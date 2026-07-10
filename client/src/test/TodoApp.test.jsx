import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TodoApp from "../TodoApp";
import { AuthProvider } from "../AuthContext";
import { api } from "../api";

vi.mock("../api", () => ({
  api: {
    getTodos: vi.fn(),
    getMyDay: vi.fn(),
    getImportant: vi.fn(),
    getPlanned: vi.fn(),
    addTodo: vi.fn(),
    updateTodo: vi.fn(),
    deleteTodo: vi.fn(),
    getCollaborators: vi.fn(),
    getListMembers: vi.fn(),
    inviteCollaborator: vi.fn(),
    acceptInvite: vi.fn(),
    declineInvite: vi.fn(),
    removeCollaborator: vi.fn(),
    getLists: vi.fn(),
    addList: vi.fn(),
    updateList: vi.fn(),
    deleteList: vi.fn(),
    getListGroups: vi.fn(),
    addListGroup: vi.fn(),
    updateListGroup: vi.fn(),
    deleteListGroup: vi.fn(),
    getMyListShares: vi.fn(),
    getListShares: vi.fn(),
    inviteToList: vi.fn(),
    acceptListShare: vi.fn(),
    declineListShare: vi.fn(),
    removeListShare: vi.fn(),
    getSubtasks: vi.fn(),
    addSubtask: vi.fn(),
    updateSubtask: vi.fn(),
    deleteSubtask: vi.fn(),
    getAttachments: vi.fn(),
    uploadAttachment: vi.fn(),
    downloadAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
  },
}));

const DEFAULT_LIST = { id: 1, name: "Tasks", group_id: null, is_default: 1, ordering: 0 };

function renderApp() {
  localStorage.setItem("token", "tok");
  localStorage.setItem("username", "alice");
  localStorage.setItem("nickname", "Alice");
  localStorage.setItem("id", "1");
  return render(
    <AuthProvider>
      <TodoApp />
    </AuthProvider>
  );
}

function baseTodo(overrides = {}) {
  return {
    id: 1,
    title: "Write report",
    done: 0,
    due_date: null,
    priority: "medium",
    recurrence: "none",
    important: 0,
    notes: null,
    my_day_date: null,
    list_id: DEFAULT_LIST.id,
    subtasks: [],
    created_at: new Date().toISOString(),
    created_by: 1,
    ...overrides,
  };
}

beforeEach(() => {
  api.getTodos.mockResolvedValue([]);
  api.getMyDay.mockResolvedValue([]);
  api.getImportant.mockResolvedValue([]);
  api.getPlanned.mockResolvedValue([]);
  api.getListMembers.mockResolvedValue([{ id: 1, username: "alice", nickname: "Alice" }]);
  api.getCollaborators.mockResolvedValue({ myLists: [], myCollaborators: [], invitesReceived: [] });
  api.getLists.mockResolvedValue([DEFAULT_LIST]);
  api.getListGroups.mockResolvedValue([]);
  api.getMyListShares.mockResolvedValue({ sharedWithMe: [], invitesReceived: [] });
  api.getListShares.mockResolvedValue({ owner: { id: 1, username: "alice", nickname: "Alice" }, shares: [] });
  api.getAttachments.mockResolvedValue([]);
});

