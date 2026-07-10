import { renderHook, act, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { AuthProvider, useAuth } from "./AuthContext";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

function wrapper({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  SecureStore.getItemAsync.mockResolvedValue(null);
});

describe("AuthContext", () => {
  it("resolves to no auth once SecureStore bootstrap finishes", async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.auth).toBeNull();
  });

  it("bootstraps auth from SecureStore on mount", async () => {
    SecureStore.getItemAsync.mockImplementation((key) => {
      const values = { token: "tok123", username: "alice", nickname: "Al", id: "7" };
      return Promise.resolve(values[key] ?? null);
    });

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.auth).toEqual({ token: "tok123", username: "alice", nickname: "Al", id: 7 });
  });

  it("login() persists to SecureStore and updates state", async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.login("tok456", "bob", "Bobby", 3);
    });

    await waitFor(() => expect(result.current.auth).not.toBeNull());
    expect(result.current.auth).toEqual({ token: "tok456", username: "bob", nickname: "Bobby", id: 3 });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("token", "tok456");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("username", "bob");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("nickname", "Bobby");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("id", "3");
  });

  it("setNickname() updates both state and SecureStore", async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.login("tok1", "dave");
    });
    await waitFor(() => expect(result.current.auth).not.toBeNull());

    await act(async () => {
      result.current.setNickname("Davey");
    });

    await waitFor(() => expect(result.current.auth.nickname).toBe("Davey"));
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("nickname", "Davey");
  });

  it("logout() clears SecureStore and resets state to null", async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.login("tok1", "eve", "Evie", 9);
    });
    await waitFor(() => expect(result.current.auth).not.toBeNull());

    await act(async () => {
      result.current.logout();
    });

    await waitFor(() => expect(result.current.auth).toBeNull());
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("token");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("username");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("nickname");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("id");
  });
});
