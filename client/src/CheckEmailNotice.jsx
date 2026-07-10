import { useState } from "react";
import { api } from "./api";

export default function CheckEmailNotice({ email, onBack }) {
  const [status, setStatus] = useState("idle");

  async function handleResend() {
    setStatus("sending");
    try {
      await api.resendVerification(email);
      setStatus("sent");
    } catch {
      setStatus("idle");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <h1 className="mb-2 text-2xl font-semibold text-slate-900 dark:text-white">Check your email</h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          We sent a verification link to <strong>{email}</strong>. Click it to activate your account, then come back
          and log in.
        </p>

        <button
          onClick={handleResend}
          disabled={status === "sending"}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {status === "sending" ? "Sending..." : status === "sent" ? "Email sent" : "Resend email"}
        </button>

        <button
          onClick={onBack}
          className="mt-4 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Back to login
        </button>
      </div>
    </div>
  );
}