describe("TodoApp", () => {
  it("shows loading then an empty state", async () => {
    renderApp();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/no tasks match/i)).toBeInTheDocument());
  });

  it("renders fetched todos in My Day by default", async () => {
    api.getMyDay.mockResolvedValue([baseTodo({ title: "Buy milk" })]);
    renderApp();
    expect(await screen.findByText("Buy milk")).toBeInTheDocument();
    expect(api.getMyDay).toHaveBeenCalled();
  });

  it("adds a new todo to My Day", async () => {
    const user = userEvent.setup();
    api.addTodo.mockResolvedValue(baseTodo({ id: 2, title: "New task", my_day_date: "2026-01-01" }));
    renderApp();
    await waitFor(() => expect(api.getMyDay).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText(/add a task/i), "New task{Enter}");

    expect(api.addTodo).toHaveBeenCalledWith(
      "tok",
      expect.objectContaining({ title: "New task", list_id: DEFAULT_LIST.id, my_day: true })
    );
    expect(await screen.findByText("New task")).toBeInTheDocument();
  });

  it("toggles a todo done", async () => {
    const user = userEvent.setup();
    const todo = baseTodo({ title: "Toggle me" });
    api.getMyDay.mockResolvedValue([todo]);
    api.updateTodo.mockResolvedValue({ ...todo, done: 1 });
    renderApp();

    const todoText = await screen.findByText("Toggle me");
    const listItem = todoText.closest("li");
    const checkbox = within(listItem).getByRole("checkbox");
    await user.click(checkbox);

    expect(api.updateTodo).toHaveBeenCalledWith("tok", todo.id, { done: true });
  });

  it("stars a todo as important", async () => {
    const user = userEvent.setup();
    const todo = baseTodo({ title: "Star me" });
    api.getMyDay.mockResolvedValue([todo]);
    api.updateTodo.mockResolvedValue({ ...todo, important: 1 });
    renderApp();

    const todoText = await screen.findByText("Star me");
    const listItem = todoText.closest("li");
    await user.click(within(listItem).getByRole("button", { name: /mark star me as important/i }));

    expect(api.updateTodo).toHaveBeenCalledWith("tok", todo.id, { important: true });
  });

  it("opens the detail panel and deletes a todo", async () => {
    const user = userEvent.setup();
    const todo = baseTodo({ title: "Delete me" });
    api.getMyDay.mockResolvedValue([todo]);
    api.deleteTodo.mockResolvedValue(null);
    renderApp();

    const todoText = await screen.findByText("Delete me");
    await user.click(todoText);
    await user.click(await screen.findByRole("button", { name: /delete task/i }));

    expect(api.deleteTodo).toHaveBeenCalledWith("tok", todo.id);
    await waitFor(() => expect(screen.queryByText("Delete me")).not.toBeInTheDocument());
  });

  it("edits a todo's title from the detail panel", async () => {
    const user = userEvent.setup();
    const todo = baseTodo({ title: "Old title" });
    api.getMyDay.mockResolvedValue([todo]);
    api.updateTodo.mockResolvedValue({ ...todo, title: "New title" });
    renderApp();

    const todoText = await screen.findByText("Old title");
    await user.click(todoText);

    const titleInput = await screen.findByDisplayValue("Old title");
    await user.clear(titleInput);
    await user.type(titleInput, "New title");
    await user.tab();

    expect(api.updateTodo).toHaveBeenCalledWith("tok", todo.id, { title: "New title" });
  });

  it("adds a note from the detail panel", async () => {
    const user = userEvent.setup();
    const todo = baseTodo({ title: "Needs notes" });
    api.getMyDay.mockResolvedValue([todo]);
    api.updateTodo.mockResolvedValue({ ...todo, notes: "Call the vendor" });
    renderApp();

    const todoText = await screen.findByText("Needs notes");
    await user.click(todoText);

    const notesInput = await screen.findByPlaceholderText(/add notes/i);
    await user.type(notesInput, "Call the vendor");
    await user.tab();

    expect(api.updateTodo).toHaveBeenCalledWith("tok", todo.id, { notes: "Call the vendor" });
  });

  it("shows steps and adds a new one from the detail panel", async () => {
    const user = userEvent.setup();
    const todo = baseTodo({ title: "Ship it" });
    api.getMyDay.mockResolvedValue([todo]);
    api.addSubtask.mockResolvedValue({ id: 1, title: "Write changelog", done: 0, ordering: 0 });
    renderApp();

    const todoText = await screen.findByText("Ship it");
    await user.click(todoText);

    await user.type(screen.getByPlaceholderText(/add subtask/i), "Write changelog");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    expect(api.addSubtask).toHaveBeenCalledWith("tok", 1, "Write changelog");
    expect(await screen.findByText("Write changelog")).toBeInTheDocument();
  });

  it("filters todos via search", async () => {
    const user = userEvent.setup();
    api.getMyDay.mockResolvedValue([baseTodo({ id: 1, title: "Alpha" }), baseTodo({ id: 2, title: "Beta" })]);
    renderApp();

    await screen.findByText("Alpha");
    await user.type(screen.getByPlaceholderText(/search tasks/i), "Alpha");

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
  });

  it("switches to the Important view and hides the quick-add bar", async () => {
    const user = userEvent.setup();
    api.getImportant.mockResolvedValue([baseTodo({ title: "Important task", important: 1 })]);
    renderApp();

    await screen.findByPlaceholderText(/add a task/i);
    await user.click(screen.getByRole("button", { name: /^important$/i }));

    expect(await screen.findByText("Important task")).toBeInTheDocument();
    expect(api.getImportant).toHaveBeenCalled();
    expect(screen.queryByPlaceholderText(/add a task/i)).not.toBeInTheDocument();
  });

  it("switches to the Planned view", async () => {
    const user = userEvent.setup();
    api.getPlanned.mockResolvedValue([baseTodo({ title: "Due soon", due_date: "2026-02-01" })]);
    renderApp();

    await user.click(screen.getByRole("button", { name: /^planned$/i }));

    expect(await screen.findByText("Due soon")).toBeInTheDocument();
    expect(api.getPlanned).toHaveBeenCalled();
  });

  it("creates a new list from the sidebar and switches to it", async () => {
    const user = userEvent.setup();
    api.addList.mockResolvedValue({ id: 5, name: "Groceries", group_id: null, is_default: 0, ordering: 1 });
    renderApp();

    await waitFor(() => expect(api.getLists).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: /new list/i }));
    await user.type(screen.getByPlaceholderText(/list name/i), "Groceries");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    expect(api.addList).toHaveBeenCalledWith("tok", "Groceries", null);
    expect(await screen.findByRole("button", { name: /groceries/i })).toBeInTheDocument();
    expect(api.getTodos).toHaveBeenCalledWith("tok", 5);
  });

  it("renders pending invites and accepts one", async () => {
    const user = userEvent.setup();
    api.getCollaborators.mockResolvedValue({
      myLists: [],
      myCollaborators: [],
      invitesReceived: [{ id: 5, username: "bob", nickname: "Bob" }],
    });
    api.acceptInvite.mockResolvedValue({ id: 5, status: "accepted" });
    renderApp();

    expect(await screen.findByText(/invited you to their household/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /accept/i }));

    expect(api.acceptInvite).toHaveBeenCalledWith("tok", 5);
  });

  it("renders a pending list-share invite and accepts it", async () => {
    const user = userEvent.setup();
    api.getMyListShares.mockResolvedValue({
      sharedWithMe: [],
      invitesReceived: [
        { share_id: 9, list_id: 7, list_name: "Groceries", owner_id: 2, owner_username: "bob", owner_nickname: "Bob" },
      ],
    });
    api.acceptListShare.mockResolvedValue({ id: 9, status: "accepted" });
    renderApp();

    expect(await screen.findByText(/shared the list "Groceries" with you/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /accept/i }));

    expect(api.acceptListShare).toHaveBeenCalledWith("tok", 9);
  });

  it("shows a shared list in the sidebar and fetches its todos when selected", async () => {
    const user = userEvent.setup();
    api.getMyListShares.mockResolvedValue({
      sharedWithMe: [{ id: 7, name: "Groceries", owner_id: 2, owner_username: "bob", owner_nickname: "Bob" }],
      invitesReceived: [],
    });
    renderApp();

    const sharedListButton = await screen.findByRole("button", { name: /groceries/i });
    await user.click(sharedListButton);

    expect(api.getTodos).toHaveBeenCalledWith("tok", 7);
  });
});
