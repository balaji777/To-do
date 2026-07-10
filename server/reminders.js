import cron from "node-cron";
import db from "./db.js";
import { sendReminderEmail } from "./email.js";

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

export function startReminderScheduler() {
  // Runs daily at 9am server time.
  cron.schedule("0 9 * * *", () => {
    checkReminders().catch((err) => console.error("Reminder check failed:", err));
  });
}
