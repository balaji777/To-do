import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { buildApp, seedUser, signTestToken } from "../helpers.js";
import db from "../../db.js";

describe("collaborators routes", () => {
  let app;
  let owner;
  let ownerToken;

  beforeEach(() => {
    app = buildApp();
    owner = seedUser();
    ownerToken = signTestToken(owner.id);
  });

  function as(token, req) {
    return req.set("Authorization", `Bearer ${token}`);
  }

  describe("POST /api/collaborators/invite", () => {
    it("invites an existing user by email", async () => {
      const invitee = seedUser({ email: "invitee@example.com" });
      const res = await as(ownerToken, request(app).post("/api/collaborators/invite")).send({
        email: invitee.email,
      });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("pending");
      expect(res.body.user_id).toBe(invitee.id);
    });

    it("rejects an unknown email", async () => {
      const res = await as(ownerToken, request(app).post("/api/collaborators/invite")).send({
        email: "nobody@example.com",
      });
      expect(res.status).toBe(404);
    });

    it("rejects self-invite", async () => {
      const res = await as(ownerToken, request(app).post("/api/collaborators/invite")).send({
        email: owner.email,
      });
      expect(res.status).toBe(400);
    });

    it("rejects a duplicate invite", async () => {
      const invitee = seedUser({ email: "dup@example.com" });
      await as(ownerToken, request(app).post("/api/collaborators/invite")).send({ email: invitee.email });

      const res = await as(ownerToken, request(app).post("/api/collaborators/invite")).send({
        email: invitee.email,
      });
      expect(res.status).toBe(409);
    });

    it("requires an email", async () => {
      const res = await as(ownerToken, request(app).post("/api/collaborators/invite")).send({});
      expect(res.status).toBe(400);
    });
  });

  describe("accept / decline", () => {
    it("accepts a pending invite", async () => {
      const invitee = seedUser({ email: "accepter@example.com" });
      const inviteeToken = signTestToken(invitee.id);
      const invite = await as(ownerToken, request(app).post("/api/collaborators/invite")).send({
        email: invitee.email,
      });

      const res = await as(inviteeToken, request(app).post(`/api/collaborators/${invite.body.id}/accept`));
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("accepted");

      const row = db.prepare("SELECT status FROM collaborators WHERE id = ?").get(invite.body.id);
      expect(row.status).toBe("accepted");
    });

    it("only lets the invitee accept their own invite", async () => {
      const invitee = seedUser({ email: "accepter2@example.com" });
      const invite = await as(ownerToken, request(app).post("/api/collaborators/invite")).send({
        email: invitee.email,
      });

      const res = await as(ownerToken, request(app).post(`/api/collaborators/${invite.body.id}/accept`));
      expect(res.status).toBe(404);
    });

    it("declines (deletes) a pending invite", async () => {
      const invitee = seedUser({ email: "decliner@example.com" });
      const inviteeToken = signTestToken(invitee.id);
      const invite = await as(ownerToken, request(app).post("/api/collaborators/invite")).send({
        email: invitee.email,
      });

      const res = await as(inviteeToken, request(app).post(`/api/collaborators/${invite.body.id}/decline`));
      expect(res.status).toBe(204);

      const row = db.prepare("SELECT * FROM collaborators WHERE id = ?").get(invite.body.id);
      expect(row).toBeUndefined();
    });
  });

  describe("GET /api/collaborators/members", () => {
    it("lists owner plus accepted collaborators", async () => {
      const collaborator = seedUser({ email: "member@example.com" });
      db.prepare("INSERT INTO collaborators (list_owner_id, user_id, status) VALUES (?, ?, 'accepted')").run(
        owner.id,
        collaborator.id
      );

      const res = await as(ownerToken, request(app).get("/api/collaborators/members"));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it("denies members lookup without access", async () => {
      const stranger = seedUser();
      const strangerToken = signTestToken(stranger.id);

      const res = await as(strangerToken, request(app).get(`/api/collaborators/members?list=${owner.id}`));
      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/collaborators/:id", () => {
    it("lets the owner remove a collaborator", async () => {
      const collaborator = seedUser({ email: "removeme@example.com" });
      const row = db
        .prepare("INSERT INTO collaborators (list_owner_id, user_id, status) VALUES (?, ?, 'accepted')")
        .run(owner.id, collaborator.id);

      const res = await as(ownerToken, request(app).delete(`/api/collaborators/${row.lastInsertRowid}`));
      expect(res.status).toBe(204);
    });

    it("lets a collaborator remove themselves (leave the list)", async () => {
      const collaborator = seedUser({ email: "leaver@example.com" });
      const collaboratorToken = signTestToken(collaborator.id);
      const row = db
        .prepare("INSERT INTO collaborators (list_owner_id, user_id, status) VALUES (?, ?, 'accepted')")
        .run(owner.id, collaborator.id);

      const res = await as(collaboratorToken, request(app).delete(`/api/collaborators/${row.lastInsertRowid}`));
      expect(res.status).toBe(204);
    });

    it("denies removal by an unrelated user", async () => {
      const collaborator = seedUser({ email: "protected@example.com" });
      const stranger = seedUser();
      const strangerToken = signTestToken(stranger.id);
      const row = db
        .prepare("INSERT INTO collaborators (list_owner_id, user_id, status) VALUES (?, ?, 'accepted')")
        .run(owner.id, collaborator.id);

      const res = await as(strangerToken, request(app).delete(`/api/collaborators/${row.lastInsertRowid}`));
      expect(res.status).toBe(404);
    });
  });
});
