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
import { clearRequestCache } from "../../app/cache/requestCache";

const SESSION_KEY = "fantasy-session";
const SESSION_EXPIRY_SKEW_MS = 5_000;

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
      if (isSessionExpired(parsed)) {
        localStorage.removeItem(SESSION_KEY);
        clearRequestCache();
        return;
      }

      setSessionState(parsed);
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  const setSession = useCallback((nextSession: AuthSession | null) => {
    setSessionState(nextSession);

    if (!nextSession) {
      localStorage.removeItem(SESSION_KEY);
      clearRequestCache();
      return;
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    const checkAndLogoutIfExpired = () => {
      if (isSessionExpired(session)) {
        setSession(null);
      }
    };

    checkAndLogoutIfExpired();

    const expiryAtMs = resolveSessionExpiryMs(session);
    if (!expiryAtMs) {
      return;
    }

    const timeoutMs = Math.max(0, expiryAtMs - Date.now() + SESSION_EXPIRY_SKEW_MS);
    const timeoutId = window.setTimeout(() => {
      setSession(null);
    }, timeoutMs);
    const intervalId = window.setInterval(checkAndLogoutIfExpired, 30_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkAndLogoutIfExpired();
      }
    };

    window.addEventListener("focus", checkAndLogoutIfExpired);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
      window.removeEventListener("focus", checkAndLogoutIfExpired);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [session, setSession]);

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

const resolveSessionExpiryMs = (session: AuthSession): number | null => {
  const candidates: number[] = [];

  const expiryFromField = Date.parse(session.expiresAt);
  if (Number.isFinite(expiryFromField)) {
    candidates.push(expiryFromField);
  }

  const expiryFromToken = readJwtExpiryMs(session.accessToken);
  if (expiryFromToken) {
    candidates.push(expiryFromToken);
  }

  if (candidates.length === 0) {
    return null;
  }

  return Math.min(...candidates);
};

const isSessionExpired = (session: AuthSession): boolean => {
  const expiryAtMs = resolveSessionExpiryMs(session);
  if (!expiryAtMs) {
    return false;
  }

  return expiryAtMs <= Date.now() + SESSION_EXPIRY_SKEW_MS;
};

const readJwtExpiryMs = (token: string): number | null => {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded)) as { exp?: number };

    if (typeof payload.exp === "number" && Number.isFinite(payload.exp) && payload.exp > 0) {
      return payload.exp * 1000;
    }
  } catch {
    return null;
  }

  return null;
};
