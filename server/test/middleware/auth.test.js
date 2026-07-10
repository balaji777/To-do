import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";
import { requireAuth } from "../../middleware/auth.js";

function mockRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe("requireAuth middleware", () => {
  it("rejects a request with no Authorization header", () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Missing token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a malformed Authorization header (no Bearer prefix)", () => {
    const req = { headers: { authorization: "Token abc123" } };
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an invalid token", () => {
    const req = { headers: { authorization: "Bearer not-a-real-token" } };
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an expired token", () => {
    const expired = jwt.sign({ userId: 1 }, process.env.JWT_SECRET, { expiresIn: -10 });
    const req = { headers: { authorization: `Bearer ${expired}` } };
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("sets req.userId and calls next() for a valid token", () => {
    const token = jwt.sign({ userId: 42 }, process.env.JWT_SECRET, { expiresIn: "7d" });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(req.userId).toBe(42);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
