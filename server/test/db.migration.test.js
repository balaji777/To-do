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

describe("category backfill migration", () => {
  it("links legacy free-text categories into the categories table, idempotently", () => {
    const dbPath = path.join(os.tmpdir(), `migration-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

    // Simulate a pre-migration database: users/todos with a legacy free-text category column,
    // no categories table and no category_id column yet.
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
        category TEXT,
        recurrence TEXT NOT NULL DEFAULT 'none',
        reminder_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const userId = legacyDb
      .prepare("INSERT INTO users (username, email) VALUES (?, ?)")
      .run("alice", "alice@example.com").lastInsertRowid;
    legacyDb.prepare("INSERT INTO todos (user_id, title, category) VALUES (?, ?, ?)").run(userId, "Fix crash", "Bug fixes");
    legacyDb
      .prepare("INSERT INTO todos (user_id, title, category) VALUES (?, ?, ?)")
      .run(userId, "Fix crash 2", "bug fixes "); // same category, different case/whitespace
    legacyDb.close();

    try {
      // Run the real migration path (schema creation + backfill) against this legacy file.
      const migrated = createDb(dbPath);

      const categories = migrated.prepare("SELECT * FROM categories WHERE user_id = ?").all(userId);
      expect(categories).toHaveLength(1);
      expect(categories[0].name).toBe("Bug fixes");

      const todos = migrated.prepare("SELECT * FROM todos WHERE user_id = ? ORDER BY id").all(userId);
      expect(todos[0].category_id).toBe(categories[0].id);
      expect(todos[1].category_id).toBe(categories[0].id);

      migrated.close();

      // Re-running the migration (as happens on every server restart) must not duplicate categories.
      const remigrated = createDb(dbPath);
      const categoriesAfterRerun = remigrated.prepare("SELECT * FROM categories WHERE user_id = ?").all(userId);
      expect(categoriesAfterRerun).toHaveLength(1);
      remigrated.close();
    } finally {
      cleanupDbFile(dbPath);
    }
  });

  it("leaves todos without a category untouched", () => {
    const dbPath = path.join(os.tmpdir(), `migration-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

    try {
      const db = createDb(dbPath);
      const userId = db
        .prepare("INSERT INTO users (username, email) VALUES (?, ?)")
        .run("bob", "bob@example.com").lastInsertRowid;
      db.prepare("INSERT INTO todos (user_id, title) VALUES (?, ?)").run(userId, "No category");

      const todo = db.prepare("SELECT * FROM todos WHERE user_id = ?").get(userId);
      expect(todo.category_id).toBeNull();
      expect(db.prepare("SELECT COUNT(*) AS count FROM categories WHERE user_id = ?").get(userId).count).toBe(0);

      db.close();
    } finally {
      cleanupDbFile(dbPath);
    }
  });
});
