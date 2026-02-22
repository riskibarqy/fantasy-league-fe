import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cacheKeys, cacheTtlMs, getOrLoadCached } from "../../app/cache/requestCache";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import type { Club } from "../../domain/fantasy/entities/Club";
import type { Player } from "../../domain/fantasy/entities/Player";
import type { TeamLineup } from "../../domain/fantasy/entities/Team";
import {
  BENCH_SLOT_POSITIONS,
  FORMATION_LIMITS,
  STARTER_SIZE,
  SUBSTITUTE_SIZE
} from "../../domain/fantasy/services/lineupRules";
import { LoadingState } from "../components/LoadingState";
import { useLeagueSelection } from "../hooks/useLeagueSelection";
import { markOnboardingCompleted } from "../hooks/useOnboardingStatus";
import { useSession } from "../hooks/useSession";
import { HttpError } from "../../infrastructure/http/httpClient";
import { appAlert } from "../lib/appAlert";
import {
  consumePickerResult,
  readLineupDraft,
  savePickerContext,
  writeLineupDraft,
  type SlotZone
} from "./teamPickerStorage";

type OnboardingStep = "favorite" | "squad";
type PitchRow = {
  label: Player["position"];
  slots: number;
  ids: string[];
};

const BUDGET_CAP = 150;
const MAX_PER_TEAM = 3;
const FORMATION_MIN_SLOTS = {
  DEF: FORMATION_LIMITS.DEF.min,
  MID: FORMATION_LIMITS.MID.min,
  FWD: FORMATION_LIMITS.FWD.min,
  BENCH: SUBSTITUTE_SIZE
} as const;
const FORMATION_MAX_SLOTS = {
  DEF: FORMATION_LIMITS.DEF.max,
  MID: FORMATION_LIMITS.MID.max,
  FWD: FORMATION_LIMITS.FWD.max
} as const;
const OUTFIELD_STARTER_SIZE = STARTER_SIZE - 1;
const API_READY_MAX_ATTEMPTS = 6;
const API_READY_BASE_DELAY_MS = 600;
const API_READY_MAX_DELAY_MS = 4_000;

const shortName = (name: string): string => {
  const words = name.trim().split(" ");
  if (words.length <= 1) {
    return name;
  }

  const last = words[words.length - 1];
  return last.length > 12 ? `${words[0]} ${last.slice(0, 1)}.` : `${words[0]} ${last}`;
};

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
};

const shirtBackgroundForClub = (club: string): string => {
  const palette: Array<[string, string, string]> = [
    ["#233d9d", "#5d8dff", "#f1f4ff"],
    ["#a6162f", "#e44c62", "#ffd7de"],
    ["#111e2d", "#f0f0f0", "#ffe16b"],
    ["#1a8b72", "#64cfb8", "#d8fff5"],
    ["#5c2d87", "#8f5bc0", "#f2e7ff"],
    ["#b11e1a", "#ff645e", "#ffe6e5"]
  ];

  const seed = hashString(club);
  const [primary, secondary, accent] = palette[seed % palette.length];
  const pattern = seed % 3;

  if (pattern === 0) {
    return `linear-gradient(180deg, ${primary} 0%, ${secondary} 100%)`;
  }

  if (pattern === 1) {
    return `repeating-linear-gradient(90deg, ${primary} 0 14px, ${secondary} 14px 28px)`;
  }

  return `linear-gradient(135deg, ${primary} 0 42%, ${secondary} 42% 84%, ${accent} 84% 100%)`;
};

const sanitizeStarterIds = (ids: string[], max: number): string[] => {
  return ids.filter(Boolean).slice(0, max);
};

const normalizeBenchIds = (ids: string[]): string[] => {
  return Array.from({ length: SUBSTITUTE_SIZE }, (_, index) => {
    const value = ids[index];
    return typeof value === "string" ? value.trim() : "";
  });
};

const upsertStarterId = (ids: string[], index: number, playerId: string, max: number): string[] => {
  const next = sanitizeStarterIds(ids, max);
  if (index < next.length) {
    next[index] = playerId;
    return next;
  }

  if (next.length < max) {
    next.push(playerId);
  }

  return next;
};

const removeStarterId = (ids: string[], index: number, min: number, max: number): string[] => {
  const next = sanitizeStarterIds(ids, max);
  if (index >= 0 && index < next.length) {
    next.splice(index, 1);
  }

  while (next.length < min) {
    next.push("");
  }

  return next;
};

