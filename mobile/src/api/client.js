const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api";

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
    const error = new Error(data?.error || "Request failed");
    if (data?.code) error.code = data.code;
    throw error;
  }

  return data;
}

export const api = {
  googleLogin: (credential) => request("/auth/google", { method: "POST", body: { credential } }),
  signup: (username, email, password) =>
    request("/auth/signup", { method: "POST", body: { username, email, password } }),
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  verifyEmail: (token) => request(`/auth/verify-email?token=${encodeURIComponent(token)}`),
  resendVerification: (email) => request("/auth/resend-verification", { method: "POST", body: { email } }),
  setNickname: (token, nickname) => request("/auth/nickname", { method: "PATCH", body: { nickname }, token }),
  getTodos: (token, listId) => request(`/todos${listId ? `?list_id=${listId}` : ""}`, { token }),
  getMyDay: (token) => request("/todos/my-day", { token }),
  getImportant: (token) => request("/todos/important", { token }),
  getPlanned: (token) => request("/todos/planned", { token }),
  getAssignedToMe: (token) => request("/todos/assigned-to-me", { token }),
  addTodo: (token, todo) => request("/todos", { method: "POST", body: todo, token }),
  updateTodo: (token, id, changes) => request(`/todos/${id}`, { method: "PATCH", body: changes, token }),
  deleteTodo: (token, id) => request(`/todos/${id}`, { method: "DELETE", token }),
  getLists: (token) => request("/lists", { token }),
  addList: (token, name, groupId) =>
    request("/lists", { method: "POST", body: { name, group_id: groupId || undefined }, token }),
  updateList: (token, id, changes) => request(`/lists/${id}`, { method: "PATCH", body: changes, token }),
  deleteList: (token, id) => request(`/lists/${id}`, { method: "DELETE", token }),
  getListGroups: (token) => request("/list-groups", { token }),
  addListGroup: (token, name) => request("/list-groups", { method: "POST", body: { name }, token }),
  updateListGroup: (token, id, changes) => request(`/list-groups/${id}`, { method: "PATCH", body: changes, token }),
  deleteListGroup: (token, id) => request(`/list-groups/${id}`, { method: "DELETE", token }),
  getMyListShares: (token) => request("/list-shares/mine", { token }),
  getListShares: (token, listId) => request(`/list-shares/${listId}`, { token }),
  inviteToList: (token, listId, email) =>
    request(`/list-shares/${listId}/invite`, { method: "POST", body: { email }, token }),
  acceptListShare: (token, id) => request(`/list-shares/${id}/accept`, { method: "POST", token }),
  declineListShare: (token, id) => request(`/list-shares/${id}/decline`, { method: "POST", token }),
  removeListShare: (token, id) => request(`/list-shares/${id}`, { method: "DELETE", token }),
  getSubtasks: (token, todoId) => request(`/subtasks?todo=${todoId}`, { token }),
  addSubtask: (token, todoId, title) =>
    request("/subtasks", { method: "POST", body: { todo_id: todoId, title }, token }),
  updateSubtask: (token, id, changes) => request(`/subtasks/${id}`, { method: "PATCH", body: changes, token }),
  deleteSubtask: (token, id) => request(`/subtasks/${id}`, { method: "DELETE", token }),
};
