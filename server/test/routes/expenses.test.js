import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { buildApp, seedUser, signTestToken } from "../helpers.js";
import db from "../../db.js";
import { sendExpenseAddedEmail } from "../../email.js";

vi.mock("../../email.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, sendExpenseAddedEmail: vi.fn().mockResolvedValue() };
});

describe("expenses routes", () => {
  let app;
  let owner;
  let ownerToken;
  let friend;
  let friendToken;

  beforeEach(() => {
    app = buildApp();
    owner = seedUser();
    ownerToken = signTestToken(owner.id);
    friend = seedUser({ email: "friend@example.com" });
    friendToken = signTestToken(friend.id);
    db.prepare("INSERT INTO collaborators (list_owner_id, user_id, status) VALUES (?, ?, 'accepted')").run(
      owner.id,
      friend.id
    );
  });

  function as(token, req) {
    return req.set("Authorization", `Bearer ${token}`);
  }

  describe("POST /api/expenses", () => {
    it("splits an expense equally between participants", async () => {
      const res = await as(ownerToken, request(app).post("/api/expenses")).send({
        description: "Dinner",
        amount: 100,
        paid_by: owner.id,
      });

      expect(res.status).toBe(201);
      expect(res.body.amount).toBe(100);
      expect(res.body.shares).toHaveLength(2);
      const total = res.body.shares.reduce((sum, s) => sum + s.amount, 0);
      expect(total).toBe(100);
    });

    it("distributes remainder cents when amount doesn't split evenly", async () => {
      const res = await as(ownerToken, request(app).post("/api/expenses")).send({
        description: "Coffee",
        amount: 10.01,
      });

      expect(res.status).toBe(201);
      const total = res.body.shares.reduce((sum, s) => sum + s.amount, 0);
      expect(total).toBeCloseTo(10.01, 2);
    });

    it("supports an exact split", async () => {
      const res = await as(ownerToken, request(app).post("/api/expenses")).send({
        description: "Groceries",
        amount: 50,
        split_type: "exact",
        shares: [
          { user_id: owner.id, amount: 30 },
          { user_id: friend.id, amount: 20 },
        ],
      });

      expect(res.status).toBe(201);
      expect(res.body.shares.find((s) => s.user_id === owner.id).amount).toBe(30);
      expect(res.body.shares.find((s) => s.user_id === friend.id).amount).toBe(20);
    });

    it("rejects an exact split that doesn't add up", async () => {
      const res = await as(ownerToken, request(app).post("/api/expenses")).send({
        description: "Groceries",
        amount: 50,
        split_type: "exact",
        shares: [
          { user_id: owner.id, amount: 30 },
          { user_id: friend.id, amount: 30 },
        ],
      });
      expect(res.status).toBe(400);
    });

    it("supports a percentage split", async () => {
      const res = await as(ownerToken, request(app).post("/api/expenses")).send({
        description: "Rent",
        amount: 100,
        split_type: "percentage",
        shares: [
          { user_id: owner.id, percentage: 60 },
          { user_id: friend.id, percentage: 40 },
        ],
      });

      expect(res.status).toBe(201);
      expect(res.body.shares.find((s) => s.user_id === owner.id).amount).toBe(60);
      expect(res.body.shares.find((s) => s.user_id === friend.id).amount).toBe(40);
    });

    it("rejects a non-member participant", async () => {
      const stranger = seedUser();
      const res = await as(ownerToken, request(app).post("/api/expenses")).send({
        description: "Dinner",
        amount: 100,
        participants: [owner.id, stranger.id],
      });
      expect(res.status).toBe(400);
    });

    it("denies creating an expense without list access", async () => {
      const stranger = seedUser();
      const strangerToken = signTestToken(stranger.id);
      const res = await as(strangerToken, request(app).post("/api/expenses")).send({
        description: "Dinner",
        amount: 100,
        list: owner.id,
      });
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/expenses", () => {
    it("lists expenses for a shared list", async () => {
      await as(ownerToken, request(app).post("/api/expenses")).send({ description: "Dinner", amount: 100 });

      const res = await as(friendToken, request(app).get(`/api/expenses?list=${owner.id}`));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe("DELETE /api/expenses/:id", () => {
    it("lets a list member delete an expense", async () => {
      const created = await as(ownerToken, request(app).post("/api/expenses")).send({
        description: "Dinner",
        amount: 100,
      });

      const res = await as(friendToken, request(app).delete(`/api/expenses/${created.body.id}`));
      expect(res.status).toBe(204);
    });
  });

  describe("GET /api/expenses/balances", () => {
    it("computes net balances after an expense and a settlement", async () => {
      await as(ownerToken, request(app).post("/api/expenses")).send({
        description: "Dinner",
        amount: 100,
        paid_by: owner.id,
      });

      let res = await as(ownerToken, request(app).get("/api/expenses/balances"));
      expect(res.status).toBe(200);
      const ownerBalance = res.body.find((b) => b.user_id === owner.id);
      const friendBalance = res.body.find((b) => b.user_id === friend.id);
      expect(ownerBalance.balance).toBe(50);
      expect(friendBalance.balance).toBe(-50);

      await as(friendToken, request(app).post("/api/expenses/settlements")).send({
        list: owner.id,
        from_user_id: friend.id,
        to_user_id: owner.id,
        amount: 50,
      });

      res = await as(ownerToken, request(app).get("/api/expenses/balances"));
      expect(res.body.find((b) => b.user_id === owner.id).balance).toBe(0);
      expect(res.body.find((b) => b.user_id === friend.id).balance).toBe(0);
    });
  });

  describe("POST /api/expenses/settlements", () => {
    it("rejects a settlement between the same user", async () => {
      const res = await as(ownerToken, request(app).post("/api/expenses/settlements")).send({
        from_user_id: owner.id,
        to_user_id: owner.id,
        amount: 10,
      });
      expect(res.status).toBe(400);
    });

    it("rejects a settlement involving a non-member", async () => {
      const stranger = seedUser();
      const res = await as(ownerToken, request(app).post("/api/expenses/settlements")).send({
        from_user_id: owner.id,
        to_user_id: stranger.id,
        amount: 10,
      });
      expect(res.status).toBe(400);
    });
  });

  describe("expense-added email notifications", () => {
    beforeEach(() => {
      sendExpenseAddedEmail.mockClear();
    });

    it("emails the other member but not whoever added the expense", async () => {
      await as(ownerToken, request(app).post("/api/expenses")).send({
        description: "Dinner",
        amount: 100,
        paid_by: owner.id,
      });

      expect(sendExpenseAddedEmail).toHaveBeenCalledTimes(1);
      expect(sendExpenseAddedEmail).toHaveBeenCalledWith(
        expect.objectContaining({ id: friend.id }),
        expect.objectContaining({ description: "Dinner" }),
        expect.objectContaining({ id: owner.id })
      );
    });
  });
});
