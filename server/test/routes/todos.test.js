import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { buildApp, seedUser, signTestToken } from "../helpers.js";
import db from "../../db.js";

describe("todos routes", () => {
  let app;
  let user;
  let token;

  beforeEach(() => {
    app = buildApp();
    user = seedUser();
    token = signTestToken(user.id);
  });

  function authed(req) {
    return req.set("Authorization", `Bearer ${token}`);
  }

  describe("POST /api/todos", () => {
    it("creates a todo with defaults", async () => {
      const res = await authed(request(app).post("/api/todos")).send({ title: "Write tests" });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe("Write tests");
      expect(res.body.priority).toBe("medium");
      expect(res.body.recurrence).toBe("none");
      expect(res.body.done).toBe(0);
    });

    it("rejects a missing title", async () => {
      const res = await authed(request(app).post("/api/todos")).send({});
      expect(res.status).toBe(400);
    });

    it("rejects an invalid priority", async () => {
      const res = await authed(request(app).post("/api/todos")).send({ title: "x", priority: "urgent" });
      expect(res.status).toBe(400);
    });

    it("rejects an invalid recurrence", async () => {
      const res = await authed(request(app).post("/api/todos")).send({ title: "x", recurrence: "yearly" });
      expect(res.status).toBe(400);
    });

    it("rejects creating on a list the user doesn't have access to", async () => {
      const other = seedUser();
      const res = await authed(request(app).post("/api/todos")).send({ title: "x", list: other.id });
      expect(res.status).toBe(403);
    });

    it("defaults type to 'task' and accepts a link", async () => {
      const res = await authed(request(app).post("/api/todos")).send({
        title: "Fix crash",
        link: "https://github.com/acme/app/issues/42",
      });
      expect(res.status).toBe(201);
      expect(res.body.type).toBe("task");
      expect(res.body.link).toBe("https://github.com/acme/app/issues/42");
    });

    it("accepts a valid type", async () => {
      const res = await authed(request(app).post("/api/todos")).send({ title: "Crash on save", type: "bug" });
      expect(res.status).toBe(201);
      expect(res.body.type).toBe("bug");
    });

    it("rejects an invalid type", async () => {
      const res = await authed(request(app).post("/api/todos")).send({ title: "x", type: "epic" });
      expect(res.status).toBe(400);
    });

    it("accepts a valid category_id and returns the joined category_name", async () => {
      const category = db
        .prepare("INSERT INTO categories (user_id, name) VALUES (?, ?)")
        .run(user.id, "Bugs");
      const res = await authed(request(app).post("/api/todos")).send({
        title: "Fix crash",
        category_id: category.lastInsertRowid,
      });
      expect(res.status).toBe(201);
      expect(res.body.category_id).toBe(category.lastInsertRowid);
      expect(res.body.category_name).toBe("Bugs");
    });

    it("rejects a category_id belonging to another user", async () => {
      const other = seedUser();
      const category = db.prepare("INSERT INTO categories (user_id, name) VALUES (?, ?)").run(other.id, "Bugs");

      const res = await authed(request(app).post("/api/todos")).send({
        title: "x",
        category_id: category.lastInsertRowid,
      });
      expect(res.status).toBe(400);
    });

    it("includes empty labels and subtasks arrays by default", async () => {
      const res = await authed(request(app).post("/api/todos")).send({ title: "x" });
      expect(res.body.labels).toEqual([]);
      expect(res.body.subtasks).toEqual([]);
    });
  });

  describe("GET /api/todos", () => {
    it("lists the caller's own todos", async () => {
      await authed(request(app).post("/api/todos")).send({ title: "A" });
      await authed(request(app).post("/api/todos")).send({ title: "B" });

      const res = await authed(request(app).get("/api/todos"));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it("denies access to another user's list without collaboration", async () => {
      const other = seedUser();
      const res = await authed(request(app).get(`/api/todos?list=${other.id}`));
      expect(res.status).toBe(403);
    });

    it("allows access to a list via an accepted collaboration", async () => {
      const owner = seedUser();
      db.prepare("INSERT INTO todos (user_id, title) VALUES (?, ?)").run(owner.id, "Owner's task");
      db.prepare("INSERT INTO collaborators (list_owner_id, user_id, status) VALUES (?, ?, 'accepted')").run(
        owner.id,
        user.id
      );

      const res = await authed(request(app).get(`/api/todos?list=${owner.id}`));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it("denies access via a pending (not yet accepted) collaboration", async () => {
      const owner = seedUser();
      db.prepare("INSERT INTO collaborators (list_owner_id, user_id, status) VALUES (?, ?, 'pending')").run(
        owner.id,
        user.id
      );

      const res = await authed(request(app).get(`/api/todos?list=${owner.id}`));
      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/todos/:id", () => {
    it("updates fields", async () => {
      const created = await authed(request(app).post("/api/todos")).send({ title: "Original" });
      const res = await authed(request(app).patch(`/api/todos/${created.body.id}`)).send({
        title: "Updated",
        priority: "high",
      });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe("Updated");
      expect(res.body.priority).toBe("high");
    });

    it("returns 404 for a todo belonging to another user", async () => {
      const other = seedUser();
      const otherToken = signTestToken(other.id);
      const created = await request(app)
        .post("/api/todos")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ title: "Not yours" });

      const res = await authed(request(app).patch(`/api/todos/${created.body.id}`)).send({ title: "Hijack" });
      expect(res.status).toBe(404);
    });

    it("updates type and link", async () => {
      const created = await authed(request(app).post("/api/todos")).send({ title: "Original" });
      const res = await authed(request(app).patch(`/api/todos/${created.body.id}`)).send({
        type: "feature",
        link: "https://github.com/acme/app/pull/7",
      });

      expect(res.status).toBe(200);
      expect(res.body.type).toBe("feature");
      expect(res.body.link).toBe("https://github.com/acme/app/pull/7");
    });

    it("rejects an invalid type on update", async () => {
      const created = await authed(request(app).post("/api/todos")).send({ title: "Original" });
      const res = await authed(request(app).patch(`/api/todos/${created.body.id}`)).send({ type: "epic" });
      expect(res.status).toBe(400);
    });

    it("creates the next occurrence when a recurring todo with a due date is completed", async () => {
      const created = await authed(request(app).post("/api/todos")).send({
        title: "Standup",
        due_date: "2026-01-05",
        recurrence: "daily",
        type: "chore",
        link: "https://example.com/standup-notes",
      });

      const res = await authed(request(app).patch(`/api/todos/${created.body.id}`)).send({ done: true });
      expect(res.status).toBe(200);

      const all = db.prepare("SELECT * FROM todos WHERE user_id = ?").all(user.id);
      expect(all).toHaveLength(2);
      const nextOccurrence = all.find((t) => t.id !== created.body.id);
      expect(nextOccurrence.due_date).toBe("2026-01-06");
      expect(nextOccurrence.done).toBe(0);
      expect(nextOccurrence.type).toBe("chore");
      expect(nextOccurrence.link).toBe("https://example.com/standup-notes");
    });

    it("does not create a next occurrence for a non-recurring todo", async () => {
      const created = await authed(request(app).post("/api/todos")).send({
        title: "One-off",
        due_date: "2026-01-05",
      });

      await authed(request(app).patch(`/api/todos/${created.body.id}`)).send({ done: true });

      const all = db.prepare("SELECT * FROM todos WHERE user_id = ?").all(user.id);
      expect(all).toHaveLength(1);
    });
  });

  describe("DELETE /api/todos/:id", () => {
    it("deletes a todo", async () => {
      const created = await authed(request(app).post("/api/todos")).send({ title: "Bye" });
      const res = await authed(request(app).delete(`/api/todos/${created.body.id}`));
      expect(res.status).toBe(204);

      const remaining = db.prepare("SELECT * FROM todos WHERE id = ?").get(created.body.id);
      expect(remaining).toBeUndefined();
    });

    it("returns 404 for a todo belonging to another user", async () => {
      const other = seedUser();
      const otherToken = signTestToken(other.id);
      const created = await request(app)
        .post("/api/todos")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ title: "Not yours" });

      const res = await authed(request(app).delete(`/api/todos/${created.body.id}`));
      expect(res.status).toBe(404);
    });
  });
});
