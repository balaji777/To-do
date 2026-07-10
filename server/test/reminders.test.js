import { describe, it, expect, beforeEach, vi } from "vitest";
import { seedUser, getDefaultList } from "./helpers.js";
import db from "../db.js";

vi.mock("../email.js", () => ({
  sendReminderEmail: vi.fn().mockResolvedValue(undefined),
  sendRemindMeEmail: vi.fn().mockResolvedValue(undefined),
}));

const { checkRemindMe } = await import("../reminders.js");
const { sendRemindMeEmail } = await import("../email.js");

function seedTodo(user, overrides = {}) {
  const list = getDefaultList(user.id);
  const result = db
    .prepare(
      `INSERT INTO todos (user_id, list_id, title, done, remind_at, reminded)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      user.id,
      list.id,
      overrides.title ?? "Task",
      overrides.done ?? 0,
      overrides.remind_at ?? null,
      overrides.reminded ?? 0
    );
  return db.prepare("SELECT * FROM todos WHERE id = ?").get(result.lastInsertRowid);
}

describe("checkRemindMe", () => {
  let user;

  beforeEach(() => {
    vi.clearAllMocks();
    user = seedUser();
  });

  it("sends an email for a due reminder and marks it reminded", async () => {
    const todo = seedTodo(user, { remind_at: "2020-01-01T09:00" });
    await checkRemindMe();

    expect(sendRemindMeEmail).toHaveBeenCalledTimes(1);
    expect(sendRemindMeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: user.email }),
      expect.objectContaining({ id: todo.id })
    );
    expect(db.prepare("SELECT reminded FROM todos WHERE id = ?").get(todo.id).reminded).toBe(1);
  });

  it("does not send for a reminder in the future", async () => {
    seedTodo(user, { remind_at: "2099-01-01T09:00" });
    await checkRemindMe();
    expect(sendRemindMeEmail).not.toHaveBeenCalled();
  });

  it("does not send twice for the same reminder", async () => {
    seedTodo(user, { remind_at: "2020-01-01T09:00", reminded: 1 });
    await checkRemindMe();
    expect(sendRemindMeEmail).not.toHaveBeenCalled();
  });

  it("does not send for a completed task", async () => {
    seedTodo(user, { remind_at: "2020-01-01T09:00", done: 1 });
    await checkRemindMe();
    expect(sendRemindMeEmail).not.toHaveBeenCalled();
  });

  it("skips tasks with no reminder set", async () => {
    seedTodo(user);
    await checkRemindMe();
    expect(sendRemindMeEmail).not.toHaveBeenCalled();
  });
});
