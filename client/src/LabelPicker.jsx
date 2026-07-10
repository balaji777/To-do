import { useEffect, useState } from "react";
import { api } from "./api";

export default function LabelPicker({ todo, allLabels, token }) {
  const [labels, setLabels] = useState(todo.labels || []);
  const [selectValue, setSelectValue] = useState("");

  useEffect(() => {
    setLabels(todo.labels || []);
  }, [todo.id, todo.labels]);

  const attachedIds = new Set(labels.map((l) => l.id));
  const available = allLabels.filter((l) => !attachedIds.has(l.id));

  async function handleSelect(e) {
    const value = e.target.value;
    setSelectValue("");
    if (!value) return;
    const updated = await api.attachLabel(token, todo.id, Number(value));
    setLabels(updated.labels);
  }

  async function handleRemove(labelId) {
    const updated = await api.detachLabel(token, todo.id, labelId);
    setLabels(updated.labels);
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {labels.map((label) => (
        <span
          key={label.id}
          className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
        >
          {label.name}
          <button
            onClick={() => handleRemove(label.id)}
            aria-label={`Remove label ${label.name}`}
            className="text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200"
          >
            &times;
          </button>
        </span>
      ))}
      {available.length > 0 && (
        <select
          value={selectValue}
          onChange={handleSelect}
          aria-label="Add label"
          className="rounded border border-slate-200 bg-transparent px-1 py-0.5 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400"
        >
          <option value="">+ label</option>
          {available.map((label) => (
            <option key={label.id} value={label.id}>
              {label.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
