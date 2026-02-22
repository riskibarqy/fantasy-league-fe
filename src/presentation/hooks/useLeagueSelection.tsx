import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import { cacheKeys, cacheTtlMs, getOrLoadCached } from "../../app/cache/requestCache";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import type { League } from "../../domain/fantasy/entities/League";
import { useSession } from "./useSession";

const STORAGE_KEY = "fantasy-selected-league-id";

type LeagueSelectionContextValue = {
  leagues: League[];
  selectedLeagueId: string;
  setSelectedLeagueId: (leagueId: string) => void;
  isLoading: boolean;
  errorMessage: string | null;
};

const LeagueSelectionContext = createContext<LeagueSelectionContextValue | null>(null);

const readStoredLeagueId = (): string => {
  return localStorage.getItem(STORAGE_KEY)?.trim() ?? "";
};

export const LeagueSelectionProvider = ({ children }: PropsWithChildren) => {
  const { getDashboard, getLeagues } = useContainer();
  const { session } = useSession();

  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueIdState] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setSelectedLeagueIdState(readStoredLeagueId());
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setIsLoading(true);

        const accessToken = session?.accessToken?.trim() ?? "";
        const userId = session?.user.id?.trim() ?? "";
        const dashboardPromise = accessToken && userId
          ? getOrLoadCached({
              key: cacheKeys.dashboard(userId),
              ttlMs: cacheTtlMs.dashboard,
              loader: () => getDashboard.execute(accessToken),
              allowStaleOnError: true
            })
          : Promise.resolve(null);

        const [dashboardResult, leaguesResult] = await Promise.allSettled([
          dashboardPromise,
          getOrLoadCached({
            key: cacheKeys.leagues(),
            ttlMs: cacheTtlMs.leagues,
            loader: () => getLeagues.execute()
          })
        ]);

        if (!mounted) {
          return;
        }

        if (leaguesResult.status !== "fulfilled") {
          throw leaguesResult.reason;
        }

        const loadedLeagues = leaguesResult.value;
        setLeagues(loadedLeagues);

        const isValidLeagueId = (leagueId: string): boolean =>
          loadedLeagues.some((league) => league.id === leagueId);

        const dashboardLeagueId =
          dashboardResult.status === "fulfilled" ? dashboardResult.value?.selectedLeagueId?.trim() ?? "" : "";
        const storedLeagueId = readStoredLeagueId();

        const fallbackLeagueId =
          loadedLeagues.find((league) => league.id === dashboardLeagueId)?.id ?? loadedLeagues[0]?.id ?? "";

        setSelectedLeagueIdState((current) => {
          const next = [current, storedLeagueId, dashboardLeagueId, fallbackLeagueId].find(
            (id) => id && isValidLeagueId(id)
          );

          return next ?? fallbackLeagueId;
        });

        setErrorMessage(null);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Failed to load leagues.");
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [getDashboard, getLeagues, session?.accessToken, session?.user.id]);

  useEffect(() => {
    const leagueId = selectedLeagueId.trim();
    if (!leagueId) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    localStorage.setItem(STORAGE_KEY, leagueId);
  }, [selectedLeagueId]);

  const setSelectedLeagueId = useCallback((leagueId: string) => {
    setSelectedLeagueIdState(leagueId.trim());
  }, []);

  const value = useMemo(
    () => ({
      leagues,
      selectedLeagueId,
      setSelectedLeagueId,
      isLoading,
      errorMessage
    }),
    [errorMessage, isLoading, leagues, selectedLeagueId, setSelectedLeagueId]
  );

  return (
    <LeagueSelectionContext.Provider value={value}>{children}</LeagueSelectionContext.Provider>
  );
};

export const useLeagueSelection = (): LeagueSelectionContextValue => {
  const context = useContext(LeagueSelectionContext);
  if (!context) {
    throw new Error("LeagueSelectionProvider is missing in component tree.");
  }

  return context;
};
