import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { buildApp, seedUser, getDefaultList, signTestToken } from "../helpers.js";
import db from "../../db.js";

describe("list-shares routes", () => {
  let app;
  let owner;
  let ownerToken;
  let list;

  beforeEach(() => {
    app = buildApp();
    owner = seedUser();
    ownerToken = signTestToken(owner.id);
    list = getDefaultList(owner.id);
  });

  function as(token, req) {
    return req.set("Authorization", `Bearer ${token}`);
  }

  describe("POST /api/list-shares/:listId/invite", () => {
    it("invites an existing user by email", async () => {
      const invitee = seedUser({ email: "invitee@example.com" });
      const res = await as(ownerToken, request(app).post(`/api/list-shares/${list.id}/invite`)).send({
        email: invitee.email,
      });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("pending");
      expect(res.body.user_id).toBe(invitee.id);
    });

    it("rejects an unknown email", async () => {
      const res = await as(ownerToken, request(app).post(`/api/list-shares/${list.id}/invite`)).send({
        email: "nobody@example.com",
      });
      expect(res.status).toBe(404);
    });

    it("rejects self-invite", async () => {
      const res = await as(ownerToken, request(app).post(`/api/list-shares/${list.id}/invite`)).send({
        email: owner.email,
      });
      expect(res.status).toBe(400);
    });

    it("rejects a duplicate invite", async () => {
      const invitee = seedUser({ email: "dup@example.com" });
      await as(ownerToken, request(app).post(`/api/list-shares/${list.id}/invite`)).send({ email: invitee.email });

      const res = await as(ownerToken, request(app).post(`/api/list-shares/${list.id}/invite`)).send({
        email: invitee.email,
      });
      expect(res.status).toBe(409);
    });

    it("requires an email", async () => {
      const res = await as(ownerToken, request(app).post(`/api/list-shares/${list.id}/invite`)).send({});
      expect(res.status).toBe(400);
    });

    it("denies inviting on a list you don't own", async () => {
      const stranger = seedUser();
      const strangerToken = signTestToken(stranger.id);
      const invitee = seedUser({ email: "invitee2@example.com" });

      const res = await as(strangerToken, request(app).post(`/api/list-shares/${list.id}/invite`)).send({
        email: invitee.email,
      });
      expect(res.status).toBe(404);
    });
  });

  describe("accept / decline", () => {
    it("accepts a pending invite", async () => {
      const invitee = seedUser({ email: "accepter@example.com" });
      const inviteeToken = signTestToken(invitee.id);
      const invite = await as(ownerToken, request(app).post(`/api/list-shares/${list.id}/invite`)).send({
        email: invitee.email,
      });

      const res = await as(inviteeToken, request(app).post(`/api/list-shares/${invite.body.id}/accept`));
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("accepted");

      const row = db.prepare("SELECT status FROM list_shares WHERE id = ?").get(invite.body.id);
      expect(row.status).toBe("accepted");
    });

    it("only lets the invitee accept their own invite", async () => {
      const invitee = seedUser({ email: "accepter2@example.com" });
      const invite = await as(ownerToken, request(app).post(`/api/list-shares/${list.id}/invite`)).send({
        email: invitee.email,
      });

      const res = await as(ownerToken, request(app).post(`/api/list-shares/${invite.body.id}/accept`));
      expect(res.status).toBe(404);
    });

    it("declines (deletes) a pending invite", async () => {
      const invitee = seedUser({ email: "decliner@example.com" });
      const inviteeToken = signTestToken(invitee.id);
      const invite = await as(ownerToken, request(app).post(`/api/list-shares/${list.id}/invite`)).send({
        email: invitee.email,
      });

      const res = await as(inviteeToken, request(app).post(`/api/list-shares/${invite.body.id}/decline`));
      expect(res.status).toBe(204);

      const row = db.prepare("SELECT * FROM list_shares WHERE id = ?").get(invite.body.id);
      expect(row).toBeUndefined();
    });
  });

  describe("GET /api/list-shares/:listId", () => {
    it("lists the owner plus pending and accepted shares", async () => {
      const collaborator = seedUser({ email: "member@example.com" });
      db.prepare("INSERT INTO list_shares (list_id, user_id, status) VALUES (?, ?, 'accepted')").run(
        list.id,
        collaborator.id
      );

      const res = await as(ownerToken, request(app).get(`/api/list-shares/${list.id}`));
      expect(res.status).toBe(200);
      expect(res.body.owner.id).toBe(owner.id);
      expect(res.body.shares).toHaveLength(1);
    });

    it("denies lookup without access", async () => {
      const stranger = seedUser();
      const strangerToken = signTestToken(stranger.id);

      const res = await as(strangerToken, request(app).get(`/api/list-shares/${list.id}`));
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/list-shares/mine", () => {
    it("reports accepted shares and pending invites separately", async () => {
      const invitee = seedUser({ email: "mine@example.com" });
      const inviteeToken = signTestToken(invitee.id);
      const invite = await as(ownerToken, request(app).post(`/api/list-shares/${list.id}/invite`)).send({
        email: invitee.email,
      });

      const pendingRes = await as(inviteeToken, request(app).get("/api/list-shares/mine"));
      expect(pendingRes.body.invitesReceived).toHaveLength(1);
      expect(pendingRes.body.sharedWithMe).toHaveLength(0);

      await as(inviteeToken, request(app).post(`/api/list-shares/${invite.body.id}/accept`));

      const acceptedRes = await as(inviteeToken, request(app).get("/api/list-shares/mine"));
      expect(acceptedRes.body.invitesReceived).toHaveLength(0);
      expect(acceptedRes.body.sharedWithMe).toHaveLength(1);
      expect(acceptedRes.body.sharedWithMe[0].id).toBe(list.id);
    });
  });

  describe("DELETE /api/list-shares/:id", () => {
    it("lets the owner remove a collaborator", async () => {
      const collaborator = seedUser({ email: "removeme@example.com" });
      const row = db
        .prepare("INSERT INTO list_shares (list_id, user_id, status) VALUES (?, ?, 'accepted')")
        .run(list.id, collaborator.id);

      const res = await as(ownerToken, request(app).delete(`/api/list-shares/${row.lastInsertRowid}`));
      expect(res.status).toBe(204);
    });

    it("lets a collaborator remove themselves (leave the list)", async () => {
      const collaborator = seedUser({ email: "leaver@example.com" });
      const collaboratorToken = signTestToken(collaborator.id);
      const row = db
        .prepare("INSERT INTO list_shares (list_id, user_id, status) VALUES (?, ?, 'accepted')")
        .run(list.id, collaborator.id);

      const res = await as(collaboratorToken, request(app).delete(`/api/list-shares/${row.lastInsertRowid}`));
      expect(res.status).toBe(204);
    });

    it("denies removal by an unrelated user", async () => {
      const collaborator = seedUser({ email: "protected@example.com" });
      const stranger = seedUser();
      const strangerToken = signTestToken(stranger.id);
      const row = db
        .prepare("INSERT INTO list_shares (list_id, user_id, status) VALUES (?, ?, 'accepted')")
        .run(list.id, collaborator.id);

      const res = await as(strangerToken, request(app).delete(`/api/list-shares/${row.lastInsertRowid}`));
      expect(res.status).toBe(404);
    });
  });
});
