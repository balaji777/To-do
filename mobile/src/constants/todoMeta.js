export const PRIORITY_STYLES = {
  low: "bg-emerald-100 dark:bg-emerald-900/40",
  medium: "bg-amber-100 dark:bg-amber-900/40",
  high: "bg-rose-100 dark:bg-rose-900/40",
};

export const PRIORITY_TEXT_STYLES = {
  low: "text-emerald-700 dark:text-emerald-300",
  medium: "text-amber-700 dark:text-amber-300",
  high: "text-rose-700 dark:text-rose-300",
};

export const RECURRENCE_LABELS = {
  none: null,
  daily: "Repeats daily",
  weekly: "Repeats weekly",
  monthly: "Repeats monthly",
};

export function isOverdue(todo) {
  if (!todo.due_date || todo.done) return false;
  const due = new Date(todo.due_date);
  due.setHours(23, 59, 59, 999);
  return due < new Date();
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export function visibleTodos(todos, { search = "", sortBy = "due" } = {}) {
  return todos
    .filter((t) => t.title.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "priority") {
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      }
      if (sortBy === "created") {
        return new Date(b.created_at) - new Date(a.created_at);
      }
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    });
}

export function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
