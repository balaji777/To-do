import path from "node:path";
import fs from "node:fs";
import os from "node:os";

process.env.DB_PATH = ":memory:";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
process.env.UPLOADS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "planora-test-uploads-"));

import { beforeEach, afterAll } from "vitest";

// Dynamic import so it runs (and creates the :memory: db) after the env vars above are set.
const { default: db } = await import("../db.js");

beforeEach(() => {
  db.exec("DELETE FROM collaborators; DELETE FROM todos; DELETE FROM users; DELETE FROM attachments;");
});

afterAll(() => {
  fs.rmSync(process.env.UPLOADS_DIR, { recursive: true, force: true });
});
