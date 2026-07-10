import { useState } from "react";

function isActiveList(activeView, listId) {
  return activeView.type === "list" && activeView.listId === listId;
}

export default function Sidebar({ lists, groups, activeView, onSelect, onCreateList, onCreateGroup }) {
  const [addingList, setAddingList] = useState(false);
  const [addingGroup, setAddingGroup] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newGroupName, setNewGroupName] = useState("");

  const grouped = groups.map((group) => ({
    group,
    lists: lists.filter((l) => l.group_id === group.id),
  }));
  const ungrouped = lists.filter((l) => !l.group_id);

  function submitNewList(e, groupId) {
    e.preventDefault();
    if (!newListName.trim()) return;
    onCreateList(newListName.trim(), groupId);
    setNewListName("");
    setAddingList(false);
  }

  function submitNewGroup(e) {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    onCreateGroup(newGroupName.trim());
    setNewGroupName("");
    setAddingGroup(false);
  }

  function smartButton(type, label, icon) {
    const active = activeView.type === type;
    return (
      <button
        onClick={() => onSelect({ type })}
        className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm ${
          active
            ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        }`}
      >
        <span aria-hidden="true">{icon}</span>
        {label}
      </button>
    );
  }

  function listButton(list) {
    const active = isActiveList(activeView, list.id);
    return (
      <button
        key={list.id}
        onClick={() => onSelect({ type: "list", listId: list.id })}
        className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm ${
          active
            ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        }`}
      >
        <span aria-hidden="true">☰</span>
        {list.name}
      </button>
    );
  }

  return (
    <nav className="w-56 shrink-0 space-y-4 border-r border-slate-200 pr-4 dark:border-slate-700">
      <div className="space-y-0.5">
        {smartButton("my-day", "My Day", "☀")
        }
        {smartButton("important", "Important", "★")}
        {smartButton("planned", "Planned", "📅")}
      </div>

      <div className="space-y-3">
        {grouped.map(({ group, lists: groupLists }) => (
          <div key={group.id}>
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{group.name}</p>
            <div className="space-y-0.5">{groupLists.map(listButton)}</div>
          </div>
        ))}

        <div className="space-y-0.5">{ungrouped.map(listButton)}</div>
      </div>

      <div className="space-y-1 border-t border-slate-200 pt-3 dark:border-slate-700">
        {addingList ? (
          <form onSubmit={(e) => submitNewList(e, null)} className="flex items-center gap-1 px-1">
            <input
              type="text"
              autoFocus
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="List name"
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
            <button type="submit" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
              Add
            </button>
          </form>
        ) : (
          <button
            onClick={() => setAddingList(true)}
            className="w-full rounded-md px-3 py-1.5 text-left text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            + New list
          </button>
        )}

        {addingGroup ? (
          <form onSubmit={submitNewGroup} className="flex items-center gap-1 px-1">
            <input
              type="text"
              autoFocus
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group name"
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
            <button type="submit" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
              Add
            </button>
          </form>
        ) : (
          <button
            onClick={() => setAddingGroup(true)}
            className="w-full rounded-md px-3 py-1.5 text-left text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            + New group
          </button>
        )}
      </div>
    </nav>
  );
}
