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
        setIsHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw) as AuthSession;
      setSessionState(parsed);
      setIsHydrated(true);
    } catch {
      removeSessionFromStorage();
      setIsHydrated(true);
    }
  }, []);

  const setSession = useCallback((nextSession: AuthSession | null) => {
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
