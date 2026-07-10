import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { buildApp, seedUser, signTestToken } from "../helpers.js";
import db from "../../db.js";

describe("categories routes", () => {
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

  it("creates and lists categories", async () => {
    await authed(request(app).post("/api/categories")).send({ name: "Bugs" });
    await authed(request(app).post("/api/categories")).send({ name: "Chores" });

    const res = await authed(request(app).get("/api/categories"));
    expect(res.status).toBe(200);
    expect(res.body.map((c) => c.name).sort()).toEqual(["Bugs", "Chores"]);
  });

  it("rejects a duplicate name (case-insensitive)", async () => {
    await authed(request(app).post("/api/categories")).send({ name: "Bugs" });
    const res = await authed(request(app).post("/api/categories")).send({ name: "bugs" });
    expect(res.status).toBe(409);
  });

  it("requires a name", async () => {
    const res = await authed(request(app).post("/api/categories")).send({});
    expect(res.status).toBe(400);
  });

  it("isolates categories per user", async () => {
    const other = seedUser();
    const otherToken = signTestToken(other.id);
    await request(app).post("/api/categories").set("Authorization", `Bearer ${otherToken}`).send({ name: "Bugs" });

    const res = await authed(request(app).get("/api/categories"));
    expect(res.body).toHaveLength(0);
  });

  it("renames a category", async () => {
    const created = await authed(request(app).post("/api/categories")).send({ name: "Bugs" });
    const res = await authed(request(app).patch(`/api/categories/${created.body.id}`)).send({ name: "Defects" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Defects");
  });

  it("404s renaming another user's category", async () => {
    const other = seedUser();
    const otherToken = signTestToken(other.id);
    const created = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ name: "Bugs" });

    const res = await authed(request(app).patch(`/api/categories/${created.body.id}`)).send({ name: "Hijacked" });
    expect(res.status).toBe(404);
  });

  it("lets an accepted collaborator create and see categories on the shared list", async () => {
    const collaborator = seedUser();
    const collaboratorToken = signTestToken(collaborator.id);
    db.prepare("INSERT INTO collaborators (list_owner_id, user_id, status) VALUES (?, ?, 'accepted')").run(
      user.id,
      collaborator.id
    );

    const created = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${collaboratorToken}`)
      .send({ name: "Shared bugs", list: user.id });
    expect(created.status).toBe(201);

    const ownerRes = await authed(request(app).get("/api/categories"));
    expect(ownerRes.body.map((c) => c.name)).toEqual(["Shared bugs"]);

    const collaboratorRes = await request(app)
      .get(`/api/categories?list=${user.id}`)
      .set("Authorization", `Bearer ${collaboratorToken}`);
    expect(collaboratorRes.body.map((c) => c.name)).toEqual(["Shared bugs"]);
  });

  it("denies category access to a list the requester doesn't belong to", async () => {
    const stranger = seedUser();
    const strangerToken = signTestToken(stranger.id);

    const res = await request(app)
      .get(`/api/categories?list=${user.id}`)
      .set("Authorization", `Bearer ${strangerToken}`);
    expect(res.status).toBe(403);
  });

  it("deletes a category and clears it from referencing todos", async () => {
    const category = await authed(request(app).post("/api/categories")).send({ name: "Bugs" });
    const todo = await authed(request(app).post("/api/todos")).send({
      title: "Fix crash",
      category_id: category.body.id,
    });
    expect(todo.body.category_id).toBe(category.body.id);

    const res = await authed(request(app).delete(`/api/categories/${category.body.id}`));
    expect(res.status).toBe(204);

    const updatedTodo = db.prepare("SELECT category_id FROM todos WHERE id = ?").get(todo.body.id);
    expect(updatedTodo.category_id).toBeNull();
  });
});
