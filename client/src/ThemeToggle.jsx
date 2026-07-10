import { useEffect, useState } from "react";

function getInitialTheme() {
  const stored = localStorage.getItem("theme");
  if (stored) return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <div className="flex rounded-md bg-slate-100 p-0.5 text-sm dark:bg-slate-700">
      <button
        onClick={() => setTheme("light")}
        aria-pressed={theme === "light"}
        className={`rounded px-2.5 py-1 font-medium transition-colors ${
          theme === "light"
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
      >
        Light
      </button>
      <button
        onClick={() => setTheme("dark")}
        aria-pressed={theme === "dark"}
        className={`rounded px-2.5 py-1 font-medium transition-colors ${
          theme === "dark"
            ? "bg-slate-900 text-white shadow-sm"
            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
      >
        Dark
      </button>
    </div>
  );
}
