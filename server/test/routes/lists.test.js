import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { buildApp, seedUser, seedList, getDefaultList, seedListShare, signTestToken } from "../helpers.js";
import db from "../../db.js";

describe("lists routes", () => {
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

  describe("GET /api/lists", () => {
    it("includes the default list for a brand-new account", async () => {
      const res = await authed(request(app).get("/api/lists"));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe("Tasks");
      expect(res.body[0].is_default).toBe(1);
    });

    it("does not include lists shared with the caller (those live under /api/list-shares)", async () => {
      const owner = seedUser();
      const ownerList = getDefaultList(owner.id);
      seedListShare(ownerList.id, user.id, "accepted");

      const res = await authed(request(app).get("/api/lists"));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(defaultList.id);
    });
  });

  describe("POST /api/lists", () => {
    it("creates a new list", async () => {
      const res = await authed(request(app).post("/api/lists")).send({ name: "Groceries" });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Groceries");
      expect(res.body.is_default).toBe(0);
    });

    it("requires a name", async () => {
      const res = await authed(request(app).post("/api/lists")).send({});
      expect(res.status).toBe(400);
    });

    it("rejects a group_id belonging to another account", async () => {
      const other = seedUser();
      const otherToken = signTestToken(other.id);
      const group = await request(app)
        .post("/api/list-groups")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ name: "Other's group" });

      const res = await authed(request(app).post("/api/lists")).send({
        name: "Sneaky",
        group_id: group.body.id,
      });
      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/lists/:id", () => {
    it("renames a list", async () => {
      const list = seedList(user.id, { name: "Old name" });
      const res = await authed(request(app).patch(`/api/lists/${list.id}`)).send({ name: "New name" });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("New name");
    });

    it("returns 404 for a list belonging to another account", async () => {
      const other = seedUser();
      const otherList = seedList(other.id);
      const res = await authed(request(app).patch(`/api/lists/${otherList.id}`)).send({ name: "Hijack" });
      expect(res.status).toBe(404);
    });

    it("allows a user with an accepted share on that specific list", async () => {
      const owner = seedUser();
      const sharedList = seedList(owner.id, { name: "Shared" });
      seedListShare(sharedList.id, user.id, "accepted");

      const res = await authed(request(app).patch(`/api/lists/${sharedList.id}`)).send({ name: "Renamed" });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Renamed");
    });

    it("denies a user whose share is only shared on a different list from the same owner", async () => {
      const owner = seedUser();
      const sharedList = seedList(owner.id, { name: "Shared" });
      const otherList = seedList(owner.id, { name: "Not shared" });
      seedListShare(sharedList.id, user.id, "accepted");

      const res = await authed(request(app).patch(`/api/lists/${otherList.id}`)).send({ name: "Hijack" });
      expect(res.status).toBe(404);
    });

    it("denies a user with only a pending (not yet accepted) share", async () => {
      const owner = seedUser();
      const sharedList = seedList(owner.id, { name: "Shared" });
      seedListShare(sharedList.id, user.id, "pending");

      const res = await authed(request(app).patch(`/api/lists/${sharedList.id}`)).send({ name: "Hijack" });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/lists/:id", () => {
    it("deletes a non-default list and its todos", async () => {
      const list = seedList(user.id, { name: "Temp" });
      await authed(request(app).post("/api/todos")).send({ title: "In temp list", list_id: list.id });

      const res = await authed(request(app).delete(`/api/lists/${list.id}`));
      expect(res.status).toBe(204);
      expect(db.prepare("SELECT * FROM lists WHERE id = ?").get(list.id)).toBeUndefined();
      expect(db.prepare("SELECT * FROM todos WHERE list_id = ?").all(list.id)).toHaveLength(0);
    });

    it("refuses to delete the default list", async () => {
      seedList(user.id, { name: "Other" });
      const res = await authed(request(app).delete(`/api/lists/${defaultList.id}`));
      expect(res.status).toBe(400);
    });

    it("refuses to delete the account's only list", async () => {
      const res = await authed(request(app).delete(`/api/lists/${defaultList.id}`));
      expect(res.status).toBe(400);
    });
  });
});
