import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { canAccessList } from "./todos.js";
import { sendListShareInviteEmail, sendListShareAcceptedEmail } from "../email.js";

const router = Router();

router.use(requireAuth);

// Lists shared with me (accepted), and invites I've received that are still pending.
router.get("/mine", (req, res) => {
  const sharedWithMe = db
    .prepare(
      `SELECT list_shares.id AS share_id, lists.id, lists.name, users.id AS owner_id,
              users.username AS owner_username, users.nickname AS owner_nickname
       FROM list_shares
       JOIN lists ON lists.id = list_shares.list_id
       JOIN users ON users.id = lists.user_id
       WHERE list_shares.user_id = ? AND list_shares.status = 'accepted'`
    )
    .all(req.userId);

  const invitesReceived = db
    .prepare(
      `SELECT list_shares.id AS share_id, lists.id AS list_id, lists.name AS list_name, users.id AS owner_id,
              users.username AS owner_username, users.nickname AS owner_nickname
       FROM list_shares
       JOIN lists ON lists.id = list_shares.list_id
       JOIN users ON users.id = lists.user_id
       WHERE list_shares.user_id = ? AND list_shares.status = 'pending'`
    )
    .all(req.userId);

  res.json({ sharedWithMe, invitesReceived });
});

// Owner + accepted/pending shares on a given list, for the share-management UI and for
// attributing "added by" on tasks within that list.
router.get("/:listId", (req, res) => {
  const list = db.prepare("SELECT * FROM lists WHERE id = ?").get(req.params.listId);
  if (!list || !canAccessList(req.userId, list)) {
    return res.status(404).json({ error: "List not found" });
  }

  const owner = db.prepare("SELECT id, username, nickname FROM users WHERE id = ?").get(list.user_id);
  const shares = db
    .prepare(
      `SELECT list_shares.id, users.id AS user_id, users.username, users.nickname, list_shares.status
       FROM list_shares
       JOIN users ON users.id = list_shares.user_id
       WHERE list_shares.list_id = ?`
    )
    .all(list.id);

  res.json({ owner, shares });
});

router.post("/:listId/invite", (req, res) => {
  const list = db.prepare("SELECT * FROM lists WHERE id = ?").get(req.params.listId);
  if (!list || list.user_id !== req.userId) {
    return res.status(404).json({ error: "List not found" });
  }

  const email = (req.body.email || "").trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const invitee = db.prepare("SELECT * FROM users WHERE lower(email) = ?").get(email);
  if (!invitee) {
    return res.status(404).json({ error: "No account found with that email" });
  }
  if (invitee.id === req.userId) {
    return res.status(400).json({ error: "You can't invite yourself" });
  }

  const existing = db
    .prepare("SELECT id FROM list_shares WHERE list_id = ? AND user_id = ?")
    .get(list.id, invitee.id);
  if (existing) {
    return res.status(409).json({ error: "That person is already invited or collaborating" });
  }

  const result = db
    .prepare("INSERT INTO list_shares (list_id, user_id, status) VALUES (?, ?, 'pending')")
    .run(list.id, invitee.id);

  const owner = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  sendListShareInviteEmail(owner, invitee, list).catch((err) => console.error("Failed to send invite email:", err));

  res.status(201).json({ id: result.lastInsertRowid, user_id: invitee.id, username: invitee.username, nickname: invitee.nickname, status: "pending" });
});

router.post("/:id/accept", (req, res) => {
  const invite = db
    .prepare("SELECT * FROM list_shares WHERE id = ? AND user_id = ? AND status = 'pending'")
    .get(req.params.id, req.userId);
  if (!invite) {
    return res.status(404).json({ error: "Invite not found" });
  }

  db.prepare("UPDATE list_shares SET status = 'accepted' WHERE id = ?").run(invite.id);

  const list = db.prepare("SELECT * FROM lists WHERE id = ?").get(invite.list_id);
  const owner = db.prepare("SELECT * FROM users WHERE id = ?").get(list.user_id);
  const collaborator = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  sendListShareAcceptedEmail(owner, collaborator, list).catch((err) => console.error("Failed to send accepted email:", err));

  res.json({ id: invite.id, list_id: invite.list_id, status: "accepted" });
});

router.post("/:id/decline", (req, res) => {
  const result = db
    .prepare("DELETE FROM list_shares WHERE id = ? AND user_id = ? AND status = 'pending'")
    .run(req.params.id, req.userId);
  if (result.changes === 0) {
    return res.status(404).json({ error: "Invite not found" });
  }
  res.status(204).end();
});

// Owner removes a member, or a member removes themselves (leaves the list).
router.delete("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM list_shares WHERE id = ?").get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: "Not found" });
  }
  const list = db.prepare("SELECT * FROM lists WHERE id = ?").get(row.list_id);
  if (!list || (list.user_id !== req.userId && row.user_id !== req.userId)) {
    return res.status(404).json({ error: "Not found" });
  }
  db.prepare("DELETE FROM list_shares WHERE id = ?").run(row.id);
  res.status(204).end();
});

export default router;
