import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import db, { ensureDefaultListForUser } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { sendVerificationEmail } from "../email.js";

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const MIN_PASSWORD_LENGTH = 8;
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

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

function issueVerificationToken(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS).toISOString();
  db.prepare("UPDATE users SET verification_token = ?, verification_expires_at = ? WHERE id = ?").run(
    token,
    expiresAt,
    userId
  );
  return token;
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
      .prepare("INSERT INTO users (username, email, google_id, email_verified) VALUES (?, ?, ?, 1)")
      .run(username, payload.email, payload.sub);
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
    ensureDefaultListForUser(user.id);
  } else if (!user.google_id) {
    db.prepare("UPDATE users SET google_id = ?, email_verified = 1 WHERE id = ?").run(payload.sub, user.id);
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

router.post("/signup", async (req, res) => {
  const username = (req.body.username || "").trim();
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";

  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ error: "Username can only contain letters, numbers, and underscores" });
  }
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  const existingByEmail = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (existingByEmail) {
    if (existingByEmail.google_id && !existingByEmail.password_hash) {
      return res.status(409).json({ error: "This email is already registered - sign in with Google instead" });
    }
    return res.status(409).json({ error: "An account with that email already exists" });
  }
  if (db.prepare("SELECT id FROM users WHERE username = ?").get(username)) {
    return res.status(409).json({ error: "That username is taken" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = db
    .prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)")
    .run(username, email, passwordHash);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
  ensureDefaultListForUser(user.id);

  const token = issueVerificationToken(user.id);
  sendVerificationEmail(user, token).catch((err) => console.error("Failed to send verification email:", err));

  res.status(201).json({ message: "Account created. Check your email to verify your address before logging in." });
});

router.post("/login", async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  if (!user.password_hash) {
    return res.status(401).json({ error: "This account uses Google sign-in" });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  if (!user.email_verified) {
    return res.status(403).json({ error: "Please verify your email before logging in", code: "EMAIL_NOT_VERIFIED" });
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

router.get("/verify-email", (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(400).json({ error: "Missing token" });
  }

  const user = db.prepare("SELECT * FROM users WHERE verification_token = ?").get(token);
  if (!user) {
    return res.status(400).json({ error: "Invalid or expired verification link" });
  }
  if (user.verification_expires_at && new Date(user.verification_expires_at) < new Date()) {
    return res.status(400).json({ error: "This verification link has expired. Request a new one." });
  }

  db.prepare(
    "UPDATE users SET email_verified = 1, verification_token = NULL, verification_expires_at = NULL WHERE id = ?"
  ).run(user.id);
  res.json({ verified: true });
});

router.post("/resend-verification", (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  const confirmation = { message: "If that account needs verification, a new email has been sent." };

  // Don't reveal whether an account exists, or resend to already-verified/Google-only accounts.
  if (!user || user.email_verified || !user.password_hash) {
    return res.json(confirmation);
  }

  const token = issueVerificationToken(user.id);
  sendVerificationEmail(user, token).catch((err) => console.error("Failed to send verification email:", err));
  res.json(confirmation);
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
