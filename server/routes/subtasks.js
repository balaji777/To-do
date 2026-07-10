import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { hasListAccess } from "./todos.js";

const router = Router();

router.use(requireAuth);

function getAccessibleTodo(req, todoId) {
  const todo = db.prepare("SELECT * FROM todos WHERE id = ?").get(todoId);
  if (!todo || !hasListAccess(req.userId, todo.user_id)) return null;
  return todo;
}

router.get("/", (req, res) => {
  const todo = getAccessibleTodo(req, req.query.todo);
  if (!todo) {
    return res.status(404).json({ error: "Todo not found" });
  }

  const subtasks = db
    .prepare("SELECT * FROM subtasks WHERE todo_id = ? ORDER BY ordering ASC, id ASC")
    .all(todo.id);
  res.json(subtasks);
});

router.post("/", (req, res) => {
  const todo = getAccessibleTodo(req, req.body.todo_id);
  if (!todo) {
    return res.status(404).json({ error: "Todo not found" });
  }

  const title = (req.body.title || "").trim();
  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }

  const { count } = db.prepare("SELECT COUNT(*) AS count FROM subtasks WHERE todo_id = ?").get(todo.id);

  const result = db
    .prepare("INSERT INTO subtasks (todo_id, title, ordering) VALUES (?, ?, ?)")
    .run(todo.id, title, count);
  const subtask = db.prepare("SELECT * FROM subtasks WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(subtask);
});

router.patch("/:id", (req, res) => {
  const subtask = db.prepare("SELECT * FROM subtasks WHERE id = ?").get(req.params.id);
  if (!subtask || !getAccessibleTodo(req, subtask.todo_id)) {
    return res.status(404).json({ error: "Subtask not found" });
  }

  const title = req.body.title !== undefined ? req.body.title.trim() : subtask.title;
  const done = req.body.done !== undefined ? (req.body.done ? 1 : 0) : subtask.done;
  const ordering = req.body.ordering !== undefined ? Number(req.body.ordering) : subtask.ordering;

  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }

  db.prepare("UPDATE subtasks SET title = ?, done = ?, ordering = ? WHERE id = ?").run(
    title,
    done,
    ordering,
    subtask.id
  );
  res.json(db.prepare("SELECT * FROM subtasks WHERE id = ?").get(subtask.id));
});

router.delete("/:id", (req, res) => {
  const subtask = db.prepare("SELECT * FROM subtasks WHERE id = ?").get(req.params.id);
  if (!subtask || !getAccessibleTodo(req, subtask.todo_id)) {
    return res.status(404).json({ error: "Subtask not found" });
  }

  db.prepare("DELETE FROM subtasks WHERE id = ?").run(subtask.id);
  res.status(204).end();
});

export default router;
