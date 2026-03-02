import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { appEnv } from "../../app/config/env";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import { useLeagueSelection } from "./useLeagueSelection";
import { useSession } from "./useSession";

export type OnboardingStatus = "checking" | "required" | "completed" | "unknown";
type CacheStatus = Extract<OnboardingStatus, "required" | "completed">;
type OnboardingStatusCache = {
  status: CacheStatus;
};

export const ONBOARDING_COMPLETED_STORAGE_PREFIX = "fantasy-onboarding-completed";
const ONBOARDING_STATUS_SESSION_CACHE_PREFIX = "fantasy-onboarding-status-session-cache";
const LEGACY_ONBOARDING_COMPLETED_STORAGE_PREFIX = "fantasy-onboarding-completed";

const onboardingStorageKey = (userId: string, leagueId: string): string =>
  `${ONBOARDING_COMPLETED_STORAGE_PREFIX}:${userId}:${leagueId}`;

const legacyOnboardingStorageKey = (userId: string): string =>
  `${LEGACY_ONBOARDING_COMPLETED_STORAGE_PREFIX}:${userId}`;

const statusSessionCacheKey = (userId: string, leagueId: string, sessionKey: string): string =>
  `${ONBOARDING_STATUS_SESSION_CACHE_PREFIX}:${userId}:${leagueId}:${sessionKey}`;

const buildSessionKey = (accessToken: string, expiresAt?: string): string => {
  const token = accessToken.trim();
  if (!token) {
    return "";
  }

  const suffix = token.slice(-16);
  return `${suffix}:${expiresAt?.trim() ?? ""}`;
};

const readCompletedMarker = (userId: string, leagueId: string): boolean => {
  if (!userId || !leagueId) {
    return false;
  }

  return (
    localStorage.getItem(onboardingStorageKey(userId, leagueId)) === "true" ||
    localStorage.getItem(legacyOnboardingStorageKey(userId)) === "true"
  );
};

const writeCompletedMarker = (userId: string, leagueId: string): void => {
  if (!userId || !leagueId) {
    return;
  }

  localStorage.setItem(onboardingStorageKey(userId, leagueId), "true");
};

const clearCompletedMarker = (userId: string, leagueId: string): void => {
  if (!userId || !leagueId) {
    return;
  }

  localStorage.removeItem(onboardingStorageKey(userId, leagueId));
};

const readStatusCache = (userId: string, leagueId: string, sessionKey: string): OnboardingStatusCache | null => {
  if (!userId || !leagueId || !sessionKey) {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(statusSessionCacheKey(userId, leagueId, sessionKey));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<OnboardingStatusCache>;
    if (parsed.status !== "required" && parsed.status !== "completed") {
      return null;
    }

    return {
      status: parsed.status
    };
  } catch {
    return null;
  }
};

const writeStatusCache = (userId: string, leagueId: string, sessionKey: string, status: CacheStatus): void => {
  if (!userId || !leagueId || !sessionKey) {
    return;
  }

  const payload: OnboardingStatusCache = {
    status
  };

  try {
    sessionStorage.setItem(statusSessionCacheKey(userId, leagueId, sessionKey), JSON.stringify(payload));
  } catch {
    // Ignore fallback storage failures.
  }
};

export const markOnboardingCompleted = (userId: string, leagueId: string): void => {
  const id = userId.trim();
  const selectedLeagueId = leagueId.trim();
  if (!id || !selectedLeagueId) {
    return;
  }

  writeCompletedMarker(id, selectedLeagueId);
};

export const useOnboardingStatus = () => {
  const { getMySquad } = useContainer();
  const { session } = useSession();
  const { leagues, selectedLeagueId, isLoading: isLeaguesLoading } = useLeagueSelection();

  const [status, setStatus] = useState<OnboardingStatus>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const processedRevisionRef = useRef(0);
  const skipOnboardingInDev =
    process.env.NODE_ENV !== "production" && appEnv.skipOnboardingInDev;

  const userId = session?.user.id?.trim() ?? "";
  const accessToken = session?.accessToken?.trim() ?? "";
  const sessionKey = useMemo(
    () => buildSessionKey(accessToken, session?.expiresAt),
    [accessToken, session?.expiresAt]
  );
  const activeLeagueId = useMemo(() => {
    const preferred = selectedLeagueId.trim();
    if (preferred) {
      return preferred;
    }

    return leagues[0]?.id?.trim() ?? "";
  }, [leagues, selectedLeagueId]);

  const markCompleted = useCallback(() => {
    if (!userId || !activeLeagueId) {
      return;
    }

    markOnboardingCompleted(userId, activeLeagueId);
    setStatus("completed");
    setErrorMessage(null);
  }, [activeLeagueId, userId]);

  const refresh = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!userId || !accessToken) {
      setStatus("checking");
      setErrorMessage("Session is missing.");
      return;
    }

    if (isLeaguesLoading) {
      return;
    }

    if (!activeLeagueId) {
      setStatus("required");
      setErrorMessage("No league configured.");
      return;
    }

    if (skipOnboardingInDev) {
      writeCompletedMarker(userId, activeLeagueId);
      writeStatusCache(userId, activeLeagueId, sessionKey, "completed");
      setStatus("completed");
      setErrorMessage(null);
      return;
    }

    const forceRefresh = revision !== processedRevisionRef.current;
    processedRevisionRef.current = revision;

    const cachedStatus = readStatusCache(userId, activeLeagueId, sessionKey);

    if (!forceRefresh && cachedStatus) {
      setStatus(cachedStatus.status);
      setErrorMessage(null);
      return;
    }

    if (!forceRefresh && readCompletedMarker(userId, activeLeagueId)) {
      setStatus("completed");
      setErrorMessage(null);
      writeStatusCache(userId, activeLeagueId, sessionKey, "completed");
      return;
    }

    let mounted = true;
    setStatus("checking");

    const load = async () => {
      try {
        const squad = await getMySquad.execute(activeLeagueId, accessToken);
        if (!mounted) {
          return;
        }

        if (squad) {
          writeCompletedMarker(userId, activeLeagueId);
          writeStatusCache(userId, activeLeagueId, sessionKey, "completed");
          setStatus("completed");
          setErrorMessage(null);
          return;
        }

        clearCompletedMarker(userId, activeLeagueId);
        writeStatusCache(userId, activeLeagueId, sessionKey, "required");
        setStatus("required");
        setErrorMessage(null);
      } catch {
        if (!mounted) {
          return;
        }

        const staleCache = readStatusCache(userId, activeLeagueId, sessionKey);
        if (staleCache) {
          setStatus(staleCache.status);
          setErrorMessage(null);
          return;
        }

        setStatus("required");
        setErrorMessage("Unable to verify onboarding status right now.");
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [accessToken, activeLeagueId, getMySquad, isLeaguesLoading, revision, sessionKey, skipOnboardingInDev, userId]);

  return useMemo(
    () => ({
      status,
      errorMessage,
      refresh,
      markCompleted
    }),
    [errorMessage, markCompleted, refresh, status]
  );
};
