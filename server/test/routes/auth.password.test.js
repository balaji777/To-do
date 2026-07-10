import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { buildApp, seedUser } from "../helpers.js";
import db from "../../db.js";

describe("POST /api/auth/signup", () => {
  let app;

  beforeEach(() => {
    app = buildApp();
  });

  it("creates an unverified account and does not return a token", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      username: "dev1",
      email: "dev1@example.com",
      password: "supersecret",
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeUndefined();

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get("dev1@example.com");
    expect(user.email_verified).toBe(0);
    expect(user.password_hash).toBeTruthy();
    expect(user.password_hash).not.toBe("supersecret");
    expect(user.verification_token).toBeTruthy();
  });

  it("rejects a password shorter than 8 characters", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      username: "dev2",
      email: "dev2@example.com",
      password: "short",
    });
    expect(res.status).toBe(400);
  });

  it("rejects a username with invalid characters", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      username: "dev two!",
      email: "dev2@example.com",
      password: "supersecret",
    });
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate email with a Google-specific message when the account has no password", async () => {
    seedUser({ username: "googleuser", email: "taken@example.com", googleId: "g-1" });

    const res = await request(app).post("/api/auth/signup").send({
      username: "newname",
      email: "taken@example.com",
      password: "supersecret",
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/google/i);
  });

  it("rejects a duplicate email for an existing password account", async () => {
    await request(app).post("/api/auth/signup").send({
      username: "first",
      email: "dupe@example.com",
      password: "supersecret",
    });

    const res = await request(app).post("/api/auth/signup").send({
      username: "second",
      email: "dupe@example.com",
      password: "supersecret",
    });
    expect(res.status).toBe(409);
  });

  it("rejects a duplicate username", async () => {
    await request(app).post("/api/auth/signup").send({
      username: "taken",
      email: "a@example.com",
      password: "supersecret",
    });

    const res = await request(app).post("/api/auth/signup").send({
      username: "taken",
      email: "b@example.com",
      password: "supersecret",
    });
    expect(res.status).toBe(409);
  });
});

describe("POST /api/auth/login", () => {
  let app;

  beforeEach(() => {
    app = buildApp();
  });

  async function signupAndVerify(overrides = {}) {
    const email = overrides.email ?? "verified@example.com";
    const username = overrides.username ?? "verifieduser";
    const password = overrides.password ?? "supersecret";
    await request(app).post("/api/auth/signup").send({ username, email, password });
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(user.id);
    return { email, password, user };
  }

  it("logs in a verified user and returns a token", async () => {
    const { email, password } = await signupAndVerify();

    const res = await request(app).post("/api/auth/login").send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.needsNickname).toBe(true);
  });

  it("rejects an unverified account", async () => {
    await request(app).post("/api/auth/signup").send({
      username: "unverified",
      email: "unverified@example.com",
      password: "supersecret",
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "unverified@example.com",
      password: "supersecret",
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("rejects an incorrect password", async () => {
    const { email } = await signupAndVerify();

    const res = await request(app).post("/api/auth/login").send({ email, password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  it("rejects login for an unknown email", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "nobody@example.com", password: "x" });
    expect(res.status).toBe(401);
  });

  it("gives a clear error for a Google-only account attempting password login", async () => {
    seedUser({ username: "googleonly", email: "googleonly@example.com", googleId: "g-2" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "googleonly@example.com", password: "anything" });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/google/i);
  });
});

describe("email verification", () => {
  let app;

  beforeEach(() => {
    app = buildApp();
  });

  it("verifies a valid token", async () => {
    await request(app).post("/api/auth/signup").send({
      username: "toverify",
      email: "toverify@example.com",
      password: "supersecret",
    });
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get("toverify@example.com");

    const res = await request(app).get(`/api/auth/verify-email?token=${user.verification_token}`);
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);

    const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
    expect(updated.email_verified).toBe(1);
    expect(updated.verification_token).toBeNull();
  });

  it("rejects an invalid token", async () => {
    const res = await request(app).get("/api/auth/verify-email?token=not-a-real-token");
    expect(res.status).toBe(400);
  });

  it("rejects an expired token", async () => {
    await request(app).post("/api/auth/signup").send({
      username: "expired",
      email: "expired@example.com",
      password: "supersecret",
    });
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get("expired@example.com");
    db.prepare("UPDATE users SET verification_expires_at = ? WHERE id = ?").run(
      new Date(Date.now() - 1000).toISOString(),
      user.id
    );

    const res = await request(app).get(`/api/auth/verify-email?token=${user.verification_token}`);
    expect(res.status).toBe(400);
  });

  it("resend-verification regenerates the token for an unverified account", async () => {
    await request(app).post("/api/auth/signup").send({
      username: "resend",
      email: "resend@example.com",
      password: "supersecret",
    });
    const before = db.prepare("SELECT * FROM users WHERE email = ?").get("resend@example.com");

    const res = await request(app).post("/api/auth/resend-verification").send({ email: "resend@example.com" });
    expect(res.status).toBe(200);

    const after = db.prepare("SELECT * FROM users WHERE email = ?").get("resend@example.com");
    expect(after.verification_token).not.toBe(before.verification_token);
  });

  it("resend-verification does not reveal whether an unknown account exists", async () => {
    const res = await request(app).post("/api/auth/resend-verification").send({ email: "nobody@example.com" });
    expect(res.status).toBe(200);
  });

  it("resend-verification is a no-op for an already-verified account", async () => {
    const { user } = await (async () => {
      await request(app).post("/api/auth/signup").send({
        username: "alreadyverified",
        email: "alreadyverified@example.com",
        password: "supersecret",
      });
      const u = db.prepare("SELECT * FROM users WHERE email = ?").get("alreadyverified@example.com");
      db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(u.id);
      return { user: u };
    })();

    const res = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "alreadyverified@example.com" });
    expect(res.status).toBe(200);

    const after = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
    expect(after.verification_token).toBe(user.verification_token);
  });
});
