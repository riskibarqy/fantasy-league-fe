import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import type { AuthSession } from "../../domain/auth/entities/User";

const SESSION_KEY = "fantasy-session";

type SessionContextValue = {
  session: AuthSession | null;
  isAuthenticated: boolean;
  setSession: (session: AuthSession | null) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export const SessionProvider = ({ children }: PropsWithChildren) => {
  const [session, setSessionState] = useState<AuthSession | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as AuthSession;
      setSessionState(parsed);
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  const setSession = useCallback((nextSession: AuthSession | null) => {
    setSessionState(nextSession);

    if (!nextSession) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
  }, []);

  const value = useMemo(
    () => ({
      session,
      isAuthenticated: Boolean(session),
      setSession
    }),
    [session, setSession]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = (): SessionContextValue => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("SessionProvider is missing in component tree.");
  }

  return context;
};
