import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useAuth } from "./AuthContext";
import ThemeToggle from "./ThemeToggle";
import ShareModal from "./ShareModal";
import SubtaskList from "./SubtaskList";
import LabelPicker from "./LabelPicker";

const PRIORITY_STYLES = {
  low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  high: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

const TYPE_STYLES = {
  bug: "bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800",
  feature: "bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-800",
  chore: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600",
  task: "bg-sky-50 text-sky-600 ring-1 ring-inset ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-800",
};

const TYPE_LABELS = { bug: "Bug", feature: "Feature", chore: "Chore", task: "Task" };

const RECURRENCE_LABELS = {
  none: null,
  daily: "Repeats daily",
  weekly: "Repeats weekly",
  monthly: "Repeats monthly",
};

function isOverdue(todo) {
  if (!todo.due_date || todo.done) return false;
  const due = new Date(todo.due_date);
  due.setHours(23, 59, 59, 999);
  return due < new Date();
}

function openDatePicker(e) {
  if (typeof e.target.showPicker === "function") {
    e.target.showPicker();
  }
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function TodoApp() {
  const { auth, logout } = useAuth();
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [categoryId, setCategoryId] = useState("");
  const [recurrence, setRecurrence] = useState("none");
  const [type, setType] = useState("task");
  const [link, setLink] = useState("");
  const [categories, setCategories] = useState([]);
  const [labels, setLabels] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [error, setError] = useState("");
  const [dateError, setDateError] = useState("");
  const [loading, setLoading] = useState(true);
  const today = todayStr();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showCompleted, setShowCompleted] = useState(true);
  const [sortBy, setSortBy] = useState("due");

  const [collab, setCollab] = useState({ myLists: [], myCollaborators: [], invitesReceived: [] });
  const [activeListId, setActiveListId] = useState(null); // null = my own list
  const [members, setMembers] = useState([]);
  const [showShare, setShowShare] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  function refreshCollab() {
    return api.getCollaborators(auth.token).then(setCollab).catch(() => {});
  }

  useEffect(() => {
    refreshCollab();
  }, [auth.token]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getTodos(auth.token, activeListId),
      api.getListMembers(auth.token, activeListId),
      api.getCategories(auth.token, activeListId),
      api.getLabels(auth.token, activeListId),
    ])
      .then(([todosData, membersData, categoriesData, labelsData]) => {
        setTodos(todosData);
        setMembers(membersData);
        setCategories(categoriesData);
        setLabels(labelsData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [auth.token, activeListId]);

  function handleDueDateChange(e) {
    const value = e.target.value;
    setDueDate(value);
    setDateError(value && value < today ? "Due date can't be in the past." : "");
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) return;
    if (dueDate && dueDate < today) {
      setDateError("Due date can't be in the past.");
      return;
    }
    try {
      const todo = await api.addTodo(auth.token, {
        title,
        due_date: dueDate || null,
        priority,
        category_id: categoryId || null,
        recurrence,
        type,
        link: link || null,
        list: activeListId || undefined,
      });
      setTodos((prev) => [todo, ...prev]);
      setTitle("");
      setDueDate("");
      setDateError("");
      setPriority("medium");
      setCategoryId("");
      setRecurrence("none");
      setType("task");
      setLink("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddCategory(e) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const category = await api.addCategory(auth.token, newCategoryName.trim(), activeListId);
      setCategories((prev) => [...prev, category].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryId(category.id);
      setNewCategoryName("");
      setAddingCategory(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleDone(todo) {
    const updated = await api.updateTodo(auth.token, todo.id, { done: !todo.done });
    // Completing a recurring todo creates a new occurrence server-side; refetch to pick it up.
    if (!todo.done && todo.recurrence !== "none" && todo.due_date) {
      const refreshed = await api.getTodos(auth.token, activeListId);
      setTodos(refreshed);
    } else {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)));
    }
  }

  async function removeTodo(id) {
    await api.deleteTodo(auth.token, id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  async function clearCompleted() {
    const completed = todos.filter((t) => t.done);
    if (completed.length === 0) return;
    await Promise.all(completed.map((t) => api.deleteTodo(auth.token, t.id)));
    setTodos((prev) => prev.filter((t) => !t.done));
  }

  async function markAllDone() {
    const pending = todos.filter((t) => !t.done);
    if (pending.length === 0) return;
    await Promise.all(pending.map((t) => api.updateTodo(auth.token, t.id, { done: true })));
    // Recurring todos create their next occurrence server-side; refetch to pick those up.
    const refreshed = await api.getTodos(auth.token, activeListId);
    setTodos(refreshed);
  }

  async function handleAcceptInvite(id) {
    await api.acceptInvite(auth.token, id);
    await refreshCollab();
  }

  async function handleDeclineInvite(id) {
    await api.declineInvite(auth.token, id);
    await refreshCollab();
  }

  function startEdit(todo) {
    setEditingId(todo.id);
    setEditDraft({
      title: todo.title,
      due_date: todo.due_date || "",
      priority: todo.priority,
      category_id: todo.category_id || "",
      type: todo.type || "task",
      link: todo.link || "",
      dateError: "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  function handleEditDateChange(e) {
    const value = e.target.value;
    setEditDraft((prev) => ({
      ...prev,
      due_date: value,
      dateError: value && value < today ? "Due date can't be in the past." : "",
    }));
  }

  async function saveEdit(todo) {
    if (!editDraft.title.trim()) return;
    if (editDraft.due_date && editDraft.due_date < today) {
      setEditDraft((prev) => ({ ...prev, dateError: "Due date can't be in the past." }));
      return;
    }
    try {
      const updated = await api.updateTodo(auth.token, todo.id, {
        title: editDraft.title.trim(),
        due_date: editDraft.due_date || null,
        priority: editDraft.priority,
        category_id: editDraft.category_id || null,
        type: editDraft.type,
        link: editDraft.link || null,
      });
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)));
      cancelEdit();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLeaveList(membershipId) {
    await api.removeCollaborator(auth.token, membershipId);
    setActiveListId(null);
    await refreshCollab();
  }

  const visibleTodos = useMemo(() => {
    const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
    return todos
      .filter((t) => showCompleted || !t.done)
      .filter((t) => categoryFilter === "all" || String(t.category_id) === categoryFilter)
      .filter((t) => priorityFilter === "all" || t.priority === priorityFilter)
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
  }, [todos, showCompleted, categoryFilter, priorityFilter, search, sortBy]);

  const remaining = todos.filter((t) => !t.done).length;
  const activeListEntry = collab.myLists.find((l) => l.id === activeListId);

  function memberName(userId) {
    const member = members.find((m) => m.id === userId);
    if (!member) return "Collaborator";
    return member.nickname || member.username;
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-900">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              {activeListId ? `${memberName(activeListId)}'s` : `${auth.nickname || auth.username}'s`} tasks
            </h1>
            {collab.myLists.length > 0 && (
              <select
                value={activeListId ?? "own"}
                onChange={(e) => setActiveListId(e.target.value === "own" ? null : Number(e.target.value))}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              >
                <option value="own">My tasks</option>
                {collab.myLists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nickname || l.username}&apos;s tasks
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-4">
            {activeListId ? (
              <button
                onClick={() => handleLeaveList(activeListEntry?.membership_id)}
                className="text-sm text-rose-600 hover:text-rose-500 dark:text-rose-400"
              >
                Leave list
              </button>
            ) : (
              <button
                onClick={() => setShowShare(true)}
                className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              >
                Share
              </button>
            )}
            <ThemeToggle />
            <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
              Log out
            </button>
          </div>
        </div>

        {collab.invitesReceived.length > 0 && (
          <div className="mb-6 space-y-2">
            {collab.invitesReceived.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-indigo-50 px-4 py-2 text-sm ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:ring-indigo-800"
              >
                <span className="text-indigo-800 dark:text-indigo-200">
                  <strong>{invite.nickname || invite.username}</strong> invited you to collaborate on their list.
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAcceptInvite(invite.id)}
                    className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleDeclineInvite(invite.id)}
                    className="rounded bg-white px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAdd} className="mb-6 space-y-2 rounded-md bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to ship?"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />

          <div className="flex flex-wrap gap-2">
            <div>
              <input
                type="date"
                value={dueDate}
                min={today}
                onChange={handleDueDateChange}
                onClick={openDatePicker}
                className={`rounded-md border px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 dark:bg-slate-900 dark:text-white ${
                  dateError
                    ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500"
                    : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600"
                }`}
              />
              {dateError && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{dateError}</p>}
            </div>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            >
              <option value="task">Task</option>
              <option value="bug">Bug</option>
              <option value="feature">Feature</option>
              <option value="chore">Chore</option>
            </select>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            >
              <option value="low">Low priority</option>
              <option value="medium">Medium priority</option>
              <option value="high">High priority</option>
            </select>
            {addingCategory ? (
              <form onSubmit={handleAddCategory} className="flex items-center gap-1">
                <input
                  type="text"
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="New category name"
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
                <button type="submit" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingCategory(false);
                    setNewCategoryName("");
                  }}
                  className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <select
                value={categoryId}
                onChange={(e) => {
                  if (e.target.value === "__new") {
                    setAddingCategory(true);
                  } else {
                    setCategoryId(e.target.value);
                  }
                }}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="__new">+ New category...</option>
              </select>
            )}
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              disabled={!dueDate}
              title={!dueDate ? "Set a due date to enable recurrence" : undefined}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            >
              <option value="none">Doesn't repeat</option>
              <option value="daily">Repeats daily</option>
              <option value="weekly">Repeats weekly</option>
              <option value="monthly">Repeats monthly</option>
            </select>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Issue / PR link (optional)"
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={!!dateError}
              className="ml-auto rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </form>

        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          >
            <option value="all">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          >
            <option value="due">Sort: Due date</option>
            <option value="priority">Sort: Priority</option>
            <option value="created">Sort: Newest</option>
          </select>
          <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Show completed
          </label>
          <div className="ml-auto flex gap-3 text-sm">
            <button
              onClick={markAllDone}
              className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
            >
              Mark all done
            </button>
            <button
              onClick={clearCompleted}
              className="text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
            >
              Clear completed
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-slate-500 dark:text-slate-400">Loading...</p>
        ) : visibleTodos.length === 0 ? (
          <p className="text-center text-slate-500 dark:text-slate-400">No tasks match.</p>
        ) : (
          <ul className="space-y-2">
            {visibleTodos.map((todo) =>
              editingId === todo.id ? (
                <li
                  key={todo.id}
                  className="space-y-2 rounded-md bg-white px-4 py-3 shadow-sm ring-1 ring-indigo-300 dark:bg-slate-800 dark:ring-indigo-700"
                >
                  <input
                    type="text"
                    value={editDraft.title}
                    onChange={(e) => setEditDraft((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  />
                  <div className="flex flex-wrap gap-2">
                    <div>
                      <input
                        type="date"
                        value={editDraft.due_date}
                        min={today}
                        onChange={handleEditDateChange}
                        onClick={openDatePicker}
                        className={`rounded-md border px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 dark:bg-slate-900 dark:text-white ${
                          editDraft.dateError
                            ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500"
                            : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600"
                        }`}
                      />
                      {editDraft.dateError && (
                        <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{editDraft.dateError}</p>
                      )}
                    </div>
                    <select
                      value={editDraft.type}
                      onChange={(e) => setEditDraft((prev) => ({ ...prev, type: e.target.value }))}
                      className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    >
                      <option value="task">Task</option>
                      <option value="bug">Bug</option>
                      <option value="feature">Feature</option>
                      <option value="chore">Chore</option>
                    </select>
                    <select
                      value={editDraft.priority}
                      onChange={(e) => setEditDraft((prev) => ({ ...prev, priority: e.target.value }))}
                      className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    >
                      <option value="low">Low priority</option>
                      <option value="medium">Medium priority</option>
                      <option value="high">High priority</option>
                    </select>
                    <select
                      value={editDraft.category_id}
                      onChange={(e) => setEditDraft((prev) => ({ ...prev, category_id: e.target.value }))}
                      className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    >
                      <option value="">No category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="url"
                      value={editDraft.link}
                      onChange={(e) => setEditDraft((prev) => ({ ...prev, link: e.target.value }))}
                      placeholder="Issue / PR link (optional)"
                      className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    />
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={cancelEdit}
                        className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50 dark:text-slate-300 dark:ring-slate-600 dark:hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveEdit(todo)}
                        disabled={!!editDraft.dateError}
                        className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </li>
              ) : (
                <li
                  key={todo.id}
                  className="flex items-start gap-3 rounded-md bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={!!todo.done}
                    onChange={() => toggleDone(todo)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`${todo.done ? "text-slate-400 line-through" : "text-slate-900 dark:text-white"}`}>
                        {todo.title}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[todo.priority]}`}>
                        {todo.priority}
                      </span>
                      {todo.type && todo.type !== "task" && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[todo.type]}`}>
                          {TYPE_LABELS[todo.type]}
                        </span>
                      )}
                      {todo.link && (
                        <a
                          href={todo.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          Link
                        </a>
                      )}
                      {(todo.category_name || todo.category) && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          {todo.category_name || todo.category}
                        </span>
                      )}
                      {members.length > 1 && todo.created_by && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
                          {todo.created_by === auth.id ? "You" : memberName(todo.created_by)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      {todo.due_date && (
                        <span className={isOverdue(todo) ? "font-medium text-rose-600 dark:text-rose-400" : "text-slate-400"}>
                          Due {new Date(todo.due_date).toLocaleDateString()}
                          {isOverdue(todo) ? " (overdue)" : ""}
                        </span>
                      )}
                      {RECURRENCE_LABELS[todo.recurrence] && (
                        <span className="text-slate-400">{RECURRENCE_LABELS[todo.recurrence]}</span>
                      )}
                    </div>
                    <LabelPicker todo={todo} allLabels={labels} token={auth.token} />
                    <SubtaskList todo={todo} token={auth.token} />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      onClick={() => startEdit(todo)}
                      className="text-sm text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => removeTodo(todo.id)}
                      className="text-sm text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              )
            )}
          </ul>
        )}

        {todos.length > 0 && (
          <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
            {remaining} of {todos.length} remaining
          </p>
        )}
      </div>

      {showShare && (
        <ShareModal
          collaborators={collab.myCollaborators}
          onClose={() => setShowShare(false)}
          onChange={refreshCollab}
        />
      )}
    </div>
  );
}
