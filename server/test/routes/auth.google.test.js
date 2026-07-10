import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const verifyIdToken = vi.fn();

vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn().mockImplementation(function MockOAuth2Client() {
    this.verifyIdToken = verifyIdToken;
  }),
}));

const { buildApp, seedUser, signTestToken } = await import("../helpers.js");
const db = (await import("../../db.js")).default;

describe("POST /api/auth/google", () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    verifyIdToken.mockReset();
  });

  it("creates a new user on first sign-in", async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: "google-123", email: "new@example.com", email_verified: true }),
    });

    const res = await request(app).post("/api/auth/google").send({ credential: "fake-credential" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.username).toBe("new");
    expect(res.body.needsNickname).toBe(true);

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get("new@example.com");
    expect(user.google_id).toBe("google-123");
    expect(user.email_verified).toBe(1);
  });

  it("suffixes the username on collision", async () => {
    seedUser({ username: "new", email: "existing@example.com", googleId: "google-existing" });

    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: "google-456", email: "new@example.com", email_verified: true }),
    });

    const res = await request(app).post("/api/auth/google").send({ credential: "fake-credential" });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe("new1");
  });

  it("logs in an existing user by google_id", async () => {
    seedUser({ username: "bob", email: "bob@example.com", googleId: "google-bob", nickname: "Bobby" });

    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: "google-bob", email: "bob@example.com", email_verified: true }),
    });

    const res = await request(app).post("/api/auth/google").send({ credential: "fake-credential" });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe("bob");
    expect(res.body.needsNickname).toBe(false);
  });

  it("links an existing email-only user to google_id", async () => {
    seedUser({ username: "carol", email: "carol@example.com" });

    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: "google-carol", email: "carol@example.com", email_verified: true }),
    });

    await request(app).post("/api/auth/google").send({ credential: "fake-credential" });

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get("carol@example.com");
    expect(user.google_id).toBe("google-carol");
  });

  it("rejects when the Google email is not verified", async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: "google-x", email: "x@example.com", email_verified: false }),
    });

    const res = await request(app).post("/api/auth/google").send({ credential: "fake-credential" });

    expect(res.status).toBe(401);
  });

  it("rejects an invalid Google credential", async () => {
    verifyIdToken.mockRejectedValue(new Error("bad token"));

    const res = await request(app).post("/api/auth/google").send({ credential: "fake-credential" });

    expect(res.status).toBe(401);
  });

  it("requires a credential in the request body", async () => {
    const res = await request(app).post("/api/auth/google").send({});
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/auth/nickname", () => {
  let app;

  beforeEach(() => {
    app = buildApp();
  });

  it("rejects an empty nickname", async () => {
    const user = seedUser();
    const token = signTestToken(user.id);

    const res = await request(app)
      .patch("/api/auth/nickname")
      .set("Authorization", `Bearer ${token}`)
      .send({ nickname: "   " });

    expect(res.status).toBe(400);
  });

  it("rejects a nickname longer than 30 characters", async () => {
    const user = seedUser();
    const token = signTestToken(user.id);

    const res = await request(app)
      .patch("/api/auth/nickname")
      .set("Authorization", `Bearer ${token}`)
      .send({ nickname: "a".repeat(31) });

    expect(res.status).toBe(400);
  });

  it("saves a valid nickname", async () => {
    const user = seedUser();
    const token = signTestToken(user.id);

    const res = await request(app)
      .patch("/api/auth/nickname")
      .set("Authorization", `Bearer ${token}`)
      .send({ nickname: "Nick" });

    expect(res.status).toBe(200);
    expect(res.body.nickname).toBe("Nick");
    expect(db.prepare("SELECT nickname FROM users WHERE id = ?").get(user.id).nickname).toBe("Nick");
  });

  it("requires authentication", async () => {
    const res = await request(app).patch("/api/auth/nickname").send({ nickname: "Nick" });
    expect(res.status).toBe(401);
  });
});
