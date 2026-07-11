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
    const error = new Error(data?.error || "Request failed");
    if (data?.code) error.code = data.code;
    throw error;
  }

  return data;
}

export const api = {
  googleLogin: (credential) => request("/auth/google", { method: "POST", body: { credential } }),
  signup: (username, email, password) => request("/auth/signup", { method: "POST", body: { username, email, password } }),
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  verifyEmail: (token) => request(`/auth/verify-email?token=${encodeURIComponent(token)}`),
  resendVerification: (email) => request("/auth/resend-verification", { method: "POST", body: { email } }),
  setNickname: (token, nickname) => request("/auth/nickname", { method: "PATCH", body: { nickname }, token }),
  markOnboardingSeen: (token) => request("/auth/onboarding-seen", { method: "PATCH", token }),
  getTodos: (token, listId) => request(`/todos${listId ? `?list_id=${listId}` : ""}`, { token }),
  getMyDay: (token) => request("/todos/my-day", { token }),
  getImportant: (token) => request("/todos/important", { token }),
  getPlanned: (token) => request("/todos/planned", { token }),
  getAssignedToMe: (token) => request("/todos/assigned-to-me", { token }),
  addTodo: (token, todo) => request("/todos", { method: "POST", body: todo, token }),
  updateTodo: (token, id, changes) => request(`/todos/${id}`, { method: "PATCH", body: changes, token }),
  deleteTodo: (token, id) => request(`/todos/${id}`, { method: "DELETE", token }),
  getCollaborators: (token) => request("/collaborators", { token }),
  getListMembers: (token, ownerId) =>
    request(`/collaborators/members${ownerId ? `?list=${ownerId}` : ""}`, { token }),
  inviteCollaborator: (token, email) => request("/collaborators/invite", { method: "POST", body: { email }, token }),
  acceptInvite: (token, id) => request(`/collaborators/${id}/accept`, { method: "POST", token }),
  declineInvite: (token, id) => request(`/collaborators/${id}/decline`, { method: "POST", token }),
  removeCollaborator: (token, id) => request(`/collaborators/${id}`, { method: "DELETE", token }),
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
  getAttachments: (token, todoId) => request(`/attachments?todo=${todoId}`, { token }),
  // Multipart, so it bypasses the JSON `request` helper (the browser sets the
  // multipart boundary header itself).
  uploadAttachment: async (token, todoId, file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE_URL}/attachments/${todoId}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Upload failed");
    return data;
  },
  downloadAttachment: async (token, id) => {
    const res = await fetch(`${BASE_URL}/attachments/${id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Download failed");
    return res.blob();
  },
  deleteAttachment: (token, id) => request(`/attachments/${id}`, { method: "DELETE", token }),
  getSubtasks: (token, todoId) => request(`/subtasks?todo=${todoId}`, { token }),
  addSubtask: (token, todoId, title) =>
    request("/subtasks", { method: "POST", body: { todo_id: todoId, title }, token }),
  updateSubtask: (token, id, changes) => request(`/subtasks/${id}`, { method: "PATCH", body: changes, token }),
  deleteSubtask: (token, id) => request(`/subtasks/${id}`, { method: "DELETE", token }),
  getExpenses: (token, listOwnerId) => request(`/expenses${listOwnerId ? `?list=${listOwnerId}` : ""}`, { token }),
  addExpense: (token, expense) => request("/expenses", { method: "POST", body: expense, token }),
  deleteExpense: (token, id) => request(`/expenses/${id}`, { method: "DELETE", token }),
  getBalances: (token, listOwnerId) =>
    request(`/expenses/balances${listOwnerId ? `?list=${listOwnerId}` : ""}`, { token }),
  getSettlements: (token, listOwnerId) =>
    request(`/expenses/settlements${listOwnerId ? `?list=${listOwnerId}` : ""}`, { token }),
  addSettlement: (token, settlement) =>
    request("/expenses/settlements", { method: "POST", body: settlement, token }),
};
