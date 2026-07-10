import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { canAccessList } from "./todos.js";
import { deleteAttachmentsForTodoIds } from "../attachment-storage.js";

const router = Router();

router.use(requireAuth);

function nextOrdering(ownerId) {
  const row = db.prepare("SELECT COUNT(*) AS count FROM lists WHERE user_id = ?").get(ownerId);
  return row.count;
}

router.get("/", (req, res) => {
  const lists = db
    .prepare("SELECT * FROM lists WHERE user_id = ? ORDER BY ordering ASC, id ASC")
    .all(req.userId);
  res.json(lists);
});

router.post("/", (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  const groupId = req.body.group_id || null;
  if (groupId) {
    const group = db.prepare("SELECT * FROM list_groups WHERE id = ? AND user_id = ?").get(groupId, req.userId);
    if (!group) {
      return res.status(400).json({ error: "Invalid group" });
    }
  }

  const result = db
    .prepare("INSERT INTO lists (user_id, group_id, name, ordering) VALUES (?, ?, ?, ?)")
    .run(req.userId, groupId, name, nextOrdering(req.userId));
  const list = db.prepare("SELECT * FROM lists WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(list);
});

router.patch("/:id", (req, res) => {
  const list = db.prepare("SELECT * FROM lists WHERE id = ?").get(req.params.id);
  if (!list || !canAccessList(req.userId, list)) {
    return res.status(404).json({ error: "List not found" });
  }

  const name = req.body.name !== undefined ? req.body.name.trim() : list.name;
  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  let groupId = req.body.group_id !== undefined ? req.body.group_id || null : list.group_id;
  if (groupId) {
    const group = db.prepare("SELECT * FROM list_groups WHERE id = ? AND user_id = ?").get(groupId, list.user_id);
    if (!group) {
      return res.status(400).json({ error: "Invalid group" });
    }
  }

  const ordering = req.body.ordering !== undefined ? Number(req.body.ordering) : list.ordering;

  db.prepare("UPDATE lists SET name = ?, group_id = ?, ordering = ? WHERE id = ?").run(
    name,
    groupId,
    ordering,
    list.id
  );
  res.json(db.prepare("SELECT * FROM lists WHERE id = ?").get(list.id));
});

router.delete("/:id", (req, res) => {
  const list = db.prepare("SELECT * FROM lists WHERE id = ?").get(req.params.id);
  if (!list || !canAccessList(req.userId, list)) {
    return res.status(404).json({ error: "List not found" });
  }

  if (list.is_default) {
    return res.status(400).json({ error: "The default list can't be deleted" });
  }

  const listCount = db.prepare("SELECT COUNT(*) AS count FROM lists WHERE user_id = ?").get(list.user_id).count;
  if (listCount <= 1) {
    return res.status(400).json({ error: "You must have at least one list" });
  }

  // Foreign key actions aren't enforced (no PRAGMA foreign_keys), so clear child rows manually.
  const todoIds = db.prepare("SELECT id FROM todos WHERE list_id = ?").all(list.id).map((t) => t.id);
  deleteAttachmentsForTodoIds(todoIds);
  db.prepare("DELETE FROM subtasks WHERE todo_id IN (SELECT id FROM todos WHERE list_id = ?)").run(list.id);
  db.prepare("DELETE FROM todos WHERE list_id = ?").run(list.id);
  db.prepare("DELETE FROM list_shares WHERE list_id = ?").run(list.id);
  db.prepare("DELETE FROM lists WHERE id = ?").run(list.id);
  res.status(204).end();
});

export default router;
