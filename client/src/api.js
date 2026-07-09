const BASE_URL = "/api";

async function request(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || "Request failed");
  }

  return data;
}

export const api = {
  register: (username, password) => request("/auth/register", { method: "POST", body: { username, password } }),
  login: (username, password) => request("/auth/login", { method: "POST", body: { username, password } }),
  getTodos: (token) => request("/todos", { token }),
  addTodo: (token, title) => request("/todos", { method: "POST", body: { title }, token }),
  updateTodo: (token, id, changes) => request(`/todos/${id}`, { method: "PATCH", body: changes, token }),
  deleteTodo: (token, id) => request(`/todos/${id}`, { method: "DELETE", token }),
};
