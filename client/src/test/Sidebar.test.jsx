import { render, screen } from "@testing-library/react";
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
    ...overrides,
  };
  render(<Sidebar {...props} />);
  return props;
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
});
