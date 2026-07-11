import { createContext, useContext, useState, useCallback } from "react";
import { api } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    const nickname = localStorage.getItem("nickname");
    const id = localStorage.getItem("id");
    const hasSeenOnboarding = localStorage.getItem("hasSeenOnboarding");
    return token && username
      ? {
          token,
          username,
          nickname: nickname || "",
          id: id ? Number(id) : null,
          hasSeenOnboarding: hasSeenOnboarding === "true",
        }
      : null;
  });

  const login = useCallback((token, username, nickname = "", id = null, hasSeenOnboarding = false) => {
    localStorage.setItem("token", token);
    localStorage.setItem("username", username);
    localStorage.setItem("nickname", nickname || "");
    localStorage.setItem("hasSeenOnboarding", String(!!hasSeenOnboarding));
    if (id != null) localStorage.setItem("id", String(id));
    setAuth({ token, username, nickname: nickname || "", id, hasSeenOnboarding: !!hasSeenOnboarding });
  }, []);

  const setNickname = useCallback((nickname) => {
    localStorage.setItem("nickname", nickname);
    setAuth((prev) => (prev ? { ...prev, nickname } : prev));
  }, []);

  const markOnboardingSeen = useCallback(() => {
    setAuth((prev) => (prev ? { ...prev, hasSeenOnboarding: true } : prev));
    localStorage.setItem("hasSeenOnboarding", "true");
    api.markOnboardingSeen(localStorage.getItem("token")).catch(() => {});
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("nickname");
    localStorage.removeItem("id");
    localStorage.removeItem("hasSeenOnboarding");
    setAuth(null);
    // Clear the offline todos cache so a network blip after logout can't serve
    // this user's cached data to whoever logs in next on the same device.
    if (typeof caches !== "undefined") {
      caches.delete("todos-cache").catch(() => {});
    }
  }, []);

  return (
    <AuthContext.Provider value={{ auth, login, logout, setNickname, markOnboardingSeen }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
