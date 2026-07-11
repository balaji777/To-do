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

  it("sends a list id as ?list_id= (matching the server's resolveList query param)", async () => {
    mockFetchOnce(200, []);
    await api.getTodos("tok", 42);

    const [url] = global.fetch.mock.calls[0];
    expect(url).toContain("/todos?list_id=42");
  });

  it("builds the list-share invite request body correctly", async () => {
    mockFetchOnce(201, { id: 1, user_id: 3, status: "pending" });
    await api.inviteToList("tok", 10, "friend@example.com");

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain("/list-shares/10/invite");
    expect(JSON.parse(options.body)).toEqual({ email: "friend@example.com" });
  });

  it.each([
    ["getMyDay", () => api.getMyDay("tok"), "/todos/my-day"],
    ["getImportant", () => api.getImportant("tok"), "/todos/important"],
    ["getPlanned", () => api.getPlanned("tok"), "/todos/planned"],
    ["getAssignedToMe", () => api.getAssignedToMe("tok"), "/todos/assigned-to-me"],
    ["getLists", () => api.getLists("tok"), "/lists"],
    ["getListGroups", () => api.getListGroups("tok"), "/list-groups"],
    ["getMyListShares", () => api.getMyListShares("tok"), "/list-shares/mine"],
  ])("%s requests the correct URL", async (_name, call, expectedPath) => {
    mockFetchOnce(200, []);
    await call();

    const [url] = global.fetch.mock.calls[0];
    expect(url).toContain(expectedPath);
  });

  it("builds the add-list request body correctly", async () => {
    mockFetchOnce(201, { id: 1, name: "Groceries" });
    await api.addList("tok", "Groceries", 5);

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain("/lists");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ name: "Groceries", group_id: 5 });
  });

  it("sends a DELETE for deleteList", async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 204, ok: true, json: () => Promise.resolve(null) });
    await api.deleteList("tok", 7);

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain("/lists/7");
    expect(options.method).toBe("DELETE");
  });

  it.each([
    ["acceptListShare", () => api.acceptListShare("tok", 9), "/list-shares/9/accept", "POST"],
    ["declineListShare", () => api.declineListShare("tok", 9), "/list-shares/9/decline", "POST"],
    ["removeListShare", () => api.removeListShare("tok", 9), "/list-shares/9", "DELETE"],
  ])("%s sends %s to the correct URL", async (_name, call, expectedPath, expectedMethod) => {
    global.fetch = jest.fn().mockResolvedValue({ status: 204, ok: true, json: () => Promise.resolve(null) });
    await call();

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain(expectedPath);
    expect(options.method).toBe(expectedMethod);
  });
});
