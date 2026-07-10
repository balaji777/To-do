import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TodoApp from "../TodoApp";
import { AuthProvider } from "../AuthContext";
import { api } from "../api";

vi.mock("../api", () => ({
  api: {
    getTodos: vi.fn(),
    addTodo: vi.fn(),
    updateTodo: vi.fn(),
    deleteTodo: vi.fn(),
    getCollaborators: vi.fn(),
    getListMembers: vi.fn(),
    inviteCollaborator: vi.fn(),
    acceptInvite: vi.fn(),
    declineInvite: vi.fn(),
    removeCollaborator: vi.fn(),
    getCategories: vi.fn(),
    addCategory: vi.fn(),
    deleteCategory: vi.fn(),
    getLabels: vi.fn(),
    addLabel: vi.fn(),
    deleteLabel: vi.fn(),
    attachLabel: vi.fn(),
    detachLabel: vi.fn(),
    getSubtasks: vi.fn(),
    addSubtask: vi.fn(),
    updateSubtask: vi.fn(),
    deleteSubtask: vi.fn(),
  },
}));

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
    category: null,
    category_id: null,
    category_name: null,
    recurrence: "none",
    type: "task",
    link: null,
    labels: [],
    subtasks: [],
    created_at: new Date().toISOString(),
    created_by: 1,
    ...overrides,
  };
}

beforeEach(() => {
  api.getTodos.mockResolvedValue([]);
  api.getListMembers.mockResolvedValue([{ id: 1, username: "alice", nickname: "Alice" }]);
  api.getCollaborators.mockResolvedValue({ myLists: [], myCollaborators: [], invitesReceived: [] });
  api.getCategories.mockResolvedValue([]);
  api.getLabels.mockResolvedValue([]);
});

