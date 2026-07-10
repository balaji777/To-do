import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import SubtaskList from "./SubtaskList";

function openDatePicker(e) {
  if (typeof e.target.showPicker === "function") {
    e.target.showPicker();
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TaskDetail({ todo, token, onClose, onUpdate, onDelete }) {
  const [notes, setNotes] = useState(todo.notes || "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.getAttachments(token, todo.id).then(setAttachments).catch(() => setAttachments([]));
  }, [token, todo.id]);

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setAttachmentError("");
    setUploading(true);
    try {
      const created = await api.uploadAttachment(token, todo.id, file);
      setAttachments((prev) => [...prev, created]);
    } catch (err) {
      setAttachmentError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDownload(attachment) {
    const blob = await api.downloadAttachment(token, attachment.id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = attachment.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDeleteAttachment(id) {
    await api.deleteAttachment(token, id);
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function patch(changes) {
    const updated = await api.updateTodo(token, todo.id, changes);
    onUpdate(updated);
    return updated;
  }

  async function handleNotesBlur() {
    if (notes === (todo.notes || "")) return;
    setSavingNotes(true);
    try {
      await patch({ notes });
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleDelete() {
    await api.deleteTodo(token, todo.id);
    onDelete(todo.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <div className="mb-4 flex items-start justify-between gap-2">
          <input
            type="text"
            value={todo.title}
            onChange={(e) => onUpdate({ ...todo, title: e.target.value })}
            onBlur={(e) => patch({ title: e.target.value })}
            className="flex-1 rounded-md border border-transparent px-1 py-1 text-lg font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white"
          />
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <button
          onClick={() => patch({ important: !todo.important })}
          className={`mb-4 flex items-center gap-1.5 text-sm font-medium ${
            todo.important ? "text-amber-500" : "text-slate-400 hover:text-amber-500"
          }`}
        >
          <span aria-hidden="true">{todo.important ? "★" : "☆"}</span>
          {todo.important ? "Important" : "Mark important"}
        </button>

        <div className="mb-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Steps</p>
          <SubtaskList todo={todo} token={token} />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Due date</label>
            <input
              type="date"
              value={todo.due_date || ""}
              onClick={openDatePicker}
              onChange={(e) => patch({ due_date: e.target.value || null })}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Repeat</label>
            <select
              value={todo.recurrence}
              onChange={(e) => patch({ recurrence: e.target.value })}
              disabled={!todo.due_date}
              title={!todo.due_date ? "Set a due date to enable recurrence" : undefined}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            >
              <option value="none">Doesn't repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Remind me</label>
          <input
            type="datetime-local"
            value={todo.remind_at || ""}
            onClick={openDatePicker}
            onChange={(e) => patch({ remind_at: e.target.value || null })}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          {todo.remind_at && (
            <button
              onClick={() => patch({ remind_at: null })}
              className="mt-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Clear reminder
            </button>
          )}
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Priority</label>
          <select
            value={todo.priority}
            onChange={(e) => patch({ priority: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <button
          onClick={() => patch({ my_day: !todo.my_day_date })}
          className={`mb-4 flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
            todo.my_day_date
              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
          }`}
        >
          <span aria-hidden="true">☀</span>
          {todo.my_day_date ? "Added to My Day" : "Add to My Day"}
        </button>

        <div className="mb-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Attachments</p>
          {attachments.length > 0 && (
            <ul className="mb-2 space-y-1">
              {attachments.map((attachment) => (
                <li key={attachment.id} className="flex items-center gap-2 text-sm">
                  <button
                    onClick={() => handleDownload(attachment)}
                    className="min-w-0 flex-1 truncate text-left text-indigo-600 hover:underline dark:text-indigo-400"
                    title={`Download ${attachment.filename}`}
                  >
                    📎 {attachment.filename}
                  </button>
                  <span className="shrink-0 text-xs text-slate-400">{formatBytes(attachment.size_bytes)}</span>
                  <button
                    onClick={() => handleDeleteAttachment(attachment.id)}
                    aria-label={`Delete ${attachment.filename}`}
                    className="shrink-0 text-slate-400 hover:text-red-500"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
          >
            {uploading ? "Uploading..." : "+ Add file"}
          </button>
          {attachmentError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{attachmentError}</p>}
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            rows={3}
            placeholder="Add notes..."
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          {savingNotes && <p className="mt-1 text-xs text-slate-400">Saving...</p>}
        </div>

        <button
          onClick={handleDelete}
          className="w-full rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          Delete task
        </button>
      </div>
    </div>
  );
}
