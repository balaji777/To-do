import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { sendTaskAddedEmail, sendTaskDeletedEmail } from "../email.js";

const router = Router();

const PRIORITIES = ["low", "medium", "high"];
const RECURRENCES = ["none", "daily", "weekly", "monthly"];

router.use(requireAuth);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function computeNextDueDate(dueDate, recurrence) {
  const next = new Date(dueDate);
  if (recurrence === "daily") next.setDate(next.getDate() + 1);
  else if (recurrence === "weekly") next.setDate(next.getDate() + 7);
  else if (recurrence === "monthly") next.setMonth(next.getMonth() + 1);
  return next.toISOString().slice(0, 10);
}

// True if userId may view/edit anything owned by ownerId's account: either it's their
// own account, or they're an accepted collaborator on it.
export function hasListAccess(userId, ownerId) {
  if (userId === ownerId) return true;
  const row = db
    .prepare("SELECT 1 FROM collaborators WHERE list_owner_id = ? AND user_id = ? AND status = 'accepted'")
    .get(ownerId, userId);
  return !!row;
}

// The owner plus every accepted collaborator on their account.
function listMembers(ownerId) {
  const owner = db.prepare("SELECT id, email, username, nickname FROM users WHERE id = ?").get(ownerId);
  const collaborators = db
    .prepare(
      `SELECT users.id, users.email, users.username, users.nickname
       FROM collaborators
       JOIN users ON users.id = collaborators.user_id
       WHERE collaborators.list_owner_id = ? AND collaborators.status = 'accepted'`
    )
    .all(ownerId);
  return [owner, ...collaborators];
}

function getDefaultListId(ownerId) {
  const list = db.prepare("SELECT id FROM lists WHERE user_id = ? AND is_default = 1").get(ownerId);
  return list ? list.id : null;
}

// Attaches subtasks[] to a batch of todo rows in one extra query instead of one per todo.
function hydrateTodos(todos) {
  if (todos.length === 0) return todos;
  const ids = todos.map((t) => t.id);
  const placeholders = ids.map(() => "?").join(",");

  const subtaskRows = db
    .prepare(
      `SELECT id, todo_id, title, done, ordering FROM subtasks
       WHERE todo_id IN (${placeholders}) ORDER BY ordering ASC, id ASC`
    )
    .all(...ids);

  const subtasksByTodo = new Map();
  for (const row of subtaskRows) {
    if (!subtasksByTodo.has(row.todo_id)) subtasksByTodo.set(row.todo_id, []);
    subtasksByTodo.get(row.todo_id).push({ id: row.id, title: row.title, done: row.done, ordering: row.ordering });
  }

  return todos.map((todo) => ({
    ...todo,
    subtasks: subtasksByTodo.get(todo.id) || [],
  }));
}

const TODO_SELECT = "SELECT todos.* FROM todos";
const TODO_SELECT_WITH_LIST = `SELECT todos.*, lists.name AS list_name
                                FROM todos JOIN lists ON lists.id = todos.list_id`;

function getTodosForList(listId) {
  const todos = db.prepare(`${TODO_SELECT} WHERE todos.list_id = ? ORDER BY todos.created_at DESC`).all(listId);
  return hydrateTodos(todos);
}

function getHydratedTodo(id) {
  const todo = db.prepare(`${TODO_SELECT} WHERE todos.id = ?`).get(id);
  return todo ? hydrateTodos([todo])[0] : null;
}

function getSmartView(ownerId, whereClause, extraParams = []) {
  const todos = db
    .prepare(`${TODO_SELECT_WITH_LIST} WHERE lists.user_id = ? AND ${whereClause} ORDER BY todos.created_at DESC`)
    .all(ownerId, ...extraParams);
  return hydrateTodos(todos);
}

// Resolves the list a request should operate on: an explicit list_id if given and valid,
// else the requesting user's own default list.
function resolveList(rawListId, requesterId) {
  const listId = rawListId ? Number(rawListId) : null;
  const list = listId ? db.prepare("SELECT * FROM lists WHERE id = ?").get(listId) : null;
  if (list) return list;

  const defaultListId = getDefaultListId(requesterId);
  return defaultListId ? db.prepare("SELECT * FROM lists WHERE id = ?").get(defaultListId) : null;
}

router.get("/", (req, res) => {
  const list = resolveList(req.query.list_id, req.userId);
  if (!list) {
    return res.status(404).json({ error: "List not found" });
  }
  if (!hasListAccess(req.userId, list.user_id)) {
    return res.status(403).json({ error: "You don't have access to that list" });
  }

  res.json(getTodosForList(list.id));
});

