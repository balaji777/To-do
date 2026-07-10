import { Router } from "express";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function uniqueUsernameFromEmail(email) {
  const base = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "") || "user";
  let username = base;
  let suffix = 1;
  while (db.prepare("SELECT id FROM users WHERE username = ?").get(username)) {
    username = `${base}${suffix++}`;
  }
  return username;
}

router.post("/google", async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: "Missing Google credential" });
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: "Google sign-in is not configured on the server" });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: "Invalid Google credential" });
  }

  if (!payload.email_verified) {
    return res.status(401).json({ error: "Google email is not verified" });
  }

  let user = db.prepare("SELECT * FROM users WHERE google_id = ? OR email = ?").get(payload.sub, payload.email);

  if (!user) {
    const username = uniqueUsernameFromEmail(payload.email);
    const result = db
      .prepare("INSERT INTO users (username, email, google_id) VALUES (?, ?, ?)")
      .run(username, payload.email, payload.sub);
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
  } else if (!user.google_id) {
    db.prepare("UPDATE users SET google_id = ? WHERE id = ?").run(payload.sub, user.id);
  }

  const token = signToken(user.id);
  res.json({
    token,
    id: user.id,
    username: user.username,
    email: user.email,
    nickname: user.nickname,
    needsNickname: !user.nickname,
  });
});

router.patch("/nickname", requireAuth, (req, res) => {
  const nickname = (req.body.nickname || "").trim();
  if (!nickname) {
    return res.status(400).json({ error: "Nickname is required" });
  }
  if (nickname.length > 30) {
    return res.status(400).json({ error: "Nickname must be 30 characters or fewer" });
  }

  db.prepare("UPDATE users SET nickname = ? WHERE id = ?").run(nickname, req.userId);
  res.json({ nickname });
});

export default router;
