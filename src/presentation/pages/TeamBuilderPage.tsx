import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import { cacheKeys, cacheTtlMs, getOrLoadCached, invalidateCached } from "../../app/cache/requestCache";
import type { Club } from "../../domain/fantasy/entities/Club";
import type { Player } from "../../domain/fantasy/entities/Player";
import type { PlayerDetails } from "../../domain/fantasy/entities/PlayerDetails";
import type { TeamLineup } from "../../domain/fantasy/entities/Team";
import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import {
  BENCH_SLOT_POSITIONS,
  FORMATION_LIMITS,
  STARTER_SIZE,
  SUBSTITUTE_SIZE,
  getBenchSlotPositions
} from "../../domain/fantasy/services/lineupRules";
import { buildLineupFromPlayers } from "../../domain/fantasy/services/squadBuilder";
import { LoadingState } from "../components/LoadingState";
import { LazyImage } from "../components/LazyImage";
import { useI18n } from "../hooks/useI18n";
import { useSession } from "../hooks/useSession";
import { useLeagueSelection } from "../hooks/useLeagueSelection";
import { appAlert } from "../lib/appAlert";
import { isLiveFixture } from "../lib/fixtureDisplay";
import { HttpError } from "../../infrastructure/http/httpClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  consumePickerResult,
  readLineupDraft,
  savePickerContext,
  writeLineupDraft,
  type SlotPickerTarget
} from "./teamPickerStorage";

type TeamMode = "PAT" | "TRF";
type PointsMetric = "average" | "my" | "highest";
type Position = Player["position"];
type OutfieldPosition = Exclude<Position, "GK">;

type PitchRow = {
  label: Position;
  slots: number;
  ids: string[];
};

type CardVisualState = "source" | "target" | null;
type TeamBuilderPageProps = {
  forcedMode?: TeamMode;
};

const PAT_MIN_SLOTS = {
  DEF: FORMATION_LIMITS.DEF.min,
  MID: FORMATION_LIMITS.MID.min,
  FWD: FORMATION_LIMITS.FWD.min
} as const;
const PAT_MAX_SLOTS = {
  DEF: FORMATION_LIMITS.DEF.max,
  MID: FORMATION_LIMITS.MID.max,
  FWD: FORMATION_LIMITS.FWD.max
} as const;
const OUTFIELD_STARTER_SIZE = STARTER_SIZE - 1;

const TRF_SLOTS = {
  GK: 2,
  DEF: 5,
  MID: 5,
  FWD: 3
} as const;
const SUBSTITUTION_MIN_STARTERS = {
  DEF: 3,
  MID: 3,
  FWD: 1
} as const;
const DEFAULT_TEAM_COLOR_PAIR: [string, string] = ["#3A4250", "#A3ACBA"];
const PICK_TEAM_DEADLINE_LEAD_MS = 2 * 60 * 60 * 1000;
const FINISHED_OR_CANCELLED_STATUSES = new Set([
  "FT",
  "FINISHED",
  "AET",
  "PEN",
  "CANCELLED",
  "POSTPONED",
  "ABANDONED"
]);

const parseTeamMode = (value: string | null): TeamMode => {
  return value?.trim().toUpperCase() === "TRF" ? "TRF" : "PAT";
};

const parsePointsMetric = (value: string | null): PointsMetric => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "average" || normalized === "highest") {
    return normalized;
  }

  return "my";
};

const parseFixtureKickoffMs = (fixture: Fixture): number => {
  const value = new Date(fixture.kickoffAt).getTime();
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
};

const isFinishedOrCancelledFixture = (fixture: Fixture): boolean => {
  const status = fixture.status?.trim().toUpperCase() ?? "";
  return FINISHED_OR_CANCELLED_STATUSES.has(status);
};

const resolveActiveGameweekFromFixtures = (fixtures: Fixture[], nowMs: number): number | null => {
  let liveMin = 0;
  let upcomingMin = 0;
  let lastKnown = 0;

  for (const fixture of fixtures) {
    const gameweek = fixture.gameweek;
    if (!Number.isFinite(gameweek) || gameweek <= 0) {
      continue;
    }

    if (gameweek > lastKnown) {
      lastKnown = gameweek;
    }

    if (isLiveFixture(fixture)) {
      if (liveMin === 0 || gameweek < liveMin) {
        liveMin = gameweek;
      }
      continue;
    }

    if (isFinishedOrCancelledFixture(fixture)) {
      continue;
    }

    const kickoffMs = parseFixtureKickoffMs(fixture);
    if (kickoffMs >= nowMs || !Number.isFinite(kickoffMs)) {
      if (upcomingMin === 0 || gameweek < upcomingMin) {
        upcomingMin = gameweek;
      }
      continue;
    }

    // Kickoff is in the past but status not finalized yet. Treat it as active gameweek.
    if (upcomingMin === 0 || gameweek < upcomingMin) {
      upcomingMin = gameweek;
    }
  }

  if (liveMin > 0) {
    return liveMin;
  }

  if (upcomingMin > 0) {
    return upcomingMin;
  }

  return lastKnown > 0 ? lastKnown : null;
};

const resolveGameweekDeadlineMs = (fixtures: Fixture[], gameweek: number): number | null => {
  const kickoffMs = fixtures
    .filter((fixture) => fixture.gameweek === gameweek)
    .map((fixture) => parseFixtureKickoffMs(fixture))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right)[0];

  if (!Number.isFinite(kickoffMs)) {
    return null;
  }

  return kickoffMs - PICK_TEAM_DEADLINE_LEAD_MS;
};

