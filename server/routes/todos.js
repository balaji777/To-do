import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { sendTaskAddedEmail, sendTaskDeletedEmail } from "../email.js";

const router = Router();

const PRIORITIES = ["low", "medium", "high"];
const RECURRENCES = ["none", "daily", "weekly", "monthly"];
const TYPES = ["bug", "feature", "chore", "task"];

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
export function hasListAccess(userId, listOwnerId) {
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

function isValidCategory(userId, categoryId) {
  if (categoryId == null) return true;
  return !!db.prepare("SELECT 1 FROM categories WHERE id = ? AND user_id = ?").get(categoryId, userId);
}

// Attaches labels[] and subtasks[] (and the joined category_name) to a batch of todo rows
// in two extra queries total, instead of one per todo.
function hydrateTodos(todos) {
  if (todos.length === 0) return todos;
  const ids = todos.map((t) => t.id);
  const placeholders = ids.map(() => "?").join(",");

  const labelRows = db
    .prepare(
      `SELECT todo_labels.todo_id, labels.id, labels.name, labels.color
       FROM todo_labels JOIN labels ON labels.id = todo_labels.label_id
       WHERE todo_labels.todo_id IN (${placeholders})`
    )
    .all(...ids);

  const subtaskRows = db
    .prepare(
      `SELECT id, todo_id, title, done, ordering FROM subtasks
       WHERE todo_id IN (${placeholders}) ORDER BY ordering ASC, id ASC`
    )
    .all(...ids);

  const labelsByTodo = new Map();
  for (const row of labelRows) {
    if (!labelsByTodo.has(row.todo_id)) labelsByTodo.set(row.todo_id, []);
    labelsByTodo.get(row.todo_id).push({ id: row.id, name: row.name, color: row.color });
  }

  const subtasksByTodo = new Map();
  for (const row of subtaskRows) {
    if (!subtasksByTodo.has(row.todo_id)) subtasksByTodo.set(row.todo_id, []);
    subtasksByTodo.get(row.todo_id).push({ id: row.id, title: row.title, done: row.done, ordering: row.ordering });
  }

  return todos.map((todo) => ({
    ...todo,
    labels: labelsByTodo.get(todo.id) || [],
    subtasks: subtasksByTodo.get(todo.id) || [],
  }));
}

const TODO_SELECT = `SELECT todos.*, categories.name AS category_name
                      FROM todos LEFT JOIN categories ON categories.id = todos.category_id`;

function getTodosForList(listOwnerId) {
  const todos = db.prepare(`${TODO_SELECT} WHERE todos.user_id = ? ORDER BY todos.created_at DESC`).all(listOwnerId);
  return hydrateTodos(todos);
}

function getHydratedTodo(id) {
  const todo = db.prepare(`${TODO_SELECT} WHERE todos.id = ?`).get(id);
  return todo ? hydrateTodos([todo])[0] : null;
}

router.get("/", (req, res) => {
  const listOwnerId = req.query.list ? Number(req.query.list) : req.userId;
  if (!hasListAccess(req.userId, listOwnerId)) {
    return res.status(403).json({ error: "You don't have access to that list" });
  }

  res.json(getTodosForList(listOwnerId));
});

router.post("/", (req, res) => {
  const {
    title,
    due_date: dueDate,
    priority = "medium",
    category,
    category_id: categoryId = null,
    recurrence = "none",
    type = "task",
    link,
    list,
  } = req.body;
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
  if (!TYPES.includes(type)) {
    return res.status(400).json({ error: "Invalid type" });
  }
  if (!isValidCategory(listOwnerId, categoryId)) {
    return res.status(400).json({ error: "Invalid category" });
  }

  const result = db
    .prepare(
      `INSERT INTO todos (user_id, title, due_date, priority, category, category_id, recurrence, created_by, type, link)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      listOwnerId,
      title.trim(),
      dueDate || null,
      priority,
      category?.trim() || null,
      categoryId,
      recurrence,
      req.userId,
      type,
      link?.trim() || null
    );

  const todo = getHydratedTodo(result.lastInsertRowid);

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
  const categoryId = req.body.category_id !== undefined ? req.body.category_id || null : todo.category_id;
  const recurrence = req.body.recurrence !== undefined ? req.body.recurrence : todo.recurrence;
  const type = req.body.type !== undefined ? req.body.type : todo.type;
  const link = req.body.link !== undefined ? (req.body.link?.trim() || null) : todo.link;

  if (!PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: "Invalid priority" });
  }
  if (!RECURRENCES.includes(recurrence)) {
    return res.status(400).json({ error: "Invalid recurrence" });
  }
  if (!TYPES.includes(type)) {
    return res.status(400).json({ error: "Invalid type" });
  }
  if (!isValidCategory(todo.user_id, categoryId)) {
    return res.status(400).json({ error: "Invalid category" });
  }

  const dueDateChanged = dueDate !== todo.due_date;
  const reminderCount = dueDateChanged ? 0 : todo.reminder_count;

  db.prepare(
    `UPDATE todos SET title = ?, done = ?, due_date = ?, priority = ?, category = ?, category_id = ?, recurrence = ?, reminder_count = ?, type = ?, link = ?
     WHERE id = ?`
  ).run(title, done, dueDate, priority, category, categoryId, recurrence, reminderCount, type, link, todo.id);

  // Just completed a recurring task with a due date: schedule the next occurrence.
  if (done === 1 && todo.done === 0 && recurrence !== "none" && dueDate) {
    const nextDueDate = computeNextDueDate(dueDate, recurrence);
    db.prepare(
      `INSERT INTO todos (user_id, title, due_date, priority, category, category_id, recurrence, created_by, type, link)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(todo.user_id, title, nextDueDate, priority, category, categoryId, recurrence, todo.created_by, type, link);
  }

  res.json(getHydratedTodo(todo.id));
});

router.post("/:id/labels", (req, res) => {
  const todo = db.prepare("SELECT * FROM todos WHERE id = ?").get(req.params.id);
  if (!todo || !hasListAccess(req.userId, todo.user_id)) {
    return res.status(404).json({ error: "Todo not found" });
  }

  const label = db.prepare("SELECT * FROM labels WHERE id = ? AND user_id = ?").get(req.body.label_id, todo.user_id);
  if (!label) {
    return res.status(400).json({ error: "Invalid label" });
  }

  db.prepare("INSERT OR IGNORE INTO todo_labels (todo_id, label_id) VALUES (?, ?)").run(todo.id, label.id);
  res.status(201).json(getHydratedTodo(todo.id));
});

router.delete("/:id/labels/:labelId", (req, res) => {
  const todo = db.prepare("SELECT * FROM todos WHERE id = ?").get(req.params.id);
  if (!todo || !hasListAccess(req.userId, todo.user_id)) {
    return res.status(404).json({ error: "Todo not found" });
  }

  db.prepare("DELETE FROM todo_labels WHERE todo_id = ? AND label_id = ?").run(todo.id, req.params.labelId);
  res.json(getHydratedTodo(todo.id));
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
