import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { hasListAccess } from "./todos.js";

const router = Router();

router.use(requireAuth);

router.get("/", (req, res) => {
  const listOwnerId = req.query.list ? Number(req.query.list) : req.userId;
  if (!hasListAccess(req.userId, listOwnerId)) {
    return res.status(403).json({ error: "You don't have access to that list" });
  }

  const labels = db.prepare("SELECT * FROM labels WHERE user_id = ? ORDER BY name COLLATE NOCASE").all(listOwnerId);
  res.json(labels);
});

router.post("/", (req, res) => {
  const name = (req.body.name || "").trim();
  const color = (req.body.color || "").trim() || null;
  const listOwnerId = req.body.list ? Number(req.body.list) : req.userId;

  if (!hasListAccess(req.userId, listOwnerId)) {
    return res.status(403).json({ error: "You don't have access to that list" });
  }
  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  const existing = db
    .prepare("SELECT id FROM labels WHERE user_id = ? AND name = ? COLLATE NOCASE")
    .get(listOwnerId, name);
  if (existing) {
    return res.status(409).json({ error: "A label with that name already exists" });
  }

  const result = db
    .prepare("INSERT INTO labels (user_id, name, color) VALUES (?, ?, ?)")
    .run(listOwnerId, name, color);
  const label = db.prepare("SELECT * FROM labels WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(label);
});

router.patch("/:id", (req, res) => {
  const label = db.prepare("SELECT * FROM labels WHERE id = ?").get(req.params.id);
  if (!label || !hasListAccess(req.userId, label.user_id)) {
    return res.status(404).json({ error: "Label not found" });
  }

  const name = req.body.name !== undefined ? req.body.name.trim() : label.name;
  const color = req.body.color !== undefined ? req.body.color?.trim() || null : label.color;
  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  const existing = db
    .prepare("SELECT id FROM labels WHERE user_id = ? AND name = ? COLLATE NOCASE AND id != ?")
    .get(label.user_id, name, label.id);
  if (existing) {
    return res.status(409).json({ error: "A label with that name already exists" });
  }

  db.prepare("UPDATE labels SET name = ?, color = ? WHERE id = ?").run(name, color, label.id);
  res.json({ ...label, name, color });
});

router.delete("/:id", (req, res) => {
  const label = db.prepare("SELECT * FROM labels WHERE id = ?").get(req.params.id);
  if (!label || !hasListAccess(req.userId, label.user_id)) {
    return res.status(404).json({ error: "Label not found" });
  }

  // Foreign key actions aren't enforced (no PRAGMA foreign_keys), so clear references manually.
  db.prepare("DELETE FROM todo_labels WHERE label_id = ?").run(label.id);
  db.prepare("DELETE FROM labels WHERE id = ?").run(label.id);
  res.status(204).end();
});

export default router;
