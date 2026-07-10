import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { buildApp, seedUser, signTestToken } from "../helpers.js";

describe("labels routes", () => {
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

  it("creates and lists labels", async () => {
    await authed(request(app).post("/api/labels")).send({ name: "urgent", color: "#ff0000" });
    const res = await authed(request(app).get("/api/labels"));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ name: "urgent", color: "#ff0000" });
  });

  it("rejects a duplicate name (case-insensitive)", async () => {
    await authed(request(app).post("/api/labels")).send({ name: "urgent" });
    const res = await authed(request(app).post("/api/labels")).send({ name: "Urgent" });
    expect(res.status).toBe(409);
  });

  it("attaches a label to a todo", async () => {
    const label = await authed(request(app).post("/api/labels")).send({ name: "urgent" });
    const todo = await authed(request(app).post("/api/todos")).send({ title: "Fix crash" });

    const res = await authed(request(app).post(`/api/todos/${todo.body.id}/labels`)).send({
      label_id: label.body.id,
    });

    expect(res.status).toBe(201);
    expect(res.body.labels).toHaveLength(1);
    expect(res.body.labels[0].name).toBe("urgent");
  });

  it("attaching the same label twice is idempotent", async () => {
    const label = await authed(request(app).post("/api/labels")).send({ name: "urgent" });
    const todo = await authed(request(app).post("/api/todos")).send({ title: "Fix crash" });

    await authed(request(app).post(`/api/todos/${todo.body.id}/labels`)).send({ label_id: label.body.id });
    const res = await authed(request(app).post(`/api/todos/${todo.body.id}/labels`)).send({
      label_id: label.body.id,
    });

    expect(res.status).toBe(201);
    expect(res.body.labels).toHaveLength(1);
  });

  it("supports multiple labels on one todo and one label on multiple todos", async () => {
    const urgent = await authed(request(app).post("/api/labels")).send({ name: "urgent" });
    const backend = await authed(request(app).post("/api/labels")).send({ name: "backend" });
    const todoA = await authed(request(app).post("/api/todos")).send({ title: "A" });
    const todoB = await authed(request(app).post("/api/todos")).send({ title: "B" });

    await authed(request(app).post(`/api/todos/${todoA.body.id}/labels`)).send({ label_id: urgent.body.id });
    await authed(request(app).post(`/api/todos/${todoA.body.id}/labels`)).send({ label_id: backend.body.id });
    await authed(request(app).post(`/api/todos/${todoB.body.id}/labels`)).send({ label_id: urgent.body.id });

    const listRes = await authed(request(app).get("/api/todos"));
    const fetchedA = listRes.body.find((t) => t.id === todoA.body.id);
    const fetchedB = listRes.body.find((t) => t.id === todoB.body.id);

    expect(fetchedA.labels.map((l) => l.name).sort()).toEqual(["backend", "urgent"]);
    expect(fetchedB.labels.map((l) => l.name)).toEqual(["urgent"]);
  });

  it("detaches a label from a todo", async () => {
    const label = await authed(request(app).post("/api/labels")).send({ name: "urgent" });
    const todo = await authed(request(app).post("/api/todos")).send({ title: "Fix crash" });
    await authed(request(app).post(`/api/todos/${todo.body.id}/labels`)).send({ label_id: label.body.id });

    const res = await authed(request(app).delete(`/api/todos/${todo.body.id}/labels/${label.body.id}`));
    expect(res.status).toBe(200);
    expect(res.body.labels).toHaveLength(0);
  });

  it("rejects attaching a label that belongs to another user", async () => {
    const other = seedUser();
    const otherToken = signTestToken(other.id);
    const otherLabel = await request(app)
      .post("/api/labels")
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ name: "not-yours" });
    const todo = await authed(request(app).post("/api/todos")).send({ title: "Fix crash" });

    const res = await authed(request(app).post(`/api/todos/${todo.body.id}/labels`)).send({
      label_id: otherLabel.body.id,
    });
    expect(res.status).toBe(400);
  });

  it("deleting a label removes it from any attached todos", async () => {
    const label = await authed(request(app).post("/api/labels")).send({ name: "urgent" });
    const todo = await authed(request(app).post("/api/todos")).send({ title: "Fix crash" });
    await authed(request(app).post(`/api/todos/${todo.body.id}/labels`)).send({ label_id: label.body.id });

    await authed(request(app).delete(`/api/labels/${label.body.id}`));

    const res = await authed(request(app).get("/api/todos"));
    expect(res.body.find((t) => t.id === todo.body.id).labels).toHaveLength(0);
  });
});
