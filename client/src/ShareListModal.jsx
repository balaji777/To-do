import { useEffect, useState } from "react";
import { api } from "./api";
import { useAuth } from "./AuthContext";

export default function ShareListModal({ listId, listName, onClose }) {
  const { auth } = useAuth();
  const [shares, setShares] = useState([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function refresh() {
    return api
      .getListShares(auth.token, listId)
      .then((data) => setShares(data.shares))
      .catch(() => {});
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

  async function handleInvite(e) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError("");
    try {
      await api.inviteToList(auth.token, listId, trimmed);
      setEmail("");
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id) {
    await api.removeListShare(auth.token, id);
    await refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Share &quot;{listName}&quot;</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleInvite} className="mb-4 flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Invite by email"
            className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Invite
          </button>
        </form>

        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">People on this list</p>
        {shares.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No one else yet — invite someone above.</p>
        ) : (
          <ul className="space-y-2">
            {shares.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-300">
                  {s.nickname || s.username}{" "}
                  {s.status === "pending" && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">(pending)</span>
                  )}
                </span>
                <button
                  onClick={() => handleRemove(s.id)}
                  className="text-xs text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
