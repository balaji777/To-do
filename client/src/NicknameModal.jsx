import { useState } from "react";
import { api } from "./api";
import { useAuth } from "./AuthContext";

export default function NicknameModal() {
  const { auth, setNickname } = useAuth();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Please enter a nickname.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const { nickname } = await api.setNickname(auth.token, trimmed);
      setNickname(nickname);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <h1 className="mb-2 text-2xl font-semibold text-slate-900 dark:text-white">Welcome!</h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          What should we call you?
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            autoFocus
            maxLength={30}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Nickname"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-center text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Continue"}
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}