const buildFlexibleRowIds = (
  ids: string[],
  min: number,
  max: number,
  outfieldCount: number
): string[] => {
  const filled = sanitizeStarterIds(ids, max);
  const row = [...filled];

  while (row.length < min) {
    row.push("");
  }

  const canExpand = outfieldCount < OUTFIELD_STARTER_SIZE && filled.length < max;
  if (canExpand && row.every(Boolean) && row.length < max) {
    row.push("");
  }

  return row;
};

const createEmptyLineupDraft = (leagueId: string): TeamLineup => ({
  leagueId,
  goalkeeperId: "",
  defenderIds: Array.from({ length: FORMATION_MIN_SLOTS.DEF }, () => ""),
  midfielderIds: Array.from({ length: FORMATION_MIN_SLOTS.MID }, () => ""),
  forwardIds: Array.from({ length: FORMATION_MIN_SLOTS.FWD }, () => ""),
  substituteIds: Array.from({ length: FORMATION_MIN_SLOTS.BENCH }, () => ""),
  captainId: "",
  viceCaptainId: "",
  updatedAt: new Date().toISOString()
});

const normalizeLineupDraft = (leagueId: string, draft: TeamLineup | null): TeamLineup => {
  if (!draft) {
    return createEmptyLineupDraft(leagueId);
  }

  return {
    ...draft,
    leagueId,
    defenderIds: buildFlexibleRowIds(
      draft.defenderIds,
      FORMATION_MIN_SLOTS.DEF,
      FORMATION_MAX_SLOTS.DEF,
      sanitizeStarterIds(draft.defenderIds, FORMATION_MAX_SLOTS.DEF).length +
        sanitizeStarterIds(draft.midfielderIds, FORMATION_MAX_SLOTS.MID).length +
        sanitizeStarterIds(draft.forwardIds, FORMATION_MAX_SLOTS.FWD).length
    ),
    midfielderIds: buildFlexibleRowIds(
      draft.midfielderIds,
      FORMATION_MIN_SLOTS.MID,
      FORMATION_MAX_SLOTS.MID,
      sanitizeStarterIds(draft.defenderIds, FORMATION_MAX_SLOTS.DEF).length +
        sanitizeStarterIds(draft.midfielderIds, FORMATION_MAX_SLOTS.MID).length +
        sanitizeStarterIds(draft.forwardIds, FORMATION_MAX_SLOTS.FWD).length
    ),
    forwardIds: buildFlexibleRowIds(
      draft.forwardIds,
      FORMATION_MIN_SLOTS.FWD,
      FORMATION_MAX_SLOTS.FWD,
      sanitizeStarterIds(draft.defenderIds, FORMATION_MAX_SLOTS.DEF).length +
        sanitizeStarterIds(draft.midfielderIds, FORMATION_MAX_SLOTS.MID).length +
        sanitizeStarterIds(draft.forwardIds, FORMATION_MAX_SLOTS.FWD).length
    ),
    substituteIds: normalizeBenchIds(draft.substituteIds)
  };
};

const setSlotPlayerId = (lineup: TeamLineup, zone: SlotZone, index: number, playerId: string): TeamLineup => {
  if (zone === "GK") {
    return {
      ...lineup,
      goalkeeperId: playerId,
      updatedAt: new Date().toISOString()
    };
  }

  if (zone === "DEF") {
    return {
      ...lineup,
      defenderIds: upsertStarterId(lineup.defenderIds, index, playerId, FORMATION_MAX_SLOTS.DEF),
      updatedAt: new Date().toISOString()
    };
  }

  if (zone === "MID") {
    return {
      ...lineup,
      midfielderIds: upsertStarterId(lineup.midfielderIds, index, playerId, FORMATION_MAX_SLOTS.MID),
      updatedAt: new Date().toISOString()
    };
  }

  if (zone === "FWD") {
    return {
      ...lineup,
      forwardIds: upsertStarterId(lineup.forwardIds, index, playerId, FORMATION_MAX_SLOTS.FWD),
      updatedAt: new Date().toISOString()
    };
  }

  const nextBench = [...lineup.substituteIds];
  while (nextBench.length <= index) {
    nextBench.push("");
  }
  nextBench[index] = playerId;

  return {
    ...lineup,
    substituteIds: normalizeBenchIds(nextBench),
    updatedAt: new Date().toISOString()
  };
};

