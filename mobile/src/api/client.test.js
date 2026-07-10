import { api } from "./client";

function mockFetchOnce(status, body) {
  global.fetch = jest.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  });
}

describe("api client", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends login credentials with the correct shape", async () => {
    mockFetchOnce(200, { token: "tok", id: 1, username: "alice", nickname: "", needsNickname: true });

    const result = await api.login("alice@example.com", "supersecret");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "alice@example.com", password: "supersecret" }),
      })
    );
    expect(result.token).toBe("tok");
  });

  it("attaches a Bearer token when one is provided", async () => {
    mockFetchOnce(200, []);
    await api.getTodos("tok123");

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer tok123");
  });

  it("omits the Authorization header when no token is given", async () => {
    mockFetchOnce(200, { message: "ok" });
    await api.signup("alice", "alice@example.com", "supersecret");

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it("returns null for a 204 response without parsing a body", async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 204, ok: true, json: () => Promise.resolve(null) });
    const result = await api.deleteTodo("tok", 5);
    expect(result).toBeNull();
  });

  it("throws an Error with the server's message on failure", async () => {
    mockFetchOnce(401, { error: "Invalid email or password" });
    await expect(api.login("x@example.com", "wrong")).rejects.toThrow("Invalid email or password");
  });

  it("attaches a .code property from the response when present", async () => {
    mockFetchOnce(403, { error: "Please verify your email", code: "EMAIL_NOT_VERIFIED" });

    try {
      await api.login("x@example.com", "pw");
      throw new Error("expected api.login to throw");
    } catch (err) {
      expect(err.code).toBe("EMAIL_NOT_VERIFIED");
    }
  });

  it("builds the label attach request body correctly", async () => {
    mockFetchOnce(201, { id: 1, labels: [] });
    await api.attachLabel("tok", 10, 3);

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain("/todos/10/labels");
    expect(JSON.parse(options.body)).toEqual({ label_id: 3 });
  });
});
