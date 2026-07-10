import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { buildApp, seedUser, seedList, signTestToken } from "../helpers.js";
import db from "../../db.js";

describe("list-groups routes", () => {
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

  describe("POST /api/list-groups", () => {
    it("creates a group", async () => {
      const res = await authed(request(app).post("/api/list-groups")).send({ name: "Home" });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Home");
    });

    it("requires a name", async () => {
      const res = await authed(request(app).post("/api/list-groups")).send({});
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/list-groups", () => {
    it("lists groups for the account", async () => {
      await authed(request(app).post("/api/list-groups")).send({ name: "Home" });
      await authed(request(app).post("/api/list-groups")).send({ name: "Work" });

      const res = await authed(request(app).get("/api/list-groups"));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it("denies access to another account's groups without collaboration", async () => {
      const other = seedUser();
      const res = await authed(request(app).get(`/api/list-groups?owner=${other.id}`));
      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/list-groups/:id", () => {
    it("renames a group", async () => {
      const created = await authed(request(app).post("/api/list-groups")).send({ name: "Old" });
      const res = await authed(request(app).patch(`/api/list-groups/${created.body.id}`)).send({ name: "New" });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("New");
    });
  });

  describe("DELETE /api/list-groups/:id", () => {
    it("ungroups its lists instead of deleting them", async () => {
      const group = await authed(request(app).post("/api/list-groups")).send({ name: "Home" });
      const list = seedList(user.id, { name: "Groceries", group_id: group.body.id });

      const res = await authed(request(app).delete(`/api/list-groups/${group.body.id}`));
      expect(res.status).toBe(204);

      const updatedList = db.prepare("SELECT * FROM lists WHERE id = ?").get(list.id);
      expect(updatedList.group_id).toBeNull();
      expect(db.prepare("SELECT * FROM list_groups WHERE id = ?").get(group.body.id)).toBeUndefined();
    });

    it("returns 404 for a group belonging to another account", async () => {
      const other = seedUser();
      const otherToken = signTestToken(other.id);
      const group = await request(app)
        .post("/api/list-groups")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ name: "Other's group" });

      const res = await authed(request(app).delete(`/api/list-groups/${group.body.id}`));
      expect(res.status).toBe(404);
    });
  });
});
