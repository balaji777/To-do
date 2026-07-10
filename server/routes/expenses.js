import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { hasListAccess } from "./todos.js";

const router = Router();

router.use(requireAuth);

function toCents(amount) {
  return Math.round(Number(amount) * 100);
}

function toAmount(cents) {
  return Math.round(cents) / 100;
}

// Owner + accepted collaborators of a list, as plain user ids.
function listMemberIds(listOwnerId) {
  const rows = db
    .prepare(
      `SELECT user_id FROM collaborators WHERE list_owner_id = ? AND status = 'accepted'
       UNION SELECT ? AS user_id`
    )
    .all(listOwnerId, listOwnerId);
  return rows.map((r) => r.user_id);
}

// Splits amountCents across userIds as evenly as possible; any leftover cents
// (from division that doesn't divide evenly) go to the first participants in
// sorted order so the shares always sum exactly to amountCents.
function splitEqually(amountCents, userIds) {
  const sorted = [...userIds].sort((a, b) => a - b);
  const base = Math.floor(amountCents / sorted.length);
  let remainder = amountCents - base * sorted.length;
  return sorted.map((userId) => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    return { user_id: userId, share_cents: base + extra };
  });
}

function hydrateExpense(expense) {
  const shares = db
    .prepare(
      `SELECT expense_shares.user_id, expense_shares.share_cents, users.username, users.nickname
       FROM expense_shares
       JOIN users ON users.id = expense_shares.user_id
       WHERE expense_shares.expense_id = ?
       ORDER BY expense_shares.user_id`
    )
    .all(expense.id)
    .map((s) => ({ user_id: s.user_id, username: s.username, nickname: s.nickname, amount: toAmount(s.share_cents) }));

  return {
    id: expense.id,
    list: expense.list_owner_id,
    description: expense.description,
    amount: toAmount(expense.amount_cents),
    paid_by: expense.paid_by,
    split_type: expense.split_type,
    created_by: expense.created_by,
    created_at: expense.created_at,
    shares,
  };
}

router.get("/", (req, res) => {
  const listOwnerId = req.query.list ? Number(req.query.list) : req.userId;
  if (!hasListAccess(req.userId, listOwnerId)) {
    return res.status(403).json({ error: "You don't have access to that list" });
  }

  const expenses = db
    .prepare("SELECT * FROM expenses WHERE list_owner_id = ? ORDER BY created_at DESC, id DESC")
    .all(listOwnerId);
  res.json(expenses.map(hydrateExpense));
});

