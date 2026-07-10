import cron from "node-cron";
import db from "./db.js";
import { sendReminderEmail, sendRemindMeEmail } from "./email.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysUntil(dueDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.round((due - today) / MS_PER_DAY);
}

// Reminder 1: 3 days before due. Reminder 2: 1 day before due. Reminder 3: on the due date.
function nextReminderDue(daysLeft, reminderCount) {
  if (reminderCount === 0 && daysLeft <= 3) return 1;
  if (reminderCount === 1 && daysLeft <= 1) return 2;
  if (reminderCount === 2 && daysLeft <= 0) return 3;
  return null;
}

export async function checkReminders() {
  const todos = db
    .prepare(
      `SELECT todos.*, users.email AS user_email, users.username AS user_username, users.nickname AS user_nickname
       FROM todos
       JOIN users ON users.id = todos.user_id
       WHERE todos.done = 0 AND todos.due_date IS NOT NULL AND todos.reminder_count < 3`
    )
    .all();

  for (const todo of todos) {
    const daysLeft = daysUntil(todo.due_date);
    const reminderNumber = nextReminderDue(daysLeft, todo.reminder_count);
    if (!reminderNumber) continue;

    await sendReminderEmail(
      { email: todo.user_email, username: todo.user_username, nickname: todo.user_nickname },
      todo,
      reminderNumber
    );
    db.prepare("UPDATE todos SET reminder_count = ? WHERE id = ?").run(reminderNumber, todo.id);
  }
}

// "Remind me" values come from a datetime-local input with no timezone, so compare
// against the server's local wall-clock time in the same YYYY-MM-DDTHH:MM shape
// (string comparison is safe for this format).
function localDateTimeStr() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export async function checkRemindMe() {
  const todos = db
    .prepare(
      `SELECT todos.*, users.email AS user_email, users.username AS user_username, users.nickname AS user_nickname
       FROM todos
       JOIN users ON users.id = todos.user_id
       WHERE todos.done = 0 AND todos.reminded = 0 AND todos.remind_at IS NOT NULL AND todos.remind_at <= ?`
    )
    .all(localDateTimeStr());

  for (const todo of todos) {
    await sendRemindMeEmail(
      { email: todo.user_email, username: todo.user_username, nickname: todo.user_nickname },
      todo
    );
    db.prepare("UPDATE todos SET reminded = 1 WHERE id = ?").run(todo.id);
  }
}

export function startReminderScheduler() {
  // Due-date escalation runs daily at 9am server time.
  cron.schedule("0 9 * * *", () => {
    checkReminders().catch((err) => console.error("Reminder check failed:", err));
  });

  // "Remind me" times are minute-precise, so poll every minute (cheap indexed-ish
  // query against a small SQLite table).
  cron.schedule("* * * * *", () => {
    checkRemindMe().catch((err) => console.error("Remind-me check failed:", err));
  });
}
