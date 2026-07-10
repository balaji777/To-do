export default function AnimatedBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 overflow-hidden bg-slate-50 dark:bg-slate-900"
    >
      <div
        className="animate-blob absolute -left-24 -top-24 h-96 w-96 rounded-full bg-indigo-400/70 blur-3xl dark:bg-indigo-500/20"
        style={{ animation: "blob-float 22s ease-in-out infinite" }}
      />
      <div
        className="animate-blob absolute -right-10 top-1/3 h-80 w-80 rounded-full bg-sky-400/70 blur-3xl dark:bg-sky-500/20"
        style={{ animation: "blob-float 26s ease-in-out infinite", animationDelay: "-8s" }}
      />
      <div
        className="animate-blob absolute -bottom-24 left-1/4 h-[28rem] w-[28rem] rounded-full bg-violet-400/70 blur-3xl dark:bg-violet-500/20"
        style={{ animation: "blob-float 30s ease-in-out infinite", animationDelay: "-15s" }}
      />
    </div>
  );
}
