import { SMART_VIEWS, viewTitle, canQuickAdd, createPayloadFor, fetchTodosForView } from "./views";

describe("viewTitle", () => {
  it("returns the smart view label", () => {
    expect(viewTitle({ type: "my-day" })).toBe("My Day");
    expect(viewTitle({ type: "assigned" })).toBe("Assigned to me");
  });

  it("returns the matching own list's name", () => {
    const lists = [{ id: 1, name: "Groceries" }];
    expect(viewTitle({ type: "list", listId: 1 }, lists, [])).toBe("Groceries");
  });

  it("falls back to a shared list's name when not owned", () => {
    const shared = [{ id: 9, name: "Team Sprint" }];
    expect(viewTitle({ type: "list", listId: 9 }, [], shared)).toBe("Team Sprint");
  });

  it("falls back to Tasks when the list can't be found", () => {
    expect(viewTitle({ type: "list", listId: 404 }, [], [])).toBe("Tasks");
  });
});

describe("canQuickAdd", () => {
  it("is true for list and my-day views", () => {
    expect(canQuickAdd({ type: "list", listId: 1 })).toBe(true);
    expect(canQuickAdd({ type: "my-day" })).toBe(true);
  });

  it("is false for important, planned, and assigned views", () => {
    expect(canQuickAdd({ type: "important" })).toBe(false);
    expect(canQuickAdd({ type: "planned" })).toBe(false);
    expect(canQuickAdd({ type: "assigned" })).toBe(false);
  });
});

describe("createPayloadFor", () => {
  it("targets the active list directly", () => {
    expect(createPayloadFor({ type: "list", listId: 3 }, [])).toEqual({ list_id: 3 });
  });

  it("targets the default list and sets my_day for the My Day view", () => {
    const lists = [{ id: 1, is_default: 0 }, { id: 2, is_default: 1 }];
    expect(createPayloadFor({ type: "my-day" }, lists)).toEqual({ list_id: 2, my_day: true });
  });

  it("returns null for My Day when there's no default list", () => {
    expect(createPayloadFor({ type: "my-day" }, [])).toBeNull();
  });

  it("returns null for smart views that aren't creatable into", () => {
    expect(createPayloadFor({ type: "important" }, [])).toBeNull();
  });
});

describe("fetchTodosForView", () => {
  function mockApi() {
    return {
      getMyDay: jest.fn().mockResolvedValue("my-day"),
      getImportant: jest.fn().mockResolvedValue("important"),
      getPlanned: jest.fn().mockResolvedValue("planned"),
      getAssignedToMe: jest.fn().mockResolvedValue("assigned"),
      getTodos: jest.fn().mockResolvedValue("list"),
    };
  }

  it("routes each smart view to its matching api call", async () => {
    const api = mockApi();
    await fetchTodosForView(api, "tok", { type: "my-day" });
    await fetchTodosForView(api, "tok", { type: "important" });
    await fetchTodosForView(api, "tok", { type: "planned" });
    await fetchTodosForView(api, "tok", { type: "assigned" });

    expect(api.getMyDay).toHaveBeenCalledWith("tok");
    expect(api.getImportant).toHaveBeenCalledWith("tok");
    expect(api.getPlanned).toHaveBeenCalledWith("tok");
    expect(api.getAssignedToMe).toHaveBeenCalledWith("tok");
  });

  it("routes a list view to getTodos with the list id", async () => {
    const api = mockApi();
    await fetchTodosForView(api, "tok", { type: "list", listId: 7 });

    expect(api.getTodos).toHaveBeenCalledWith("tok", 7);
  });
});

it("SMART_VIEWS covers exactly the four expected views", () => {
  expect(SMART_VIEWS.map((v) => v.type)).toEqual(["my-day", "important", "planned", "assigned"]);
});
