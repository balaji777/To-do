import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensures the given user has a default "Tasks" list (the one MS To-Do-style list that
// can't be deleted), creating it if missing. Returns its id either way.
function ensureDefaultList(db, userId) {
  const existing = db.prepare("SELECT id FROM lists WHERE user_id = ? AND is_default = 1").get(userId);
  if (existing) return existing.id;
  const result = db.prepare("INSERT INTO lists (user_id, name, is_default) VALUES (?, 'Tasks', 1)").run(userId);
  return result.lastInsertRowid;
}

export function createDb(dbPath) {
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  // Every route in this app manually cascades deletes to child rows instead of relying on
  // ON DELETE clauses (see the "Foreign key actions aren't enforced" comments throughout
  // routes/*.js) - make that explicit, since some SQLite builds default this pragma to ON,
  // and a stale REFERENCES clause pointing at a since-dropped table (e.g. the removed
  // `categories` table) would otherwise break every INSERT into the referencing table.
  db.pragma("foreign_keys = OFF");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      google_id TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      due_date TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      recurrence TEXT NOT NULL DEFAULT 'none',
      reminder_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS collaborators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(list_owner_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      ordering INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      paid_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      split_type TEXT NOT NULL DEFAULT 'equal',
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expense_shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      share_cents INTEGER NOT NULL,
      UNIQUE(expense_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS list_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      ordering INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      group_id INTEGER REFERENCES list_groups(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      ordering INTEGER NOT NULL DEFAULT 0,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS list_shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(list_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT,
      size_bytes INTEGER NOT NULL,
      uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Dev-planner-era features (categories, labels, task type/link) have been removed in
  // favor of a Microsoft To-Do-style model (lists, groups, My Day, Important, notes).
  db.exec(`
    DROP TABLE IF EXISTS todo_labels;
    DROP TABLE IF EXISTS labels;
    DROP TABLE IF EXISTS categories;
  `);

  // Idempotent migrations for databases created before these columns/constraints existed.
  function ensureColumn(table, column, definition) {
    const existing = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!existing.some((col) => col.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }

  // password_hash used to be NOT NULL; Google-only accounts need it nullable.
  // SQLite can't drop a NOT NULL constraint via ALTER, so rebuild the table when needed.
  const passwordHashCol = db.prepare("PRAGMA table_info(users)").all().find((c) => c.name === "password_hash");
  if (passwordHashCol && passwordHashCol.notnull === 1) {
    db.exec(`
      ALTER TABLE users RENAME TO users_old;
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        google_id TEXT UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO users (id, username, email, password_hash, created_at)
        SELECT id, username, email, password_hash, created_at FROM users_old;
      DROP TABLE users_old;
    `);
  }

  ensureColumn("users", "email", "TEXT");
  ensureColumn("users", "google_id", "TEXT");
  ensureColumn("users", "nickname", "TEXT");
  ensureColumn("users", "email_verified", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("users", "verification_token", "TEXT");
  ensureColumn("users", "verification_expires_at", "TEXT");
  ensureColumn("todos", "due_date", "TEXT");
  ensureColumn("todos", "priority", "TEXT NOT NULL DEFAULT 'medium'");
  ensureColumn("todos", "recurrence", "TEXT NOT NULL DEFAULT 'none'");
  ensureColumn("todos", "reminder_count", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("todos", "created_by", "INTEGER");
  ensureColumn("todos", "list_id", "INTEGER REFERENCES lists(id) ON DELETE CASCADE");
  ensureColumn("todos", "important", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("todos", "notes", "TEXT");
  ensureColumn("todos", "my_day_date", "TEXT");
  ensureColumn("todos", "remind_at", "TEXT");
  ensureColumn("todos", "reminded", "INTEGER NOT NULL DEFAULT 0");

  // One-time backfill: every user gets a default "Tasks" list, and every todo that
  // predates the lists table gets attached to its owner's default list. Idempotent -
  // only touches users/todos not already migrated, so it's a no-op after the first run.
  const usersWithoutDefaultList = db
    .prepare("SELECT id FROM users WHERE id NOT IN (SELECT user_id FROM lists WHERE is_default = 1)")
    .all();
  for (const user of usersWithoutDefaultList) {
    ensureDefaultList(db, user.id);
  }

  const orphanedTodos = db.prepare("SELECT id, user_id FROM todos WHERE list_id IS NULL").all();
  for (const todo of orphanedTodos) {
    const listId = ensureDefaultList(db, todo.user_id);
    db.prepare("UPDATE todos SET list_id = ? WHERE id = ?").run(listId, todo.id);
  }

  return db;
}

const db = createDb(process.env.DB_PATH || path.join(__dirname, "todo.db"));

// Used by auth.js so every newly created account starts with its default "Tasks" list.
export function ensureDefaultListForUser(userId) {
  return ensureDefaultList(db, userId);
}

export default db;
