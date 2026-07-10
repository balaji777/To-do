import { useEffect, useState } from "react";
import { api } from "./api";

export default function VerifyEmailConfirm() {
  const [status, setStatus] = useState("verifying");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("error");
      setError("Missing verification token.");
      return;
    }
    api
      .verifyEmail(token)
      .then(() => setStatus("verified"))
      .catch((err) => {
        setStatus("error");
        setError(err.message);
      });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        {status === "verifying" && (
          <>
            <h1 className="mb-2 text-2xl font-semibold text-slate-900 dark:text-white">Verifying...</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">One moment.</p>
          </>
        )}

        {status === "verified" && (
          <>
            <h1 className="mb-2 text-2xl font-semibold text-slate-900 dark:text-white">Email verified</h1>
            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">Your account is ready. You can log in now.</p>
            <a
              href="/"
              className="inline-block w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Go to login
            </a>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="mb-2 text-2xl font-semibold text-slate-900 dark:text-white">Verification failed</h1>
            <p className="mb-6 text-sm text-red-600 dark:text-red-400">{error}</p>
            <a
              href="/"
              className="inline-block w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Back to login
            </a>
          </>
        )}
      </div>
    </div>
  );
}
