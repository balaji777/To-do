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
  getTodos: (token, listOwnerId) => request(`/todos${listOwnerId ? `?list=${listOwnerId}` : ""}`, { token }),
  addTodo: (token, todo) => request("/todos", { method: "POST", body: todo, token }),
  updateTodo: (token, id, changes) => request(`/todos/${id}`, { method: "PATCH", body: changes, token }),
  deleteTodo: (token, id) => request(`/todos/${id}`, { method: "DELETE", token }),
  getCollaborators: (token) => request("/collaborators", { token }),
  getListMembers: (token, listOwnerId) =>
    request(`/collaborators/members${listOwnerId ? `?list=${listOwnerId}` : ""}`, { token }),
  inviteCollaborator: (token, email) => request("/collaborators/invite", { method: "POST", body: { email }, token }),
  acceptInvite: (token, id) => request(`/collaborators/${id}/accept`, { method: "POST", token }),
  declineInvite: (token, id) => request(`/collaborators/${id}/decline`, { method: "POST", token }),
  removeCollaborator: (token, id) => request(`/collaborators/${id}`, { method: "DELETE", token }),
  getCategories: (token, listOwnerId) =>
    request(`/categories${listOwnerId ? `?list=${listOwnerId}` : ""}`, { token }),
  addCategory: (token, name, listOwnerId) =>
    request("/categories", { method: "POST", body: { name, list: listOwnerId || undefined }, token }),
  deleteCategory: (token, id) => request(`/categories/${id}`, { method: "DELETE", token }),
  getLabels: (token, listOwnerId) => request(`/labels${listOwnerId ? `?list=${listOwnerId}` : ""}`, { token }),
  addLabel: (token, name, color, listOwnerId) =>
    request("/labels", { method: "POST", body: { name, color, list: listOwnerId || undefined }, token }),
  deleteLabel: (token, id) => request(`/labels/${id}`, { method: "DELETE", token }),
  attachLabel: (token, todoId, labelId) =>
    request(`/todos/${todoId}/labels`, { method: "POST", body: { label_id: labelId }, token }),
  detachLabel: (token, todoId, labelId) => request(`/todos/${todoId}/labels/${labelId}`, { method: "DELETE", token }),
  getSubtasks: (token, todoId) => request(`/subtasks?todo=${todoId}`, { token }),
  addSubtask: (token, todoId, title) =>
    request("/subtasks", { method: "POST", body: { todo_id: todoId, title }, token }),
  updateSubtask: (token, id, changes) => request(`/subtasks/${id}`, { method: "PATCH", body: changes, token }),
  deleteSubtask: (token, id) => request(`/subtasks/${id}`, { method: "DELETE", token }),
};
