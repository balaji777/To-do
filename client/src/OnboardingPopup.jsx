import { useAuth } from "./AuthContext";

export default function OnboardingPopup() {
  const { markOnboardingSeen } = useAuth();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Welcome to Planora</h2>

        <ul className="mb-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <li>My Day, Important, Planned, and Assigned to me give you quick views into what matters.</li>
          <li>Create lists and groups, then share any list with the people you work or live with.</li>
        </ul>

        <div className="mb-4 rounded-md bg-indigo-50 p-3 dark:bg-indigo-950/40">
          <p className="text-sm text-indigo-800 dark:text-indigo-200">
            <strong>Splitting shared costs?</strong> Head to <strong>Household → Expenses</strong> to split bills
            Splitwise-style with the people on your lists, track who owes what, and settle up. You&apos;ll get an
            email whenever someone adds or settles an expense.
          </p>
        </div>

        <button
          onClick={markOnboardingSeen}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
