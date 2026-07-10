import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { createDb } from "../db.js";

function cleanupDbFile(dbPath) {
  for (const suffix of ["", "-wal", "-shm"]) {
    const file = dbPath + suffix;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}

function tmpDbPath() {
  return path.join(os.tmpdir(), `migration-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
}

describe("default list backfill migration", () => {
  it("gives every existing user a default list and attaches their orphaned todos to it", () => {
    const dbPath = tmpDbPath();

    // Simulate a pre-migration database: users/todos with no lists table and no list_id column yet.
    const legacyDb = new Database(dbPath);
    legacyDb.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        google_id TEXT UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        done INTEGER NOT NULL DEFAULT 0,
        due_date TEXT,
        priority TEXT NOT NULL DEFAULT 'medium',
        recurrence TEXT NOT NULL DEFAULT 'none',
        reminder_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const userId = legacyDb
      .prepare("INSERT INTO users (username, email) VALUES (?, ?)")
      .run("alice", "alice@example.com").lastInsertRowid;
    legacyDb.prepare("INSERT INTO todos (user_id, title) VALUES (?, ?)").run(userId, "Fix crash");
    legacyDb.prepare("INSERT INTO todos (user_id, title) VALUES (?, ?)").run(userId, "Fix crash 2");
    legacyDb.close();

    try {
      const migrated = createDb(dbPath);

      const lists = migrated.prepare("SELECT * FROM lists WHERE user_id = ?").all(userId);
      expect(lists).toHaveLength(1);
      expect(lists[0].name).toBe("Tasks");
      expect(lists[0].is_default).toBe(1);

      const todos = migrated.prepare("SELECT * FROM todos WHERE user_id = ? ORDER BY id").all(userId);
      expect(todos[0].list_id).toBe(lists[0].id);
      expect(todos[1].list_id).toBe(lists[0].id);

      migrated.close();

      // Re-running the migration (as happens on every server restart) must not duplicate lists.
      const remigrated = createDb(dbPath);
      const listsAfterRerun = remigrated.prepare("SELECT * FROM lists WHERE user_id = ?").all(userId);
      expect(listsAfterRerun).toHaveLength(1);
      remigrated.close();
    } finally {
      cleanupDbFile(dbPath);
    }
  });

  it("gives a user with zero todos a default list too", () => {
    const dbPath = tmpDbPath();

    try {
      const db = createDb(dbPath);
      const userId = db
        .prepare("INSERT INTO users (username, email) VALUES (?, ?)")
        .run("bob", "bob@example.com").lastInsertRowid;

      // The INSERT above ran before this createDb call's own migration pass, so run it again
      // the way a server restart would, to backfill the list for this brand-new user row.
      db.close();
      const remigrated = createDb(dbPath);
      const list = remigrated.prepare("SELECT * FROM lists WHERE user_id = ? AND is_default = 1").get(userId);
      expect(list).toBeTruthy();
      expect(list.name).toBe("Tasks");
      remigrated.close();
    } finally {
      cleanupDbFile(dbPath);
    }
  });

  it("drops the legacy categories/labels tables if they exist", () => {
    const dbPath = tmpDbPath();

    const legacyDb = new Database(dbPath);
    legacyDb.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        google_id TEXT UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT);
      CREATE TABLE labels (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT);
      CREATE TABLE todo_labels (todo_id INTEGER, label_id INTEGER);
    `);
    legacyDb.close();

    try {
      const migrated = createDb(dbPath);
      const tables = migrated
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('categories', 'labels', 'todo_labels')")
        .all();
      expect(tables).toHaveLength(0);
      migrated.close();
    } finally {
      cleanupDbFile(dbPath);
    }
  });
});
