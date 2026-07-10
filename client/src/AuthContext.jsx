import { createContext, useContext, useState, useCallback } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    const nickname = localStorage.getItem("nickname");
    const id = localStorage.getItem("id");
    return token && username
      ? { token, username, nickname: nickname || "", id: id ? Number(id) : null }
      : null;
  });

  const login = useCallback((token, username, nickname = "", id = null) => {
    localStorage.setItem("token", token);
    localStorage.setItem("username", username);
    localStorage.setItem("nickname", nickname || "");
    if (id != null) localStorage.setItem("id", String(id));
    setAuth({ token, username, nickname: nickname || "", id });
  }, []);

  const setNickname = useCallback((nickname) => {
    localStorage.setItem("nickname", nickname);
    setAuth((prev) => (prev ? { ...prev, nickname } : prev));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("nickname");
    localStorage.removeItem("id");
    setAuth(null);
  }, []);

  return (
    <AuthContext.Provider value={{ auth, login, logout, setNickname }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
