import express from "express";
import jwt from "jsonwebtoken";
import db from "../db.js";
import authRoutes from "../routes/auth.js";
import todoRoutes from "../routes/todos.js";
import collaboratorRoutes from "../routes/collaborators.js";
import categoryRoutes from "../routes/categories.js";
import labelRoutes from "../routes/labels.js";
import subtaskRoutes from "../routes/subtasks.js";

export function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/todos", todoRoutes);
  app.use("/api/collaborators", collaboratorRoutes);
  app.use("/api/categories", categoryRoutes);
  app.use("/api/labels", labelRoutes);
  app.use("/api/subtasks", subtaskRoutes);
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
  return db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
}
