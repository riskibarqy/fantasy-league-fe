import { useCallback, useEffect, useMemo, useState } from "react";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import { useLeagueSelection } from "./useLeagueSelection";
import { useSession } from "./useSession";

type OnboardingStatus = "checking" | "required" | "completed" | "unknown";

export const ONBOARDING_COMPLETED_STORAGE_PREFIX = "fantasy-onboarding-completed";

const onboardingStorageKey = (userId: string): string =>
  `${ONBOARDING_COMPLETED_STORAGE_PREFIX}:${userId}`;

const readCompletedMarker = (userId: string): boolean => {
  return localStorage.getItem(onboardingStorageKey(userId)) === "true";
};

const writeCompletedMarker = (userId: string): void => {
  localStorage.setItem(onboardingStorageKey(userId), "true");
};

export const markOnboardingCompleted = (userId: string): void => {
  const id = userId.trim();
  if (!id) {
    return;
  }

  writeCompletedMarker(id);
};

export const useOnboardingStatus = () => {
  const { getMySquad } = useContainer();
  const { session } = useSession();
  const { leagues, selectedLeagueId, isLoading: isLeaguesLoading } = useLeagueSelection();

  const [status, setStatus] = useState<OnboardingStatus>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const userId = session?.user.id?.trim() ?? "";
  const accessToken = session?.accessToken?.trim() ?? "";

  const markCompleted = useCallback(() => {
    if (!userId) {
      return;
    }

    markOnboardingCompleted(userId);
    setStatus("completed");
    setErrorMessage(null);
  }, [userId]);

  const refresh = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!userId || !accessToken) {
      setStatus("checking");
      setErrorMessage("Session is missing.");
      return;
    }

    if (readCompletedMarker(userId)) {
      setStatus("completed");
      setErrorMessage(null);
      return;
    }

    if (isLeaguesLoading) {
      return;
    }

    const leagueIds = Array.from(
      new Set([selectedLeagueId, ...leagues.map((league) => league.id)].filter(Boolean))
    );

    if (leagueIds.length === 0) {
      setStatus("required");
      setErrorMessage("No league configured.");
      return;
    }

    let mounted = true;
    setStatus("checking");

    const load = async () => {
      const checks = await Promise.allSettled(
        leagueIds.map((leagueId) => getMySquad.execute(leagueId, accessToken))
      );
      if (!mounted) {
        return;
      }

      const hasSquad = checks.some(
        (result) => result.status === "fulfilled" && Boolean(result.value)
      );
      if (hasSquad) {
        markOnboardingCompleted(userId);
        setStatus("completed");
        setErrorMessage(null);
        return;
      }

      const hasRejected = checks.some((result) => result.status === "rejected");
      if (hasRejected) {
        setStatus("required");
        setErrorMessage("Unable to verify onboarding status right now.");
        return;
      }

      setStatus("required");
      setErrorMessage(null);
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [accessToken, getMySquad, isLeaguesLoading, leagues, revision, selectedLeagueId, userId]);

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
