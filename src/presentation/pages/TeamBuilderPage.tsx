import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftRight, Clock3, Pickaxe, Sparkles, Trophy } from "lucide-react";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import { cacheKeys, cacheTtlMs, getOrLoadCached, peekCached } from "../../app/cache/requestCache";
import type { Player } from "../../domain/fantasy/entities/Player";
import type { PlayerDetails } from "../../domain/fantasy/entities/PlayerDetails";
import type { TeamLineup } from "../../domain/fantasy/entities/Team";
import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import { SUBSTITUTE_SIZE } from "../../domain/fantasy/services/lineupRules";
import { buildLineupFromPlayers } from "../../domain/fantasy/services/squadBuilder";
import { LoadingState } from "../components/LoadingState";
import { useSession } from "../hooks/useSession";
import { useLeagueSelection } from "../hooks/useLeagueSelection";
import { appAlert } from "../lib/appAlert";
import { HttpError } from "../../infrastructure/http/httpClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  consumePickerResult,
  readLineupDraft,
  savePickerContext,
  writeLineupDraft,
  type SlotPickerTarget
} from "./teamPickerStorage";

type TeamMode = "PAT" | "TRF";
type Position = Player["position"];

type PitchRow = {
  label: Position;
  slots: number;
  ids: string[];
};

const PAT_DEFAULT_SLOTS = {
  DEF: 4,
  MID: 4,
  FWD: 2
} as const;

const TRF_SLOTS = {
  GK: 2,
  DEF: 5,
  MID: 5,
  FWD: 3
} as const;

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

const assignAt = (ids: string[], index: number, value: string): string[] => {
  const next = [...ids];
  while (next.length <= index) {
    next.push("");
  }
  next[index] = value;
  return next;
};

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
        defenderIds: assignAt(lineup.defenderIds, target.index, playerId)
      };
    case "MID":
      return {
        ...lineup,
        midfielderIds: assignAt(lineup.midfielderIds, target.index, playerId)
      };
    case "FWD":
      return {
        ...lineup,
        forwardIds: assignAt(lineup.forwardIds, target.index, playerId)
      };
    case "BENCH":
      return {
        ...lineup,
        substituteIds: assignAt(lineup.substituteIds, target.index, playerId)
      };
  }
};

const getStarterIds = (lineup: TeamLineup): string[] => {
  return [lineup.goalkeeperId, ...lineup.defenderIds, ...lineup.midfielderIds, ...lineup.forwardIds].filter(Boolean);
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
    substituteIds: (lineup.substituteIds ?? []).slice(0, SUBSTITUTE_SIZE)
  });
};

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

