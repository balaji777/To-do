import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { buildApp, seedUser, seedListShare, getDefaultList, signTestToken } from "../helpers.js";
import db from "../../db.js";

describe("subtasks routes", () => {
  let app;
  let user;
  let token;
  let todoId;

  beforeEach(async () => {
    app = buildApp();
    user = seedUser();
    token = signTestToken(user.id);
    const todo = await request(app)
      .post("/api/todos")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Ship the release" });
    todoId = todo.body.id;
  });

  function authed(req) {
    return req.set("Authorization", `Bearer ${token}`);
  }

  it("creates subtasks in order", async () => {
    const first = await authed(request(app).post("/api/subtasks")).send({ todo_id: todoId, title: "Write changelog" });
    const second = await authed(request(app).post("/api/subtasks")).send({ todo_id: todoId, title: "Tag release" });

    expect(first.status).toBe(201);
    expect(first.body.ordering).toBe(0);
    expect(second.body.ordering).toBe(1);
  });

  it("lists subtasks for a todo ordered by ordering", async () => {
    await authed(request(app).post("/api/subtasks")).send({ todo_id: todoId, title: "First" });
    await authed(request(app).post("/api/subtasks")).send({ todo_id: todoId, title: "Second" });

    const res = await authed(request(app).get(`/api/subtasks?todo=${todoId}`));
    expect(res.status).toBe(200);
    expect(res.body.map((s) => s.title)).toEqual(["First", "Second"]);
  });

  it("requires a title", async () => {
    const res = await authed(request(app).post("/api/subtasks")).send({ todo_id: todoId });
    expect(res.status).toBe(400);
  });

  it("toggles a subtask done", async () => {
    const created = await authed(request(app).post("/api/subtasks")).send({ todo_id: todoId, title: "Write changelog" });
    const res = await authed(request(app).patch(`/api/subtasks/${created.body.id}`)).send({ done: true });

    expect(res.status).toBe(200);
    expect(res.body.done).toBe(1);
  });

  it("reorders a subtask", async () => {
    const created = await authed(request(app).post("/api/subtasks")).send({ todo_id: todoId, title: "Write changelog" });
    const res = await authed(request(app).patch(`/api/subtasks/${created.body.id}`)).send({ ordering: 5 });

    expect(res.status).toBe(200);
    expect(res.body.ordering).toBe(5);
  });

  it("deletes a subtask", async () => {
    const created = await authed(request(app).post("/api/subtasks")).send({ todo_id: todoId, title: "Write changelog" });
    const res = await authed(request(app).delete(`/api/subtasks/${created.body.id}`));

    expect(res.status).toBe(204);
    expect(db.prepare("SELECT * FROM subtasks WHERE id = ?").get(created.body.id)).toBeUndefined();
  });

  it("denies access to a subtask on a todo the user can't access", async () => {
    const other = seedUser();
    const otherToken = signTestToken(other.id);
    const otherTodo = await request(app)
      .post("/api/todos")
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ title: "Not yours" });

    const res = await authed(request(app).post("/api/subtasks")).send({
      todo_id: otherTodo.body.id,
      title: "Sneaky",
    });
    expect(res.status).toBe(404);
  });

  it("allows subtask access via an accepted share on the todo's list", async () => {
    const collaborator = seedUser();
    const collaboratorToken = signTestToken(collaborator.id);
    const list = getDefaultList(user.id);
    seedListShare(list.id, collaborator.id, "accepted");

    const res = await request(app)
      .post("/api/subtasks")
      .set("Authorization", `Bearer ${collaboratorToken}`)
      .send({ todo_id: todoId, title: "Collaborator's subtask" });

    expect(res.status).toBe(201);
  });
});
