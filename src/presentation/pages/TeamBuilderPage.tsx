import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import type { League } from "../../domain/fantasy/entities/League";
import type { Player } from "../../domain/fantasy/entities/Player";
import type { TeamLineup } from "../../domain/fantasy/entities/Team";
import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import { SUBSTITUTE_SIZE } from "../../domain/fantasy/services/lineupRules";
import { buildLineupFromPlayers, pickAutoSquadPlayerIds } from "../../domain/fantasy/services/squadBuilder";
import { useSession } from "../hooks/useSession";

type TeamMode = "PAT" | "TRF";
type Position = Player["position"];
type SlotZone = "GK" | "DEF" | "MID" | "FWD" | "BENCH";

type SlotPickerTarget = {
  zone: SlotZone;
  index: number;
};

const PLAYERS_CACHE_KEY = "fantasy-players-cache";

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
    substituteIds: lineup.substituteIds ?? []
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

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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

const readPlayersCache = (leagueId: string): Player[] => {
  try {
    const raw = localStorage.getItem(PLAYERS_CACHE_KEY);
    if (!raw) {
      return [];
    }

    const cache = JSON.parse(raw) as Record<string, Player[]>;
    const players = cache[leagueId];
    return Array.isArray(players) ? players : [];
  } catch {
    return [];
  }
};

