import { renderHook, act, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { AuthProvider } from "./AuthContext";
import { ListsProvider, useLists } from "./ListsContext";
import { api } from "../api/client";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("../api/client", () => ({
  api: {
    getLists: jest.fn(),
    getListGroups: jest.fn(),
    getMyListShares: jest.fn(),
    getListShares: jest.fn(),
    addList: jest.fn(),
    updateList: jest.fn(),
    deleteList: jest.fn(),
    addListGroup: jest.fn(),
    updateListGroup: jest.fn(),
    deleteListGroup: jest.fn(),
    acceptListShare: jest.fn(),
    declineListShare: jest.fn(),
    removeListShare: jest.fn(),
  },
}));

function wrapper({ children }) {
  return (
    <AuthProvider>
      <ListsProvider>{children}</ListsProvider>
    </AuthProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  SecureStore.getItemAsync.mockImplementation((key) => {
    const values = { token: "tok123", username: "alice", nickname: "Al", id: "7" };
    return Promise.resolve(values[key] ?? null);
  });
  api.getLists.mockResolvedValue([]);
  api.getListGroups.mockResolvedValue([]);
  api.getMyListShares.mockResolvedValue({ sharedWithMe: [], invitesReceived: [] });
  api.getListShares.mockResolvedValue({ owner: { id: 7, username: "alice" }, shares: [] });
});

describe("ListsContext", () => {
  it("fetches lists/groups/shares once the auth token is available", async () => {
    await renderHook(() => useLists(), { wrapper });

    await waitFor(() => expect(api.getLists).toHaveBeenCalledWith("tok123"));
    expect(api.getListGroups).toHaveBeenCalledWith("tok123");
    expect(api.getMyListShares).toHaveBeenCalledWith("tok123");
  });

  it("createList optimistically appends the new list and switches the active view to it", async () => {
    api.addList.mockResolvedValue({ id: 5, name: "Groceries", group_id: null, is_default: 0 });
    const { result } = await renderHook(() => useLists(), { wrapper });
    await waitFor(() => expect(api.getLists).toHaveBeenCalled());

    await act(async () => {
      await result.current.createList("Groceries", null);
    });

    expect(result.current.lists).toEqual([{ id: 5, name: "Groceries", group_id: null, is_default: 0 }]);
    expect(result.current.activeView).toEqual({ type: "list", listId: 5 });
  });

  it("deleteList resets the active view to My Day when the deleted list was active", async () => {
    api.getLists.mockResolvedValue([{ id: 5, name: "Groceries", is_default: 0 }]);
    api.deleteList.mockResolvedValue(null);
    const { result } = await renderHook(() => useLists(), { wrapper });
    await waitFor(() => expect(result.current.lists).toHaveLength(1));

    await act(async () => {
      result.current.setActiveView({ type: "list", listId: 5 });
    });
    await waitFor(() => expect(result.current.activeView).toEqual({ type: "list", listId: 5 }));

    await act(async () => {
      await result.current.deleteList(5);
    });

    expect(result.current.lists).toEqual([]);
    expect(result.current.activeView).toEqual({ type: "my-day" });
  });

  it("refetches task members when the active view switches to a list", async () => {
    api.getListShares.mockResolvedValue({
      owner: { id: 7, username: "alice" },
      shares: [{ id: 1, user_id: 8, username: "bob", status: "accepted" }],
    });
    const { result } = await renderHook(() => useLists(), { wrapper });
    await waitFor(() => expect(api.getLists).toHaveBeenCalled());

    await act(async () => {
      result.current.setActiveView({ type: "list", listId: 5 });
    });

    await waitFor(() => expect(result.current.taskMembers).toHaveLength(2));
    expect(api.getListShares).toHaveBeenCalledWith("tok123", 5);
  });
});
