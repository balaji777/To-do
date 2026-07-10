import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { sendCollaboratorInviteEmail, sendCollaboratorAcceptedEmail } from "../email.js";

const router = Router();

router.use(requireAuth);

// Lists I own (always includes myself), lists shared with me, collaborators on my own list,
// and invites I've sent/received that are still pending.
router.get("/", (req, res) => {
  const myLists = db
    .prepare(
      `SELECT users.id, users.username, users.nickname
       FROM collaborators
       JOIN users ON users.id = collaborators.list_owner_id
       WHERE collaborators.user_id = ? AND collaborators.status = 'accepted'`
    )
    .all(req.userId);

  const myCollaborators = db
    .prepare(
      `SELECT collaborators.id, users.id AS user_id, users.username, users.nickname, collaborators.status
       FROM collaborators
       JOIN users ON users.id = collaborators.user_id
       WHERE collaborators.list_owner_id = ?`
    )
    .all(req.userId);

  const invitesReceived = db
    .prepare(
      `SELECT collaborators.id, users.id AS owner_id, users.username, users.nickname
       FROM collaborators
       JOIN users ON users.id = collaborators.list_owner_id
       WHERE collaborators.user_id = ? AND collaborators.status = 'pending'`
    )
    .all(req.userId);

  res.json({ myLists, myCollaborators, invitesReceived });
});

// Owner + accepted collaborators of a given list, for attributing "added by" on tasks.
router.get("/members", (req, res) => {
  const listOwnerId = req.query.list ? Number(req.query.list) : req.userId;

  if (listOwnerId !== req.userId) {
    const access = db
      .prepare("SELECT 1 FROM collaborators WHERE list_owner_id = ? AND user_id = ? AND status = 'accepted'")
      .get(listOwnerId, req.userId);
    if (!access) {
      return res.status(403).json({ error: "You don't have access to that list" });
    }
  }

  const owner = db.prepare("SELECT id, username, nickname FROM users WHERE id = ?").get(listOwnerId);
  const collaborators = db
    .prepare(
      `SELECT users.id, users.username, users.nickname
       FROM collaborators
       JOIN users ON users.id = collaborators.user_id
       WHERE collaborators.list_owner_id = ? AND collaborators.status = 'accepted'`
    )
    .all(listOwnerId);

  res.json([owner, ...collaborators]);
});

router.post("/invite", (req, res) => {
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
    .prepare("SELECT id FROM collaborators WHERE list_owner_id = ? AND user_id = ?")
    .get(req.userId, invitee.id);
  if (existing) {
    return res.status(409).json({ error: "That person is already invited or collaborating" });
  }

  const result = db
    .prepare("INSERT INTO collaborators (list_owner_id, user_id, status) VALUES (?, ?, 'pending')")
    .run(req.userId, invitee.id);

  const owner = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  sendCollaboratorInviteEmail(owner, invitee).catch((err) => console.error("Failed to send invite email:", err));

  res.status(201).json({ id: result.lastInsertRowid, user_id: invitee.id, username: invitee.username, nickname: invitee.nickname, status: "pending" });
});

router.post("/:id/accept", (req, res) => {
  const invite = db
    .prepare("SELECT * FROM collaborators WHERE id = ? AND user_id = ? AND status = 'pending'")
    .get(req.params.id, req.userId);
  if (!invite) {
    return res.status(404).json({ error: "Invite not found" });
  }

  db.prepare("UPDATE collaborators SET status = 'accepted' WHERE id = ?").run(invite.id);

  const owner = db.prepare("SELECT * FROM users WHERE id = ?").get(invite.list_owner_id);
  const collaborator = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  sendCollaboratorAcceptedEmail(owner, collaborator).catch((err) => console.error("Failed to send accepted email:", err));

  res.json({ id: invite.id, list_owner_id: invite.list_owner_id, status: "accepted" });
});

router.post("/:id/decline", (req, res) => {
  const result = db
    .prepare("DELETE FROM collaborators WHERE id = ? AND user_id = ? AND status = 'pending'")
    .run(req.params.id, req.userId);
  if (result.changes === 0) {
    return res.status(404).json({ error: "Invite not found" });
  }
  res.status(204).end();
});

// Owner removes a collaborator, or a collaborator removes themselves (leaves the list).
router.delete("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM collaborators WHERE id = ?").get(req.params.id);
  if (!row || (row.list_owner_id !== req.userId && row.user_id !== req.userId)) {
    return res.status(404).json({ error: "Not found" });
  }
  db.prepare("DELETE FROM collaborators WHERE id = ?").run(row.id);
  res.status(204).end();
});

export default router;
