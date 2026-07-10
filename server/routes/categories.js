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

  const categories = db
    .prepare("SELECT * FROM categories WHERE user_id = ? ORDER BY name COLLATE NOCASE")
    .all(listOwnerId);
  res.json(categories);
});

router.post("/", (req, res) => {
  const name = (req.body.name || "").trim();
  const listOwnerId = req.body.list ? Number(req.body.list) : req.userId;

  if (!hasListAccess(req.userId, listOwnerId)) {
    return res.status(403).json({ error: "You don't have access to that list" });
  }
  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  const existing = db
    .prepare("SELECT id FROM categories WHERE user_id = ? AND name = ? COLLATE NOCASE")
    .get(listOwnerId, name);
  if (existing) {
    return res.status(409).json({ error: "A category with that name already exists" });
  }

  const result = db.prepare("INSERT INTO categories (user_id, name) VALUES (?, ?)").run(listOwnerId, name);
  const category = db.prepare("SELECT * FROM categories WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(category);
});

router.patch("/:id", (req, res) => {
  const category = db.prepare("SELECT * FROM categories WHERE id = ?").get(req.params.id);
  if (!category || !hasListAccess(req.userId, category.user_id)) {
    return res.status(404).json({ error: "Category not found" });
  }

  const name = (req.body.name || "").trim();
  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  const existing = db
    .prepare("SELECT id FROM categories WHERE user_id = ? AND name = ? COLLATE NOCASE AND id != ?")
    .get(category.user_id, name, category.id);
  if (existing) {
    return res.status(409).json({ error: "A category with that name already exists" });
  }

  db.prepare("UPDATE categories SET name = ? WHERE id = ?").run(name, category.id);
  res.json({ ...category, name });
});

router.delete("/:id", (req, res) => {
  const category = db.prepare("SELECT * FROM categories WHERE id = ?").get(req.params.id);
  if (!category || !hasListAccess(req.userId, category.user_id)) {
    return res.status(404).json({ error: "Category not found" });
  }

  // Foreign key actions aren't enforced (no PRAGMA foreign_keys), so clear references manually.
  db.prepare("UPDATE todos SET category_id = NULL WHERE category_id = ?").run(category.id);
  db.prepare("DELETE FROM categories WHERE id = ?").run(category.id);
  res.status(204).end();
});

export default router;