const clearSlotPlayerId = (lineup: TeamLineup, zone: SlotZone, index: number): TeamLineup => {
  if (zone === "GK") {
    return {
      ...lineup,
      goalkeeperId: "",
      updatedAt: new Date().toISOString()
    };
  }

  if (zone === "DEF") {
    return {
      ...lineup,
      defenderIds: removeStarterId(lineup.defenderIds, index, FORMATION_MIN_SLOTS.DEF, FORMATION_MAX_SLOTS.DEF),
      updatedAt: new Date().toISOString()
    };
  }

  if (zone === "MID") {
    return {
      ...lineup,
      midfielderIds: removeStarterId(lineup.midfielderIds, index, FORMATION_MIN_SLOTS.MID, FORMATION_MAX_SLOTS.MID),
      updatedAt: new Date().toISOString()
    };
  }

  if (zone === "FWD") {
    return {
      ...lineup,
      forwardIds: removeStarterId(lineup.forwardIds, index, FORMATION_MIN_SLOTS.FWD, FORMATION_MAX_SLOTS.FWD),
      updatedAt: new Date().toISOString()
    };
  }

  const nextBench = [...lineup.substituteIds];
  if (index >= 0 && index < nextBench.length) {
    nextBench[index] = "";
  }

  return {
    ...lineup,
    substituteIds: normalizeBenchIds(nextBench),
    updatedAt: new Date().toISOString()
  };
};

const getSlotPlayerId = (lineup: TeamLineup, zone: SlotZone, index: number): string => {
  if (zone === "GK") {
    return lineup.goalkeeperId;
  }
  if (zone === "DEF") {
    return lineup.defenderIds[index] ?? "";
  }
  if (zone === "MID") {
    return lineup.midfielderIds[index] ?? "";
  }
  if (zone === "FWD") {
    return lineup.forwardIds[index] ?? "";
  }
  return lineup.substituteIds[index] ?? "";
};

const toSelectedPlayerIds = (lineup: TeamLineup | null): string[] => {
  if (!lineup) {
    return [];
  }

  return [
    lineup.goalkeeperId,
    ...lineup.defenderIds,
    ...lineup.midfielderIds,
    ...lineup.forwardIds,
    ...lineup.substituteIds
  ].filter(Boolean);
};

const toStarterIds = (lineup: TeamLineup | null): string[] => {
  if (!lineup) {
    return [];
  }

  return [lineup.goalkeeperId, ...lineup.defenderIds, ...lineup.midfielderIds, ...lineup.forwardIds].filter(Boolean);
};

const isLineupDraftComplete = (lineup: TeamLineup | null): boolean => {
  if (!lineup) {
    return false;
  }

  const defenderCount = lineup.defenderIds.filter(Boolean).length;
  const midfielderCount = lineup.midfielderIds.filter(Boolean).length;
  const forwardCount = lineup.forwardIds.filter(Boolean).length;
  const outfieldCount = defenderCount + midfielderCount + forwardCount;

  return Boolean(
    lineup.goalkeeperId &&
      lineup.substituteIds.every(Boolean) &&
      defenderCount >= FORMATION_MIN_SLOTS.DEF &&
      defenderCount <= FORMATION_MAX_SLOTS.DEF &&
      midfielderCount >= FORMATION_MIN_SLOTS.MID &&
      midfielderCount <= FORMATION_MAX_SLOTS.MID &&
      forwardCount >= FORMATION_MIN_SLOTS.FWD &&
      forwardCount <= FORMATION_MAX_SLOTS.FWD &&
      outfieldCount === OUTFIELD_STARTER_SIZE
  );
};

const scrollElementToViewportCenter = (element: HTMLElement) => {
  if (typeof window === "undefined") {
    return;
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const rect = element.getBoundingClientRect();
      const offset = Math.max((window.innerHeight - rect.height) / 2, 0);
      const targetTop = window.scrollY + rect.top - offset;
      window.scrollTo({
        top: Math.max(targetTop, 0),
        behavior: "smooth"
      });
    });
  });
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const isTransientOnboardingApiError = (error: unknown): boolean => {
  if (error instanceof HttpError) {
    return [408, 425, 429, 500, 502, 503, 504].includes(error.statusCode);
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("failed to fetch") ||
      message.includes("networkerror") ||
      message.includes("network request failed") ||
      message.includes("timeout") ||
      message.includes("not ready")
    );
  }

  return false;
};

