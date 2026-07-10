import { renderHook, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "../AuthContext";

function wrapper({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("AuthContext", () => {
  it("starts with no auth when localStorage is empty", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.auth).toBeNull();
  });

  it("hydrates auth from localStorage on mount", () => {
    localStorage.setItem("token", "tok123");
    localStorage.setItem("username", "alice");
    localStorage.setItem("nickname", "Al");
    localStorage.setItem("id", "7");

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.auth).toEqual({ token: "tok123", username: "alice", nickname: "Al", id: 7 });
  });

  it("login() persists to localStorage and updates state", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.login("tok456", "bob", "Bobby", 3);
    });

    expect(result.current.auth).toEqual({ token: "tok456", username: "bob", nickname: "Bobby", id: 3 });
    expect(localStorage.getItem("token")).toBe("tok456");
    expect(localStorage.getItem("username")).toBe("bob");
    expect(localStorage.getItem("nickname")).toBe("Bobby");
    expect(localStorage.getItem("id")).toBe("3");
  });

  it("login() defaults nickname to empty string when omitted", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.login("tok789", "carol");
    });

    expect(result.current.auth.nickname).toBe("");
    expect(localStorage.getItem("nickname")).toBe("");
  });

  it("setNickname() updates both state and localStorage", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.login("tok1", "dave");
    });
    act(() => {
      result.current.setNickname("Davey");
    });

    expect(result.current.auth.nickname).toBe("Davey");
    expect(localStorage.getItem("nickname")).toBe("Davey");
  });

  it("logout() clears localStorage and resets state to null", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.login("tok1", "eve", "Evie", 9);
    });
    act(() => {
      result.current.logout();
    });

    expect(result.current.auth).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("username")).toBeNull();
    expect(localStorage.getItem("nickname")).toBeNull();
    expect(localStorage.getItem("id")).toBeNull();
  });
});