const sanitizeStarterIds = (ids: string[], max: number): string[] => {
  return ids.filter(Boolean).slice(0, max);
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

const upsertBenchId = (ids: string[], index: number, playerId: string): string[] => {
  const next = [...ids.slice(0, SUBSTITUTE_SIZE)];
  while (next.length <= index && next.length < SUBSTITUTE_SIZE) {
    next.push("");
  }

  if (index >= 0 && index < SUBSTITUTE_SIZE) {
    next[index] = playerId;
  }

  return next;
};

const replaceAtIndex = (ids: string[], index: number, value: string): string[] => {
  const next = [...ids];
  if (index >= 0 && index < next.length) {
    next[index] = value;
  }
  return next;
};

const removeAtIndex = (ids: string[], index: number): string[] => {
  if (index < 0 || index >= ids.length) {
    return [...ids];
  }

  return ids.filter((_, currentIndex) => currentIndex !== index);
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

const createEmptyLineup = (leagueId: string): TeamLineup => ({
  leagueId,
  goalkeeperId: "",
  defenderIds: [],
  midfielderIds: [],
  forwardIds: [],
  substituteIds: [],
  captainId: "",
  viceCaptainId: "",
  updatedAt: new Date().toISOString()
});

const assignPlayerToTarget = (
  lineup: TeamLineup,
  target: SlotPickerTarget,
  playerId: string
): TeamLineup => {
  switch (target.zone) {
    case "GK":
      return {
        ...lineup,
        goalkeeperId: playerId
      };
    case "DEF":
      return {
        ...lineup,
        defenderIds: upsertStarterId(lineup.defenderIds, target.index, playerId, PAT_MAX_SLOTS.DEF)
      };
    case "MID":
      return {
        ...lineup,
        midfielderIds: upsertStarterId(lineup.midfielderIds, target.index, playerId, PAT_MAX_SLOTS.MID)
      };
    case "FWD":
      return {
        ...lineup,
        forwardIds: upsertStarterId(lineup.forwardIds, target.index, playerId, PAT_MAX_SLOTS.FWD)
      };
    case "BENCH":
      return {
        ...lineup,
        substituteIds: upsertBenchId(lineup.substituteIds, target.index, playerId)
      };
  }
};

const getStarterIds = (lineup: TeamLineup): string[] => {
  return [lineup.goalkeeperId, ...lineup.defenderIds, ...lineup.midfielderIds, ...lineup.forwardIds].filter(Boolean);
};

const getPlayerIdAtTarget = (lineup: TeamLineup, target: SlotPickerTarget): string => {
  switch (target.zone) {
    case "GK":
      return lineup.goalkeeperId;
    case "DEF":
      return lineup.defenderIds[target.index] ?? "";
    case "MID":
      return lineup.midfielderIds[target.index] ?? "";
    case "FWD":
      return lineup.forwardIds[target.index] ?? "";
    case "BENCH":
      return lineup.substituteIds[target.index] ?? "";
  }
};

const getTargetForPlayerId = (lineup: TeamLineup, playerId: string): SlotPickerTarget | null => {
  if (!playerId) {
    return null;
  }

  if (lineup.goalkeeperId === playerId) {
    return {
      zone: "GK",
      index: 0
    };
  }

  const defenderIndex = lineup.defenderIds.findIndex((id) => id === playerId);
  if (defenderIndex >= 0) {
    return {
      zone: "DEF",
      index: defenderIndex
    };
  }

  const midfielderIndex = lineup.midfielderIds.findIndex((id) => id === playerId);
  if (midfielderIndex >= 0) {
    return {
      zone: "MID",
      index: midfielderIndex
    };
  }

  const forwardIndex = lineup.forwardIds.findIndex((id) => id === playerId);
  if (forwardIndex >= 0) {
    return {
      zone: "FWD",
      index: forwardIndex
    };
  }

  const benchIndex = lineup.substituteIds.findIndex((id) => id === playerId);
  if (benchIndex >= 0) {
    return {
      zone: "BENCH",
      index: benchIndex
    };
  }

  return null;
};

const ensureLeadership = (lineup: TeamLineup): TeamLineup => {
  const starters = getStarterIds(lineup);
  const captainId = starters.includes(lineup.captainId) ? lineup.captainId : starters[0] ?? "";
  const viceCaptainId =
    starters.includes(lineup.viceCaptainId) && lineup.viceCaptainId !== captainId
      ? lineup.viceCaptainId
      : starters.find((id) => id !== captainId) ?? "";

  return {
    ...lineup,
    captainId,
    viceCaptainId
  };
};

const normalizeLineup = (leagueId: string, lineup: TeamLineup | null): TeamLineup => {
  if (!lineup) {
    return createEmptyLineup(leagueId);
  }

  return ensureLeadership({
    ...lineup,
    leagueId,
    defenderIds: sanitizeStarterIds(lineup.defenderIds ?? [], PAT_MAX_SLOTS.DEF),
    midfielderIds: sanitizeStarterIds(lineup.midfielderIds ?? [], PAT_MAX_SLOTS.MID),
    forwardIds: sanitizeStarterIds(lineup.forwardIds ?? [], PAT_MAX_SLOTS.FWD),
    substituteIds: (lineup.substituteIds ?? []).slice(0, SUBSTITUTE_SIZE)
  });
};

const toComparableLineup = (lineup: TeamLineup | null) => {
  if (!lineup) {
    return null;
  }

  return {
    leagueId: lineup.leagueId,
    goalkeeperId: lineup.goalkeeperId,
    defenderIds: lineup.defenderIds.filter(Boolean),
    midfielderIds: lineup.midfielderIds.filter(Boolean),
    forwardIds: lineup.forwardIds.filter(Boolean),
    substituteIds: lineup.substituteIds.filter(Boolean).slice(0, SUBSTITUTE_SIZE),
    captainId: lineup.captainId,
    viceCaptainId: lineup.viceCaptainId
  };
};

const shortName = (name: string): string => {
  const normalized = name.trim().replace(/\s+/g, " ");
  const words = normalized.split(" ");
  if (words.length <= 1) {
    return normalized;
  }

  const last = words[words.length - 1];
  return last.length > 12 ? `${words[0]} ${last.slice(0, 1)}.` : `${words[0]} ${last}`;
};

const pitchDisplayName = (player: Player): string => {
  const preferred = player.commonName?.trim();
  if (preferred) {
    return preferred;
  }

  return shortName(player.name);
};

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
};

const normalizeTeamKey = (value: string): string => value.trim().toLowerCase();

const buildTeamColorIndex = (teams: Club[]): Map<string, [string, string]> => {
  const index = new Map<string, [string, string]>();

  for (const team of teams) {
    if (!team.teamColor || team.teamColor.length < 2) {
      continue;
    }

    const pair: [string, string] = [team.teamColor[0], team.teamColor[1]];
    const keys = [team.id, team.name, team.short].map(normalizeTeamKey).filter(Boolean);
    for (const key of keys) {
      index.set(key, pair);
    }
  }

  return index;
};

const resolveJerseyColorPair = (
  player: Player,
  teamColorIndex: Map<string, [string, string]>
): [string, string] => {
  if (player.teamColor && player.teamColor.length >= 2) {
    return [player.teamColor[0], player.teamColor[1]];
  }

  return teamColorIndex.get(normalizeTeamKey(player.club)) ?? DEFAULT_TEAM_COLOR_PAIR;
};

const jerseyBackgroundFromColors = ([primary, secondary]: [string, string]): string => {
  return `linear-gradient(140deg, ${primary} 0 46%, ${secondary} 46% 100%)`;
};

const jerseyNumberFromPlayer = (playerId: string): string => {
  return String((hashString(playerId) % 99) + 1);
};

const sortByProjectedDesc = (players: Player[]): Player[] => {
  return [...players].sort((left, right) => right.projectedPoints - left.projectedPoints);
};

const clampNumber = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const simulatePastPoints = (player: Player, gameweek: number): number => {
  const swing = (hashString(`${player.id}-${gameweek}`) % 7) - 3;
  const raw = player.projectedPoints * 0.7 + player.form * 0.55 + swing * 0.45;
  return Number(clampNumber(raw, 0, 20).toFixed(1));
};

const toSelectedPercentage = (playerId: string): number => {
  const value = 12 + (hashString(playerId) % 740) / 10;
  return Number(Math.min(value, 89.9).toFixed(1));
};

const normalizeUrl = (value?: string): string => value?.trim() ?? "";

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const isUnauthorizedError = (error: unknown): boolean => {
  if (error instanceof HttpError) {
    return error.statusCode === 401 || error.statusCode === 403;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("invalid token") ||
    message.includes("token expired") ||
    message.includes("introspection")
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

async function withRetry<T>(run: () => Promise<T>, retries: number): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }

      await delay(250 * (attempt + 1));
      attempt += 1;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed.");
}

export const TeamBuilderPage = ({ forcedMode }: TeamBuilderPageProps = {}) => {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    getPlayers,
    getTeams,
    getPlayerDetails,
    getLineup,
    getDashboard,
    getFixtures,
    getMySquad,
    getHighestPlayerPointsByGameweek,
    getMyPlayerPointsByGameweek,
    pickSquad,
    logout,
    saveLineup
  } =
    useContainer();
  const { selectedLeagueId } = useLeagueSelection();
  const { session, setSession } = useSession();
  const userScope = session?.user.id ?? "";
  const logoutInProgressRef = useRef(false);
  const pitchBoardRef = useRef<HTMLDivElement | null>(null);
  const pointsViewCenteredKeyRef = useRef("");

  const [mode, setMode] = useState<TeamMode>(() => forcedMode ?? parseTeamMode(searchParams.get("mode")));
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Club[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [lineup, setLineup] = useState<TeamLineup | null>(null);
  const [gameweek, setGameweek] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isLeagueDataLoading, setIsLeagueDataLoading] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedPlayerDetails, setSelectedPlayerDetails] = useState<PlayerDetails | null>(null);
  const [isSelectedPlayerDetailsLoading, setIsSelectedPlayerDetailsLoading] = useState(false);
  const [isFullProfileVisible, setIsFullProfileVisible] = useState(false);
  const [substitutionSourcePlayerId, setSubstitutionSourcePlayerId] = useState<string | null>(null);
  const [hasSubstitutionDraftChanges, setHasSubstitutionDraftChanges] = useState(false);
  const [lastSavedLineup, setLastSavedLineup] = useState<TeamLineup | null>(null);
  const [isSavingLineup, setIsSavingLineup] = useState(false);
  const [pointsByPlayerId, setPointsByPlayerId] = useState<Record<string, number>>({});
  const [pointsViewGameweek, setPointsViewGameweek] = useState<number | null>(null);
  const [pointsViewTotal, setPointsViewTotal] = useState<number | null>(null);
  const [pointsViewTopUserId, setPointsViewTopUserId] = useState<string | null>(null);
  const [isPointsViewLoading, setIsPointsViewLoading] = useState(false);
  const [pointsViewNotice, setPointsViewNotice] = useState<string | null>(null);

  useEffect(() => {
    if (forcedMode) {
      setMode((current) => (current === forcedMode ? current : forcedMode));
      return;
    }

    const queryMode = parseTeamMode(searchParams.get("mode"));
    setMode((current) => (current === queryMode ? current : queryMode));
  }, [forcedMode, searchParams]);

  const isPointsView = searchParams.get("view")?.trim().toLowerCase() === "points";
  const pointsMetric = parsePointsMetric(searchParams.get("metric"));

  const recenterToPitch = useCallback(() => {
    if (!pitchBoardRef.current) {
      return;
    }

    scrollElementToViewportCenter(pitchBoardRef.current);
  }, []);

  const forceLogout = useCallback(
    async (reason: string) => {
      if (logoutInProgressRef.current) {
        return;
      }

      logoutInProgressRef.current = true;

      try {
        const token = session?.accessToken?.trim() ?? "";
        if (token) {
          await logout.execute(token);
        }
      } catch {
        // no-op: local session clear still needs to happen
      } finally {
        setSession(null);
        void appAlert.warning("Session Expired", reason);
        navigate("/login", { replace: true });
      }
    },
    [logout, navigate, session?.accessToken, setSession]
  );

  useEffect(() => {
    if (!isPointsView) {
      setPointsByPlayerId({});
      setPointsViewGameweek(null);
      setPointsViewTotal(null);
      setPointsViewTopUserId(null);
      setPointsViewNotice(null);
      setIsPointsViewLoading(false);
      return;
    }

    const leagueId = selectedLeagueId.trim();
    const accessToken = session?.accessToken?.trim() ?? "";
    if (!leagueId || !accessToken) {
      setPointsByPlayerId({});
      setPointsViewGameweek(null);
      setPointsViewTotal(null);
      setPointsViewTopUserId(null);
      return;
    }
    if (!gameweek || !Number.isFinite(gameweek) || gameweek <= 0) {
      setIsPointsViewLoading(true);
      return;
    }

    let mounted = true;
    setIsPointsViewLoading(true);
    const currentTargetGameweek = gameweek;
    const highestTargetGameweek = gameweek;

    const loadPointsView = async () => {
      try {
        if (pointsMetric === "highest") {
          const highestRow = await getHighestPlayerPointsByGameweek.execute(
            leagueId,
            accessToken,
            highestTargetGameweek
          );
          if (!mounted) {
            return;
          }

          if (!highestRow) {
            setPointsByPlayerId({});
            setPointsViewGameweek(highestTargetGameweek ?? null);
            setPointsViewTotal(null);
            setPointsViewTopUserId(null);
            if (highestTargetGameweek) {
              setPointsViewNotice(`No highest lineup points available for GW ${highestTargetGameweek} yet.`);
            } else {
              setPointsViewNotice("No highest lineup points available for the current gameweek yet.");
            }
            return;
          }

          const nextPoints: Record<string, number> = {};
          for (const item of highestRow.players) {
            nextPoints[item.playerId] = item.countedPoints;
          }

          setPointsByPlayerId(nextPoints);
          setPointsViewGameweek(highestRow.gameweek);
          setPointsViewTotal(highestRow.totalPoints);
          setPointsViewTopUserId(highestRow.userId || null);
          setPointsViewNotice(null);
          return;
        }

        const rows = await getMyPlayerPointsByGameweek.execute(
          leagueId,
          accessToken,
          currentTargetGameweek
        );
        if (!mounted) {
          return;
        }

        const selectedRow =
          currentTargetGameweek !== undefined
            ? rows.find((item) => item.gameweek === currentTargetGameweek) ?? null
            : rows[0] ?? null;
        if (!selectedRow) {
          setPointsByPlayerId({});
          setPointsViewGameweek(currentTargetGameweek ?? null);
          setPointsViewTotal(currentTargetGameweek ? 0 : null);
          setPointsViewTopUserId(null);
          setPointsViewNotice(null);
          return;
        }

        const nextPoints: Record<string, number> = {};
        for (const item of selectedRow.players) {
          nextPoints[item.playerId] = item.countedPoints;
        }

        setPointsByPlayerId(nextPoints);
        setPointsViewGameweek(selectedRow.gameweek);
        setPointsViewTotal(selectedRow.totalPoints);
        setPointsViewTopUserId(null);
        setPointsViewNotice(null);
      } catch (error) {
        if (!mounted) {
          return;
        }

        if (isUnauthorizedError(error)) {
          await forceLogout("Your session has expired. Please sign in again.");
          return;
        }

        setPointsByPlayerId({});
        setPointsViewGameweek(null);
        setPointsViewTotal(null);
        setPointsViewTopUserId(null);
        setPointsViewNotice(null);
        void appAlert.error("Points View", error instanceof Error ? error.message : "Failed to load player points.");
      } finally {
        if (mounted) {
          setIsPointsViewLoading(false);
        }
      }
    };

    void loadPointsView();

    return () => {
      mounted = false;
    };
  }, [
    forceLogout,
    getHighestPlayerPointsByGameweek,
    gameweek,
    getMyPlayerPointsByGameweek,
    isPointsView,
    pointsMetric,
    selectedLeagueId,
    session?.accessToken
  ]);

  const syncSquadFromLineup = useCallback(
    async (draftLineup: TeamLineup, forceUpsert = false): Promise<boolean> => {
      const accessToken = session?.accessToken?.trim() ?? "";
      if (!accessToken) {
        await forceLogout("Your session is invalid. Please sign in again.");
        return false;
      }

      const draftPlayerIds = [
        draftLineup.goalkeeperId,
        ...draftLineup.defenderIds,
        ...draftLineup.midfielderIds,
        ...draftLineup.forwardIds,
        ...draftLineup.substituteIds
      ].filter(Boolean);
      const uniqueDraftPlayerIds = [...new Set(draftPlayerIds)];

      if (uniqueDraftPlayerIds.length !== STARTER_SIZE + SUBSTITUTE_SIZE) {
        throw new Error("Lineup must contain exactly 15 unique players before save.");
      }

      let squad = null;
      try {
        squad = await getMySquad.execute(draftLineup.leagueId, accessToken);
      } catch (error) {
        if (isUnauthorizedError(error)) {
          await forceLogout("Your session has expired. Please sign in again.");
          return false;
        }

        throw error;
      }

      const shouldUpsertFromDraft = (() => {
        if (forceUpsert) {
          return true;
        }

        if (!squad || squad.picks.length !== STARTER_SIZE + SUBSTITUTE_SIZE) {
          return true;
        }

        const squadSet = new Set(squad.picks.map((pick) => pick.playerId));
        return !uniqueDraftPlayerIds.every((playerId) => squadSet.has(playerId));
      })();

      if (!shouldUpsertFromDraft) {
        return true;
      }

      await pickSquad.execute(
        {
          leagueId: draftLineup.leagueId,
          playerIds: uniqueDraftPlayerIds
        },
        accessToken
      );
      return true;
    },
    [forceLogout, getMySquad, pickSquad, session?.accessToken]
  );

  useEffect(() => {
    if (errorMessage) {
      void appAlert.error("Team Load Failed", errorMessage);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (infoMessage) {
      void appAlert.info("Team Update", infoMessage);
    }
  }, [infoMessage]);

  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const teamColorIndex = useMemo(() => buildTeamColorIndex(teams), [teams]);

  useEffect(() => {
    let mounted = true;

    const loadHeader = async () => {
      const accessToken = session?.accessToken?.trim() ?? "";
      const userId = session?.user.id?.trim() ?? "";
      if (!accessToken || !userId) {
        return;
      }

      try {
        const dashboard = await withRetry(
          () =>
            getOrLoadCached({
              key: cacheKeys.dashboard(userId),
              ttlMs: cacheTtlMs.dashboard,
              loader: () => getDashboard.execute(accessToken),
              allowStaleOnError: false
            }),
          1
        );

        if (!mounted) {
          return;
        }

        setGameweek(dashboard.gameweek);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setInfoMessage(error instanceof Error ? error.message : "Failed to load dashboard.");
      }
    };

    void loadHeader();

    return () => {
      mounted = false;
    };
  }, [getDashboard, session?.accessToken, session?.user.id]);

  useEffect(() => {
    if (!selectedLeagueId) {
      return;
    }

    const accessToken = session?.accessToken?.trim() ?? "";
    if (!accessToken) {
      return;
    }

    let mounted = true;
    setLastSavedLineup(null);
    setIsSavingLineup(false);
    setSubstitutionSourcePlayerId(null);
    setHasSubstitutionDraftChanges(false);
    setPlayers([]);
    setTeams([]);
    setFixtures([]);
    setLineup(null);
    setSelectedPlayerId(null);
    setSelectedPlayerDetails(null);
    setErrorMessage(null);
    setInfoMessage(null);

    const loadLeagueData = async () => {
      setIsLeagueDataLoading(true);

      try {
        let playersResultRaw: Player[] = [];
        let playersError: unknown = null;

        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            const result = await withRetry(
              () =>
                getOrLoadCached({
                  key: cacheKeys.players(selectedLeagueId),
                  ttlMs: cacheTtlMs.players,
                  loader: () => getPlayers.execute(selectedLeagueId),
                  allowStaleOnError: false,
                  forceRefresh: attempt > 0
                }),
              2
            );
            if (result.length > 0) {
              playersResultRaw = result;
              playersError = null;
              break;
            }

            playersResultRaw = result;
          } catch (error) {
            playersError = error;
          }

          if (attempt < 2) {
            await delay(350 * (attempt + 1));
          }
        }

        if (playersResultRaw.length === 0 && playersError) {
          throw playersError instanceof Error ? playersError : new Error("Failed to load players.");
        }

        const [lineupResult, fixturesResult, teamsResult] = await Promise.all([
          getOrLoadCached({
            key: cacheKeys.lineup(userScope, selectedLeagueId),
            ttlMs: cacheTtlMs.lineup,
            loader: () => getLineup.execute(selectedLeagueId, accessToken),
            storage: "memory",
            allowStaleOnError: false
          }),
          getOrLoadCached({
            key: cacheKeys.fixtures(selectedLeagueId),
            ttlMs: cacheTtlMs.fixtures,
            loader: () => getFixtures.execute(selectedLeagueId),
            allowStaleOnError: false
          }),
          getOrLoadCached({
            key: cacheKeys.teams(selectedLeagueId),
            ttlMs: cacheTtlMs.teams,
            loader: () => getTeams.execute(selectedLeagueId),
            allowStaleOnError: false
          })
        ]);

        if (!mounted) {
          return;
        }

        const playersResult = playersResultRaw;
        let infoToShow: string | null = null;
        let loadErrorToShow: string | null = null;
        let shouldRecenterPitch = false;

        setPlayers(playersResult);
        setTeams(teamsResult);
        setFixtures(fixturesResult);

        let resolvedLineup = lineupResult;

        if (!resolvedLineup && playersResult.length > 0) {
          if (!accessToken) {
            await forceLogout("Your session is invalid. Please sign in again.");
            return;
          }

          try {
            const squadResult = await getMySquad.execute(selectedLeagueId, accessToken);
            if (!squadResult) {
              void appAlert.info(
                "Onboarding Required",
                "No squad found for this league. Please complete onboarding for this league."
              );
              navigate(
                `/onboarding?force=1&step=squad&leagueId=${encodeURIComponent(selectedLeagueId)}`,
                { replace: true }
              );
              return;
            } else {
              resolvedLineup = buildLineupFromPlayers(
                selectedLeagueId,
                playersResult,
                squadResult.picks.map((pick) => pick.playerId)
              );
              infoToShow = "Loaded lineup from your current squad.";
            }
          } catch (error) {
            if (isUnauthorizedError(error)) {
              await forceLogout("Your session has expired. Please sign in again.");
              return;
            }

            const message =
              error instanceof Error ? error.message : "Unknown error while loading squad.";
            resolvedLineup = createEmptyLineup(selectedLeagueId);
            loadErrorToShow = `Squad load failed (${message}). Pick players directly on the field.`;
          }
        }

        const savedNormalized = normalizeLineup(selectedLeagueId, resolvedLineup);
        let normalized = savedNormalized;
        const draftLineup = readLineupDraft(selectedLeagueId, userScope);
        if (draftLineup) {
          normalized = normalizeLineup(selectedLeagueId, draftLineup);
        }

        const pickerResult = consumePickerResult(userScope);
        if (pickerResult && pickerResult.leagueId === selectedLeagueId) {
          const pickedPlayer = playersResult.find((player) => player.id === pickerResult.playerId);
          if (pickedPlayer) {
            normalized = ensureLeadership(
              assignPlayerToTarget(normalized, pickerResult.target, pickerResult.playerId)
            );
            infoToShow = `${pickedPlayer.name} added to ${pickerResult.target.zone} slot.`;
            shouldRecenterPitch = true;
          } else {
            loadErrorToShow = loadErrorToShow ?? "Picked player is unavailable for this league.";
          }
        }

        setLineup(normalized);
        setLastSavedLineup(savedNormalized);
        writeLineupDraft(normalized, userScope);
        setSelectedPlayerId(null);
        setSubstitutionSourcePlayerId(null);
        setHasSubstitutionDraftChanges(false);
        if (shouldRecenterPitch) {
          recenterToPitch();
        }

        const resolvedGameweek = resolveActiveGameweekFromFixtures(fixturesResult, Date.now());
        if (resolvedGameweek) {
          setGameweek((current) => {
            if (current && current > 0) {
              return current;
            }

            return resolvedGameweek;
          });
        }

        if (infoToShow) {
          setInfoMessage(infoToShow);
        } else if (lineupResult) {
          setInfoMessage(`Last saved at ${new Date(lineupResult.updatedAt).toLocaleString("id-ID")}`);
        } else if (playersResult.length === 0) {
          setInfoMessage("Players endpoint returned no data for this league.");
        } else {
          setInfoMessage("No lineup saved for this league yet.");
        }

        setErrorMessage(loadErrorToShow);
      } catch (error) {
        if (!mounted) {
          return;
        }

        if (isUnauthorizedError(error)) {
          await forceLogout("Your session has expired. Please sign in again.");
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Failed to load lineup.");
      } finally {
        if (mounted) {
          setIsLeagueDataLoading(false);
        }
      }
    };

    void loadLeagueData();

    return () => {
      mounted = false;
    };
  }, [
    forceLogout,
    getFixtures,
    getLineup,
    getMySquad,
    getPlayers,
    getTeams,
    recenterToPitch,
    selectedLeagueId,
    session?.accessToken,
    userScope
  ]);

  useEffect(() => {
    if (!lineup) {
      return;
    }

    writeLineupDraft(lineup, userScope);
  }, [lineup, userScope]);

  useEffect(() => {
    if (!selectedPlayerId) {
      setIsFullProfileVisible(false);
    }
  }, [selectedPlayerId]);

  useEffect(() => {
    if (mode !== "PAT") {
      setSubstitutionSourcePlayerId(null);
    }
  }, [mode]);

  const starterIds = useMemo(() => (lineup ? getStarterIds(lineup) : []), [lineup]);

  const squadIds = useMemo(() => {
    if (!lineup) {
      return [];
    }

    return [...new Set([...starterIds, ...lineup.substituteIds])];
  }, [lineup, starterIds]);

  useEffect(() => {
    if (!substitutionSourcePlayerId) {
      return;
    }

    if (!squadIds.includes(substitutionSourcePlayerId)) {
      setSubstitutionSourcePlayerId(null);
    }
  }, [squadIds, substitutionSourcePlayerId]);

  const squadPlayers = useMemo(() => {
    return squadIds
      .map((id) => playersById.get(id))
      .filter((player): player is Player => Boolean(player));
  }, [playersById, squadIds]);
  const requiredBenchSlots = useMemo(() => {
    if (!lineup) {
      return BENCH_SLOT_POSITIONS;
    }

    return getBenchSlotPositions(lineup);
  }, [lineup]);

  const squadCost = useMemo(() => {
    return squadPlayers.reduce((sum, player) => sum + player.price, 0);
  }, [squadPlayers]);

  const activeFixtureGameweek = useMemo(() => {
    return resolveActiveGameweekFromFixtures(fixtures, Date.now());
  }, [fixtures]);

  const planningGameweek = useMemo(() => {
    if (activeFixtureGameweek && activeFixtureGameweek > 0) {
      return activeFixtureGameweek + 1;
    }

    if (gameweek && gameweek > 0) {
      return gameweek + 1;
    }

    return null;
  }, [activeFixtureGameweek, gameweek]);

  const fixtureByTeam = useMemo(() => {
    const map = new Map<string, Fixture>();
    const sorted = [...fixtures].sort((left, right) => parseFixtureKickoffMs(left) - parseFixtureKickoffMs(right));
    const nowMs = Date.now();

    const preferred = planningGameweek
      ? sorted.filter((fixture) => fixture.gameweek === planningGameweek)
      : sorted.filter((fixture) => parseFixtureKickoffMs(fixture) >= nowMs);
    const fallback = sorted.filter((fixture) => parseFixtureKickoffMs(fixture) >= nowMs);
    const source = preferred.length > 0 ? preferred : fallback.length > 0 ? fallback : sorted;

    for (const fixture of source) {
      if (!map.has(fixture.homeTeam)) {
        map.set(fixture.homeTeam, fixture);
      }

      if (!map.has(fixture.awayTeam)) {
        map.set(fixture.awayTeam, fixture);
      }
    }

    return map;
  }, [fixtures, planningGameweek]);

  const lockState = useMemo(() => {
    if (!activeFixtureGameweek) {
      return null;
    }

    const deadlineMs = resolveGameweekDeadlineMs(fixtures, activeFixtureGameweek);
    if (deadlineMs === null) {
      return null;
    }

    return {
      gameweek: activeFixtureGameweek,
      deadlineMs,
      locked: Date.now() >= deadlineMs
    };
  }, [activeFixtureGameweek, fixtures]);

  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) {
      return null;
    }

    return playersById.get(selectedPlayerId) ?? null;
  }, [playersById, selectedPlayerId]);

  useEffect(() => {
    if (!selectedPlayer || !selectedLeagueId) {
      setSelectedPlayerDetails(null);
      setIsSelectedPlayerDetailsLoading(false);
      return;
    }

    let mounted = true;

    const loadPlayerDetails = async () => {
      setIsSelectedPlayerDetailsLoading(true);
      setSelectedPlayerDetails(null);

      try {
        const details = await getOrLoadCached({
          key: cacheKeys.playerDetails(selectedLeagueId, selectedPlayer.id),
          ttlMs: cacheTtlMs.playerDetails,
          loader: () => getPlayerDetails.execute(selectedLeagueId, selectedPlayer.id),
          allowStaleOnError: false
        });

        if (!mounted) {
          return;
        }

        setSelectedPlayerDetails(details);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setSelectedPlayerDetails(null);
        void appAlert.warning(
          "Player Details",
          error instanceof Error ? error.message : "Unable to load full player details."
        );
      } finally {
        if (mounted) {
          setIsSelectedPlayerDetailsLoading(false);
        }
      }
    };

    void loadPlayerDetails();

    return () => {
      mounted = false;
    };
  }, [getPlayerDetails, selectedLeagueId, selectedPlayer]);

  const openPlayerPicker = (target: SlotPickerTarget) => {
    if (!lineup || !selectedLeagueId) {
      return;
    }

    const currentSlotId = getPlayerIdAtTarget(lineup, target);
    if (target.zone !== "BENCH" && !currentSlotId && getStarterIds(lineup).length >= STARTER_SIZE) {
      void appAlert.info("Formation Full", "Starting XI is full. Remove one starter first.");
      return;
    }

    savePickerContext(
      {
        leagueId: selectedLeagueId,
        target,
        lineup,
        returnPath: mode === "TRF" ? "/transfers" : "/pick-team"
      },
      userScope
    );

    const params = new URLSearchParams({
      leagueId: selectedLeagueId,
      zone: target.zone,
      index: String(target.index)
    });

    navigate(`/pick-team/pick?${params.toString()}`);
  };

  const selectedPlayerIsStarter = useMemo(() => {
    if (!selectedPlayer || !lineup) {
      return false;
    }

    return starterIds.includes(selectedPlayer.id);
  }, [lineup, selectedPlayer, starterIds]);

  const selectedPlayerIsBench = useMemo(() => {
    if (!selectedPlayer || !lineup) {
      return false;
    }

    return lineup.substituteIds.includes(selectedPlayer.id);
  }, [lineup, selectedPlayer]);

  const substitutionSourceTarget = useMemo(() => {
    if (!lineup || !substitutionSourcePlayerId) {
      return null;
    }

    return getTargetForPlayerId(lineup, substitutionSourcePlayerId);
  }, [lineup, substitutionSourcePlayerId]);

  const starterPositionCounts = useMemo(() => {
    return {
      DEF: lineup?.defenderIds.filter(Boolean).length ?? 0,
      MID: lineup?.midfielderIds.filter(Boolean).length ?? 0,
      FWD: lineup?.forwardIds.filter(Boolean).length ?? 0
    };
  }, [lineup]);

  const isSubstitutionAllowedForTargets = useCallback(
    (sourceTarget: SlotPickerTarget, targetTarget: SlotPickerTarget): boolean => {
      if (!lineup) {
        return false;
      }

      // Substitution must be between exactly one starter and one bench player.
      const sourceIsStarter = sourceTarget.zone !== "BENCH";
      const targetIsStarter = targetTarget.zone !== "BENCH";
      if (sourceIsStarter === targetIsStarter) {
        return false;
      }

      const sourcePlayerId = getPlayerIdAtTarget(lineup, sourceTarget);
      const targetPlayerId = getPlayerIdAtTarget(lineup, targetTarget);
      const sourcePlayer = playersById.get(sourcePlayerId);
      const targetPlayer = playersById.get(targetPlayerId);
      if (!sourcePlayer || !targetPlayer) {
        return false;
      }

      const starterTarget = sourceIsStarter ? sourceTarget : targetTarget;
      const incomingPlayer = sourceIsStarter ? targetPlayer : sourcePlayer;

      // GK starter can only be swapped with a GK bench player.
      if (starterTarget.zone === "GK") {
        return incomingPlayer.position === "GK";
      }

      // Outfield starter cannot be swapped with GK bench player.
      if (incomingPlayer.position === "GK") {
        return false;
      }

      const nextCounts = { ...starterPositionCounts };
      const starterPosition = starterTarget.zone as OutfieldPosition;
      const incomingPosition = incomingPlayer.position as OutfieldPosition;
      nextCounts[starterPosition] -= 1;
      nextCounts[incomingPosition] += 1;

      return (
        nextCounts.DEF >= SUBSTITUTION_MIN_STARTERS.DEF &&
        nextCounts.MID >= SUBSTITUTION_MIN_STARTERS.MID &&
        nextCounts.FWD >= SUBSTITUTION_MIN_STARTERS.FWD &&
        nextCounts.DEF <= PAT_MAX_SLOTS.DEF &&
        nextCounts.MID <= PAT_MAX_SLOTS.MID &&
        nextCounts.FWD <= PAT_MAX_SLOTS.FWD
      );
    },
    [lineup, playersById, starterPositionCounts]
  );

  const getSubstitutionTargetsForSource = useCallback(
    (sourcePlayerId: string): Set<string> => {
      const enabledTargets = new Set<string>();
      if (mode !== "PAT" || !lineup) {
        return enabledTargets;
      }

      const sourceTarget = getTargetForPlayerId(lineup, sourcePlayerId);
      if (!sourceTarget) {
        return enabledTargets;
      }

      const candidateTargetPlayerIds =
        sourceTarget.zone === "BENCH"
          ? getStarterIds(lineup)
          : lineup.substituteIds.filter(Boolean);

      for (const targetPlayerId of candidateTargetPlayerIds) {
        const targetTarget = getTargetForPlayerId(lineup, targetPlayerId);
        if (!targetTarget) {
          continue;
        }

        if (isSubstitutionAllowedForTargets(sourceTarget, targetTarget)) {
          enabledTargets.add(targetPlayerId);
        }
      }

      return enabledTargets;
    },
    [isSubstitutionAllowedForTargets, lineup, mode]
  );

  const substitutionTargetIds = useMemo(() => {
    if (!substitutionSourcePlayerId) {
      return new Set<string>();
    }

    return getSubstitutionTargetsForSource(substitutionSourcePlayerId);
  }, [getSubstitutionTargetsForSource, substitutionSourcePlayerId]);

  const selectedPlayerSubstitutionTargets = useMemo(() => {
    if (!selectedPlayer) {
      return new Set<string>();
    }

    return getSubstitutionTargetsForSource(selectedPlayer.id);
  }, [getSubstitutionTargetsForSource, selectedPlayer]);

  useEffect(() => {
    if (!substitutionSourcePlayerId) {
      return;
    }

    if (substitutionTargetIds.size === 0) {
      setSubstitutionSourcePlayerId(null);
      void appAlert.warning("Substitution", "No valid substitution target is available.");
    }
  }, [substitutionSourcePlayerId, substitutionTargetIds]);

  const applySubstitution = useCallback(
    (targetPlayerId: string) => {
      if (!lineup || !substitutionSourcePlayerId || !substitutionSourceTarget) {
        return;
      }

      const target = getTargetForPlayerId(lineup, targetPlayerId);
      if (!target) {
        return;
      }

      if (!isSubstitutionAllowedForTargets(substitutionSourceTarget, target)) {
        void appAlert.warning("Invalid Substitution", "These players cannot be swapped.");
        return;
      }

      const sourceIsStarter = substitutionSourceTarget.zone !== "BENCH";
      const starterTarget = sourceIsStarter ? substitutionSourceTarget : target;
      const benchTarget = sourceIsStarter ? target : substitutionSourceTarget;
      if (starterTarget.zone === "BENCH" || benchTarget.zone !== "BENCH") {
        return;
      }

      const starterPlayerId = getPlayerIdAtTarget(lineup, starterTarget);
      const benchPlayerId = getPlayerIdAtTarget(lineup, benchTarget);
      const incomingPlayer = playersById.get(benchPlayerId);
      if (!starterPlayerId || !benchPlayerId || !incomingPlayer) {
        return;
      }

      const nextBenchIds = upsertBenchId(lineup.substituteIds, benchTarget.index, starterPlayerId);
      let nextLineup: TeamLineup = {
        ...lineup,
        substituteIds: nextBenchIds
      };

      if (starterTarget.zone === "GK") {
        nextLineup = {
          ...nextLineup,
          goalkeeperId: benchPlayerId
        };
      } else if (incomingPlayer.position === starterTarget.zone) {
        if (starterTarget.zone === "DEF") {
          nextLineup = {
            ...nextLineup,
            defenderIds: replaceAtIndex(lineup.defenderIds, starterTarget.index, benchPlayerId)
          };
        } else if (starterTarget.zone === "MID") {
          nextLineup = {
            ...nextLineup,
            midfielderIds: replaceAtIndex(lineup.midfielderIds, starterTarget.index, benchPlayerId)
          };
        } else {
          nextLineup = {
            ...nextLineup,
            forwardIds: replaceAtIndex(lineup.forwardIds, starterTarget.index, benchPlayerId)
          };
        }
      } else {
        const sourceZone = starterTarget.zone;
        const sourceIndex = starterTarget.index;

        if (sourceZone === "DEF") {
          nextLineup = {
            ...nextLineup,
            defenderIds: removeAtIndex(lineup.defenderIds, sourceIndex)
          };
        } else if (sourceZone === "MID") {
          nextLineup = {
            ...nextLineup,
            midfielderIds: removeAtIndex(lineup.midfielderIds, sourceIndex)
          };
        } else {
          nextLineup = {
            ...nextLineup,
            forwardIds: removeAtIndex(lineup.forwardIds, sourceIndex)
          };
        }

        if (incomingPlayer.position === "DEF") {
          nextLineup = {
            ...nextLineup,
            defenderIds: [...nextLineup.defenderIds, benchPlayerId]
          };
        } else if (incomingPlayer.position === "MID") {
          nextLineup = {
            ...nextLineup,
            midfielderIds: [...nextLineup.midfielderIds, benchPlayerId]
          };
        } else if (incomingPlayer.position === "FWD") {
          nextLineup = {
            ...nextLineup,
            forwardIds: [...nextLineup.forwardIds, benchPlayerId]
          };
        }
      }

      const swapped = ensureLeadership({
        ...nextLineup,
        updatedAt: new Date().toISOString()
      });

      setLineup(swapped);
      setHasSubstitutionDraftChanges(true);
      setSubstitutionSourcePlayerId(null);
      setSelectedPlayerId(null);
      const sourceName = playersById.get(substitutionSourcePlayerId)?.name ?? "Player";
      const targetName = playersById.get(targetPlayerId)?.name ?? "Player";
      void appAlert.success("Substitution Applied", `${sourceName} swapped with ${targetName}.`);
      recenterToPitch();
    },
    [
      isSubstitutionAllowedForTargets,
      lineup,
      playersById,
      recenterToPitch,
      substitutionSourcePlayerId,
      substitutionSourceTarget
    ]
  );

  const selectedPlayerCanSubstitute = Boolean(
    mode === "PAT" &&
      selectedPlayer &&
      lineup &&
      selectedPlayerSubstitutionTargets.size > 0 &&
      substitutionSourcePlayerId !== selectedPlayer.id
  );
  const selectedPlayerIsSubstitutionSource = Boolean(
    selectedPlayer && substitutionSourcePlayerId === selectedPlayer.id
  );

  const selectedPlayerStats = useMemo(() => {
    if (!selectedPlayer) {
      return null;
    }

    const detailsPlayer = selectedPlayerDetails?.player;
    const detailsStats = selectedPlayerDetails?.statistics;
    const pointPerMatchFromSeason =
      detailsStats && detailsStats.appearances > 0
        ? (detailsStats.totalPoints / detailsStats.appearances).toFixed(2)
        : null;

    return {
      price: (detailsPlayer?.price ?? selectedPlayer.price).toFixed(1),
      pointPerMatch:
        pointPerMatchFromSeason ??
        (((detailsPlayer?.projectedPoints ?? selectedPlayer.projectedPoints) +
          (detailsPlayer?.form ?? selectedPlayer.form)) /
          2).toFixed(2),
      form: (detailsPlayer?.form ?? selectedPlayer.form).toFixed(1),
      selectedPercentage: `${toSelectedPercentage(selectedPlayer.id).toFixed(1)}%`
    };
  }, [selectedPlayer, selectedPlayerDetails]);

  const selectedPlayerProfileItems = useMemo(() => {
    if (!selectedPlayer) {
      return [];
    }

    const profile = selectedPlayerDetails?.player;
    const toValue = (value: string | number | undefined): string => {
      if (typeof value === "number") {
        return String(value);
      }

      const text = value?.trim() ?? "";
      return text || "-";
    };

    const items = [
      { label: "Player ID", value: selectedPlayer.id },
      { label: "Full Name", value: toValue(profile?.fullName ?? selectedPlayer.name) },
      { label: "Nationality", value: toValue(profile?.nationality) },
      { label: "Country of Birth", value: toValue(profile?.countryOfBirth) },
      { label: "Birth Date", value: toValue(profile?.birthDate) },
      { label: "Age", value: toValue(profile?.age) },
      { label: "Height", value: toValue(profile?.height) },
      { label: "Weight", value: toValue(profile?.weight) },
      { label: "Preferred Foot", value: toValue(profile?.preferredFoot) },
      { label: "Shirt Number", value: toValue(profile?.shirtNumber) },
      { label: "Market Value", value: toValue(profile?.marketValue) }
    ];

    const extra =
      selectedPlayerDetails?.extraInfo.map((entry) => ({
        label: entry.label,
        value: entry.value
      })) ?? [];

    return [...items, ...extra];
  }, [selectedPlayer, selectedPlayerDetails]);

  const selectedPlayerSeasonStats = useMemo(() => {
    const stats = selectedPlayerDetails?.statistics;
    if (!stats) {
      return [];
    }

    return [
      { label: "Appearances", value: String(stats.appearances) },
      { label: "Minutes Played", value: String(stats.minutesPlayed) },
      { label: "Goals", value: String(stats.goals) },
      { label: "Assists", value: String(stats.assists) },
      { label: "Clean Sheets", value: String(stats.cleanSheets) },
      { label: "Yellow Cards", value: String(stats.yellowCards) },
      { label: "Red Cards", value: String(stats.redCards) },
      { label: "Total Points", value: String(stats.totalPoints) }
    ];
  }, [selectedPlayerDetails]);

  const fixtureStrip = useMemo(() => {
    if (!selectedPlayer) {
      return [];
    }

    const baseGameweek =
      planningGameweek ??
      gameweek ??
      fixtures
        .map((fixture) => fixture.gameweek)
        .sort((left, right) => left - right)[0] ??
      1;

    const toLabel = (fixture: Fixture | undefined): string => {
      if (!fixture) {
        return "TBD";
      }

      if (fixture.homeTeam === selectedPlayer.club) {
        return `${fixture.awayTeam} (H)`;
      }

      if (fixture.awayTeam === selectedPlayer.club) {
        return `${fixture.homeTeam} (A)`;
      }

      return `${fixture.homeTeam} vs ${fixture.awayTeam}`;
    };

    return [-2, -1, 0, 1, 2].map((offset) => {
      const gw = baseGameweek + offset;
      const fixture =
        fixtures.find(
          (item) =>
            item.gameweek === gw &&
            (item.homeTeam === selectedPlayer.club || item.awayTeam === selectedPlayer.club)
        ) ?? fixtures.find((item) => item.gameweek === gw);
      const isDone = gw < baseGameweek;

      return {
        gw,
        label: toLabel(fixture),
        isCurrent: offset === 0,
        points: isDone ? simulatePastPoints(selectedPlayer, gw) : null
      };
    });
  }, [fixtures, gameweek, planningGameweek, selectedPlayer]);

  const patRows = useMemo<PitchRow[]>(() => {
    const lineupOutfieldCount = lineup
      ? lineup.defenderIds.filter(Boolean).length +
        lineup.midfielderIds.filter(Boolean).length +
        lineup.forwardIds.filter(Boolean).length
      : 0;

    if (!lineup) {
      return [
        { label: "GK", slots: 1, ids: [] },
        {
          label: "DEF",
          slots: PAT_MIN_SLOTS.DEF,
          ids: Array.from({ length: PAT_MIN_SLOTS.DEF }, () => "")
        },
        {
          label: "MID",
          slots: PAT_MIN_SLOTS.MID,
          ids: Array.from({ length: PAT_MIN_SLOTS.MID }, () => "")
        },
        {
          label: "FWD",
          slots: PAT_MIN_SLOTS.FWD,
          ids: Array.from({ length: PAT_MIN_SLOTS.FWD }, () => "")
        }
      ];
    }

    const defenderIds = buildFlexibleRowIds(
      lineup.defenderIds,
      PAT_MIN_SLOTS.DEF,
      PAT_MAX_SLOTS.DEF,
      lineupOutfieldCount
    );
    const midfielderIds = buildFlexibleRowIds(
      lineup.midfielderIds,
      PAT_MIN_SLOTS.MID,
      PAT_MAX_SLOTS.MID,
      lineupOutfieldCount
    );
    const forwardIds = buildFlexibleRowIds(
      lineup.forwardIds,
      PAT_MIN_SLOTS.FWD,
      PAT_MAX_SLOTS.FWD,
      lineupOutfieldCount
    );

    return [
      {
        label: "GK",
        slots: 1,
        ids: lineup.goalkeeperId ? [lineup.goalkeeperId] : []
      },
      {
        label: "DEF",
        slots: defenderIds.length,
        ids: defenderIds
      },
      {
        label: "MID",
        slots: midfielderIds.length,
        ids: midfielderIds
      },
      {
        label: "FWD",
        slots: forwardIds.length,
        ids: forwardIds
      }
    ];
  }, [lineup]);

  const trfRows = useMemo<PitchRow[]>(() => {
    const playersByPosition = {
      GK: sortByProjectedDesc(players.filter((player) => player.position === "GK")),
      DEF: sortByProjectedDesc(players.filter((player) => player.position === "DEF")),
      MID: sortByProjectedDesc(players.filter((player) => player.position === "MID")),
      FWD: sortByProjectedDesc(players.filter((player) => player.position === "FWD"))
    };

    const preferredOrder = squadIds
      .map((id) => playersById.get(id))
      .filter((player): player is Player => Boolean(player));

    const preferredByPosition = {
      GK: preferredOrder.filter((player) => player.position === "GK"),
      DEF: preferredOrder.filter((player) => player.position === "DEF"),
      MID: preferredOrder.filter((player) => player.position === "MID"),
      FWD: preferredOrder.filter((player) => player.position === "FWD")
    };

    const pickIds = (position: Position, slots: number): string[] => {
      const ids: string[] = [];

      for (const player of preferredByPosition[position]) {
        if (!ids.includes(player.id) && ids.length < slots) {
          ids.push(player.id);
        }
      }

      for (const player of playersByPosition[position]) {
        if (!ids.includes(player.id) && ids.length < slots) {
          ids.push(player.id);
        }
      }

      return ids;
    };

    return [
      { label: "GK", slots: TRF_SLOTS.GK, ids: pickIds("GK", TRF_SLOTS.GK) },
      { label: "DEF", slots: TRF_SLOTS.DEF, ids: pickIds("DEF", TRF_SLOTS.DEF) },
      { label: "MID", slots: TRF_SLOTS.MID, ids: pickIds("MID", TRF_SLOTS.MID) },
      { label: "FWD", slots: TRF_SLOTS.FWD, ids: pickIds("FWD", TRF_SLOTS.FWD) }
    ];
  }, [players, playersById, squadIds]);

  const resolveCardInteraction = useCallback(
    (playerId: string) => {
      const defaultInteraction = {
        disabled: false,
        visualState: null as CardVisualState,
        onClick: () => setSelectedPlayerId(playerId)
      };

      if (!substitutionSourcePlayerId || mode !== "PAT") {
        return defaultInteraction;
      }

      if (playerId === substitutionSourcePlayerId) {
        return {
          disabled: false,
          visualState: "source" as CardVisualState,
          onClick: () => setSubstitutionSourcePlayerId(null)
        };
      }

      if (substitutionTargetIds.has(playerId)) {
        return {
          disabled: false,
          visualState: "target" as CardVisualState,
          onClick: () => applySubstitution(playerId)
        };
      }

      return {
        disabled: true,
        visualState: null as CardVisualState,
        onClick: undefined
      };
    },
    [applySubstitution, mode, substitutionSourcePlayerId, substitutionTargetIds]
  );

  const renderPitchCard = (
    player: Player | null,
    isCaptain: boolean,
    isViceCaptain: boolean,
    emptyLabel: string,
    onEmptyClick?: () => void,
    options?: {
      onPlayerClick?: () => void;
      isDisabled?: boolean;
      visualState?: CardVisualState;
      disableEmpty?: boolean;
      pointsLabel?: string;
    }
  ) => {
    if (!player) {
      if (onEmptyClick && !options?.disableEmpty) {
	                return (
	                  <button
            type="button"
            className="fpl-player-card empty-slot player-card-button pick-slot-button"
            onClick={onEmptyClick}
          >
            <span>{`Pick ${emptyLabel}`}</span>
          </button>
        );
      }

      return (
        <div className={`fpl-player-card empty-slot ${options?.disableEmpty ? "empty-slot-disabled" : ""}`}>
          <span>{emptyLabel}</span>
        </div>
      );
    }

    const fixture = fixtureByTeam.get(player.club);
    const fixtureLabel = fixture
      ? fixture.homeTeam === player.club
        ? `${fixture.awayTeam} (H)`
        : `${fixture.homeTeam} (A)`
      : `GW ${planningGameweek ?? gameweek ?? "-"}`;
    const jerseyBackground = jerseyBackgroundFromColors(resolveJerseyColorPair(player, teamColorIndex));
    const jerseyNumber = jerseyNumberFromPlayer(player.id);

    return (
      <button
        type="button"
        className={`fpl-player-card player-card-button ${options?.visualState === "source" ? "player-card-source" : ""} ${
          options?.visualState === "target" ? "player-card-target" : ""
        } ${options?.isDisabled ? "player-card-disabled" : ""}`}
        onClick={options?.onPlayerClick}
        disabled={options?.isDisabled}
      >
        <div className="player-price-chip">£{player.price.toFixed(1)}m</div>
        <div className="shirt-holder">
          <div className="shirt" style={{ background: jerseyBackground }}>
            <span className="shirt-number">{jerseyNumber}</span>
          </div>
          {isCaptain ? <span className="armband captain">C</span> : null}
          {isViceCaptain ? <span className="armband vice">V</span> : null}
        </div>
        <div className="player-info-chip">
          <div className="player-name-chip" title={player.name}>{pitchDisplayName(player)}</div>
          <div className="player-fixture-chip">{fixtureLabel}</div>
          {options?.pointsLabel !== undefined ? (
            <div className="player-total-chip">{options.pointsLabel}</div>
          ) : null}
        </div>
      </button>
    );
  };

  const isTransferMode = mode === "TRF";

  const renderPitch = (
    rows: PitchRow[],
    showLeadershipBadges: boolean,
    allowSlotPicking: boolean
  ) => {
    return (
      <div className={`fpl-pitch-stage${isTransferMode ? " fpl-pitch-stage--trf" : ""}`}>
        <div className="pitch-top-boards">
          <div>Fantasy</div>
          <div>Fantasy</div>
        </div>

        <div className={`fpl-pitch${isTransferMode ? " fpl-pitch--trf" : ""}`}>
          <div className="pitch-lines">
            <div className="penalty-box" />
            <div className="center-circle" />
            <div className="half-line" />
          </div>

          {rows.map((row) => (
            <div
              key={row.label}
              className={`fpl-line${isTransferMode ? " fpl-line--trf" : ""}`}
              style={{ "--slot-count": row.slots } as CSSProperties}
            >
              {Array.from({ length: row.slots }).map((_, index) => {
                const playerId = row.ids[index];
                const player = playerId ? playersById.get(playerId) ?? null : null;
                const onEmptyClick =
                  allowSlotPicking && !player && !substitutionSourcePlayerId
                    ? () => {
                        setSelectedPlayerId(null);
                        openPlayerPicker({
                          zone: row.label,
                          index
                        });
                      }
                    : undefined;

                const isCaptain = showLeadershipBadges && Boolean(lineup && player && lineup.captainId === player.id);
                const isViceCaptain =
                  showLeadershipBadges && Boolean(lineup && player && lineup.viceCaptainId === player.id);
                const interaction = player ? resolveCardInteraction(player.id) : null;
                const pointsLabel = player && isReadOnlyPointsView ? resolvePlayerPointsLabel(player.id) : undefined;

                return (
                  <div key={`${row.label}-${index}`}>
                    {renderPitchCard(player, isCaptain, isViceCaptain, row.label, onEmptyClick, {
                      onPlayerClick: isReadOnlyPointsView ? undefined : interaction?.onClick,
                      isDisabled: isReadOnlyPointsView || interaction?.disabled,
                      visualState: interaction?.visualState ?? null,
                      disableEmpty: isReadOnlyPointsView || Boolean(substitutionSourcePlayerId),
                      pointsLabel
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const pointsViewTitle =
    pointsMetric === "average"
      ? t("team.pointsView.average")
      : pointsMetric === "highest"
        ? t("team.pointsView.highest")
        : t("team.pointsView.squad");
  const isReadOnlyPointsView = isPointsView && mode === "PAT";

  useEffect(() => {
    if (!isReadOnlyPointsView) {
      pointsViewCenteredKeyRef.current = "";
      return;
    }

    if (!lineup || isLeagueDataLoading || isPointsViewLoading) {
      return;
    }

    const viewKey = `${pointsMetric}:${pointsViewGameweek ?? "latest"}`;
    if (pointsViewCenteredKeyRef.current === viewKey) {
      return;
    }

    pointsViewCenteredKeyRef.current = viewKey;
    recenterToPitch();
  }, [
    isLeagueDataLoading,
    isPointsViewLoading,
    isReadOnlyPointsView,
    lineup,
    pointsMetric,
    pointsViewGameweek,
    recenterToPitch
  ]);

  const resolvePlayerPointsLabel = useCallback(
    (playerId: string): string => {
      const value = pointsByPlayerId[playerId];
      return `${Number.isFinite(value) ? value : 0} pts`;
    },
    [pointsByPlayerId]
  );
  const captainChecked = Boolean(selectedPlayer && lineup && lineup.captainId === selectedPlayer.id);
  const viceCaptainChecked = Boolean(selectedPlayer && lineup && lineup.viceCaptainId === selectedPlayer.id);

  const onCaptainChange = (checked: boolean) => {
    if (!selectedPlayer || !lineup || !selectedPlayerIsStarter) {
      return;
    }

    setLineup((previous) => {
      if (!previous) {
        return previous;
      }

      if (!checked) {
        return {
          ...previous,
          captainId: previous.captainId === selectedPlayer.id ? "" : previous.captainId
        };
      }

      return {
        ...previous,
        captainId: selectedPlayer.id,
        viceCaptainId:
          previous.viceCaptainId === selectedPlayer.id ? "" : previous.viceCaptainId
      };
    });
  };

  const onViceCaptainChange = (checked: boolean) => {
    if (!selectedPlayer || !lineup || !selectedPlayerIsStarter) {
      return;
    }

    setLineup((previous) => {
      if (!previous) {
        return previous;
      }

      if (!checked) {
        return {
          ...previous,
          viceCaptainId:
            previous.viceCaptainId === selectedPlayer.id ? "" : previous.viceCaptainId
        };
      }

      return {
        ...previous,
        viceCaptainId: selectedPlayer.id,
        captainId: previous.captainId === selectedPlayer.id ? "" : previous.captainId
      };
    });
  };

  const startSubstitutionFromSelectedPlayer = () => {
    if (!selectedPlayer || !lineup || mode !== "PAT") {
      return;
    }

    if (!selectedPlayerIsStarter && !selectedPlayerIsBench) {
      void appAlert.warning("Substitution", "Selected player is not part of this lineup.");
      return;
    }

    if (selectedPlayerSubstitutionTargets.size === 0) {
      void appAlert.warning(
        "Substitution",
        selectedPlayerIsBench
          ? "No valid starter can be swapped with this bench player."
          : "No valid bench player can replace this starter."
      );
      return;
    }

    setSubstitutionSourcePlayerId(selectedPlayer.id);
    setSelectedPlayerId(null);
    setIsFullProfileVisible(false);
    void appAlert.info(
      "Substitution Mode",
      selectedPlayerIsBench
        ? "Tap a highlighted starter on the field to swap."
        : "Tap a highlighted bench player to swap."
    );
    recenterToPitch();
  };

  const substitutionSourceName = substitutionSourcePlayerId
    ? playersById.get(substitutionSourcePlayerId)?.name ?? "selected player"
    : null;
  const substitutionTargetLabel =
    substitutionSourceTarget?.zone === "BENCH"
      ? t("team.substitution.target.starter")
      : t("team.substitution.target.bench");

  const hasPendingChanges = useMemo(() => {
    return JSON.stringify(toComparableLineup(lineup)) !== JSON.stringify(toComparableLineup(lastSavedLineup));
  }, [lastSavedLineup, lineup]);

  useEffect(() => {
    if (!hasPendingChanges) {
      setHasSubstitutionDraftChanges(false);
    }
  }, [hasPendingChanges]);

  const shouldShowBulkActions =
    mode === "PAT" && !isReadOnlyPointsView && (Boolean(substitutionSourcePlayerId) || hasSubstitutionDraftChanges);
  const isPickTeamLocked = mode === "PAT" && !isReadOnlyPointsView && Boolean(lockState?.locked);

  const onCancelBulkChanges = () => {
    if (!lastSavedLineup) {
      return;
    }

    setLineup(lastSavedLineup);
    setSelectedPlayerId(null);
    setSubstitutionSourcePlayerId(null);
    setHasSubstitutionDraftChanges(false);
    setIsFullProfileVisible(false);
    writeLineupDraft(lastSavedLineup, userScope);
    void appAlert.info("Draft Reset", "Reverted to the last saved lineup.");
  };

  const onSaveBulkChanges = async () => {
    if (!lineup || !selectedLeagueId) {
      return;
    }

    if (lockState?.locked) {
      const deadlineLabel = new Date(lockState.deadlineMs).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Jakarta"
      });
      void appAlert.warning(
        "Lineup Locked",
        `Pick Team for GW ${lockState.gameweek} is locked since ${deadlineLabel} WIB (2 hours before first kickoff).`
      );
      return;
    }

    if (!hasPendingChanges) {
      void appAlert.info("No Changes", "There are no pending lineup changes to save.");
      return;
    }

    if (players.length === 0) {
      void appAlert.warning("Save Failed", "Players data is not loaded yet.");
      return;
    }

    setIsSavingLineup(true);
    try {
      const squadReady = await syncSquadFromLineup(lineup);
      if (!squadReady) {
        return;
      }

      let saved: TeamLineup;
      try {
        saved = await saveLineup.execute(lineup, players, session?.accessToken ?? "");
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        const shouldRetryWithSquadSync =
          message.includes("must pick fantasy squad before saving lineup") ||
          message.includes("not part of user fantasy squad");

        if (!shouldRetryWithSquadSync) {
          throw error;
        }

        const retryReady = await syncSquadFromLineup(lineup, true);
        if (!retryReady) {
          return;
        }

        saved = await saveLineup.execute(lineup, players, session?.accessToken ?? "");
      }
      const normalizedSaved = normalizeLineup(selectedLeagueId, saved);
      invalidateCached(cacheKeys.lineup(userScope, selectedLeagueId));
      setLineup(normalizedSaved);
      setLastSavedLineup(normalizedSaved);
      setSelectedPlayerId(null);
      setSubstitutionSourcePlayerId(null);
      setHasSubstitutionDraftChanges(false);
      setIsFullProfileVisible(false);
      writeLineupDraft(normalizedSaved, userScope);
      void appAlert.success("Lineup Saved", "Your Pick Team changes were saved.");
    } catch (error) {
      if (isUnauthorizedError(error)) {
        await forceLogout("Your session has expired. Please sign in again.");
        return;
      }

      void appAlert.error("Save Failed", error instanceof Error ? error.message : "Unable to save lineup.");
    } finally {
      setIsSavingLineup(false);
    }
  };

  if (isLeagueDataLoading) {
    return (
      <div className={`page-grid team-builder-page${isReadOnlyPointsView ? " team-builder-page--points-view" : ""}`}>
        <Card className="card">
          <LoadingState label="Loading team data" />
        </Card>
      </div>
    );
  }

  return (
    <div className={`page-grid team-builder-page${isReadOnlyPointsView ? " team-builder-page--points-view" : ""}`}>
      {mode === "PAT" && isReadOnlyPointsView ? (
        <Card className="card">
          <div className="team-points-view-banner">
            <div>
              <strong>
                {pointsViewTitle}
                {pointsViewGameweek ? ` • GW ${pointsViewGameweek}` : ""}
              </strong>
              <p>
                {t("team.pointsView.total", { points: pointsViewTotal ?? "-" })}
                {isPointsViewLoading ? ` • ${t("team.pointsView.loading")}` : ""}
              </p>
              {pointsMetric === "highest" && pointsViewTopUserId ? (
                <p>{t("team.pointsView.topUser", { user: pointsViewTopUserId })}</p>
              ) : null}
              {pointsViewNotice ? <p>{pointsViewNotice}</p> : null}
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => navigate("/pick-team", { replace: true })}
            >
              {t("team.pointsView.back")}
            </Button>
          </div>
        </Card>
      ) : null}

      {!isReadOnlyPointsView ? (
        <Card className="card team-chip-box">
          {mode === "PAT" ? (
            <div className="team-pat-inline" aria-label={t("team.chips.pickTeamAria")}>
              <div className="team-pat-inline-item">
                <p className="small-label">{t("team.chips.wildcard")}</p>
                <strong>{t("team.chips.available")}</strong>
              </div>
              <div className="team-pat-inline-item">
                <p className="small-label">{t("team.chips.tripleCaptain")}</p>
                <strong>{t("team.chips.available")}</strong>
              </div>
              <div className="team-pat-inline-item">
                <p className="small-label">{t("team.chips.freeHit")}</p>
                <strong>{t("team.chips.available")}</strong>
              </div>
              <div className="team-pat-inline-item">
                <p className="small-label">{t("team.chips.benchBoost")}</p>
                <strong>{t("team.chips.available")}</strong>
              </div>
            </div>
          ) : (
            <div className="team-trf-inline" aria-label={t("team.chips.transfersAria")}>
              <div className="team-trf-inline-item">
                <p className="small-label">{t("team.chips.freeTrf")}</p>
                <strong>1</strong>
              </div>
              <div className="team-trf-inline-item">
                <p className="small-label">{t("team.chips.pointCost")}</p>
                <strong>0 pts</strong>
              </div>
              <div className="team-trf-inline-item">
                <p className="small-label">{t("team.chips.budget")}</p>
                <strong>£{Math.max(0, 100 - squadCost).toFixed(1)}</strong>
              </div>
              <div className="team-trf-inline-item">
                <p className="small-label">{t("team.chips.wildcard")}</p>
                <strong>{t("team.chips.available")}</strong>
              </div>
              <div className="team-trf-inline-item">
                <p className="small-label">{t("team.chips.freeHit")}</p>
                <strong>{t("team.chips.available")}</strong>
              </div>
            </div>
          )}
        </Card>
      ) : null}

      <Card ref={pitchBoardRef} className={`fpl-board card${isTransferMode ? " fpl-board--trf" : ""}`}>
        {isPickTeamLocked ? (
          <div className="substitution-banner">
            <p>
              {`GW ${lockState?.gameweek ?? "-"} is locked. Pick Team deadline is 2 hours before first kickoff.`}
            </p>
          </div>
        ) : null}

        {shouldShowBulkActions ? (
          <div className="pick-team-bulk-actions">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="pick-team-bulk-btn"
              onClick={onCancelBulkChanges}
              disabled={!lastSavedLineup || !hasPendingChanges || isSavingLineup}
            >
              {t("team.bulk.cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              className="pick-team-bulk-btn"
              onClick={() => void onSaveBulkChanges()}
              disabled={!lastSavedLineup || !hasPendingChanges || isSavingLineup || isLeagueDataLoading || isPickTeamLocked}
            >
              {isSavingLineup ? t("team.bulk.saving") : t("team.bulk.save")}
            </Button>
          </div>
        ) : null}

        {substitutionSourcePlayerId && mode === "PAT" && !isReadOnlyPointsView ? (
          <div className="substitution-banner">
            <p>
              {t("team.substitution.banner", {
                source: substitutionSourceName ?? "-",
                target: substitutionTargetLabel
              })}
            </p>
          </div>
        ) : null}

        {mode === "PAT"
          ? renderPitch(patRows, true, !isReadOnlyPointsView)
          : renderPitch(trfRows, false, false)}

        {mode === "PAT" ? (
          <div className="fpl-bench">
            <p className="small-label">{t("team.bench.title")}</p>
            <div className="bench-grid">
              {Array.from({ length: SUBSTITUTE_SIZE }).map((_, index) => {
                const playerId = lineup?.substituteIds[index];
                const player = playerId ? playersById.get(playerId) : null;
                const benchPosition = requiredBenchSlots[index] ?? "BENCH";
                const interaction = player ? resolveCardInteraction(player.id) : null;

                if (!player) {
                  return (
                    <button
                      key={`bench-${index}`}
                      type="button"
                      className={`bench-card empty-slot player-card-button pick-slot-button ${
                        substitutionSourcePlayerId || isReadOnlyPointsView ? "empty-slot-disabled" : ""
                      }`}
                      disabled={Boolean(substitutionSourcePlayerId) || isReadOnlyPointsView}
                      onClick={() => {
                        if (isReadOnlyPointsView) {
                          return;
                        }
                        setSelectedPlayerId(null);
                        openPlayerPicker({
                          zone: "BENCH",
                          index
                        });
                      }}
                    >
                      {t("team.pickSlot", { slot: benchPosition })}
                    </button>
                  );
                }

                return (
                  <button
                    key={player.id}
                    type="button"
                    className={`bench-card player-card-button ${
                      interaction?.visualState === "source" ? "player-card-source" : ""
                    } ${interaction?.visualState === "target" ? "player-card-target" : ""} ${
                      interaction?.disabled || isReadOnlyPointsView ? "player-card-disabled" : ""
                    }`}
                    onClick={isReadOnlyPointsView ? undefined : interaction?.onClick}
                    disabled={interaction?.disabled || isReadOnlyPointsView}
	                  >
	                    <div className="player-price-chip">£{player.price.toFixed(1)}m</div>
	                    <div className="shirt-holder">
	                      <div
	                        className="shirt"
	                        style={{
	                          background: jerseyBackgroundFromColors(resolveJerseyColorPair(player, teamColorIndex))
	                        }}
	                      >
	                        <span className="shirt-number">{jerseyNumberFromPlayer(player.id)}</span>
	                      </div>
	                    </div>
	                    <div className="player-info-chip">
	                      <div className="player-name-chip" title={player.name}>{pitchDisplayName(player)}</div>
                      <div className="player-fixture-chip">{t("team.bench.position", { position: player.position })}</div>
                      {isReadOnlyPointsView ? (
                        <div className="player-total-chip">{resolvePlayerPointsLabel(player.id)}</div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </Card>

      <AnimatePresence>
        {selectedPlayer ? (
          <motion.div
            className="player-modal-overlay"
            onClick={() => setSelectedPlayerId(null)}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: "easeOut" }}
          >
            <motion.div
              onClick={(event) => event.stopPropagation()}
              initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.985 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 360, damping: 32, mass: 0.9 }
              }
            >
              <Card className="player-modal card">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="player-modal-close"
              onClick={() => setSelectedPlayerId(null)}
            >
	              {t("team.modal.close")}
	            </Button>

            <div className="player-modal-hero">
              <div className="player-portrait">
                {normalizeUrl(selectedPlayerDetails?.player.imageUrl ?? selectedPlayer.imageUrl) ? (
                  <LazyImage
                    src={normalizeUrl(selectedPlayerDetails?.player.imageUrl ?? selectedPlayer.imageUrl) ?? ""}
                    alt={selectedPlayerDetails?.player.name ?? selectedPlayer.name}
                    className="player-portrait-photo"
                    fallback={
                      <>
                        <span className="player-portrait-head" />
                        <span
                          className="player-portrait-body"
                          style={{
                            background: jerseyBackgroundFromColors(
                              selectedPlayerDetails?.player.teamColor && selectedPlayerDetails.player.teamColor.length >= 2
                                ? [
                                    selectedPlayerDetails.player.teamColor[0],
                                    selectedPlayerDetails.player.teamColor[1]
                                  ]
                                : resolveJerseyColorPair(selectedPlayer, teamColorIndex)
                            )
                          }}
                        />
                      </>
                    }
                  />
                ) : (
                  <>
                    <span className="player-portrait-head" />
	                    <span
	                      className="player-portrait-body"
	                      style={{
	                        background: jerseyBackgroundFromColors(
	                          selectedPlayerDetails?.player.teamColor && selectedPlayerDetails.player.teamColor.length >= 2
	                            ? [
	                                selectedPlayerDetails.player.teamColor[0],
	                                selectedPlayerDetails.player.teamColor[1]
	                              ]
	                            : resolveJerseyColorPair(selectedPlayer, teamColorIndex)
	                        )
	                      }}
	                    />
	                  </>
                )}
              </div>

              <div className="player-hero-text">
                <h3>{selectedPlayerDetails?.player.fullName ?? selectedPlayerDetails?.player.name ?? selectedPlayer.name}</h3>
                <p>{selectedPlayerDetails?.player.position ?? selectedPlayer.position}</p>
                <p>{selectedPlayerDetails?.player.club ?? selectedPlayer.club}</p>
                <div className="player-hero-urls">
                  <div className="media-line">
                    {normalizeUrl(selectedPlayerDetails?.player.teamLogoUrl ?? selectedPlayer.teamLogoUrl) ? (
                      <LazyImage
                        src={normalizeUrl(selectedPlayerDetails?.player.teamLogoUrl ?? selectedPlayer.teamLogoUrl) ?? ""}
                        alt={selectedPlayerDetails?.player.club ?? selectedPlayer.club}
                        className="media-thumb media-thumb-small"
                        fallback={
                          <span className="media-thumb media-thumb-small media-thumb-fallback" aria-hidden="true">
                            T
                          </span>
                        }
                      />
                    ) : (
                      <span className="media-thumb media-thumb-small media-thumb-fallback" aria-hidden="true">
                        T
                      </span>
                    )}
                  </div>
                  <div className="media-line">
                    {normalizeUrl(selectedPlayerDetails?.player.imageUrl ?? selectedPlayer.imageUrl) ? (
                      <LazyImage
                        src={normalizeUrl(selectedPlayerDetails?.player.imageUrl ?? selectedPlayer.imageUrl) ?? ""}
                        alt={selectedPlayerDetails?.player.name ?? selectedPlayer.name}
                        className="media-thumb media-thumb-small"
                        fallback={
                          <span className="media-thumb media-thumb-small media-thumb-fallback" aria-hidden="true">
                            P
                          </span>
                        }
                      />
                    ) : (
                      <span className="media-thumb media-thumb-small media-thumb-fallback" aria-hidden="true">
                        P
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {isSelectedPlayerDetailsLoading ? (
	              <LoadingState label={t("team.modal.loadingDetails")} inline compact />
	            ) : null}

            <div className="player-modal-stats">
              <article className="modal-stat-card">
	                <p>{t("team.modal.price")}</p>
	                <strong>£{selectedPlayerStats?.price ?? "-"}</strong>
	              </article>
	              <article className="modal-stat-card">
	                <p>{t("team.modal.pointPerMatch")}</p>
	                <strong>{selectedPlayerStats?.pointPerMatch ?? "-"}</strong>
	              </article>
	              <article className="modal-stat-card">
	                <p>{t("team.modal.form")}</p>
	                <strong>{selectedPlayerStats?.form ?? "-"}</strong>
	              </article>
	              <article className="modal-stat-card">
	                <p>{t("team.modal.selected")}</p>
	                <strong>{selectedPlayerStats?.selectedPercentage ?? "-"}</strong>
	              </article>
            </div>

            {isFullProfileVisible ? (
              <>
                <div className="player-modal-fixtures">
	                  <h4>{t("team.modal.backendProfile")}</h4>
                  <div className="player-modal-profile-grid">
                    {selectedPlayerProfileItems.map((item) => (
                      <article key={`profile-${item.label}`} className="modal-stat-card">
                        <p>{item.label}</p>
                        <strong>{item.value}</strong>
                      </article>
                    ))}
                  </div>
                </div>

                {selectedPlayerSeasonStats.length > 0 ? (
                  <div className="player-modal-fixtures">
	                    <h4>{t("team.modal.backendSeasonStats")}</h4>
                    <div className="player-modal-profile-grid">
                      {selectedPlayerSeasonStats.map((item) => (
                        <article key={`season-${item.label}`} className="modal-stat-card">
                          <p>{item.label}</p>
                          <strong>{item.value}</strong>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedPlayerDetails?.history && selectedPlayerDetails.history.length > 0 ? (
                  <div className="player-modal-fixtures">
	                    <h4>{t("team.modal.backendRecentMatches")}</h4>
                    <div className="fixture-strip">
                      {selectedPlayerDetails.history.slice(0, 5).map((item) => (
                        <article key={`history-${item.fixtureId}-${item.gameweek}`} className="fixture-pill">
	                          <p>{t("dashboard.gwLabel", { gameweek: item.gameweek })}</p>
	                          <strong>
	                            {item.opponent} ({item.homeAway === "home" ? t("team.modal.homeShort") : t("team.modal.awayShort")})
	                          </strong>
	                          <span>{item.points} pts</span>
	                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
	              <p className="muted">{t("team.modal.profileHint")}</p>
	            )}

	            <div className="player-modal-fixtures">
	              <h4>{t("team.modal.incomingFixtures")}</h4>
              <div className="fixture-strip">
                {fixtureStrip.map((item) => (
                  <article
                    key={`gw-${item.gw}`}
                    className={`fixture-pill ${item.isCurrent ? "current" : ""}`}
                  >
	                    <p>{t("dashboard.gwLabel", { gameweek: item.gw })}</p>
                    <strong>{item.label}</strong>
                    <span>
                      {item.points !== null ? `${item.points.toFixed(1)} pts` : "-"}
                    </span>
                  </article>
                ))}
              </div>
            </div>

            <div className="player-modal-leadership">
              <label>
                <input
                  type="checkbox"
                  checked={captainChecked}
                  disabled={!selectedPlayerIsStarter}
                  onChange={(event) => onCaptainChange(event.target.checked)}
                />
	                {t("team.modal.captain")}
	              </label>

              <label>
                <input
                  type="checkbox"
                  checked={viceCaptainChecked}
                  disabled={!selectedPlayerIsStarter}
                  onChange={(event) => onViceCaptainChange(event.target.checked)}
                />
	                {t("team.modal.viceCaptain")}
	              </label>
            </div>

            {selectedPlayerIsBench ? (
	              <p className="muted">{t("team.modal.captainNotice")}</p>
	            ) : null}

            <div className="player-modal-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsFullProfileVisible((previous) => !previous)}
              >
	                {isFullProfileVisible ? t("team.modal.hideFullProfile") : t("team.modal.fullProfile")}
	              </Button>
              <Button
                type="button"
                onClick={startSubstitutionFromSelectedPlayer}
                disabled={!selectedPlayerCanSubstitute}
              >
	                {selectedPlayerIsSubstitutionSource ? t("team.modal.substitutionActive") : t("team.modal.substitutes")}
	              </Button>
            </div>
              </Card>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
