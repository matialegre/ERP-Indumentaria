import React, { createContext, useContext, useState, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import { api } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync("erp_token");
        if (saved) {
          setToken(saved);
          const me = await api.get("/auth/me");
          setUser(me);
        }
      } catch {
        await SecureStore.deleteItemAsync("erp_token").catch(() => {});
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (username, password) => {
    const data = await api.post("/auth/login", { username, password });
    await SecureStore.setItemAsync("erp_token", data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync("erp_token").catch(() => {});
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
