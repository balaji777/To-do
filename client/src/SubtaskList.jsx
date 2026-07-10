import { useEffect, useState } from "react";
import { api } from "./api";

export default function SubtaskList({ todo, token }) {
  const [subtasks, setSubtasks] = useState(todo.subtasks || []);
  const [title, setTitle] = useState("");

  useEffect(() => {
    setSubtasks(todo.subtasks || []);
  }, [todo.id, todo.subtasks]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) return;
    const subtask = await api.addSubtask(token, todo.id, title.trim());
    setSubtasks((prev) => [...prev, subtask]);
    setTitle("");
  }

  async function toggle(subtask) {
    const updated = await api.updateSubtask(token, subtask.id, { done: !subtask.done });
    setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? updated : s)));
  }

  async function remove(subtask) {
    await api.deleteSubtask(token, subtask.id);
    setSubtasks((prev) => prev.filter((s) => s.id !== subtask.id));
  }

  return (
    <div className="mt-2">
      {subtasks.length > 0 && (
        <ul className="mb-1.5 space-y-1">
          {subtasks.map((subtask) => (
            <li key={subtask.id} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={!!subtask.done}
                onChange={() => toggle(subtask)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className={subtask.done ? "text-slate-400 line-through" : "text-slate-600 dark:text-slate-300"}>
                {subtask.title}
              </span>
              <button
                onClick={() => remove(subtask)}
                aria-label={`Delete subtask ${subtask.title}`}
                className="ml-auto text-slate-300 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAdd} className="flex items-center gap-1.5">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add subtask..."
          className="flex-1 rounded border border-slate-200 bg-transparent px-1.5 py-0.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:text-white"
        />
        <button type="submit" className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
          Add
        </button>
      </form>
    </div>
  );
}
