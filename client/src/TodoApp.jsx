import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useAuth } from "./AuthContext";
import ThemeToggle from "./ThemeToggle";
import ShareModal from "./ShareModal";
import ShareListModal from "./ShareListModal";
import ExpensesModal from "./ExpensesModal";
import Sidebar from "./Sidebar";
import TaskDetail from "./TaskDetail";

const VIEW_TITLES = {
  "my-day": "My Day",
  important: "Important",
  planned: "Planned",
};

function isOverdue(todo) {
  if (!todo.due_date || todo.done) return false;
  const due = new Date(todo.due_date);
  due.setHours(23, 59, 59, 999);
  return due < new Date();
}

export default function TodoApp() {
  const { auth, logout } = useAuth();
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [showCompleted, setShowCompleted] = useState(true);
  const [sortBy, setSortBy] = useState("due");

  // Household: account-wide sharing, used only by the Expenses feature (unrelated to
  // per-list sharing below).
  const [collab, setCollab] = useState({ myLists: [], myCollaborators: [], invitesReceived: [] });
  const [activeOwnerId, setActiveOwnerId] = useState(null); // null = my own household
  const [householdMembers, setHouseholdMembers] = useState([]);
  const [showShare, setShowShare] = useState(false);
  const [showExpenses, setShowExpenses] = useState(false);

  // Per-list sharing: a specific list shown inline in the sidebar under "Shared with Me".
  const [listShares, setListShares] = useState({ sharedWithMe: [], invitesReceived: [] });
  const [taskMembers, setTaskMembers] = useState([]);
  const [showShareList, setShowShareList] = useState(false);

  const [lists, setLists] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeView, setActiveView] = useState({ type: "my-day" });
  const [detailTodoId, setDetailTodoId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function refreshCollab() {
    return api.getCollaborators(auth.token).then(setCollab).catch(() => {});
  }

  function refreshListShares() {
    return api.getMyListShares(auth.token).then(setListShares).catch(() => {});
  }

  useEffect(() => {
    refreshCollab();
    refreshListShares();
  }, [auth.token]);

  useEffect(() => {
    api.getListMembers(auth.token, activeOwnerId).then(setHouseholdMembers).catch((err) => setError(err.message));
  }, [auth.token, activeOwnerId]);

  useEffect(() => {
    Promise.all([api.getLists(auth.token), api.getListGroups(auth.token)])
      .then(([listsData, groupsData]) => {
        setLists(listsData);
        setGroups(groupsData);
      })
      .catch((err) => setError(err.message));
  }, [auth.token]);

  useEffect(() => {
    if (activeView.type !== "list") {
      setTaskMembers([]);
      return;
    }
    api
      .getListShares(auth.token, activeView.listId)
      .then((data) => setTaskMembers([data.owner, ...data.shares.filter((s) => s.status === "accepted")]))
      .catch(() => setTaskMembers([]));
  }, [auth.token, activeView]);

  function fetchTodosForView() {
    if (activeView.type === "my-day") return api.getMyDay(auth.token);
    if (activeView.type === "important") return api.getImportant(auth.token);
    if (activeView.type === "planned") return api.getPlanned(auth.token);
    return api.getTodos(auth.token, activeView.listId);
  }

  function refreshTodos() {
    return fetchTodosForView()
      .then(setTodos)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    setLoading(true);
    refreshTodos().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token, activeView]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) return;

    const payload = { title: title.trim() };
    if (activeView.type === "list") {
      payload.list_id = activeView.listId;
    } else if (activeView.type === "my-day") {
      const defaultList = lists.find((l) => l.is_default);
      payload.list_id = defaultList?.id;
      payload.my_day = true;
    }

    try {
      const todo = await api.addTodo(auth.token, payload);
      setTodos((prev) => [todo, ...prev]);
      setTitle("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleDone(todo) {
    const updated = await api.updateTodo(auth.token, todo.id, { done: !todo.done });
    // Completing a recurring todo creates a new occurrence server-side; refetch to pick it up.
    if (!todo.done && todo.recurrence !== "none" && todo.due_date) {
      await refreshTodos();
    } else {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)));
    }
  }

  async function toggleImportant(todo) {
    await api.updateTodo(auth.token, todo.id, { important: !todo.important });
    await refreshTodos();
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
    await refreshTodos();
  }

  async function handleAcceptInvite(id) {
    await api.acceptInvite(auth.token, id);
    await refreshCollab();
  }

  async function handleDeclineInvite(id) {
    await api.declineInvite(auth.token, id);
    await refreshCollab();
  }

  async function handleLeaveList(membershipId) {
    await api.removeCollaborator(auth.token, membershipId);
    setActiveOwnerId(null);
    await refreshCollab();
  }

  function handleSwitchOwner(ownerId) {
    setActiveOwnerId(ownerId);
  }

  async function handleAcceptListShare(id) {
    await api.acceptListShare(auth.token, id);
    await refreshListShares();
  }

  async function handleDeclineListShare(id) {
    await api.declineListShare(auth.token, id);
    await refreshListShares();
  }

  async function handleCreateList(name, groupId) {
    try {
      const list = await api.addList(auth.token, name, groupId);
      setLists((prev) => [...prev, list]);
      setActiveView({ type: "list", listId: list.id });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateGroup(name) {
    try {
      const group = await api.addListGroup(auth.token, name);
      setGroups((prev) => [...prev, group]);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleMoveList(listId, { beforeId = null, groupId = null }) {
    const moved = lists.find((l) => l.id === listId);
    if (!moved) return;
    const rest = lists.filter((l) => l.id !== listId);
    let insertAt = rest.length;
    if (beforeId != null) {
      const idx = rest.findIndex((l) => l.id === beforeId);
      if (idx !== -1) insertAt = idx;
    }
    const next = [...rest.slice(0, insertAt), { ...moved, group_id: groupId }, ...rest.slice(insertAt)].map(
      (l, idx) => ({ ...l, ordering: idx })
    );
    const changed = next.filter((l) => {
      const original = lists.find((p) => p.id === l.id);
      return !original || original.ordering !== l.ordering || original.group_id !== l.group_id;
    });
    setLists(next);
    try {
      await Promise.all(
        changed.map((l) => api.updateList(auth.token, l.id, { ordering: l.ordering, group_id: l.group_id }))
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleMoveGroup(groupId, beforeId = null) {
    const moved = groups.find((g) => g.id === groupId);
    if (!moved) return;
    const rest = groups.filter((g) => g.id !== groupId);
    let insertAt = rest.length;
    if (beforeId != null) {
      const idx = rest.findIndex((g) => g.id === beforeId);
      if (idx !== -1) insertAt = idx;
    }
    const next = [...rest.slice(0, insertAt), moved, ...rest.slice(insertAt)].map((g, idx) => ({
      ...g,
      ordering: idx,
    }));
    const changed = next.filter((g) => {
      const original = groups.find((p) => p.id === g.id);
      return !original || original.ordering !== g.ordering;
    });
    setGroups(next);
    try {
      await Promise.all(changed.map((g) => api.updateListGroup(auth.token, g.id, { ordering: g.ordering })));
    } catch (err) {
      setError(err.message);
    }
  }

  function handleDetailUpdate(patch) {
    setTodos((prev) => prev.map((t) => (t.id === patch.id ? { ...t, ...patch } : t)));
  }

  async function closeDetail() {
    setDetailTodoId(null);
    await refreshTodos();
  }

  function handleDetailDelete(id) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    setDetailTodoId(null);
  }

  const visibleTodos = useMemo(() => {
    const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
    return todos
      .filter((t) => showCompleted || !t.done)
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
  }, [todos, showCompleted, search, sortBy]);

  const remaining = todos.filter((t) => !t.done).length;
  const activeListEntry = collab.myLists.find((l) => l.id === activeOwnerId);
  const detailTodo = todos.find((t) => t.id === detailTodoId);
  const canQuickAdd = activeView.type === "list" || activeView.type === "my-day";
  const ownsActiveList = activeView.type === "list" && lists.some((l) => l.id === activeView.listId);

  function memberName(userId) {
    const member = taskMembers.find((m) => m.id === userId);
    if (!member) return "Collaborator";
    return member.nickname || member.username;
  }

  const viewTitle =
    VIEW_TITLES[activeView.type] ||
    lists.find((l) => l.id === activeView.listId)?.name ||
    listShares.sharedWithMe.find((l) => l.id === activeView.listId)?.name ||
    "Tasks";

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto flex w-full max-w-4xl gap-6">
        <Sidebar
          lists={lists}
          groups={groups}
          sharedLists={listShares.sharedWithMe}
          activeView={activeView}
          onSelect={setActiveView}
          onCreateList={handleCreateList}
          onCreateGroup={handleCreateGroup}
          onMoveList={handleMoveList}
          onMoveGroup={handleMoveGroup}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="min-w-0 flex-1">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
                className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
              >
                ☰
              </button>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{viewTitle}</h1>
              {collab.myLists.length > 0 && (
                <select
                  value={activeOwnerId ?? "own"}
                  onChange={(e) => handleSwitchOwner(e.target.value === "own" ? null : Number(e.target.value))}
                  className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                >
                  <option value="own">My lists</option>
                  {collab.myLists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nickname || l.username}&apos;s lists
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-4">
              {ownsActiveList && (
                <button
                  onClick={() => setShowShareList(true)}
                  className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                >
                  Share list
                </button>
              )}
              {householdMembers.length > 1 && (
                <button
                  onClick={() => setShowExpenses(true)}
                  className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                >
                  Expenses
                </button>
              )}
              {activeOwnerId ? (
                <button
                  onClick={() => handleLeaveList(activeListEntry?.membership_id)}
                  className="text-sm text-rose-600 hover:text-rose-500 dark:text-rose-400"
                >
                  Leave household
                </button>
              ) : (
                <button
                  onClick={() => setShowShare(true)}
                  className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                >
                  Household
                </button>
              )}
              <ThemeToggle />
              <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                Log out
              </button>
            </div>
          </div>

          {(collab.invitesReceived.length > 0 || listShares.invitesReceived.length > 0) && (
            <div className="mb-6 space-y-2">
              {collab.invitesReceived.map((invite) => (
                <div
                  key={`household-${invite.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-indigo-50 px-4 py-2 text-sm ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:ring-indigo-800"
                >
                  <span className="text-indigo-800 dark:text-indigo-200">
                    <strong>{invite.nickname || invite.username}</strong> invited you to their household.
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
              {listShares.invitesReceived.map((invite) => (
                <div
                  key={`list-${invite.share_id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-indigo-50 px-4 py-2 text-sm ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:ring-indigo-800"
                >
                  <span className="text-indigo-800 dark:text-indigo-200">
                    <strong>{invite.owner_nickname || invite.owner_username}</strong> shared the list &quot;
                    {invite.list_name}&quot; with you.
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAcceptListShare(invite.share_id)}
                      className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDeclineListShare(invite.share_id)}
                      className="rounded bg-white px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {canQuickAdd && (
            <form onSubmit={handleAdd} className="mb-6">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Add a task"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </form>
          )}

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
              {visibleTodos.map((todo) => (
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
                  <button className="min-w-0 flex-1 text-left" onClick={() => setDetailTodoId(todo.id)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={todo.done ? "text-slate-400 line-through" : "text-slate-900 dark:text-white"}>
                        {todo.title}
                      </span>
                      {todo.list_name && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          {todo.list_name}
                        </span>
                      )}
                      {taskMembers.length > 1 && todo.created_by && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
                          {todo.created_by === auth.id ? "You" : memberName(todo.created_by)}
                        </span>
                      )}
                      {todo.subtasks?.length > 0 && (
                        <span className="text-xs text-slate-400">
                          {todo.subtasks.filter((s) => s.done).length}/{todo.subtasks.length} steps
                        </span>
                      )}
                    </div>
                    {todo.due_date && (
                      <div className="mt-1 text-xs">
                        <span className={isOverdue(todo) ? "font-medium text-rose-600 dark:text-rose-400" : "text-slate-400"}>
                          Due {new Date(todo.due_date).toLocaleDateString()}
                          {isOverdue(todo) ? " (overdue)" : ""}
                        </span>
                      </div>
                    )}
                  </button>
                  <button
                    onClick={() => toggleImportant(todo)}
                    aria-label={todo.important ? `Unmark ${todo.title} as important` : `Mark ${todo.title} as important`}
                    className={`mt-0.5 text-lg leading-none ${
                      todo.important ? "text-amber-500" : "text-slate-300 hover:text-amber-500 dark:text-slate-600"
                    }`}
                  >
                    {todo.important ? "★" : "☆"}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {todos.length > 0 && (
            <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
              {remaining} of {todos.length} remaining
            </p>
          )}
        </div>
      </div>

      {showShare && (
        <ShareModal
          collaborators={collab.myCollaborators}
          onClose={() => setShowShare(false)}
          onChange={refreshCollab}
        />
      )}

      {showShareList && (
        <ShareListModal
          listId={activeView.listId}
          listName={viewTitle}
          onClose={() => setShowShareList(false)}
        />
      )}

      {showExpenses && (
        <ExpensesModal
          listOwnerId={activeOwnerId ?? auth.id}
          members={householdMembers}
          onClose={() => setShowExpenses(false)}
        />
      )}

      {detailTodo && (
        <TaskDetail
          todo={detailTodo}
          token={auth.token}
          onClose={closeDetail}
          onUpdate={handleDetailUpdate}
          onDelete={handleDetailDelete}
        />
      )}
    </div>
  );
}