const retryWhenOnboardingApiNotReady = async <T,>(
  operation: (attempt: number) => Promise<T>,
  onRetry?: (attempt: number, maxAttempts: number, delayMs: number) => void
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= API_READY_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      const shouldRetry = attempt < API_READY_MAX_ATTEMPTS && isTransientOnboardingApiError(error);
      if (!shouldRetry) {
        throw error;
      }

      const delayMs = Math.min(
        API_READY_BASE_DELAY_MS * 2 ** (attempt - 1),
        API_READY_MAX_DELAY_MS
      );
      onRetry?.(attempt, API_READY_MAX_ATTEMPTS, delayMs);
      await delay(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Onboarding API is not ready yet.");
};

export const OnboardingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getTeams, getPlayers, saveOnboardingFavoriteClub, completeOnboarding } = useContainer();
  const { leagues, selectedLeagueId, setSelectedLeagueId } = useLeagueSelection();
  const { session } = useSession();
  const userScope = session?.user.id ?? "";

  const [step, setStep] = useState<OnboardingStep>(() =>
    searchParams.get("step") === "squad" ? "squad" : "favorite"
  );
  const [leagueId, setLeagueId] = useState("");
  const [teams, setTeams] = useState<Club[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [lineupDraft, setLineupDraft] = useState<TeamLineup | null>(null);
  const [squadName, setSquadName] = useState("My Squad");
  const [teamSearch, setTeamSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const loadedLeagueRef = useRef("");
  const pitchBoardRef = useRef<HTMLElement | null>(null);

  const recenterToPitch = () => {
    if (!pitchBoardRef.current) {
      return;
    }

    scrollElementToViewportCenter(pitchBoardRef.current);
  };

  useEffect(() => {
    if (errorMessage) {
      void appAlert.error("Onboarding", errorMessage);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (infoMessage) {
      void appAlert.info("Onboarding", infoMessage);
    }
  }, [infoMessage]);

  useEffect(() => {
    if (leagueId) {
      return;
    }

    const fallback = selectedLeagueId || leagues[0]?.id || "";
    if (fallback) {
      setLeagueId(fallback);
    }
  }, [leagueId, leagues, selectedLeagueId]);

  useEffect(() => {
    if (!leagueId) {
      return;
    }

    let mounted = true;
    setIsLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);

    const load = async () => {
      try {
        const [teamsResult, playersResult] = await retryWhenOnboardingApiNotReady(
          async (attempt) => {
            const [loadedTeams, loadedPlayers] = await Promise.all([
              getOrLoadCached({
                key: cacheKeys.teams(leagueId),
                ttlMs: cacheTtlMs.teams,
                loader: () => getTeams.execute(leagueId),
                allowStaleOnError: false,
                forceRefresh: attempt > 1
              }),
              getOrLoadCached({
                key: cacheKeys.players(leagueId),
                ttlMs: cacheTtlMs.players,
                loader: () => getPlayers.execute(leagueId),
                allowStaleOnError: false,
                forceRefresh: attempt > 1
              })
            ]);

            if (loadedTeams.length === 0 || loadedPlayers.length === 0) {
              throw new Error("Onboarding API not ready yet.");
            }

            return [loadedTeams, loadedPlayers] as const;
          },
          (attempt, maxAttempts, delayMs) => {
            if (!mounted) {
              return;
            }

            if (attempt > 1) {
              return;
            }

            setInfoMessage(
              `Preparing onboarding data (${attempt}/${maxAttempts}). Retrying in ${Math.ceil(
                delayMs / 1000
              )}s...`
            );
          }
        );

        if (!mounted) {
          return;
        }

        setTeams(teamsResult);
        setPlayers(playersResult);
        setInfoMessage(null);

        setSelectedTeamId((previous) =>
          teamsResult.some((team) => team.id === previous) ? previous : teamsResult[0]?.id ?? ""
        );

        const scopedLeagueKey = `${userScope || "anon"}::${leagueId}`;
        if (loadedLeagueRef.current !== scopedLeagueKey) {
          const persistedDraft = readLineupDraft(leagueId, userScope);
          setLineupDraft(normalizeLineupDraft(leagueId, persistedDraft));
          loadedLeagueRef.current = scopedLeagueKey;
        }
      } catch (error) {
        if (!mounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Failed to load onboarding data.");
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
  }, [getPlayers, getTeams, leagueId, userScope]);

  useEffect(() => {
    if (searchParams.get("step") === "squad") {
      setStep("squad");
    }
  }, [searchParams]);

  useEffect(() => {
    const requestedLeagueId = searchParams.get("leagueId")?.trim() ?? "";
    if (!requestedLeagueId) {
      return;
    }

    setLeagueId((previous) => (previous === requestedLeagueId ? previous : requestedLeagueId));
    setSelectedLeagueId(requestedLeagueId);
  }, [searchParams, setSelectedLeagueId]);

  useEffect(() => {
    if (!lineupDraft) {
      return;
    }

    writeLineupDraft(lineupDraft, userScope);
  }, [lineupDraft, userScope]);

  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);

  useEffect(() => {
    if (!lineupDraft || !leagueId || playersById.size === 0) {
      return;
    }

    const result = consumePickerResult(userScope);
    if (!result || result.leagueId !== leagueId) {
      return;
    }

    const pickedPlayer = playersById.get(result.playerId);
    if (!pickedPlayer) {
      setErrorMessage("Selected player not found. Please retry.");
      return;
    }

    if (result.target.zone === "BENCH") {
      const requiredBenchPosition = BENCH_SLOT_POSITIONS[result.target.index];
      if (requiredBenchPosition && pickedPlayer.position !== requiredBenchPosition) {
        setErrorMessage(`Bench slot ${result.target.index + 1} requires ${requiredBenchPosition}.`);
        return;
      }
    } else if (pickedPlayer.position !== result.target.zone) {
      setErrorMessage(`Invalid slot pick: this slot requires ${result.target.zone}.`);
      return;
    }

    const nextDraft = setSlotPlayerId(lineupDraft, result.target.zone, result.target.index, result.playerId);
    const nextIds = toSelectedPlayerIds(nextDraft);
    const uniqueIds = new Set(nextIds);
    if (uniqueIds.size !== nextIds.length) {
      setErrorMessage("Player is already selected in another slot.");
      return;
    }

    const nextPlayers = nextIds
      .map((id) => playersById.get(id))
      .filter((item): item is Player => Boolean(item));

    const nextTeamCounter = nextPlayers.reduce<Record<string, number>>((counter, player) => {
      counter[player.club] = (counter[player.club] ?? 0) + 1;
      return counter;
    }, {});

    const teamLimitReached = Object.values(nextTeamCounter).some((count) => count > MAX_PER_TEAM);
    if (teamLimitReached) {
      setErrorMessage(`Max ${MAX_PER_TEAM} players per club.`);
      return;
    }

    const nextTotalCost = nextPlayers.reduce((sum, player) => sum + player.price, 0);
    if (nextTotalCost > BUDGET_CAP) {
      setErrorMessage(`Budget cap exceeded (${BUDGET_CAP.toFixed(1)}).`);
      return;
    }

    setLineupDraft(nextDraft);
    setStep("squad");
    setErrorMessage(null);
    setInfoMessage(`${pickedPlayer.name} selected.`);
    recenterToPitch();
  }, [leagueId, lineupDraft, playersById, userScope]);

  useEffect(() => {
    if (!lineupDraft || playersById.size === 0) {
      return;
    }

    const nextBenchIds = [...lineupDraft.substituteIds];
    let changed = false;

    for (let index = 0; index < SUBSTITUTE_SIZE; index += 1) {
      const playerId = nextBenchIds[index];
      if (!playerId) {
        continue;
      }

      const requiredPosition = BENCH_SLOT_POSITIONS[index];
      const player = playersById.get(playerId);
      if (!player || (requiredPosition && player.position !== requiredPosition)) {
        nextBenchIds[index] = "";
        changed = true;
      }
    }

    if (!changed) {
      return;
    }

    setLineupDraft({
      ...lineupDraft,
      substituteIds: normalizeBenchIds(nextBenchIds),
      updatedAt: new Date().toISOString()
    });
    setInfoMessage("Bench slots were adjusted to GK/DEF/MID/FWD.");
  }, [lineupDraft, playersById]);

  const selectedPlayerIds = useMemo(() => toSelectedPlayerIds(lineupDraft), [lineupDraft]);

  const selectedPlayers = useMemo(() => {
    return selectedPlayerIds
      .map((id) => playersById.get(id))
      .filter((player): player is Player => Boolean(player));
  }, [playersById, selectedPlayerIds]);

  const teamCounter = useMemo(() => {
    return selectedPlayers.reduce<Record<string, number>>((counter, player) => {
      counter[player.club] = (counter[player.club] ?? 0) + 1;
      return counter;
    }, {});
  }, [selectedPlayers]);

  const positionCounter = useMemo(() => {
    return selectedPlayers.reduce<Record<Player["position"], number>>(
      (counter, player) => {
        counter[player.position] += 1;
        return counter;
      },
      { GK: 0, DEF: 0, MID: 0, FWD: 0 }
    );
  }, [selectedPlayers]);

  const totalCost = useMemo(() => {
    return selectedPlayers.reduce((sum, player) => sum + player.price, 0);
  }, [selectedPlayers]);

  const filteredTeams = useMemo(() => {
    const keyword = teamSearch.trim().toLowerCase();
    if (!keyword) {
      return teams;
    }

    return teams.filter((team) => {
      const name = team.name.toLowerCase();
      const short = team.short.toLowerCase();
      return name.includes(keyword) || short.includes(keyword);
    });
  }, [teamSearch, teams]);

  const selectedTeamName = useMemo(() => {
    return teams.find((team) => team.id === selectedTeamId)?.name ?? "-";
  }, [selectedTeamId, teams]);

  const starterIds = useMemo(() => toStarterIds(lineupDraft), [lineupDraft]);

  const canSubmit = Boolean(
    leagueId &&
      selectedTeamId &&
      isLineupDraftComplete(lineupDraft) &&
      selectedPlayerIds.length === 15 &&
      new Set(selectedPlayerIds).size === 15 &&
      positionCounter.GK >= 1 &&
      positionCounter.DEF >= FORMATION_MIN_SLOTS.DEF &&
      positionCounter.DEF <= FORMATION_MAX_SLOTS.DEF &&
      positionCounter.MID >= FORMATION_MIN_SLOTS.MID &&
      positionCounter.MID <= FORMATION_MAX_SLOTS.MID &&
      positionCounter.FWD >= FORMATION_MIN_SLOTS.FWD &&
      positionCounter.FWD <= FORMATION_MAX_SLOTS.FWD &&
      (lineupDraft
        ? BENCH_SLOT_POSITIONS.every((position, index) => {
            const playerId = lineupDraft.substituteIds[index];
            const player = playerId ? playersById.get(playerId) : null;
            return player?.position === position;
          })
        : false) &&
      totalCost <= BUDGET_CAP &&
      Object.values(teamCounter).every((count) => count <= MAX_PER_TEAM)
  );

  const pitchRows = useMemo<PitchRow[]>(() => {
    const outfieldCount = lineupDraft
      ? lineupDraft.defenderIds.filter(Boolean).length +
        lineupDraft.midfielderIds.filter(Boolean).length +
        lineupDraft.forwardIds.filter(Boolean).length
      : 0;

    if (!lineupDraft) {
      return [
        { label: "GK", slots: 1, ids: [] },
        {
          label: "DEF",
          slots: FORMATION_MIN_SLOTS.DEF,
          ids: Array.from({ length: FORMATION_MIN_SLOTS.DEF }, () => "")
        },
        {
          label: "MID",
          slots: FORMATION_MIN_SLOTS.MID,
          ids: Array.from({ length: FORMATION_MIN_SLOTS.MID }, () => "")
        },
        {
          label: "FWD",
          slots: FORMATION_MIN_SLOTS.FWD,
          ids: Array.from({ length: FORMATION_MIN_SLOTS.FWD }, () => "")
        }
      ];
    }

    const defenderIds = buildFlexibleRowIds(
      lineupDraft.defenderIds,
      FORMATION_MIN_SLOTS.DEF,
      FORMATION_MAX_SLOTS.DEF,
      outfieldCount
    );
    const midfielderIds = buildFlexibleRowIds(
      lineupDraft.midfielderIds,
      FORMATION_MIN_SLOTS.MID,
      FORMATION_MAX_SLOTS.MID,
      outfieldCount
    );
    const forwardIds = buildFlexibleRowIds(
      lineupDraft.forwardIds,
      FORMATION_MIN_SLOTS.FWD,
      FORMATION_MAX_SLOTS.FWD,
      outfieldCount
    );

    return [
      { label: "GK", slots: 1, ids: [lineupDraft.goalkeeperId] },
      { label: "DEF", slots: defenderIds.length, ids: defenderIds },
      { label: "MID", slots: midfielderIds.length, ids: midfielderIds },
      { label: "FWD", slots: forwardIds.length, ids: forwardIds }
    ];
  }, [lineupDraft]);

  const onNextStep = () => {
    if (!selectedTeamId) {
      setErrorMessage("Please select your favorite club first.");
      return;
    }

    setErrorMessage(null);
    setStep("squad");
  };

  const openPicker = (zone: SlotZone, index: number) => {
    if (!leagueId || !lineupDraft) {
      return;
    }

    const currentSlotId = getSlotPlayerId(lineupDraft, zone, index);
    if (zone !== "BENCH" && !currentSlotId && starterIds.length >= STARTER_SIZE) {
      setInfoMessage("Starting XI is full. Remove one starter first.");
      return;
    }

    savePickerContext(
      {
        leagueId,
        target: {
          zone,
          index
        },
        lineup: lineupDraft,
        returnPath: "/onboarding?step=squad"
      },
      userScope
    );

    navigate(
      `/onboarding/pick?leagueId=${encodeURIComponent(leagueId)}&zone=${encodeURIComponent(zone)}&index=${index}`
    );
  };

  const onRemoveFromSlot = (zone: SlotZone, index: number) => {
    if (!lineupDraft) {
      return;
    }

    setLineupDraft(clearSlotPlayerId(lineupDraft, zone, index));
    setErrorMessage(null);
  };

  const onSubmit = async () => {
    const accessToken = session?.accessToken?.trim() ?? "";
    if (!accessToken) {
      setErrorMessage("Session expired. Please login again.");
      return;
    }

    if (!leagueId || !selectedTeamId || !lineupDraft) {
      setErrorMessage("League and favorite club are required.");
      return;
    }

    if (!canSubmit) {
      setErrorMessage("Complete all field slots with valid budget and team composition.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setInfoMessage(null);

      const sortedStarters = starterIds
        .map((id) => playersById.get(id))
        .filter((player): player is Player => Boolean(player))
        .sort((left, right) => right.projectedPoints - left.projectedPoints);

      const captainId = sortedStarters[0]?.id ?? starterIds[0] ?? "";
      const viceCaptainId =
        sortedStarters.find((player) => player.id !== captainId)?.id ??
        starterIds.find((id) => id !== captainId) ??
        "";

      await retryWhenOnboardingApiNotReady(
        () =>
          saveOnboardingFavoriteClub.execute(
            {
              leagueId,
              teamId: selectedTeamId
            },
            accessToken
          ),
        (attempt, maxAttempts, delayMs) => {
          if (attempt > 1) {
            return;
          }

          setInfoMessage(
            `Saving favorite club (${attempt}/${maxAttempts}). Retrying in ${Math.ceil(
              delayMs / 1000
            )}s...`
          );
        }
      );

      await retryWhenOnboardingApiNotReady(
        () =>
          completeOnboarding.execute(
            {
              leagueId,
              squadName: squadName.trim(),
              playerIds: selectedPlayerIds,
              lineup: {
                ...lineupDraft,
                defenderIds: lineupDraft.defenderIds.filter(Boolean),
                midfielderIds: lineupDraft.midfielderIds.filter(Boolean),
                forwardIds: lineupDraft.forwardIds.filter(Boolean),
                substituteIds: lineupDraft.substituteIds.slice(0, SUBSTITUTE_SIZE),
                captainId,
                viceCaptainId,
                updatedAt: new Date().toISOString()
              }
            },
            accessToken
          ),
        (attempt, maxAttempts, delayMs) => {
          if (attempt > 1) {
            return;
          }

          setInfoMessage(
            `Finalizing onboarding (${attempt}/${maxAttempts}). Retrying in ${Math.ceil(
              delayMs / 1000
            )}s...`
          );
        }
      );

      setSelectedLeagueId(leagueId);
      markOnboardingCompleted(session?.user.id ?? "");
      void appAlert.success("Onboarding Completed", "Your first squad is ready.");
      navigate("/", { replace: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to complete onboarding.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPitchCard = (zone: SlotZone, index: number, label: string, player: Player | null) => {
    if (!player) {
      return (
        <button type="button" className="fpl-player-card empty-slot pick-slot-button" onClick={() => openPicker(zone, index)}>
          <span>{`Pick ${label}`}</span>
        </button>
      );
    }

    return (
      <div
        className="fpl-player-card onboarding-filled-card"
        role="button"
        tabIndex={0}
        onClick={() => openPicker(zone, index)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPicker(zone, index);
          }
        }}
      >
        <button
          type="button"
          className="onboarding-slot-remove"
          aria-label={`Remove ${player.name}`}
          onClick={(event) => {
            event.stopPropagation();
            onRemoveFromSlot(zone, index);
          }}
        >
          ×
        </button>
        <div className="player-price-chip">£{player.price.toFixed(1)}m</div>
        <div className="shirt-holder">
          <div className="shirt" style={{ background: shirtBackgroundForClub(player.club) }} />
        </div>
        <div className="player-info-chip">
          <div className="player-name-chip">{shortName(player.name)}</div>
          <div className="player-fixture-chip">{player.club}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="app-shell onboarding-shell">
      <main className="content">
        <section className="card onboarding-hero">
          <p className="small-label">Onboarding</p>
          <h2>Set Favorite Club and Build First Squad</h2>
          <p className="muted">Step {step === "favorite" ? "1" : "2"} of 2.</p>
        </section>

        {step === "favorite" ? (
          <section className="card onboarding-section">
            <div className="home-section-head">
              <h3>1. Pick Favorite Club</h3>
            </div>

            <div className="page-filter-grid">
              <label>
                League
                <select
                  value={leagueId}
                  onChange={(event) => {
                    const nextLeagueId = event.target.value;
                    setLeagueId(nextLeagueId);
                    setSelectedLeagueId(nextLeagueId);
                  }}
                >
                  {leagues.map((league) => (
                    <option key={league.id} value={league.id}>
                      {league.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Search Club Name
                <input
                  type="text"
                  value={teamSearch}
                  onChange={(event) => setTeamSearch(event.target.value)}
                  placeholder="Search club"
                />
              </label>
            </div>

            {isLoading ? <LoadingState label="Loading clubs and players" /> : null}

            <div className="onboarding-team-list-scroll">
              <div className="onboarding-team-grid onboarding-team-grid-single">
                {filteredTeams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    className={`onboarding-team-card ${selectedTeamId === team.id ? "active" : ""}`}
                    onClick={() => setSelectedTeamId(team.id)}
                  >
                    <div className="media-line">
                      <img src={team.logoUrl} alt={team.name} className="media-thumb media-thumb-small" loading="lazy" />
                      <div className="media-copy">
                        <strong>{team.name}</strong>
                        <small className="muted">{team.short || team.id}</small>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {!isLoading && filteredTeams.length === 0 ? <p className="muted">No club found for this keyword.</p> : null}

            <section className="onboarding-actions onboarding-actions-between">
              <div className="small-label">Selected: {selectedTeamName}</div>
              <button type="button" onClick={onNextStep} disabled={!selectedTeamId || isLoading}>
                Continue to Squad
              </button>
            </section>
          </section>
        ) : null}

        {step === "squad" ? (
          <>
            <section className="card team-header-box">
              <div className="page-filter-grid">
                <label>
                  Squad Name
                  <input
                    type="text"
                    value={squadName}
                    onChange={(event) => setSquadName(event.target.value)}
                    maxLength={100}
                  />
                </label>
              </div>

              <div className="team-meta-grid">
                <article className="team-meta-item">
                  <p className="small-label">Selected Players</p>
                  <strong>{selectedPlayerIds.length} / 15</strong>
                </article>
                <article className="team-meta-item">
                  <p className="small-label">Budget</p>
                  <strong>
                    £{totalCost.toFixed(1)} / £{BUDGET_CAP.toFixed(1)}
                  </strong>
                </article>
                <article className="team-meta-item">
                  <p className="small-label">Team Limit</p>
                  <strong>{MAX_PER_TEAM} per club</strong>
                </article>
              </div>

              <p className="muted">Tap empty slot to pick player. Tap filled slot to replace player. Use × to remove.</p>
            </section>

            <section ref={pitchBoardRef} className="fpl-board card">
              <div className="fpl-pitch-stage">
                <div className="pitch-top-boards">
                  <div>Fantasy</div>
                  <div>Fantasy</div>
                </div>

                <div className="fpl-pitch">
                  <div className="pitch-lines">
                    <div className="penalty-box" />
                    <div className="center-circle" />
                    <div className="half-line" />
                  </div>

                  {pitchRows.map((row) => (
                    <div key={row.label} className="fpl-line" style={{ "--slot-count": row.slots } as CSSProperties}>
                      {Array.from({ length: row.slots }).map((_, index) => {
                        const playerId = row.ids[index];
                        const player = playerId ? playersById.get(playerId) ?? null : null;
                        return <div key={`${row.label}-${index}`}>{renderPitchCard(row.label, index, row.label, player)}</div>;
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="fpl-bench">
                <p className="small-label">Substitutes</p>
                <div className="bench-grid">
                  {Array.from({ length: FORMATION_MIN_SLOTS.BENCH }).map((_, index) => {
                    const playerId = getSlotPlayerId(lineupDraft ?? createEmptyLineupDraft(leagueId), "BENCH", index);
                    const player = playerId ? playersById.get(playerId) ?? null : null;
                    const benchPosition = BENCH_SLOT_POSITIONS[index] ?? "BENCH";
                    return <div key={`bench-${index}`}>{renderPitchCard("BENCH", index, benchPosition, player)}</div>;
                  })}
                </div>
              </div>
            </section>

            <section className="onboarding-actions onboarding-actions-between">
              <button type="button" className="secondary-button" onClick={() => setStep("favorite")}>
                Back
              </button>
              <button type="button" onClick={onSubmit} disabled={isSubmitting || isLoading || !canSubmit}>
                {isSubmitting ? "Saving..." : "Complete"}
              </button>
            </section>
          </>
        ) : null}

      </main>
    </div>
  );
};
