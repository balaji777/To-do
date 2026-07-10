const BASE_URL = import.meta.env.VITE_API_URL || "/api";

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
  googleLogin: (credential) => request("/auth/google", { method: "POST", body: { credential } }),
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
};
