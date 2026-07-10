import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import fs from "node:fs";
import { buildApp, seedUser, seedList, seedListShare, signTestToken } from "../helpers.js";
import { attachmentPath } from "../../attachment-storage.js";
import db from "../../db.js";

describe("attachments routes", () => {
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

  async function createTodo(overrides = {}) {
    const res = await authed(request(app).post("/api/todos")).send({ title: "Task", ...overrides });
    return res.body;
  }

  function uploadTo(todoId, content = "hello world", name = "notes.txt") {
    return authed(request(app).post(`/api/attachments/${todoId}`)).attach("file", Buffer.from(content), name);
  }

  describe("POST /api/attachments/:todoId", () => {
    it("uploads a file and stores it on disk", async () => {
      const todo = await createTodo();
      const res = await uploadTo(todo.id);

      expect(res.status).toBe(201);
      expect(res.body.todo_id).toBe(todo.id);
      expect(res.body.filename).toBe("notes.txt");
      expect(res.body.size_bytes).toBe(11);
      expect(res.body.uploaded_by).toBe(user.id);
      expect(fs.existsSync(attachmentPath(res.body.stored_name))).toBe(true);
    });

    it("rejects uploading to another account's todo", async () => {
      const other = seedUser();
      const otherToken = signTestToken(other.id);
      const created = await request(app)
        .post("/api/todos")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ title: "Not yours" });

      const res = await uploadTo(created.body.id);
      expect(res.status).toBe(404);
    });

    it("allows an accepted share member to upload", async () => {
      const owner = seedUser();
      const ownerToken = signTestToken(owner.id);
      const sharedList = seedList(owner.id, { name: "Shared" });
      seedListShare(sharedList.id, user.id, "accepted");
      const created = await request(app)
        .post("/api/todos")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ title: "Shared task", list_id: sharedList.id });

      const res = await uploadTo(created.body.id);
      expect(res.status).toBe(201);
    });

    it("rejects a request with no file", async () => {
      const todo = await createTodo();
      const res = await authed(request(app).post(`/api/attachments/${todo.id}`)).send();
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/attachments", () => {
    it("lists a todo's attachments", async () => {
      const todo = await createTodo();
      await uploadTo(todo.id, "one", "a.txt");
      await uploadTo(todo.id, "two", "b.txt");

      const res = await authed(request(app).get(`/api/attachments?todo=${todo.id}`));
      expect(res.status).toBe(200);
      expect(res.body.map((a) => a.filename)).toEqual(["a.txt", "b.txt"]);
    });

    it("rejects listing attachments on an inaccessible todo", async () => {
      const other = seedUser();
      const otherToken = signTestToken(other.id);
      const created = await request(app)
        .post("/api/todos")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ title: "Not yours" });

      const res = await authed(request(app).get(`/api/attachments?todo=${created.body.id}`));
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/attachments/:id/download", () => {
    it("downloads the original file content and name", async () => {
      const todo = await createTodo();
      const uploaded = await uploadTo(todo.id, "file body here", "report.txt");

      const res = await authed(request(app).get(`/api/attachments/${uploaded.body.id}/download`));
      expect(res.status).toBe(200);
      expect(res.headers["content-disposition"]).toContain("report.txt");
      expect(res.text).toBe("file body here");
    });

    it("rejects downloading someone else's attachment", async () => {
      const other = seedUser();
      const otherToken = signTestToken(other.id);
      const created = await request(app)
        .post("/api/todos")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ title: "Not yours" });
      const uploaded = await request(app)
        .post(`/api/attachments/${created.body.id}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .attach("file", Buffer.from("secret"), "secret.txt");

      const res = await authed(request(app).get(`/api/attachments/${uploaded.body.id}/download`));
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/attachments/:id", () => {
    it("deletes the row and the file on disk", async () => {
      const todo = await createTodo();
      const uploaded = await uploadTo(todo.id);
      const storedName = uploaded.body.stored_name;

      const res = await authed(request(app).delete(`/api/attachments/${uploaded.body.id}`));
      expect(res.status).toBe(204);
      expect(db.prepare("SELECT * FROM attachments WHERE id = ?").get(uploaded.body.id)).toBeUndefined();
      expect(fs.existsSync(attachmentPath(storedName))).toBe(false);
    });
  });

  it("deleting a todo removes its attachments and files", async () => {
    const todo = await createTodo();
    const uploaded = await uploadTo(todo.id);
    const storedName = uploaded.body.stored_name;

    const res = await authed(request(app).delete(`/api/todos/${todo.id}`));
    expect(res.status).toBe(204);
    expect(db.prepare("SELECT * FROM attachments WHERE todo_id = ?").all(todo.id)).toEqual([]);
    expect(fs.existsSync(attachmentPath(storedName))).toBe(false);
  });

  it("deleting a list removes its todos' attachments and files", async () => {
    const list = seedList(user.id, { name: "Doomed" });
    const todo = await createTodo({ list_id: list.id });
    const uploaded = await uploadTo(todo.id);
    const storedName = uploaded.body.stored_name;

    const res = await authed(request(app).delete(`/api/lists/${list.id}`));
    expect(res.status).toBe(204);
    expect(db.prepare("SELECT * FROM attachments WHERE todo_id = ?").all(todo.id)).toEqual([]);
    expect(fs.existsSync(attachmentPath(storedName))).toBe(false);
  });
});
