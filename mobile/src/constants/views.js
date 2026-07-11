export const SMART_VIEWS = [
  { type: "my-day", label: "My Day", icon: "☀" },
  { type: "important", label: "Important", icon: "★" },
  { type: "planned", label: "Planned", icon: "📅" },
  { type: "assigned", label: "Assigned to me", icon: "👤" },
];

const SMART_VIEW_LABELS = Object.fromEntries(SMART_VIEWS.map((v) => [v.type, v.label]));

export function viewTitle(activeView, lists = [], sharedWithMe = []) {
  if (activeView.type === "list") {
    const own = lists.find((l) => l.id === activeView.listId);
    if (own) return own.name;
    const shared = sharedWithMe.find((l) => l.id === activeView.listId);
    if (shared) return shared.name;
    return "Tasks";
  }
  return SMART_VIEW_LABELS[activeView.type] || "Tasks";
}

export function canQuickAdd(activeView) {
  return activeView.type === "list" || activeView.type === "my-day";
}

export function createPayloadFor(activeView, lists = []) {
  if (activeView.type === "list") {
    return { list_id: activeView.listId };
  }
  if (activeView.type === "my-day") {
    const defaultList = lists.find((l) => l.is_default);
    return defaultList ? { list_id: defaultList.id, my_day: true } : null;
  }
  return null;
}

export function fetchTodosForView(api, token, activeView) {
  if (activeView.type === "my-day") return api.getMyDay(token);
  if (activeView.type === "important") return api.getImportant(token);
  if (activeView.type === "planned") return api.getPlanned(token);
  if (activeView.type === "assigned") return api.getAssignedToMe(token);
  return api.getTodos(token, activeView.listId);
}