describe("TodoApp", () => {
  it("shows loading then an empty state", async () => {
    renderApp();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/no tasks match/i)).toBeInTheDocument());
  });

  it("renders fetched todos", async () => {
    api.getTodos.mockResolvedValue([baseTodo({ title: "Buy milk" })]);
    renderApp();
    expect(await screen.findByText("Buy milk")).toBeInTheDocument();
  });

  it("adds a new todo", async () => {
    const user = userEvent.setup();
    api.addTodo.mockResolvedValue(baseTodo({ id: 2, title: "New task" }));
    renderApp();
    await waitFor(() => expect(api.getTodos).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText(/what needs to ship/i), "New task");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    expect(api.addTodo).toHaveBeenCalledWith(
      "tok",
      expect.objectContaining({ title: "New task", priority: "medium", recurrence: "none" })
    );
    expect(await screen.findByText("New task")).toBeInTheDocument();
  });

  it("toggles a todo done", async () => {
    const user = userEvent.setup();
    const todo = baseTodo({ title: "Toggle me" });
    api.getTodos.mockResolvedValue([todo]);
    api.updateTodo.mockResolvedValue({ ...todo, done: 1 });
    renderApp();

    const todoText = await screen.findByText("Toggle me");
    const listItem = todoText.closest("li");
    const checkbox = within(listItem).getByRole("checkbox");
    await user.click(checkbox);

    expect(api.updateTodo).toHaveBeenCalledWith("tok", todo.id, { done: true });
  });

  it("deletes a todo", async () => {
    const user = userEvent.setup();
    const todo = baseTodo({ title: "Delete me" });
    api.getTodos.mockResolvedValue([todo]);
    api.deleteTodo.mockResolvedValue(null);
    renderApp();

    const todoText = await screen.findByText("Delete me");
    const listItem = todoText.closest("li");
    await user.click(within(listItem).getByRole("button", { name: /delete/i }));

    expect(api.deleteTodo).toHaveBeenCalledWith("tok", todo.id);
    await waitFor(() => expect(screen.queryByText("Delete me")).not.toBeInTheDocument());
  });

  it("edits a todo's title", async () => {
    const user = userEvent.setup();
    const todo = baseTodo({ title: "Old title" });
    api.getTodos.mockResolvedValue([todo]);
    api.updateTodo.mockResolvedValue({ ...todo, title: "New title" });
    renderApp();

    const todoText = await screen.findByText("Old title");
    const listItem = todoText.closest("li");
    await user.click(within(listItem).getByRole("button", { name: /edit/i }));

    const titleInput = screen.getByDisplayValue("Old title");
    await user.clear(titleInput);
    await user.type(titleInput, "New title");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(api.updateTodo).toHaveBeenCalledWith(
      "tok",
      todo.id,
      expect.objectContaining({ title: "New title" })
    );
  });

  it("adds a todo with a type and a link", async () => {
    const user = userEvent.setup();
    api.addTodo.mockResolvedValue(baseTodo({ id: 3, title: "Fix crash", type: "bug", link: "https://github.com/acme/app/issues/9" }));
    renderApp();
    await waitFor(() => expect(api.getTodos).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText(/what needs to ship/i), "Fix crash");
    await user.selectOptions(screen.getByDisplayValue("Task"), "bug");
    await user.type(screen.getByPlaceholderText(/issue \/ pr link/i), "https://github.com/acme/app/issues/9");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    expect(api.addTodo).toHaveBeenCalledWith(
      "tok",
      expect.objectContaining({ title: "Fix crash", type: "bug", link: "https://github.com/acme/app/issues/9" })
    );

    const added = await screen.findByText("Fix crash");
    const listItem = added.closest("li");
    expect(within(listItem).getByText("Bug")).toBeInTheDocument();
    expect(within(listItem).getByRole("link", { name: /link/i })).toHaveAttribute(
      "href",
      "https://github.com/acme/app/issues/9"
    );
  });

  it("does not show a type badge for the default 'task' type", async () => {
    api.getTodos.mockResolvedValue([baseTodo({ title: "Plain task" })]);
    renderApp();

    const todoText = await screen.findByText("Plain task");
    const listItem = todoText.closest("li");
    expect(within(listItem).queryByText("Task")).not.toBeInTheDocument();
  });

  it("populates the category dropdown and sends category_id when adding a todo", async () => {
    const user = userEvent.setup();
    api.getCategories.mockResolvedValue([{ id: 9, name: "Bugs" }]);
    api.addTodo.mockResolvedValue(baseTodo({ id: 4, title: "Fix it", category_id: 9, category_name: "Bugs" }));
    renderApp();

    const categorySelect = await screen.findByDisplayValue("No category");
    await user.selectOptions(categorySelect, "9");
    await user.type(screen.getByPlaceholderText(/what needs to ship/i), "Fix it");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    expect(api.addTodo).toHaveBeenCalledWith("tok", expect.objectContaining({ category_id: "9" }));
    const added = await screen.findByText("Fix it");
    expect(within(added.closest("li")).getByText("Bugs")).toBeInTheDocument();
  });

  it("creates a new category inline from the add form", async () => {
    const user = userEvent.setup();
    api.addCategory.mockResolvedValue({ id: 11, name: "Infra" });
    renderApp();

    const categorySelect = await screen.findByDisplayValue("No category");
    await user.selectOptions(categorySelect, "__new");
    await user.type(screen.getByPlaceholderText(/new category name/i), "Infra");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(api.addCategory).toHaveBeenCalledWith("tok", "Infra", null);
    expect(await screen.findByDisplayValue("Infra")).toBeInTheDocument();
  });

  it("shows attached labels and lets a new one be added via the picker", async () => {
    const user = userEvent.setup();
    api.getLabels.mockResolvedValue([{ id: 3, name: "urgent", color: null }]);
    api.getTodos.mockResolvedValue([baseTodo({ title: "Ship it" })]);
    api.attachLabel.mockResolvedValue({
      ...baseTodo({ title: "Ship it" }),
      labels: [{ id: 3, name: "urgent", color: null }],
    });
    renderApp();

    const todoText = await screen.findByText("Ship it");
    const listItem = todoText.closest("li");
    await user.selectOptions(within(listItem).getByLabelText(/add label/i), "3");

    expect(api.attachLabel).toHaveBeenCalledWith("tok", 1, 3);
    expect(await within(listItem).findByText("urgent")).toBeInTheDocument();
  });

  it("shows subtasks and adds a new one", async () => {
    const user = userEvent.setup();
    api.getTodos.mockResolvedValue([baseTodo({ title: "Ship it" })]);
    api.addSubtask.mockResolvedValue({ id: 1, title: "Write changelog", done: 0, ordering: 0 });
    renderApp();

    const todoText = await screen.findByText("Ship it");
    const listItem = todoText.closest("li");
    await user.type(within(listItem).getByPlaceholderText(/add subtask/i), "Write changelog");
    await user.click(within(listItem).getByRole("button", { name: /^add$/i }));

    expect(api.addSubtask).toHaveBeenCalledWith("tok", 1, "Write changelog");
    expect(await within(listItem).findByText("Write changelog")).toBeInTheDocument();
  });

  it("filters todos via search", async () => {
    const user = userEvent.setup();
    api.getTodos.mockResolvedValue([baseTodo({ id: 1, title: "Alpha" }), baseTodo({ id: 2, title: "Beta" })]);
    renderApp();

    await screen.findByText("Alpha");
    await user.type(screen.getByPlaceholderText(/search tasks/i), "Alpha");

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
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

    expect(await screen.findByText(/invited you to collaborate/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /accept/i }));

    expect(api.acceptInvite).toHaveBeenCalledWith("tok", 5);
  });
});
