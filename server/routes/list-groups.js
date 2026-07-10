import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

function nextOrdering(ownerId) {
  const row = db.prepare("SELECT COUNT(*) AS count FROM list_groups WHERE user_id = ?").get(ownerId);
  return row.count;
}

router.get("/", (req, res) => {
  const groups = db
    .prepare("SELECT * FROM list_groups WHERE user_id = ? ORDER BY ordering ASC, id ASC")
    .all(req.userId);
  res.json(groups);
});

router.post("/", (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  const result = db
    .prepare("INSERT INTO list_groups (user_id, name, ordering) VALUES (?, ?, ?)")
    .run(req.userId, name, nextOrdering(req.userId));
  const group = db.prepare("SELECT * FROM list_groups WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(group);
});

router.patch("/:id", (req, res) => {
  const group = db.prepare("SELECT * FROM list_groups WHERE id = ?").get(req.params.id);
  if (!group || group.user_id !== req.userId) {
    return res.status(404).json({ error: "Group not found" });
  }

  const name = req.body.name !== undefined ? req.body.name.trim() : group.name;
  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }
  const ordering = req.body.ordering !== undefined ? Number(req.body.ordering) : group.ordering;

  db.prepare("UPDATE list_groups SET name = ?, ordering = ? WHERE id = ?").run(name, ordering, group.id);
  res.json(db.prepare("SELECT * FROM list_groups WHERE id = ?").get(group.id));
});

router.delete("/:id", (req, res) => {
  const group = db.prepare("SELECT * FROM list_groups WHERE id = ?").get(req.params.id);
  if (!group || group.user_id !== req.userId) {
    return res.status(404).json({ error: "Group not found" });
  }

  // Ungroup its lists rather than deleting them; no PRAGMA foreign_keys, so do it by hand.
  db.prepare("UPDATE lists SET group_id = NULL WHERE group_id = ?").run(group.id);
  db.prepare("DELETE FROM list_groups WHERE id = ?").run(group.id);
  res.status(204).end();
});

export default router;
