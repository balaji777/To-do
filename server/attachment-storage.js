import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import db from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Like DB_PATH: hosts with a separate persistent disk can point uploads somewhere
// durable (e.g. /var/data/uploads on Render). Defaults to server/uploads.
export const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

export function attachmentPath(storedName) {
  return path.join(uploadsDir, storedName);
}

// Removes both the disk files and the rows for every attachment on the given todos.
// Called from the todo/list delete routes, which cascade child rows by hand.
export function deleteAttachmentsForTodoIds(todoIds) {
  if (todoIds.length === 0) return;
  const placeholders = todoIds.map(() => "?").join(",");
  const rows = db.prepare(`SELECT stored_name FROM attachments WHERE todo_id IN (${placeholders})`).all(...todoIds);
  for (const row of rows) {
    fs.rmSync(attachmentPath(row.stored_name), { force: true });
  }
  db.prepare(`DELETE FROM attachments WHERE todo_id IN (${placeholders})`).run(...todoIds);
}
