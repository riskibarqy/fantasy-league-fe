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
const SESSION_FALLBACK_KEY = "fantasy-session-fallback";
const IMAGE_CACHE_STORAGE_KEY = "fantasy:image-cache:v1";
const SESSION_EXPIRY_SKEW_MS = 5_000;
const SESSION_CLOCK_DRIFT_TOLERANCE_MS = 5 * 60 * 1000;

let volatileSession: AuthSession | null = null;

type SessionContextValue = {
  session: AuthSession | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setSession: (session: AuthSession | null) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export const SessionProvider = ({ children }: PropsWithChildren) => {
  const [session, setSessionState] = useState<AuthSession | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = readSessionRaw();
      if (!raw) {
        if (volatileSession && !isSessionExpired(volatileSession)) {
          setSessionState(volatileSession);
        }
        setIsHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw) as AuthSession;
      if (isSessionExpired(parsed)) {
        removeSessionFromStorage();
        volatileSession = null;
        clearRequestCache();
        setIsHydrated(true);
        return;
      }

      volatileSession = parsed;
      setSessionState(parsed);
      setIsHydrated(true);
    } catch {
      removeSessionFromStorage();
      volatileSession = null;
      setIsHydrated(true);
    }
  }, []);

  const setSession = useCallback((nextSession: AuthSession | null) => {
    volatileSession = nextSession;
    setSessionState(nextSession);

    if (!nextSession) {
      removeSessionFromStorage();
      clearRequestCache();
      return;
    }

    const payload = JSON.stringify(nextSession);
    try {
      localStorage.setItem(SESSION_KEY, payload);
      try {
        sessionStorage.setItem(SESSION_FALLBACK_KEY, payload);
      } catch {
        // Ignore fallback storage failure.
      }
      return;
    } catch {
      // localStorage can be full due image/request cache. Evict and retry once.
      clearRequestCache();
      try {
        localStorage.removeItem(IMAGE_CACHE_STORAGE_KEY);
        localStorage.setItem(SESSION_KEY, payload);
        try {
          sessionStorage.setItem(SESSION_FALLBACK_KEY, payload);
        } catch {
          // Ignore fallback storage failure.
        }
      } catch {
        try {
          sessionStorage.setItem(SESSION_FALLBACK_KEY, payload);
        } catch {
          // Keep authenticated state in memory to avoid breaking post-login redirect.
        }
      }
    }
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

    const timeoutMs = Math.max(
      0,
      expiryAtMs - Date.now() + SESSION_EXPIRY_SKEW_MS + SESSION_CLOCK_DRIFT_TOLERANCE_MS
    );
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
      isHydrated,
      setSession
    }),
    [isHydrated, session, setSession]
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
  const expiryFromField = Date.parse(session.expiresAt);
  if (Number.isFinite(expiryFromField)) {
    return expiryFromField;
  }

  const expiryFromToken = readJwtExpiryMs(session.accessToken);
  if (expiryFromToken) {
    return expiryFromToken;
  }

  return null;
};

const isSessionExpired = (session: AuthSession): boolean => {
  const expiryAtMs = resolveSessionExpiryMs(session);
  if (!expiryAtMs) {
    return false;
  }

  return expiryAtMs <= Date.now() + SESSION_EXPIRY_SKEW_MS - SESSION_CLOCK_DRIFT_TOLERANCE_MS;
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

const readSessionRaw = (): string | null => {
  try {
    const primary = localStorage.getItem(SESSION_KEY);
    if (primary?.trim()) {
      return primary;
    }
  } catch {
    // Ignore storage read failures.
  }

  try {
    const fallback = sessionStorage.getItem(SESSION_FALLBACK_KEY);
    if (fallback?.trim()) {
      return fallback;
    }
  } catch {
    // Ignore fallback storage read failures.
  }

  return null;
};

const removeSessionFromStorage = (): void => {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore storage remove failures.
  }

  try {
    sessionStorage.removeItem(SESSION_FALLBACK_KEY);
  } catch {
    // Ignore fallback storage remove failures.
  }
};