router.get("/my-day", (req, res) => {
  const ownerId = req.query.owner ? Number(req.query.owner) : req.userId;
  if (!hasListAccess(req.userId, ownerId)) {
    return res.status(403).json({ error: "You don't have access to that account" });
  }
  res.json(getSmartView(ownerId, "todos.my_day_date = ?", [todayStr()]));
});

router.get("/important", (req, res) => {
  const ownerId = req.query.owner ? Number(req.query.owner) : req.userId;
  if (!hasListAccess(req.userId, ownerId)) {
    return res.status(403).json({ error: "You don't have access to that account" });
  }
  res.json(getSmartView(ownerId, "todos.important = 1 AND todos.done = 0"));
});

router.get("/planned", (req, res) => {
  const ownerId = req.query.owner ? Number(req.query.owner) : req.userId;
  if (!hasListAccess(req.userId, ownerId)) {
    return res.status(403).json({ error: "You don't have access to that account" });
  }
  res.json(getSmartView(ownerId, "todos.due_date IS NOT NULL AND todos.done = 0"));
});

router.post("/", (req, res) => {
  const {
    title,
    due_date: dueDate,
    priority = "medium",
    recurrence = "none",
    important,
    notes,
    my_day: myDay,
  } = req.body;

  const list = resolveList(req.body.list_id, req.userId);
  if (!list) {
    return res.status(400).json({ error: "Invalid list" });
  }
  if (!hasListAccess(req.userId, list.user_id)) {
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
      `INSERT INTO todos (user_id, list_id, title, due_date, priority, recurrence, created_by, important, notes, my_day_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      list.user_id,
      list.id,
      title.trim(),
      dueDate || null,
      priority,
      recurrence,
      req.userId,
      important ? 1 : 0,
      notes?.trim() || null,
      myDay ? todayStr() : null
    );

  const todo = getHydratedTodo(result.lastInsertRowid);

  listMembers(list.user_id).forEach((member) =>
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
  const recurrence = req.body.recurrence !== undefined ? req.body.recurrence : todo.recurrence;
  const important = req.body.important !== undefined ? (req.body.important ? 1 : 0) : todo.important;
  const notes = req.body.notes !== undefined ? req.body.notes?.trim() || null : todo.notes;
  const myDayDate = req.body.my_day !== undefined ? (req.body.my_day ? todayStr() : null) : todo.my_day_date;

  let listId = todo.list_id;
  if (req.body.list_id !== undefined) {
    const newList = db.prepare("SELECT * FROM lists WHERE id = ?").get(req.body.list_id);
    if (!newList || newList.user_id !== todo.user_id) {
      return res.status(400).json({ error: "Invalid list" });
    }
    listId = newList.id;
  }

  if (!PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: "Invalid priority" });
  }
  if (!RECURRENCES.includes(recurrence)) {
    return res.status(400).json({ error: "Invalid recurrence" });
  }

  const dueDateChanged = dueDate !== todo.due_date;
  const reminderCount = dueDateChanged ? 0 : todo.reminder_count;

  db.prepare(
    `UPDATE todos SET title = ?, done = ?, due_date = ?, priority = ?, recurrence = ?, reminder_count = ?,
     important = ?, notes = ?, my_day_date = ?, list_id = ?
     WHERE id = ?`
  ).run(title, done, dueDate, priority, recurrence, reminderCount, important, notes, myDayDate, listId, todo.id);

  // Just completed a recurring task with a due date: schedule the next occurrence.
  if (done === 1 && todo.done === 0 && recurrence !== "none" && dueDate) {
    const nextDueDate = computeNextDueDate(dueDate, recurrence);
    db.prepare(
      `INSERT INTO todos (user_id, list_id, title, due_date, priority, recurrence, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(todo.user_id, listId, title, nextDueDate, priority, recurrence, todo.created_by);
  }

  res.json(getHydratedTodo(todo.id));
});

router.delete("/:id", (req, res) => {
  const todo = db.prepare("SELECT * FROM todos WHERE id = ?").get(req.params.id);

  if (!todo || !hasListAccess(req.userId, todo.user_id)) {
    return res.status(404).json({ error: "Todo not found" });
  }

  db.prepare("DELETE FROM subtasks WHERE todo_id = ?").run(todo.id);
  db.prepare("DELETE FROM todos WHERE id = ?").run(todo.id);

  listMembers(todo.user_id).forEach((member) =>
    sendTaskDeletedEmail(member, todo).catch((err) => console.error("Failed to send task-deleted email:", err))
  );

  res.status(204).end();
});

export default router;
