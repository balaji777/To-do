const SECTIONS = [
  {
    title: "Lists & groups",
    body: "Create as many lists as you like, and organize them into groups from the sidebar's \"+ New list\" / \"+ New group\".",
  },
  {
    title: "Smart views",
    body: "My Day, Important, Planned, and Assigned to me pull tasks together across every list you own, based on what you've flagged, due-dated, or been assigned.",
  },
  {
    title: "Sharing",
    body: "Share any list with someone by email from \"Share list\" while viewing it. They'll see it under \"Shared with Me\" once they accept.",
  },
  {
    title: "Task details",
    body: "Open any task to add notes, break it into steps, set a repeat schedule, attach files, or set a separate reminder time.",
  },
  {
    title: "Household Expenses",
    body: "Splitwise-style expense splitting for the people you share lists with — add expenses, split equally/exactly/by percentage, and settle up from the \"Household\" menu.",
  },
];

export default function AboutModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">About Planora</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <ul className="space-y-4">
          {SECTIONS.map((section) => (
            <li key={section.title}>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{section.title}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{section.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
