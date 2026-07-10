import express from "express";
import jwt from "jsonwebtoken";
import db, { ensureDefaultListForUser } from "../db.js";
import authRoutes from "../routes/auth.js";
import todoRoutes from "../routes/todos.js";
import collaboratorRoutes from "../routes/collaborators.js";
import listRoutes from "../routes/lists.js";
import listGroupRoutes from "../routes/list-groups.js";
import subtaskRoutes from "../routes/subtasks.js";
import expenseRoutes from "../routes/expenses.js";
import listShareRoutes from "../routes/list-shares.js";

export function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/todos", todoRoutes);
  app.use("/api/collaborators", collaboratorRoutes);
  app.use("/api/lists", listRoutes);
  app.use("/api/list-groups", listGroupRoutes);
  app.use("/api/subtasks", subtaskRoutes);
  app.use("/api/expenses", expenseRoutes);
  app.use("/api/list-shares", listShareRoutes);
  return app;
}

export function signTestToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

let userCounter = 0;

export function seedUser(overrides = {}) {
  userCounter += 1;
  const username = overrides.username ?? `user${userCounter}`;
  const email = overrides.email ?? `user${userCounter}@example.com`;
  const googleId = overrides.googleId ?? null;
  const nickname = overrides.nickname ?? null;

  const result = db
    .prepare("INSERT INTO users (username, email, google_id, nickname) VALUES (?, ?, ?, ?)")
    .run(username, email, googleId, nickname);
  ensureDefaultListForUser(result.lastInsertRowid);
  return db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
}

export function seedList(userId, overrides = {}) {
  const name = overrides.name ?? "My List";
  const result = db
    .prepare("INSERT INTO lists (user_id, group_id, name, ordering) VALUES (?, ?, ?, ?)")
    .run(userId, overrides.group_id ?? null, name, overrides.ordering ?? 0);
  return db.prepare("SELECT * FROM lists WHERE id = ?").get(result.lastInsertRowid);
}

export function getDefaultList(userId) {
  return db.prepare("SELECT * FROM lists WHERE user_id = ? AND is_default = 1").get(userId);
}

export function seedListShare(listId, userId, status = "accepted") {
  const result = db
    .prepare("INSERT INTO list_shares (list_id, user_id, status) VALUES (?, ?, ?)")
    .run(listId, userId, status);
  return db.prepare("SELECT * FROM list_shares WHERE id = ?").get(result.lastInsertRowid);
}
