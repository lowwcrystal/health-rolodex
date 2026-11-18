import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi, type LoginInput, type Session, type SignupInput } from "@/api/auth";

interface AuthState {
  session: Session | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<Session>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi
      .me()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const next = await authApi.login(input);
    setSession(next);
    return next;
  }, []);
  const signup = useCallback(async (input: SignupInput) => setSession(await authApi.signup(input)), []);
  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, loading, login, signup, logout }),
    [session, loading, login, signup, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
