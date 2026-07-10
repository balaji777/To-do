import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { buildApp, seedUser, seedList, getDefaultList, seedListShare, signTestToken } from "../helpers.js";
import db from "../../db.js";

describe("todos routes", () => {
  let app;
  let user;
  let token;
  let defaultList;

  beforeEach(() => {
    app = buildApp();
    user = seedUser();
    token = signTestToken(user.id);
    defaultList = getDefaultList(user.id);
  });

  function authed(req) {
    return req.set("Authorization", `Bearer ${token}`);
  }

  describe("POST /api/todos", () => {
    it("creates a todo on the caller's default list", async () => {
      const res = await authed(request(app).post("/api/todos")).send({ title: "Write tests" });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe("Write tests");
      expect(res.body.priority).toBe("medium");
      expect(res.body.recurrence).toBe("none");
      expect(res.body.done).toBe(0);
      expect(res.body.list_id).toBe(defaultList.id);
      expect(res.body.important).toBe(0);
    });

    it("creates a todo on a named list", async () => {
      const list = seedList(user.id, { name: "Groceries" });
      const res = await authed(request(app).post("/api/todos")).send({ title: "Milk", list_id: list.id });
      expect(res.status).toBe(201);
      expect(res.body.list_id).toBe(list.id);
    });

    it("accepts important, notes, and my_day", async () => {
      const res = await authed(request(app).post("/api/todos")).send({
        title: "Plan trip",
        important: true,
        notes: "Remember passports",
        my_day: true,
      });
      expect(res.status).toBe(201);
      expect(res.body.important).toBe(1);
      expect(res.body.notes).toBe("Remember passports");
      expect(res.body.my_day_date).toBeTruthy();
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
      const otherList = getDefaultList(other.id);
      const res = await authed(request(app).post("/api/todos")).send({ title: "x", list_id: otherList.id });
      expect(res.status).toBe(403);
    });

    it("includes an empty subtasks array by default", async () => {
      const res = await authed(request(app).post("/api/todos")).send({ title: "x" });
      expect(res.body.subtasks).toEqual([]);
    });
  });

  describe("GET /api/todos", () => {
    it("lists the caller's default-list todos with no list_id given", async () => {
      await authed(request(app).post("/api/todos")).send({ title: "A" });
      await authed(request(app).post("/api/todos")).send({ title: "B" });

      const res = await authed(request(app).get("/api/todos"));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it("lists todos for a specific list_id", async () => {
      const list = seedList(user.id, { name: "Work" });
      await authed(request(app).post("/api/todos")).send({ title: "On default list" });
      await authed(request(app).post("/api/todos")).send({ title: "On work list", list_id: list.id });

      const res = await authed(request(app).get(`/api/todos?list_id=${list.id}`));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe("On work list");
    });

    it("denies access to another user's list without collaboration", async () => {
      const other = seedUser();
      const otherList = getDefaultList(other.id);
      const res = await authed(request(app).get(`/api/todos?list_id=${otherList.id}`));
      expect(res.status).toBe(403);
    });

    it("allows access to a shared list via an accepted list share", async () => {
      const owner = seedUser();
      const ownerList = getDefaultList(owner.id);
      db.prepare("INSERT INTO todos (user_id, list_id, title) VALUES (?, ?, ?)").run(
        owner.id,
        ownerList.id,
        "Owner's task"
      );
      seedListShare(ownerList.id, user.id, "accepted");

      const res = await authed(request(app).get(`/api/todos?list_id=${ownerList.id}`));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it("denies access via a pending (not yet accepted) list share", async () => {
      const owner = seedUser();
      const ownerList = getDefaultList(owner.id);
      seedListShare(ownerList.id, user.id, "pending");

      const res = await authed(request(app).get(`/api/todos?list_id=${ownerList.id}`));
      expect(res.status).toBe(403);
    });

    it("denies access to a different, unshared list on the same owner's account", async () => {
      const owner = seedUser();
      const sharedList = seedList(owner.id, { name: "Shared" });
      const otherList = seedList(owner.id, { name: "Not shared" });
      seedListShare(sharedList.id, user.id, "accepted");

      const res = await authed(request(app).get(`/api/todos?list_id=${otherList.id}`));
      expect(res.status).toBe(403);
    });
  });

  describe("smart views", () => {
    it("GET /api/todos/my-day returns only todos added to My Day today", async () => {
      await authed(request(app).post("/api/todos")).send({ title: "In My Day", my_day: true });
      await authed(request(app).post("/api/todos")).send({ title: "Not in My Day" });

      const res = await authed(request(app).get("/api/todos/my-day"));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe("In My Day");
    });

    it("GET /api/todos/important returns only starred, unfinished todos", async () => {
      const starred = await authed(request(app).post("/api/todos")).send({ title: "Starred", important: true });
      await authed(request(app).post("/api/todos")).send({ title: "Not starred" });

      const res = await authed(request(app).get("/api/todos/important"));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(starred.body.id);
    });

    it("GET /api/todos/planned returns only todos with a due date", async () => {
      await authed(request(app).post("/api/todos")).send({ title: "Has due date", due_date: "2026-02-01" });
      await authed(request(app).post("/api/todos")).send({ title: "No due date" });

      const res = await authed(request(app).get("/api/todos/planned"));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe("Has due date");
    });

    it("smart views span every list on the account", async () => {
      const list = seedList(user.id, { name: "Work" });
      await authed(request(app).post("/api/todos")).send({ title: "Default list important", important: true });
      await authed(request(app).post("/api/todos")).send({
        title: "Work list important",
        important: true,
        list_id: list.id,
      });

      const res = await authed(request(app).get("/api/todos/important"));
      expect(res.body).toHaveLength(2);
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

    it("toggles important and notes", async () => {
      const created = await authed(request(app).post("/api/todos")).send({ title: "Original" });
      const res = await authed(request(app).patch(`/api/todos/${created.body.id}`)).send({
        important: true,
        notes: "Some notes",
      });
      expect(res.status).toBe(200);
      expect(res.body.important).toBe(1);
      expect(res.body.notes).toBe("Some notes");
    });

    it("adds and removes a todo from My Day", async () => {
      const created = await authed(request(app).post("/api/todos")).send({ title: "Original" });
      const added = await authed(request(app).patch(`/api/todos/${created.body.id}`)).send({ my_day: true });
      expect(added.body.my_day_date).toBeTruthy();

      const removed = await authed(request(app).patch(`/api/todos/${created.body.id}`)).send({ my_day: false });
      expect(removed.body.my_day_date).toBeNull();
    });

    it("moves a todo to a different list on the same account", async () => {
      const list = seedList(user.id, { name: "Work" });
      const created = await authed(request(app).post("/api/todos")).send({ title: "Original" });

      const res = await authed(request(app).patch(`/api/todos/${created.body.id}`)).send({ list_id: list.id });
      expect(res.status).toBe(200);
      expect(res.body.list_id).toBe(list.id);
    });

    it("rejects moving a todo to a list on another account", async () => {
      const other = seedUser();
      const otherList = getDefaultList(other.id);
      const created = await authed(request(app).post("/api/todos")).send({ title: "Original" });

      const res = await authed(request(app).patch(`/api/todos/${created.body.id}`)).send({
        list_id: otherList.id,
      });
      expect(res.status).toBe(400);
    });

    it("rejects a shared-list collaborator moving a todo into the owner's other, unshared list", async () => {
      const owner = seedUser();
      const ownerToken = signTestToken(owner.id);
      const sharedList = seedList(owner.id, { name: "Shared" });
      const otherList = seedList(owner.id, { name: "Not shared" });
      seedListShare(sharedList.id, user.id, "accepted");

      const created = await request(app)
        .post("/api/todos")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ title: "Owner's task", list_id: sharedList.id });

      const res = await authed(request(app).patch(`/api/todos/${created.body.id}`)).send({
        list_id: otherList.id,
      });
      expect(res.status).toBe(400);
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

    it("creates the next occurrence when a recurring todo with a due date is completed", async () => {
      const created = await authed(request(app).post("/api/todos")).send({
        title: "Standup",
        due_date: "2026-01-05",
        recurrence: "daily",
      });

      const res = await authed(request(app).patch(`/api/todos/${created.body.id}`)).send({ done: true });
      expect(res.status).toBe(200);

      const all = db.prepare("SELECT * FROM todos WHERE user_id = ?").all(user.id);
      expect(all).toHaveLength(2);
      const nextOccurrence = all.find((t) => t.id !== created.body.id);
      expect(nextOccurrence.due_date).toBe("2026-01-06");
      expect(nextOccurrence.done).toBe(0);
      expect(nextOccurrence.list_id).toBe(defaultList.id);
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