router.post("/", (req, res) => {
  const listOwnerId = req.body.list ? Number(req.body.list) : req.userId;
  if (!hasListAccess(req.userId, listOwnerId)) {
    return res.status(403).json({ error: "You don't have access to that list" });
  }

  const description = (req.body.description || "").trim();
  const amountCents = toCents(req.body.amount);
  const paidBy = req.body.paid_by ? Number(req.body.paid_by) : req.userId;
  const splitType = req.body.split_type || "equal";

  if (!description) {
    return res.status(400).json({ error: "Description is required" });
  }
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }
  if (!hasListAccess(paidBy, listOwnerId)) {
    return res.status(400).json({ error: "paid_by must be a member of the list" });
  }
  if (!["equal", "exact", "percentage"].includes(splitType)) {
    return res.status(400).json({ error: "split_type must be 'equal', 'exact', or 'percentage'" });
  }

  const members = listMemberIds(listOwnerId);
  let shares;

  if (splitType === "equal") {
    const participants = req.body.participants ? req.body.participants.map(Number) : members;
    if (participants.length === 0) {
      return res.status(400).json({ error: "At least one participant is required" });
    }
    if (participants.some((id) => !members.includes(id))) {
      return res.status(400).json({ error: "All participants must be members of the list" });
    }
    shares = splitEqually(amountCents, participants);
  } else if (splitType === "exact") {
    const input = req.body.shares || [];
    if (input.length === 0) {
      return res.status(400).json({ error: "shares is required for an exact split" });
    }
    shares = input.map((s) => ({ user_id: Number(s.user_id), share_cents: toCents(s.amount) }));
    if (shares.some((s) => !members.includes(s.user_id))) {
      return res.status(400).json({ error: "All shares must belong to members of the list" });
    }
    const total = shares.reduce((sum, s) => sum + s.share_cents, 0);
    if (total !== amountCents) {
      return res.status(400).json({ error: "Shares must add up to the total amount" });
    }
  } else {
    const input = req.body.shares || [];
    if (input.length === 0) {
      return res.status(400).json({ error: "shares is required for a percentage split" });
    }
    const pctTotal = input.reduce((sum, s) => sum + Number(s.percentage), 0);
    if (Math.round(pctTotal * 100) !== 10000) {
      return res.status(400).json({ error: "Percentages must add up to 100" });
    }
    const userIds = input.map((s) => Number(s.user_id));
    if (userIds.some((id) => !members.includes(id))) {
      return res.status(400).json({ error: "All shares must belong to members of the list" });
    }
    // Compute each share by percentage, then hand any rounding remainder to the
    // largest shares first so the total still matches amountCents exactly.
    const raw = input.map((s, i) => ({
      user_id: userIds[i],
      exact: (amountCents * Number(s.percentage)) / 100,
    }));
    const floored = raw.map((r) => ({ user_id: r.user_id, share_cents: Math.floor(r.exact), remainder: r.exact - Math.floor(r.exact) }));
    let leftover = amountCents - floored.reduce((sum, r) => sum + r.share_cents, 0);
    floored
      .slice()
      .sort((a, b) => b.remainder - a.remainder)
      .forEach((r) => {
        if (leftover > 0) {
          r.share_cents += 1;
          leftover -= 1;
        }
      });
    shares = floored.map((r) => ({ user_id: r.user_id, share_cents: r.share_cents }));
  }

  const insertExpense = db.prepare(
    `INSERT INTO expenses (list_owner_id, paid_by, description, amount_cents, split_type, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insertShare = db.prepare(
    "INSERT INTO expense_shares (expense_id, user_id, share_cents) VALUES (?, ?, ?)"
  );

  const expenseId = db.transaction(() => {
    const result = insertExpense.run(listOwnerId, paidBy, description, amountCents, splitType, req.userId);
    for (const share of shares) {
      insertShare.run(result.lastInsertRowid, share.user_id, share.share_cents);
    }
    return result.lastInsertRowid;
  })();

  const expense = db.prepare("SELECT * FROM expenses WHERE id = ?").get(expenseId);
  res.status(201).json(hydrateExpense(expense));
});

router.delete("/:id", (req, res) => {
  const expense = db.prepare("SELECT * FROM expenses WHERE id = ?").get(req.params.id);
  if (!expense || !hasListAccess(req.userId, expense.list_owner_id)) {
    return res.status(404).json({ error: "Expense not found" });
  }

  db.prepare("DELETE FROM expenses WHERE id = ?").run(expense.id);
  res.status(204).end();
});

router.get("/balances", (req, res) => {
  const listOwnerId = req.query.list ? Number(req.query.list) : req.userId;
  if (!hasListAccess(req.userId, listOwnerId)) {
    return res.status(403).json({ error: "You don't have access to that list" });
  }

  const members = db
    .prepare(
      `SELECT id, username, nickname FROM users WHERE id = ?
       UNION
       SELECT users.id, users.username, users.nickname
       FROM collaborators JOIN users ON users.id = collaborators.user_id
       WHERE collaborators.list_owner_id = ? AND collaborators.status = 'accepted'`
    )
    .all(listOwnerId, listOwnerId);

  const paid = db
    .prepare("SELECT paid_by AS user_id, SUM(amount_cents) AS total FROM expenses WHERE list_owner_id = ? GROUP BY paid_by")
    .all(listOwnerId);
  const owed = db
    .prepare(
      `SELECT expense_shares.user_id AS user_id, SUM(expense_shares.share_cents) AS total
       FROM expense_shares JOIN expenses ON expenses.id = expense_shares.expense_id
       WHERE expenses.list_owner_id = ? GROUP BY expense_shares.user_id`
    )
    .all(listOwnerId);
  const settledPaid = db
    .prepare("SELECT from_user_id AS user_id, SUM(amount_cents) AS total FROM settlements WHERE list_owner_id = ? GROUP BY from_user_id")
    .all(listOwnerId);
  const settledReceived = db
    .prepare("SELECT to_user_id AS user_id, SUM(amount_cents) AS total FROM settlements WHERE list_owner_id = ? GROUP BY to_user_id")
    .all(listOwnerId);

  const totals = new Map(members.map((m) => [m.id, 0]));
  const apply = (rows, sign) => rows.forEach((r) => totals.set(r.user_id, (totals.get(r.user_id) || 0) + sign * r.total));
  apply(paid, 1);
  apply(owed, -1);
  apply(settledPaid, 1);
  apply(settledReceived, -1);

  const balances = members.map((m) => ({
    user_id: m.id,
    username: m.username,
    nickname: m.nickname,
    balance: toAmount(totals.get(m.id) || 0),
  }));

  res.json(balances);
});

router.get("/settlements", (req, res) => {
  const listOwnerId = req.query.list ? Number(req.query.list) : req.userId;
  if (!hasListAccess(req.userId, listOwnerId)) {
    return res.status(403).json({ error: "You don't have access to that list" });
  }

  const settlements = db
    .prepare("SELECT * FROM settlements WHERE list_owner_id = ? ORDER BY created_at DESC, id DESC")
    .all(listOwnerId);
  res.json(
    settlements.map((s) => ({
      id: s.id,
      list: s.list_owner_id,
      from_user_id: s.from_user_id,
      to_user_id: s.to_user_id,
      amount: toAmount(s.amount_cents),
      note: s.note,
      created_at: s.created_at,
    }))
  );
});

router.post("/settlements", (req, res) => {
  const listOwnerId = req.body.list ? Number(req.body.list) : req.userId;
  if (!hasListAccess(req.userId, listOwnerId)) {
    return res.status(403).json({ error: "You don't have access to that list" });
  }

  const fromUserId = Number(req.body.from_user_id);
  const toUserId = Number(req.body.to_user_id);
  const amountCents = toCents(req.body.amount);

  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }
  if (fromUserId === toUserId) {
    return res.status(400).json({ error: "from_user_id and to_user_id must differ" });
  }
  if (!hasListAccess(fromUserId, listOwnerId) || !hasListAccess(toUserId, listOwnerId)) {
    return res.status(400).json({ error: "Both users must be members of the list" });
  }

  const result = db
    .prepare(
      "INSERT INTO settlements (list_owner_id, from_user_id, to_user_id, amount_cents, note) VALUES (?, ?, ?, ?, ?)"
    )
    .run(listOwnerId, fromUserId, toUserId, amountCents, req.body.note || null);

  const settlement = db.prepare("SELECT * FROM settlements WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({
    id: settlement.id,
    list: settlement.list_owner_id,
    from_user_id: settlement.from_user_id,
    to_user_id: settlement.to_user_id,
    amount: toAmount(settlement.amount_cents),
    note: settlement.note,
    created_at: settlement.created_at,
  });
});

export default router;
