import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/", (req, res) => {
  const todos = db
    .prepare("SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC")
    .all(req.userId);
  res.json(todos);
});

router.post("/", (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }

  const result = db
    .prepare("INSERT INTO todos (user_id, title) VALUES (?, ?)")
    .run(req.userId, title.trim());

  const todo = db.prepare("SELECT * FROM todos WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(todo);
});

router.patch("/:id", (req, res) => {
  const todo = db
    .prepare("SELECT * FROM todos WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.userId);

  if (!todo) {
    return res.status(404).json({ error: "Todo not found" });
  }

  const title = req.body.title !== undefined ? req.body.title.trim() : todo.title;
  const done = req.body.done !== undefined ? (req.body.done ? 1 : 0) : todo.done;

  db.prepare("UPDATE todos SET title = ?, done = ? WHERE id = ?").run(title, done, todo.id);

  res.json({ ...todo, title, done });
});

router.delete("/:id", (req, res) => {
  const result = db
    .prepare("DELETE FROM todos WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Todo not found" });
  }

  res.status(204).end();
});

export default router;