const writePlayersCache = (leagueId: string, players: Player[]): void => {
  try {
    const raw = localStorage.getItem(PLAYERS_CACHE_KEY);
    const cache = raw ? (JSON.parse(raw) as Record<string, Player[]>) : {};
    cache[leagueId] = players;
    localStorage.setItem(PLAYERS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    return;
  }
};

export const TeamBuilderPage = () => {
  const { getLeagues, getPlayers, getLineup, getDashboard, getFixtures, getMySquad, pickSquad } =
    useContainer();
  const { session } = useSession();

  const [mode, setMode] = useState<TeamMode>("PAT");
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [lineup, setLineup] = useState<TeamLineup | null>(null);
  const [gameweek, setGameweek] = useState<number | null>(null);
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [slotPickerTarget, setSlotPickerTarget] = useState<SlotPickerTarget | null>(null);

  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);

  useEffect(() => {
    let mounted = true;

    const loadHeader = async () => {
      try {
        const [dashboardResult, leaguesResult] = await Promise.all([
          getDashboard.execute(),
          getLeagues.execute()
        ]);

        if (!mounted) {
          return;
        }

        setLeagues(leaguesResult);
        setGameweek(dashboardResult.gameweek);
        const isValidLeagueId = (leagueId: string): boolean =>
          leaguesResult.some((league) => league.id === leagueId);

        const preferredLeagueId = isValidLeagueId(dashboardResult.selectedLeagueId)
          ? dashboardResult.selectedLeagueId
          : leaguesResult[0]?.id ?? "";

        setSelectedLeagueId((current) => (isValidLeagueId(current) ? current : preferredLeagueId));
      } catch (error) {
        if (!mounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Failed to load team header.");
      }
    };

    void loadHeader();

    return () => {
      mounted = false;
    };
  }, [getDashboard, getLeagues]);

  useEffect(() => {
    if (!selectedLeagueId) {
      return;
    }

    let mounted = true;

    const loadLeagueData = async () => {
      try {
        const playersResultRaw = await withRetry(
          () => getPlayers.execute(selectedLeagueId),
          2
        );
        const [lineupResultRaw, fixturesResultRaw] = await Promise.allSettled([
          getLineup.execute(selectedLeagueId),
          getFixtures.execute(selectedLeagueId)
        ]);

        if (!mounted) {
          return;
        }

        let playersResult = playersResultRaw;
        let fallbackMessage: string | null = null;

        if (playersResult.length > 0) {
          writePlayersCache(selectedLeagueId, playersResult);
        } else {
          const cachedPlayers = readPlayersCache(selectedLeagueId);
          if (cachedPlayers.length > 0) {
            playersResult = cachedPlayers;
            fallbackMessage = "Using cached players because latest players response was empty.";
          }
        }

        const lineupResult =
          lineupResultRaw.status === "fulfilled" ? lineupResultRaw.value : null;
        const fixturesResult =
          fixturesResultRaw.status === "fulfilled" ? fixturesResultRaw.value : [];

        setPlayers(playersResult);
        setFixtures(fixturesResult);

        let resolvedLineup = lineupResult;

        if (!resolvedLineup && playersResult.length > 0) {
          const accessToken = session?.accessToken?.trim() ?? "";

          if (accessToken) {
            try {
              let squadResult = await getMySquad.execute(selectedLeagueId, accessToken);
              if (!squadResult) {
                const playerIds = pickAutoSquadPlayerIds(playersResult);
                squadResult = await pickSquad.execute(
                  {
                    leagueId: selectedLeagueId,
                    playerIds
                  },
                  accessToken
                );
                fallbackMessage =
                  fallbackMessage ??
                  "Squad was empty. Auto-picked players and synced to Fantasy API.";
              } else {
                fallbackMessage = fallbackMessage ?? "Loaded lineup from your current squad.";
              }

              resolvedLineup = buildLineupFromPlayers(
                selectedLeagueId,
                playersResult,
                squadResult.picks.map((pick) => pick.playerId)
              );
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "Unknown error while syncing squad.";

              fallbackMessage =
                fallbackMessage ??
                `Squad sync failed (${message}). Showing generated lineup from players.`;
              resolvedLineup = buildLineupFromPlayers(selectedLeagueId, playersResult);
            }
          } else {
            fallbackMessage =
              fallbackMessage ??
              "No saved lineup yet. Showing generated lineup from available players.";
            resolvedLineup = buildLineupFromPlayers(selectedLeagueId, playersResult);
          }
        }

        const normalized = normalizeLineup(selectedLeagueId, resolvedLineup);
        setLineup(normalized);
        setSelectedPlayerId(null);
        setSlotPickerTarget(null);

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
          fallbackMessage = fallbackMessage ?? `Lineup request failed (${message}).`;
        }

        if (fixturesResultRaw.status === "rejected") {
          const message =
            fixturesResultRaw.reason instanceof Error
              ? fixturesResultRaw.reason.message
              : "Failed to load fixtures.";
          fallbackMessage = fallbackMessage ?? `Fixtures request failed (${message}).`;
        }

        if (lineupResult) {
          setInfoMessage(`Last saved at ${new Date(lineupResult.updatedAt).toLocaleString("id-ID")}`);
        } else if (fallbackMessage) {
          setInfoMessage(fallbackMessage);
        } else if (playersResult.length === 0) {
          setInfoMessage("Players endpoint returned no data for this league.");
        } else {
          setInfoMessage("No lineup saved for this league yet.");
        }

        setErrorMessage(null);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Failed to load lineup.");
      }
    };

    void loadLeagueData();

    return () => {
      mounted = false;
    };
  }, [getFixtures, getLineup, getMySquad, getPlayers, pickSquad, selectedLeagueId, session?.accessToken]);

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

  const slotPickerCandidates = useMemo(() => {
    if (!slotPickerTarget || !lineup) {
      return [];
    }

    const currentTargetPlayerId = getPlayerIdAtTarget(lineup, slotPickerTarget);
    const usedIds = new Set(
      [...starterIds, ...lineup.substituteIds].filter((id) => id && id !== currentTargetPlayerId)
    );

    const candidates = players.filter((player) => {
      const positionMatch =
        slotPickerTarget.zone === "BENCH" ? true : player.position === slotPickerTarget.zone;
      if (!positionMatch) {
        return false;
      }

      return !usedIds.has(player.id);
    });

    return sortByProjectedDesc(candidates);
  }, [lineup, players, slotPickerTarget, starterIds]);

  const slotPickerTitle = useMemo(() => {
    if (!slotPickerTarget) {
      return "";
    }

    return slotPickerTarget.zone === "BENCH"
      ? `Pick Bench Player ${slotPickerTarget.index + 1}`
      : `Pick ${slotPickerTarget.zone} Player ${slotPickerTarget.index + 1}`;
  }, [slotPickerTarget]);

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

    return {
      price: selectedPlayer.price.toFixed(1),
      pointPerMatch: ((selectedPlayer.projectedPoints + selectedPlayer.form) / 2).toFixed(2),
      form: selectedPlayer.form.toFixed(1),
      selectedPercentage: `${toSelectedPercentage(selectedPlayer.id).toFixed(1)}%`
    };
  }, [selectedPlayer]);

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
                        setSlotPickerTarget({
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

  const onPickPlayerFromList = (playerId: string) => {
    if (!lineup || !slotPickerTarget) {
      return;
    }

    const player = playersById.get(playerId);
    if (!player) {
      return;
    }

    const nextLineup = ensureLeadership(assignPlayerToTarget(lineup, slotPickerTarget, playerId));
    setLineup(nextLineup);
    setSlotPickerTarget(null);
    setInfoMessage(`${player.name} added to ${slotPickerTarget.zone} slot.`);
  };

  return (
    <div className="page-grid team-builder-page">
      <section className="section-title">
        <h2>Team Builder</h2>
        <p className="muted">Choose mode: Pick A Team (PAT) or Transfers (TRF).</p>
      </section>

      <section className="card team-header-box">
        <div className="mode-switch">
          <button
            type="button"
            className={`mode-button ${mode === "PAT" ? "active" : ""}`}
            onClick={() => setMode("PAT")}
          >
            PAT
          </button>
          <button
            type="button"
            className={`mode-button ${mode === "TRF" ? "active" : ""}`}
            onClick={() => setMode("TRF")}
          >
            TRF
          </button>
        </div>

        <div>
          <label>
            League
            <select
              value={selectedLeagueId}
              onChange={(event) => setSelectedLeagueId(event.target.value)}
            >
              {leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name}
                </option>
              ))}
            </select>
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

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        {infoMessage ? <p className="small-label">{infoMessage}</p> : null}
      </section>

      <section className="card team-chip-box">
        {mode === "PAT" ? (
          <div className="chips-grid chips-grid-4">
            <article className="chip-card">
              <p>Wildcard</p>
              <strong>Available</strong>
            </article>
            <article className="chip-card">
              <p>Triple Captain</p>
              <strong>Available</strong>
            </article>
            <article className="chip-card">
              <p>Free Hit</p>
              <strong>Available</strong>
            </article>
            <article className="chip-card">
              <p>Bench Boost</p>
              <strong>Available</strong>
            </article>
          </div>
        ) : (
          <div className="chips-grid chips-grid-6">
            <article className="chip-card">
              <p>Budget</p>
              <strong>£{Math.max(0, 100 - squadCost).toFixed(1)}</strong>
            </article>
            <article className="chip-card">
              <p>Point Cost</p>
              <strong>0 pts</strong>
            </article>
            <article className="chip-card">
              <p>Wildcard</p>
              <strong>Available</strong>
            </article>
            <article className="chip-card">
              <p>Triple Captain</p>
              <strong>Available</strong>
            </article>
            <article className="chip-card">
              <p>Free Hit</p>
              <strong>Available</strong>
            </article>
            <article className="chip-card">
              <p>Bench Boost</p>
              <strong>Available</strong>
            </article>
          </div>
        )}
      </section>

      <section className="fpl-board card">
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
                        setSlotPickerTarget({
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
      </section>

      {slotPickerTarget ? (
        <div className="player-modal-overlay" onClick={() => setSlotPickerTarget(null)}>
          <section className="player-modal card slot-picker-modal" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="player-modal-close ghost-button"
              onClick={() => setSlotPickerTarget(null)}
            >
              Close
            </button>

            <div>
              <h3>{slotPickerTitle}</h3>
              <p className="muted">Select a player and place directly into this field slot.</p>
            </div>

            <div className="slot-picker-list">
              {slotPickerCandidates.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  className="slot-picker-item"
                  onClick={() => onPickPlayerFromList(player.id)}
                >
                  <span>{player.name}</span>
                  <small>{player.club}</small>
                  <small>{player.position}</small>
                  <strong>£{player.price.toFixed(1)}</strong>
                </button>
              ))}
            </div>

            {slotPickerCandidates.length === 0 ? (
              <p className="muted">No available player for this slot.</p>
            ) : null}
          </section>
        </div>
      ) : null}

      {selectedPlayer ? (
        <div className="player-modal-overlay" onClick={() => setSelectedPlayerId(null)}>
          <section className="player-modal card" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="player-modal-close ghost-button"
              onClick={() => setSelectedPlayerId(null)}
            >
              Close
            </button>

            <div className="player-modal-hero">
              <div className="player-portrait">
                <span className="player-portrait-head" />
                <span
                  className="player-portrait-body"
                  style={{ background: shirtBackgroundForClub(selectedPlayer.club) }}
                />
              </div>

              <div className="player-hero-text">
                <h3>{selectedPlayer.name}</h3>
                <p>{selectedPlayer.position}</p>
                <p>{selectedPlayer.club}</p>
              </div>
            </div>

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
          </section>
        </div>
      ) : null}
    </div>
  );
};
