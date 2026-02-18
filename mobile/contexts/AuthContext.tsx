/**
 * Auth context — provides isLoggedIn state and auth actions to the app tree.
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import * as authService from "@/services/auth";

interface AuthState {
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string | null) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  isLoggedIn: false,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authService.restoreAuth().then((loggedIn) => {
      setIsLoggedIn(loggedIn);
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await authService.login(email, password);
    setIsLoggedIn(true);
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName?: string | null) => {
      await authService.register(email, password, displayName);
      setIsLoggedIn(true);
    },
    [],
  );

  const logout = useCallback(async () => {
    await authService.logout();
    setIsLoggedIn(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isLoggedIn, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
