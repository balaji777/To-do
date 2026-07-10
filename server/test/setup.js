process.env.DB_PATH = ":memory:";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.GOOGLE_CLIENT_ID = "test-google-client-id";

import { beforeEach } from "vitest";

// Dynamic import so it runs (and creates the :memory: db) after the env vars above are set.
const { default: db } = await import("../db.js");

beforeEach(() => {
  db.exec("DELETE FROM collaborators; DELETE FROM todos; DELETE FROM users;");
});
