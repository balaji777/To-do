import { useState } from "react";
import GoogleSignIn from "./GoogleSignIn";
import LoginForm from "./LoginForm";
import SignupForm from "./SignupForm";
import CheckEmailNotice from "./CheckEmailNotice";

export default function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [checkEmail, setCheckEmail] = useState(null);

  if (checkEmail) {
    return <CheckEmailNotice email={checkEmail} onBack={() => setCheckEmail(null)} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <h1 className="text-center text-2xl font-semibold text-slate-900 dark:text-white">Planora</h1>
        <p className="mb-4 text-center text-xs font-medium uppercase tracking-wide text-indigo-500 dark:text-indigo-400">
          From To-Do to Done
        </p>
        <p className="mb-6 text-center text-sm text-slate-500 dark:text-slate-400">
          {mode === "login" ? "Log in to your account" : "Create an account"}
        </p>

        {mode === "login" ? <LoginForm onUnverified={setCheckEmail} /> : <SignupForm onSignedUp={setCheckEmail} />}

        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 w-full text-center text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
        </button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          <span className="text-xs uppercase tracking-wide text-slate-400">or</span>
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>

        <GoogleSignIn />
      </div>
    </div>
  );
}
