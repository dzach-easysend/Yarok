/**
 * Auth context — provides isLoggedIn, displayName, and auth actions to the app tree.
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import * as authService from "@/services/auth";

interface AuthState {
  isLoggedIn: boolean;
  isLoading: boolean;
  displayName: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string | null) => Promise<void>;
  logout: () => Promise<void>;
  switchToAnonymous: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  isLoggedIn: false,
  isLoading: true,
  displayName: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  switchToAnonymous: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    authService.restoreAuth().then((result) => {
      setIsLoggedIn(result.isLoggedIn);
      setDisplayName(result.displayName);
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authService.login(email, password);
    setIsLoggedIn(true);
    setDisplayName(data.display_name ?? null);
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayNameArg?: string | null) => {
      const data = await authService.register(email, password, displayNameArg);
      setIsLoggedIn(true);
      setDisplayName(data.display_name ?? displayNameArg ?? null);
    },
    [],
  );

  const logout = useCallback(async () => {
    await authService.logout();
    setIsLoggedIn(false);
    setDisplayName(null);
  }, []);

  const switchToAnonymous = useCallback(async () => {
    await authService.switchToAnonymous();
    setIsLoggedIn(false);
    setDisplayName(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ isLoggedIn, isLoading, displayName, login, register, logout, switchToAnonymous }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
