import { createContext, useContext, useState, useCallback, useEffect } from "react";
import * as SecureStore from "expo-secure-store";

const AuthContext = createContext(null);

const KEYS = ["token", "username", "nickname", "id"];

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all(KEYS.map((key) => SecureStore.getItemAsync(key)))
      .then(([token, username, nickname, id]) => {
        if (token && username) {
          setAuth({ token, username, nickname: nickname || "", id: id ? Number(id) : null });
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback((token, username, nickname = "", id = null) => {
    SecureStore.setItemAsync("token", token);
    SecureStore.setItemAsync("username", username);
    SecureStore.setItemAsync("nickname", nickname || "");
    if (id != null) SecureStore.setItemAsync("id", String(id));
    setAuth({ token, username, nickname: nickname || "", id });
  }, []);

  const setNickname = useCallback((nickname) => {
    SecureStore.setItemAsync("nickname", nickname);
    setAuth((prev) => (prev ? { ...prev, nickname } : prev));
  }, []);

  const logout = useCallback(() => {
    KEYS.forEach((key) => SecureStore.deleteItemAsync(key));
    setAuth(null);
  }, []);

  return (
    <AuthContext.Provider value={{ auth, isLoading, login, logout, setNickname }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