const formatDeadline = (date: string | null): string => {
  if (!date) {
    return "-";
  }

  return new Date(date).toLocaleString("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
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

export const TeamBuilderPage = () => {
  const navigate = useNavigate();
  const { getPlayers, getPlayerDetails, getLineup, getDashboard, getFixtures, getMySquad, logout } = useContainer();
  const { leagues, selectedLeagueId, setSelectedLeagueId } = useLeagueSelection();
  const { session, setSession } = useSession();
  const userScope = session?.user.id ?? "";
  const logoutInProgressRef = useRef(false);
  const pitchBoardRef = useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = useState<TeamMode>("PAT");
  const [players, setPlayers] = useState<Player[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [lineup, setLineup] = useState<TeamLineup | null>(null);
  const [gameweek, setGameweek] = useState<number | null>(null);
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isLeagueDataLoading, setIsLeagueDataLoading] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedPlayerDetails, setSelectedPlayerDetails] = useState<PlayerDetails | null>(null);
  const [isSelectedPlayerDetailsLoading, setIsSelectedPlayerDetailsLoading] = useState(false);

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

  useEffect(() => {
    let mounted = true;

    const loadHeader = async () => {
      try {
        const dashboard = await withRetry(
          () =>
            getOrLoadCached({
              key: cacheKeys.dashboard(),
              ttlMs: cacheTtlMs.dashboard,
              loader: () => getDashboard.execute(),
              allowStaleOnError: true
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

        const message =
          error instanceof Error ? error.message : "Failed to load dashboard.";
        setInfoMessage(`Header fallback: ${message}`);
      }
    };

    void loadHeader();

    return () => {
      mounted = false;
    };
  }, [getDashboard]);

  useEffect(() => {
    if (!selectedLeagueId) {
      return;
    }

    let mounted = true;

    const optimisticPlayers = peekCached<Player[]>(cacheKeys.players(selectedLeagueId), true) ?? [];
    const optimisticFixtures = peekCached<Fixture[]>(cacheKeys.fixtures(selectedLeagueId), true) ?? [];
    const optimisticDraft = readLineupDraft(selectedLeagueId, userScope);
    const optimisticLineup = optimisticDraft ? normalizeLineup(selectedLeagueId, optimisticDraft) : null;

    if (optimisticPlayers.length > 0) {
      setPlayers(optimisticPlayers);
    }

    if (optimisticFixtures.length > 0) {
      setFixtures(optimisticFixtures);
    }

    if (optimisticLineup) {
      setLineup(optimisticLineup);
    }

    const loadLeagueData = async () => {
      const shouldShowBlockingLoader = optimisticPlayers.length === 0 && !optimisticLineup;
      setIsLeagueDataLoading(shouldShowBlockingLoader);

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
                  allowStaleOnError: true,
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

        const [lineupResultRaw, fixturesResultRaw] = await Promise.allSettled([
          getLineup.execute(selectedLeagueId),
          getOrLoadCached({
            key: cacheKeys.fixtures(selectedLeagueId),
            ttlMs: cacheTtlMs.fixtures,
            loader: () => getFixtures.execute(selectedLeagueId),
            allowStaleOnError: true
          })
        ]);

        if (!mounted) {
          return;
        }

        const playersResult = playersResultRaw;
        let infoToShow: string | null = null;
        let loadErrorToShow: string | null = null;
        let shouldRecenterPitch = false;

        const lineupResult =
          lineupResultRaw.status === "fulfilled" ? lineupResultRaw.value : null;
        const fixturesResult =
          fixturesResultRaw.status === "fulfilled" ? fixturesResultRaw.value : [];

        setPlayers(playersResult);
        setFixtures(fixturesResult);

        let resolvedLineup = lineupResult;

        if (!resolvedLineup && playersResult.length > 0) {
          const accessToken = session?.accessToken?.trim() ?? "";

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

        let normalized = normalizeLineup(selectedLeagueId, resolvedLineup);
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
        writeLineupDraft(normalized, userScope);
        setSelectedPlayerId(null);
        if (shouldRecenterPitch) {
          recenterToPitch();
        }

        const nearestKickoff = [...fixturesResult]
          .sort((left, right) => new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime())[0]?.kickoffAt ?? null;

        setDeadlineAt(nearestKickoff);
        if (fixturesResult[0]?.gameweek) {
          setGameweek(fixturesResult[0].gameweek);
        }

        if (lineupResultRaw.status === "rejected") {
          const message =
            lineupResultRaw.reason instanceof Error
              ? lineupResultRaw.reason.message
              : "Failed to load lineup.";
          loadErrorToShow = loadErrorToShow ?? `Lineup request failed (${message}).`;
        }

        if (fixturesResultRaw.status === "rejected") {
          const message =
            fixturesResultRaw.reason instanceof Error
              ? fixturesResultRaw.reason.message
              : "Failed to load fixtures.";
          loadErrorToShow = loadErrorToShow ?? `Fixtures request failed (${message}).`;
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
  }, [forceLogout, getFixtures, getLineup, getMySquad, getPlayers, recenterToPitch, selectedLeagueId, session?.accessToken, userScope]);

  useEffect(() => {
    if (!lineup) {
      return;
    }

    writeLineupDraft(lineup, userScope);
  }, [lineup, userScope]);

  const starterIds = useMemo(() => (lineup ? getStarterIds(lineup) : []), [lineup]);

  const squadIds = useMemo(() => {
    if (!lineup) {
      return [];
    }

    return [...new Set([...starterIds, ...lineup.substituteIds])];
  }, [lineup, starterIds]);

  const squadPlayers = useMemo(() => {
    return squadIds
      .map((id) => playersById.get(id))
      .filter((player): player is Player => Boolean(player));
  }, [playersById, squadIds]);

  const squadCost = useMemo(() => {
    return squadPlayers.reduce((sum, player) => sum + player.price, 0);
  }, [squadPlayers]);

  const fixtureByTeam = useMemo(() => {
    const map = new Map<string, Fixture>();
    const sorted = [...fixtures].sort(
      (left, right) => new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime()
    );

    for (const fixture of sorted) {
      if (!map.has(fixture.homeTeam)) {
        map.set(fixture.homeTeam, fixture);
      }

      if (!map.has(fixture.awayTeam)) {
        map.set(fixture.awayTeam, fixture);
      }
    }

    return map;
  }, [fixtures]);

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

      try {
        const details = await getOrLoadCached({
          key: cacheKeys.playerDetails(selectedLeagueId, selectedPlayer.id),
          ttlMs: cacheTtlMs.playerDetails,
          loader: () => getPlayerDetails.execute(selectedLeagueId, selectedPlayer.id),
          allowStaleOnError: true
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

    savePickerContext(
      {
        leagueId: selectedLeagueId,
        target,
        lineup
      },
      userScope
    );

    const params = new URLSearchParams({
      leagueId: selectedLeagueId,
      zone: target.zone,
      index: String(target.index)
    });

    navigate(`/team/pick?${params.toString()}`);
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
      const fixture = fixtures.find((item) => item.gameweek === gw);
      const isDone = gw < baseGameweek;

      return {
        gw,
        label: toLabel(fixture),
        isCurrent: offset === 0,
        points: isDone ? simulatePastPoints(selectedPlayer, gw) : null
      };
    });
  }, [fixtures, gameweek, selectedPlayer]);

  const patRows = useMemo<PitchRow[]>(() => {
    if (!lineup) {
      return [
        { label: "GK", slots: 1, ids: [] },
        { label: "DEF", slots: PAT_DEFAULT_SLOTS.DEF, ids: [] },
        { label: "MID", slots: PAT_DEFAULT_SLOTS.MID, ids: [] },
        { label: "FWD", slots: PAT_DEFAULT_SLOTS.FWD, ids: [] }
      ];
    }

    return [
      {
        label: "GK",
        slots: 1,
        ids: lineup.goalkeeperId ? [lineup.goalkeeperId] : []
      },
      {
        label: "DEF",
        slots: Math.max(PAT_DEFAULT_SLOTS.DEF, lineup.defenderIds.length),
        ids: lineup.defenderIds
      },
      {
        label: "MID",
        slots: Math.max(PAT_DEFAULT_SLOTS.MID, lineup.midfielderIds.length),
        ids: lineup.midfielderIds
      },
      {
        label: "FWD",
        slots: Math.max(PAT_DEFAULT_SLOTS.FWD, lineup.forwardIds.length),
        ids: lineup.forwardIds
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

  const renderPitchCard = (
    player: Player | null,
    isCaptain: boolean,
    isViceCaptain: boolean,
    emptyLabel: string,
    onEmptyClick?: () => void
  ) => {
    if (!player) {
      if (onEmptyClick) {
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
        <div className="fpl-player-card empty-slot">
          <span>{emptyLabel}</span>
        </div>
      );
    }

    const fixture = fixtureByTeam.get(player.club);
    const fixtureLabel = fixture
      ? fixture.homeTeam === player.club
        ? `${fixture.awayTeam} (H)`
        : `${fixture.homeTeam} (A)`
      : `GW ${gameweek ?? "-"}`;

    return (
      <button
        type="button"
        className="fpl-player-card player-card-button"
        onClick={() => setSelectedPlayerId(player.id)}
      >
        <div className="player-price-chip">£{player.price.toFixed(1)}m</div>
        <div className="shirt-holder">
          <div className="shirt" style={{ background: shirtBackgroundForClub(player.club) }} />
          {isCaptain ? <span className="armband captain">C</span> : null}
          {isViceCaptain ? <span className="armband vice">V</span> : null}
        </div>
        <div className="player-info-chip">
          <div className="player-name-chip">{shortName(player.name)}</div>
          <div className="player-fixture-chip">{fixtureLabel}</div>
        </div>
      </button>
    );
  };

  const renderPitch = (
    rows: PitchRow[],
    showLeadershipBadges: boolean,
    allowSlotPicking: boolean
  ) => {
    return (
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

          {rows.map((row) => (
            <div key={row.label} className="fpl-line" style={{ "--slot-count": row.slots } as CSSProperties}>
              {Array.from({ length: row.slots }).map((_, index) => {
                const playerId = row.ids[index];
                const player = playerId ? playersById.get(playerId) ?? null : null;
                const onEmptyClick =
                  allowSlotPicking && !player
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

                return (
                  <div key={`${row.label}-${index}`}>
                    {renderPitchCard(player, isCaptain, isViceCaptain, row.label, onEmptyClick)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const selectedLeagueName = leagues.find((league) => league.id === selectedLeagueId)?.name ?? "-";
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

  return (
    <div className="page-grid team-builder-page">
      <section className="section-title">
        <h2 className="section-icon-title">
          <Trophy className="inline-icon" aria-hidden="true" />
          Team Builder
        </h2>
        <p className="muted">Choose mode: Pick Team or Transfers.</p>
      </section>

      <Card className="card team-header-box">
        <div className="mode-switch">
          <Button
            type="button"
            variant={mode === "PAT" ? "default" : "secondary"}
            className={`mode-button ${mode === "PAT" ? "active" : ""}`}
            onClick={() => setMode("PAT")}
          >
            <Pickaxe className="mode-icon" aria-hidden="true" />
            Pick Team
          </Button>
          <Button
            type="button"
            variant={mode === "TRF" ? "default" : "secondary"}
            className={`mode-button ${mode === "TRF" ? "active" : ""}`}
            onClick={() => setMode("TRF")}
          >
            <ArrowLeftRight className="mode-icon" aria-hidden="true" />
            Transfers
          </Button>
        </div>

        <div>
          <label>
            League
            <Select
              value={selectedLeagueId}
              onChange={(event) => setSelectedLeagueId(event.target.value)}
            >
              {leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div className="team-meta-grid">
          <article className="team-meta-item">
            <p className="small-label">League</p>
            <strong>{selectedLeagueName}</strong>
          </article>
          <article className="team-meta-item">
            <p className="small-label">Gameweek</p>
            <strong>{gameweek ?? "-"}</strong>
          </article>
          <article className="team-meta-item">
            <p className="small-label">Deadline Transfers</p>
            <strong>{formatDeadline(deadlineAt)}</strong>
          </article>
        </div>

        {isLeagueDataLoading ? <LoadingState label="Loading latest team data" inline compact /> : null}
      </Card>

      <Card className="card team-chip-box">
        {mode === "PAT" ? (
          <div className="chips-grid chips-grid-4">
            <article className="chip-card">
              <p className="chip-card-label">
                <Sparkles className="inline-icon" aria-hidden="true" />
                Wildcard
              </p>
              <strong>Available</strong>
            </article>
            <article className="chip-card">
              <p className="chip-card-label">
                <Sparkles className="inline-icon" aria-hidden="true" />
                Triple Captain
              </p>
              <strong>Available</strong>
            </article>
            <article className="chip-card">
              <p className="chip-card-label">
                <Sparkles className="inline-icon" aria-hidden="true" />
                Free Hit
              </p>
              <strong>Available</strong>
            </article>
            <article className="chip-card">
              <p className="chip-card-label">
                <Sparkles className="inline-icon" aria-hidden="true" />
                Bench Boost
              </p>
              <strong>Available</strong>
            </article>
          </div>
        ) : (
          <div className="chips-grid chips-grid-6">
            <article className="chip-card">
              <p className="chip-card-label">
                <Sparkles className="inline-icon" aria-hidden="true" />
                Budget
              </p>
              <strong>£{Math.max(0, 100 - squadCost).toFixed(1)}</strong>
            </article>
            <article className="chip-card">
              <p className="chip-card-label">
                <Clock3 className="inline-icon" aria-hidden="true" />
                Point Cost
              </p>
              <strong>0 pts</strong>
            </article>
            <article className="chip-card">
              <p className="chip-card-label">
                <Sparkles className="inline-icon" aria-hidden="true" />
                Wildcard
              </p>
              <strong>Available</strong>
            </article>
            <article className="chip-card">
              <p className="chip-card-label">
                <Sparkles className="inline-icon" aria-hidden="true" />
                Triple Captain
              </p>
              <strong>Available</strong>
            </article>
            <article className="chip-card">
              <p className="chip-card-label">
                <Sparkles className="inline-icon" aria-hidden="true" />
                Free Hit
              </p>
              <strong>Available</strong>
            </article>
            <article className="chip-card">
              <p className="chip-card-label">
                <Sparkles className="inline-icon" aria-hidden="true" />
                Bench Boost
              </p>
              <strong>Available</strong>
            </article>
          </div>
        )}
      </Card>

      <Card ref={pitchBoardRef} className="fpl-board card">
        {mode === "PAT" ? renderPitch(patRows, true, true) : renderPitch(trfRows, false, false)}

        {mode === "PAT" ? (
          <div className="fpl-bench">
            <p className="small-label">Substitutes</p>
            <div className="bench-grid">
              {Array.from({ length: SUBSTITUTE_SIZE }).map((_, index) => {
                const playerId = lineup?.substituteIds[index];
                const player = playerId ? playersById.get(playerId) : null;

                if (!player) {
                  return (
                    <button
                      key={`bench-${index}`}
                      type="button"
                      className="bench-card empty-slot player-card-button pick-slot-button"
                      onClick={() => {
                        setSelectedPlayerId(null);
                        openPlayerPicker({
                          zone: "BENCH",
                          index
                        });
                      }}
                    >
                      Pick Bench
                    </button>
                  );
                }

                return (
                  <button
                    key={player.id}
                    type="button"
                    className="bench-card player-card-button"
                    onClick={() => setSelectedPlayerId(player.id)}
                  >
                    <div className="player-price-chip">£{player.price.toFixed(1)}m</div>
                    <div className="shirt-holder">
                      <div className="shirt" style={{ background: shirtBackgroundForClub(player.club) }} />
                    </div>
                    <div className="player-info-chip">
                      <div className="player-name-chip">{shortName(player.name)}</div>
                      <div className="player-fixture-chip">Bench</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </Card>

      {selectedPlayer ? (
        <div className="player-modal-overlay" onClick={() => setSelectedPlayerId(null)}>
          <Card className="player-modal card" onClick={(event) => event.stopPropagation()}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="player-modal-close"
              onClick={() => setSelectedPlayerId(null)}
            >
              Close
            </Button>

            <div className="player-modal-hero">
              <div className="player-portrait">
                {normalizeUrl(selectedPlayerDetails?.player.imageUrl ?? selectedPlayer.imageUrl) ? (
                  <img
                    src={normalizeUrl(selectedPlayerDetails?.player.imageUrl ?? selectedPlayer.imageUrl)}
                    alt={selectedPlayerDetails?.player.name ?? selectedPlayer.name}
                    className="player-portrait-photo"
                    loading="lazy"
                  />
                ) : (
                  <>
                    <span className="player-portrait-head" />
                    <span
                      className="player-portrait-body"
                      style={{
                        background: shirtBackgroundForClub(selectedPlayerDetails?.player.club ?? selectedPlayer.club)
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
                      <img
                        src={normalizeUrl(selectedPlayerDetails?.player.teamLogoUrl ?? selectedPlayer.teamLogoUrl)}
                        alt={selectedPlayerDetails?.player.club ?? selectedPlayer.club}
                        className="media-thumb media-thumb-small"
                        loading="lazy"
                      />
                    ) : (
                      <span className="media-thumb media-thumb-small media-thumb-fallback" aria-hidden="true">
                        T
                      </span>
                    )}
                  </div>
                  <div className="media-line">
                    {normalizeUrl(selectedPlayerDetails?.player.imageUrl ?? selectedPlayer.imageUrl) ? (
                      <img
                        src={normalizeUrl(selectedPlayerDetails?.player.imageUrl ?? selectedPlayer.imageUrl)}
                        alt={selectedPlayerDetails?.player.name ?? selectedPlayer.name}
                        className="media-thumb media-thumb-small"
                        loading="lazy"
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
              <LoadingState label="Loading backend player details" inline compact />
            ) : null}

            <div className="player-modal-stats">
              <article className="modal-stat-card">
                <p>Price</p>
                <strong>£{selectedPlayerStats?.price ?? "-"}</strong>
              </article>
              <article className="modal-stat-card">
                <p>Point / Match</p>
                <strong>{selectedPlayerStats?.pointPerMatch ?? "-"}</strong>
              </article>
              <article className="modal-stat-card">
                <p>Form</p>
                <strong>{selectedPlayerStats?.form ?? "-"}</strong>
              </article>
              <article className="modal-stat-card">
                <p>Selected %</p>
                <strong>{selectedPlayerStats?.selectedPercentage ?? "-"}</strong>
              </article>
            </div>

            <div className="player-modal-fixtures">
              <h4>Player Profile (Backend)</h4>
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
                <h4>Season Stats (Backend)</h4>
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
                <h4>Recent Matches (Backend)</h4>
                <div className="fixture-strip">
                  {selectedPlayerDetails.history.slice(0, 5).map((item) => (
                    <article key={`history-${item.fixtureId}-${item.gameweek}`} className="fixture-pill">
                      <p>GW {item.gameweek}</p>
                      <strong>
                        {item.opponent} ({item.homeAway === "home" ? "H" : "A"})
                      </strong>
                      <span>{item.points} pts</span>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="player-modal-fixtures">
              <h4>Incoming Fixtures</h4>
              <div className="fixture-strip">
                {fixtureStrip.map((item) => (
                  <article
                    key={`gw-${item.gw}`}
                    className={`fixture-pill ${item.isCurrent ? "current" : ""}`}
                  >
                    <p>GW {item.gw}</p>
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
                Captain
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={viceCaptainChecked}
                  disabled={!selectedPlayerIsStarter}
                  onChange={(event) => onViceCaptainChange(event.target.checked)}
                />
                Vice Captain
              </label>
            </div>

            {selectedPlayerIsBench ? (
              <p className="muted">Captain and vice captain can only be assigned to starting players.</p>
            ) : null}
          </Card>
        </div>
      ) : null}
    </div>
  );
};
