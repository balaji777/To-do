import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Sidebar from "../Sidebar";

function renderSidebar(overrides = {}) {
  const props = {
    lists: [],
    groups: [],
    activeView: { type: "my-day" },
    onSelect: vi.fn(),
    onCreateList: vi.fn(),
    onCreateGroup: vi.fn(),
    onMoveList: vi.fn(),
    onMoveGroup: vi.fn(),
    ...overrides,
  };
  render(<Sidebar {...props} />);
  return props;
}

function drag(source, target) {
  const dataTransfer = {};
  fireEvent.dragStart(source, { dataTransfer });
  fireEvent.dragOver(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
}

describe("Sidebar", () => {
  it("renders the smart views", () => {
    renderSidebar();
    expect(screen.getByRole("button", { name: /my day/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^important$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^planned$/i })).toBeInTheDocument();
  });

  it("selects a smart view", async () => {
    const user = userEvent.setup();
    const props = renderSidebar();
    await user.click(screen.getByRole("button", { name: /^important$/i }));
    expect(props.onSelect).toHaveBeenCalledWith({ type: "important" });
  });

  it("renders ungrouped lists and selects one", async () => {
    const user = userEvent.setup();
    const props = renderSidebar({ lists: [{ id: 1, name: "Groceries", group_id: null }] });
    const button = screen.getByRole("button", { name: /groceries/i });
    await user.click(button);
    expect(props.onSelect).toHaveBeenCalledWith({ type: "list", listId: 1 });
  });

  it("renders lists nested under their group", () => {
    renderSidebar({
      groups: [{ id: 1, name: "Home" }],
      lists: [{ id: 2, name: "Chores", group_id: 1 }],
    });
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /chores/i })).toBeInTheDocument();
  });

  it("creates a new list", async () => {
    const user = userEvent.setup();
    const props = renderSidebar();
    await user.click(screen.getByRole("button", { name: /new list/i }));
    await user.type(screen.getByPlaceholderText(/list name/i), "Work");
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    expect(props.onCreateList).toHaveBeenCalledWith("Work", null);
  });

  it("creates a new group", async () => {
    const user = userEvent.setup();
    const props = renderSidebar();
    await user.click(screen.getByRole("button", { name: /new group/i }));
    await user.type(screen.getByPlaceholderText(/group name/i), "Home");
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    expect(props.onCreateGroup).toHaveBeenCalledWith("Home");
  });

  it("renders a Shared with Me section and selects a shared list", async () => {
    const user = userEvent.setup();
    const props = renderSidebar({
      sharedLists: [{ id: 9, name: "Camping trip", owner_username: "bob", owner_nickname: "Bob" }],
    });
    expect(screen.getByText("Shared with Me")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /camping trip/i });
    await user.click(button);
    expect(props.onSelect).toHaveBeenCalledWith({ type: "list", listId: 9 });
  });

  it("omits the Shared with Me section when there are no shared lists", () => {
    renderSidebar();
    expect(screen.queryByText("Shared with Me")).not.toBeInTheDocument();
  });

  it("closes the mobile drawer after selecting a view", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const props = renderSidebar({ open: true, onClose });
    await user.click(screen.getByRole("button", { name: /^important$/i }));
    expect(props.onSelect).toHaveBeenCalledWith({ type: "important" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes the mobile drawer when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderSidebar({ open: true, onClose });
    const backdrop = document.querySelector(".bg-black\\/40");
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it("does not render a backdrop when the drawer is closed", () => {
    renderSidebar({ open: false });
    expect(document.querySelector(".bg-black\\/40")).not.toBeInTheDocument();
  });

  it("reorders ungrouped lists by dragging one before another", () => {
    const props = renderSidebar({
      lists: [
        { id: 1, name: "Groceries", group_id: null },
        { id: 2, name: "Errands", group_id: null },
      ],
    });
    const groceries = screen.getByRole("button", { name: /groceries/i });
    const errands = screen.getByRole("button", { name: /errands/i });
    drag(errands, groceries);
    expect(props.onMoveList).toHaveBeenCalledWith(2, { beforeId: 1, groupId: null });
  });

  it("moves a list into a group by dropping it on the group header", () => {
    const props = renderSidebar({
      groups: [{ id: 1, name: "Home" }],
      lists: [{ id: 2, name: "Groceries", group_id: null }],
    });
    const groceries = screen.getByRole("button", { name: /groceries/i });
    const groupHeader = screen.getByText("Home");
    drag(groceries, groupHeader);
    expect(props.onMoveList).toHaveBeenCalledWith(2, { beforeId: null, groupId: 1 });
  });

  it("moves a list out of a group by dropping it in the ungrouped area", () => {
    const props = renderSidebar({
      groups: [{ id: 1, name: "Home" }],
      lists: [
        { id: 2, name: "Chores", group_id: 1 },
        { id: 3, name: "Errands", group_id: null },
      ],
    });
    const chores = screen.getByRole("button", { name: /chores/i });
    const errands = screen.getByRole("button", { name: /errands/i });
    drag(chores, errands);
    expect(props.onMoveList).toHaveBeenCalledWith(2, { beforeId: 3, groupId: null });
  });

  it("collapses and expands a group when its header is clicked", async () => {
    const user = userEvent.setup();
    renderSidebar({
      groups: [{ id: 1, name: "Home" }],
      lists: [{ id: 2, name: "Chores", group_id: 1 }],
    });
    expect(screen.getByRole("button", { name: /chores/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /home/i }));
    expect(screen.queryByRole("button", { name: /chores/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /home/i }));
    expect(screen.getByRole("button", { name: /chores/i })).toBeInTheDocument();
  });

  it("persists collapsed groups to localStorage and restores them on mount", async () => {
    const user = userEvent.setup();
    const props = {
      groups: [{ id: 1, name: "Home" }],
      lists: [{ id: 2, name: "Chores", group_id: 1 }],
    };
    const { unmount } = render(
      <Sidebar
        {...props}
        activeView={{ type: "my-day" }}
        onSelect={vi.fn()}
        onCreateList={vi.fn()}
        onCreateGroup={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: /home/i }));
    expect(JSON.parse(localStorage.getItem("collapsedGroups"))).toEqual([1]);
    unmount();

    render(
      <Sidebar
        {...props}
        activeView={{ type: "my-day" }}
        onSelect={vi.fn()}
        onCreateList={vi.fn()}
        onCreateGroup={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /chores/i })).not.toBeInTheDocument();
  });

  it("shows a placeholder under an empty group", () => {
    renderSidebar({ groups: [{ id: 1, name: "Home" }] });
    expect(screen.getByText(/no lists yet/i)).toBeInTheDocument();
  });

  it("still accepts a list dropped on a collapsed group", async () => {
    const user = userEvent.setup();
    const props = renderSidebar({
      groups: [{ id: 1, name: "Home" }],
      lists: [{ id: 2, name: "Groceries", group_id: null }],
    });
    await user.click(screen.getByRole("button", { name: /home/i }));
    drag(screen.getByRole("button", { name: /groceries/i }), screen.getByRole("button", { name: /home/i }));
    expect(props.onMoveList).toHaveBeenCalledWith(2, { beforeId: null, groupId: 1 });
  });

  it("reorders groups by dragging one group header onto another", () => {
    const props = renderSidebar({
      groups: [
        { id: 1, name: "Home" },
        { id: 2, name: "Work" },
      ],
    });
    const work = screen.getByText("Work");
    const home = screen.getByText("Home");
    drag(work, home);
    expect(props.onMoveGroup).toHaveBeenCalledWith(2, 1);
  });
});
