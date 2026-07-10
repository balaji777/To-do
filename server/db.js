import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createDb(dbPath) {
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");

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
      category TEXT,
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

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, name COLLATE NOCASE)
    );

    CREATE TABLE IF NOT EXISTS labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, name COLLATE NOCASE)
    );

    CREATE TABLE IF NOT EXISTS todo_labels (
      todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
      PRIMARY KEY (todo_id, label_id)
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      ordering INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
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
  ensureColumn("todos", "category", "TEXT");
  ensureColumn("todos", "recurrence", "TEXT NOT NULL DEFAULT 'none'");
  ensureColumn("todos", "reminder_count", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("todos", "created_by", "INTEGER");
  ensureColumn("todos", "type", "TEXT NOT NULL DEFAULT 'task'");
  ensureColumn("todos", "link", "TEXT");
  ensureColumn("todos", "category_id", "INTEGER REFERENCES categories(id) ON DELETE SET NULL");

  // One-time backfill: turn the legacy free-text `category` column into rows in the new
  // `categories` table. Idempotent - only touches todos that haven't been linked yet, so it's
  // a no-op on every boot after the first.
  const legacyCategoryRows = db
    .prepare("SELECT id, user_id, category FROM todos WHERE category_id IS NULL AND category IS NOT NULL")
    .all();
  if (legacyCategoryRows.length > 0) {
    const insertCategory = db.prepare("INSERT OR IGNORE INTO categories (user_id, name) VALUES (?, ?)");
    const findCategory = db.prepare("SELECT id FROM categories WHERE user_id = ? AND name = ? COLLATE NOCASE");
    const linkTodo = db.prepare("UPDATE todos SET category_id = ? WHERE id = ?");

    for (const row of legacyCategoryRows) {
      const name = row.category.trim();
      if (!name) continue;
      insertCategory.run(row.user_id, name);
      const category = findCategory.get(row.user_id, name);
      if (category) linkTodo.run(category.id, row.id);
    }
  }

  return db;
}

const db = createDb(process.env.DB_PATH || path.join(__dirname, "todo.db"));

export default db;
