import { visibleTodos, isOverdue } from "./todoMeta";

function todo(overrides = {}) {
  return {
    id: 1,
    title: "Write report",
    done: 0,
    due_date: null,
    priority: "medium",
    recurrence: "none",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("visibleTodos", () => {
  it("filters by search text (case-insensitive)", () => {
    const todos = [todo({ title: "Fix bug" }), todo({ id: 2, title: "Write docs" })];
    expect(visibleTodos(todos, { search: "fix" })).toHaveLength(1);
    expect(visibleTodos(todos, { search: "FIX" })).toHaveLength(1);
  });

  it("sorts by due date ascending, undated items last", () => {
    const todos = [
      todo({ id: 1, due_date: "2026-02-01" }),
      todo({ id: 2, due_date: null }),
      todo({ id: 3, due_date: "2026-01-01" }),
    ];
    const sorted = visibleTodos(todos, { sortBy: "due" }).map((t) => t.id);
    expect(sorted).toEqual([3, 1, 2]);
  });

  it("sorts by priority (high, medium, low)", () => {
    const todos = [
      todo({ id: 1, priority: "low" }),
      todo({ id: 2, priority: "high" }),
      todo({ id: 3, priority: "medium" }),
    ];
    const sorted = visibleTodos(todos, { sortBy: "priority" }).map((t) => t.id);
    expect(sorted).toEqual([2, 3, 1]);
  });

  it("sorts by newest created first", () => {
    const todos = [
      todo({ id: 1, created_at: "2026-01-01T00:00:00.000Z" }),
      todo({ id: 2, created_at: "2026-03-01T00:00:00.000Z" }),
    ];
    const sorted = visibleTodos(todos, { sortBy: "created" }).map((t) => t.id);
    expect(sorted).toEqual([2, 1]);
  });
});

describe("isOverdue", () => {
  it("is false when there's no due date", () => {
    expect(isOverdue(todo({ due_date: null }))).toBe(false);
  });

  it("is false when already done, even if the due date passed", () => {
    expect(isOverdue(todo({ due_date: "2020-01-01", done: 1 }))).toBe(false);
  });

  it("is true for a past due date on an incomplete todo", () => {
    expect(isOverdue(todo({ due_date: "2020-01-01", done: 0 }))).toBe(true);
  });

  it("is false for a future due date", () => {
    expect(isOverdue(todo({ due_date: "2099-01-01", done: 0 }))).toBe(false);
  });
});
