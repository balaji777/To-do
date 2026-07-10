import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { sendTaskAddedEmail, sendTaskDeletedEmail } from "../email.js";

const router = Router();

const PRIORITIES = ["low", "medium", "high"];
const RECURRENCES = ["none", "daily", "weekly", "monthly"];

router.use(requireAuth);

function computeNextDueDate(dueDate, recurrence) {
  const next = new Date(dueDate);
  if (recurrence === "daily") next.setDate(next.getDate() + 1);
  else if (recurrence === "weekly") next.setDate(next.getDate() + 7);
  else if (recurrence === "monthly") next.setMonth(next.getMonth() + 1);
  return next.toISOString().slice(0, 10);
}

// True if userId may view/edit the list owned by listOwnerId: either it's their own
// list, or they're an accepted collaborator on it.
function hasListAccess(userId, listOwnerId) {
  if (userId === listOwnerId) return true;
  const row = db
    .prepare("SELECT 1 FROM collaborators WHERE list_owner_id = ? AND user_id = ? AND status = 'accepted'")
    .get(listOwnerId, userId);
  return !!row;
}

// The owner plus every accepted collaborator on their list.
function listMembers(listOwnerId) {
  const owner = db.prepare("SELECT id, email, username, nickname FROM users WHERE id = ?").get(listOwnerId);
  const collaborators = db
    .prepare(
      `SELECT users.id, users.email, users.username, users.nickname
       FROM collaborators
       JOIN users ON users.id = collaborators.user_id
       WHERE collaborators.list_owner_id = ? AND collaborators.status = 'accepted'`
    )
    .all(listOwnerId);
  return [owner, ...collaborators];
}

router.get("/", (req, res) => {
  const listOwnerId = req.query.list ? Number(req.query.list) : req.userId;
  if (!hasListAccess(req.userId, listOwnerId)) {
    return res.status(403).json({ error: "You don't have access to that list" });
  }

  const todos = db
    .prepare("SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC")
    .all(listOwnerId);
  res.json(todos);
});

router.post("/", (req, res) => {
  const { title, due_date: dueDate, priority = "medium", category, recurrence = "none", list } = req.body;
  const listOwnerId = list ? Number(list) : req.userId;

  if (!hasListAccess(req.userId, listOwnerId)) {
    return res.status(403).json({ error: "You don't have access to that list" });
  }
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }
  if (!PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: "Invalid priority" });
  }
  if (!RECURRENCES.includes(recurrence)) {
    return res.status(400).json({ error: "Invalid recurrence" });
  }

  const result = db
    .prepare(
      `INSERT INTO todos (user_id, title, due_date, priority, category, recurrence, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(listOwnerId, title.trim(), dueDate || null, priority, category?.trim() || null, recurrence, req.userId);

  const todo = db.prepare("SELECT * FROM todos WHERE id = ?").get(result.lastInsertRowid);

  listMembers(listOwnerId).forEach((member) =>
    sendTaskAddedEmail(member, todo).catch((err) => console.error("Failed to send task-added email:", err))
  );

  res.status(201).json(todo);
});

router.patch("/:id", (req, res) => {
  const todo = db.prepare("SELECT * FROM todos WHERE id = ?").get(req.params.id);

  if (!todo || !hasListAccess(req.userId, todo.user_id)) {
    return res.status(404).json({ error: "Todo not found" });
  }

  const title = req.body.title !== undefined ? req.body.title.trim() : todo.title;
  const done = req.body.done !== undefined ? (req.body.done ? 1 : 0) : todo.done;
  const dueDate = req.body.due_date !== undefined ? req.body.due_date || null : todo.due_date;
  const priority = req.body.priority !== undefined ? req.body.priority : todo.priority;
  const category = req.body.category !== undefined ? (req.body.category?.trim() || null) : todo.category;
  const recurrence = req.body.recurrence !== undefined ? req.body.recurrence : todo.recurrence;

  if (!PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: "Invalid priority" });
  }
  if (!RECURRENCES.includes(recurrence)) {
    return res.status(400).json({ error: "Invalid recurrence" });
  }

  const dueDateChanged = dueDate !== todo.due_date;
  const reminderCount = dueDateChanged ? 0 : todo.reminder_count;

  db.prepare(
    `UPDATE todos SET title = ?, done = ?, due_date = ?, priority = ?, category = ?, recurrence = ?, reminder_count = ?
     WHERE id = ?`
  ).run(title, done, dueDate, priority, category, recurrence, reminderCount, todo.id);

  const updated = db.prepare("SELECT * FROM todos WHERE id = ?").get(todo.id);

  // Just completed a recurring task with a due date: schedule the next occurrence.
  if (done === 1 && todo.done === 0 && recurrence !== "none" && dueDate) {
    const nextDueDate = computeNextDueDate(dueDate, recurrence);
    db.prepare(
      `INSERT INTO todos (user_id, title, due_date, priority, category, recurrence, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(todo.user_id, title, nextDueDate, priority, category, recurrence, todo.created_by);
  }

  res.json(updated);
});

router.delete("/:id", (req, res) => {
  const todo = db.prepare("SELECT * FROM todos WHERE id = ?").get(req.params.id);

  if (!todo || !hasListAccess(req.userId, todo.user_id)) {
    return res.status(404).json({ error: "Todo not found" });
  }

  db.prepare("DELETE FROM todos WHERE id = ?").run(todo.id);

  listMembers(todo.user_id).forEach((member) =>
    sendTaskDeletedEmail(member, todo).catch((err) => console.error("Failed to send task-deleted email:", err))
  );

  res.status(204).end();
});

export default router;
