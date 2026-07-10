import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { canAccessList } from "./todos.js";
import { uploadsDir, attachmentPath } from "../attachment-storage.js";

const router = Router();

router.use(requireAuth);

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    // Random name on disk: never trust the client's filename for paths.
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).slice(0, 16)),
  }),
  limits: { fileSize: MAX_FILE_BYTES },
});

// Multer decodes originalname as latin1; recover UTF-8 names (e.g. accents, CJK).
function originalName(file) {
  return Buffer.from(file.originalname, "latin1").toString("utf8");
}

function todoWithAccess(userId, todoId) {
  const todo = db.prepare("SELECT * FROM todos WHERE id = ?").get(todoId);
  if (!todo) return null;
  const list = db.prepare("SELECT * FROM lists WHERE id = ?").get(todo.list_id);
  return canAccessList(userId, list) ? todo : null;
}

function attachmentWithAccess(userId, attachmentId) {
  const attachment = db.prepare("SELECT * FROM attachments WHERE id = ?").get(attachmentId);
  if (!attachment) return null;
  return todoWithAccess(userId, attachment.todo_id) ? attachment : null;
}

router.get("/", (req, res) => {
  const todo = todoWithAccess(req.userId, req.query.todo);
  if (!todo) {
    return res.status(404).json({ error: "Todo not found" });
  }
  const attachments = db
    .prepare("SELECT * FROM attachments WHERE todo_id = ? ORDER BY id ASC")
    .all(todo.id);
  res.json(attachments);
});

router.post("/:todoId", (req, res) => {
  // Access is checked before multer touches the body, so strangers can't even
  // land a temp file on disk.
  const todo = todoWithAccess(req.userId, req.params.todoId);
  if (!todo) {
    return res.status(404).json({ error: "Todo not found" });
  }

  upload.single("file")(req, res, (err) => {
    if (err) {
      const message =
        err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
          ? "File is too large (10 MB max)"
          : "Upload failed";
      return res.status(400).json({ error: message });
    }
    if (!req.file) {
      return res.status(400).json({ error: "A file is required" });
    }

    const result = db
      .prepare(
        `INSERT INTO attachments (todo_id, filename, stored_name, mime_type, size_bytes, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(todo.id, originalName(req.file), req.file.filename, req.file.mimetype, req.file.size, req.userId);
    res.status(201).json(db.prepare("SELECT * FROM attachments WHERE id = ?").get(result.lastInsertRowid));
  });
});

router.get("/:id/download", (req, res) => {
  const attachment = attachmentWithAccess(req.userId, req.params.id);
  if (!attachment) {
    return res.status(404).json({ error: "Attachment not found" });
  }
  res.download(attachmentPath(attachment.stored_name), attachment.filename);
});

router.delete("/:id", (req, res) => {
  const attachment = attachmentWithAccess(req.userId, req.params.id);
  if (!attachment) {
    return res.status(404).json({ error: "Attachment not found" });
  }
  fs.rmSync(attachmentPath(attachment.stored_name), { force: true });
  db.prepare("DELETE FROM attachments WHERE id = ?").run(attachment.id);
  res.status(204).end();
});

export default router;
