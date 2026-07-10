import { useEffect, useState } from "react";
import { api } from "./api";
import { useAuth } from "./AuthContext";

function money(amount) {
  return `₹${Number(amount).toFixed(2)}`;
}

function memberName(members, userId, myId) {
  if (userId === myId) return "You";
  const member = members.find((m) => m.id === userId);
  return member ? member.nickname || member.username : "Someone";
}

export default function ExpensesModal({ listOwnerId, members, onClose }) {
  const { auth } = useAuth();
  const myId = auth.id;

  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(myId);
  const [splitType, setSplitType] = useState("equal");
  const [participantIds, setParticipantIds] = useState(members.map((m) => m.id));
  const [exactShares, setExactShares] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [settleTo, setSettleTo] = useState(members.find((m) => m.id !== myId)?.id ?? "");
  const [settleAmount, setSettleAmount] = useState("");

  function refresh() {
    setLoading(true);
    return Promise.all([api.getExpenses(auth.token, listOwnerId), api.getBalances(auth.token, listOwnerId)])
      .then(([expensesData, balancesData]) => {
        setExpenses(expensesData);
        setBalances(balancesData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listOwnerId]);

  function toggleParticipant(id) {
    setParticipantIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function handleAddExpense(e) {
    e.preventDefault();
    setError("");
    if (!description.trim() || !amount) return;

    const body = {
      list: listOwnerId,
      description: description.trim(),
      amount: Number(amount),
      paid_by: Number(paidBy),
      split_type: splitType,
    };
    if (splitType === "equal") {
      if (participantIds.length === 0) {
        setError("Pick at least one person to split with.");
        return;
      }
      body.participants = participantIds;
    } else {
      body.shares = members.map((m) => ({ user_id: m.id, amount: Number(exactShares[m.id] || 0) }));
    }

    setSubmitting(true);
    try {
      await api.addExpense(auth.token, body);
      setDescription("");
      setAmount("");
      setExactShares({});
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteExpense(id) {
    await api.deleteExpense(auth.token, id);
    await refresh();
  }

  async function handleSettle(e) {
    e.preventDefault();
    setError("");
    if (!settleTo || !settleAmount) return;
    try {
      await api.addSettlement(auth.token, {
        list: listOwnerId,
        from_user_id: myId,
        to_user_id: Number(settleTo),
        amount: Number(settleAmount),
      });
      setSettleAmount("");
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  const otherMembers = members.filter((m) => m.id !== myId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Shared expenses</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Balances</p>
        <ul className="mb-6 space-y-1.5">
          {balances.map((b) => (
            <li key={b.user_id} className="flex items-center justify-between text-sm">
              <span className="text-slate-700 dark:text-slate-300">{memberName(members, b.user_id, myId)}</span>
              {b.balance === 0 ? (
                <span className="text-slate-400">settled up</span>
              ) : b.balance > 0 ? (
                <span className="font-medium text-emerald-600 dark:text-emerald-400">is owed {money(b.balance)}</span>
              ) : (
                <span className="font-medium text-rose-600 dark:text-rose-400">owes {money(-b.balance)}</span>
              )}
            </li>
          ))}
        </ul>

        <form onSubmit={handleAddExpense} className="mb-6 space-y-2 rounded-md bg-slate-50 p-3 dark:bg-slate-900/50">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Add expense</p>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What was it for?"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <div className="flex flex-wrap gap-2">
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            >
              <option value={myId}>Paid by you</option>
              {otherMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  Paid by {m.nickname || m.username}
                </option>
              ))}
            </select>
            <select
              value={splitType}
              onChange={(e) => setSplitType(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            >
              <option value="equal">Split equally</option>
              <option value="exact">Split by exact amounts</option>
            </select>
          </div>

          {splitType === "equal" ? (
            <div className="flex flex-wrap gap-3 pt-1">
              {members.map((m) => (
                <label key={m.id} className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={participantIds.includes(m.id)}
                    onChange={() => toggleParticipant(m.id)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {m.id === myId ? "You" : m.nickname || m.username}
                </label>
              ))}
            </div>
          ) : (
            <div className="space-y-1 pt-1">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-600 dark:text-slate-300">{m.id === myId ? "You" : m.nickname || m.username}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={exactShares[m.id] || ""}
                    onChange={(e) => setExactShares((prev) => ({ ...prev, [m.id]: e.target.value }))}
                    placeholder="0.00"
                    className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Add expense
          </button>
        </form>

        {otherMembers.length > 0 && (
          <form onSubmit={handleSettle} className="mb-6 flex flex-wrap items-center gap-2 rounded-md bg-slate-50 p-3 dark:bg-slate-900/50">
            <span className="text-sm text-slate-600 dark:text-slate-300">Settle up: you paid</span>
            <select
              value={settleTo}
              onChange={(e) => setSettleTo(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            >
              {otherMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nickname || m.username}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={settleAmount}
              onChange={(e) => setSettleAmount(e.target.value)}
              placeholder="Amount"
              className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
            <button
              type="submit"
              className="rounded-md bg-white px-3 py-1 text-sm font-medium text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600"
            >
              Record
            </button>
          </form>
        )}

        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">History</p>
        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>
        ) : expenses.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No expenses yet — add one above.</p>
        ) : (
          <ul className="space-y-2">
            {expenses.map((exp) => (
              <li
                key={exp.id}
                className="flex items-start justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
              >
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-200">
                    {exp.description} — {money(exp.amount)}
                  </p>
                  <p className="text-xs text-slate-400">
                    Paid by {memberName(members, exp.paid_by, myId)} · split{" "}
                    {exp.shares.map((s) => `${memberName(members, s.user_id, myId)} ${money(s.amount)}`).join(", ")}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteExpense(exp.id)}
                  className="shrink-0 text-xs text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
