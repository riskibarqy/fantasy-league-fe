import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Player } from "../../domain/fantasy/entities/Player";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import { cacheKeys, cacheTtlMs, getOrLoadCached } from "../../app/cache/requestCache";
import { LoadingState } from "../components/LoadingState";
import { useSession } from "../hooks/useSession";
import { appAlert } from "../lib/appAlert";
import {
  clearPickerContext,
  readPickerContext,
  savePickerResult,
  type SlotPickerTarget,
  type SlotZone
} from "./teamPickerStorage";

type SortOption =
  | "price_desc"
  | "price_asc"
  | "name_asc"
  | "name_desc"
  | "club_asc"
  | "club_desc";

type PositionFilter = "ALL" | Player["position"];

const isSlotZone = (value: string | null): value is SlotZone => {
  return value === "GK" || value === "DEF" || value === "MID" || value === "FWD" || value === "BENCH";
};

const toTargetTitle = (target: SlotPickerTarget): string => {
  if (target.zone === "BENCH") {
    return `Pick Bench Player ${target.index + 1}`;
  }

  return `Pick ${target.zone} Player ${target.index + 1}`;
};

const getPlayerIdAtTarget = (lineupIds: {
  goalkeeperId: string;
  defenderIds: string[];
  midfielderIds: string[];
  forwardIds: string[];
  substituteIds: string[];
}, target: SlotPickerTarget): string => {
  switch (target.zone) {
    case "GK":
      return lineupIds.goalkeeperId;
    case "DEF":
      return lineupIds.defenderIds[target.index] ?? "";
    case "MID":
      return lineupIds.midfielderIds[target.index] ?? "";
    case "FWD":
      return lineupIds.forwardIds[target.index] ?? "";
    case "BENCH":
      return lineupIds.substituteIds[target.index] ?? "";
  }
};

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async <T,>(run: () => Promise<T>, retries: number): Promise<T> => {
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

      await delay(300 * (attempt + 1));
      attempt += 1;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed.");
};

const normalizeUrl = (value?: string): string => value?.trim() ?? "";
const normalizeDisplayText = (value: string, fallback: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return /^https?:\/\//i.test(trimmed) ? fallback : trimmed;
};

export const TeamPlayerPickerPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getPlayers } = useContainer();
  const { session } = useSession();
  const userScope = session?.user.id ?? "";

  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (errorMessage) {
      void appAlert.error("Player List Failed", errorMessage);
    }
  }, [errorMessage]);

  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<PositionFilter>("ALL");
  const [club, setClub] = useState("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("price_desc");
  const deferredSearch = useDeferredValue(search);

  const context = useMemo(() => {
    const stored = readPickerContext(userScope);
    const leagueId = searchParams.get("leagueId") ?? stored?.leagueId ?? "";
    const zoneRaw = searchParams.get("zone");
    const indexRaw = searchParams.get("index");
    const index = Number(indexRaw ?? "-1");
    const parsedTarget =
      isSlotZone(zoneRaw) && Number.isInteger(index) && index >= 0
        ? ({
            zone: zoneRaw,
            index
          } satisfies SlotPickerTarget)
        : stored?.target ?? null;

    if (!stored || !leagueId || !parsedTarget || stored.leagueId !== leagueId) {
      return null;
    }

    return {
      leagueId,
      target: parsedTarget,
      lineup: stored.lineup,
      returnPath: stored.returnPath || "/team"
    };
  }, [searchParams, userScope]);

  useEffect(() => {
    if (!context) {
      return;
    }

    let mounted = true;

    const loadPlayers = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const result = await withRetry(
          () =>
            getOrLoadCached({
              key: cacheKeys.players(context.leagueId),
              ttlMs: cacheTtlMs.players,
              loader: () => getPlayers.execute(context.leagueId),
              allowStaleOnError: true
            }),
          2
        );

        const resolvedResult =
          result.length > 0
            ? result
            : await withRetry(
                () =>
                  getOrLoadCached({
                    key: cacheKeys.players(context.leagueId),
                    ttlMs: cacheTtlMs.players,
                    loader: () => getPlayers.execute(context.leagueId),
                    allowStaleOnError: true,
                    forceRefresh: true
                  }),
                1
              );

        if (!mounted) {
          return;
        }

        setPlayers(resolvedResult);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Failed to load players.");
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void loadPlayers();

    return () => {
      mounted = false;
    };
  }, [context, getPlayers]);

  const clubOptions = useMemo(() => {
    return ["ALL", ...new Set(players.map((player) => player.club).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "id-ID")
    );
  }, [players]);

  const availablePlayers = useMemo(() => {
    if (!context) {
      return [];
    }

    const currentTargetPlayerId = getPlayerIdAtTarget(context.lineup, context.target);
    const usedIds = new Set(
      [
        context.lineup.goalkeeperId,
        ...context.lineup.defenderIds,
        ...context.lineup.midfielderIds,
        ...context.lineup.forwardIds,
        ...context.lineup.substituteIds
      ].filter((id) => id && id !== currentTargetPlayerId)
    );

    return players.filter((player) => {
      const byTarget = context.target.zone === "BENCH" ? true : player.position === context.target.zone;
      if (!byTarget || usedIds.has(player.id)) {
        return false;
      }

      const byPosition = position === "ALL" ? true : player.position === position;
      const byClub = club === "ALL" ? true : player.club === club;
      const keyword = deferredSearch.trim().toLowerCase();
      const bySearch = keyword
        ? player.name.toLowerCase().includes(keyword) || player.club.toLowerCase().includes(keyword)
        : true;

      return byPosition && byClub && bySearch;
    });
  }, [club, context, deferredSearch, players, position]);

  const sortedPlayers = useMemo(() => {
    const sorted = [...availablePlayers];

    sorted.sort((left, right) => {
      switch (sortBy) {
        case "price_asc":
          return left.price - right.price;
        case "price_desc":
          return right.price - left.price;
        case "name_asc":
          return left.name.localeCompare(right.name, "id-ID");
        case "name_desc":
          return right.name.localeCompare(left.name, "id-ID");
        case "club_asc":
          return left.club.localeCompare(right.club, "id-ID");
        case "club_desc":
          return right.club.localeCompare(left.club, "id-ID");
      }
    });

    return sorted;
  }, [availablePlayers, sortBy]);

  const onCancel = () => {
    clearPickerContext(userScope);
    navigate(context?.returnPath || "/team");
  };

  const onResetFilters = () => {
    setSearch("");
    setPosition("ALL");
    setClub("ALL");
    setSortBy("price_desc");
  };

  const onPick = (playerId: string) => {
    if (!context) {
      return;
    }

    savePickerResult(
      {
        leagueId: context.leagueId,
        target: context.target,
        playerId
      },
      userScope
    );
    navigate(context.returnPath || "/team");
  };

  if (!context) {
    return (
      <div className="page-grid team-picker-page">
        <section className="card">
          <h2>Pick Player</h2>
          <p className="muted">No active slot target found. Please pick from the Team page.</p>
          <div className="team-picker-actions">
            <button type="button" className="secondary-button" onClick={() => navigate("/team")}>
              Back to Team
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-grid team-picker-page">
      <section className="section-title">
        <h2>{toTargetTitle(context.target)}</h2>
        <p className="muted">Tap/click a table row to pick player for this slot.</p>
      </section>

      <section className="card team-picker-filters">
        <label>
          Search Name / Club
          <input
            type="text"
            placeholder="Search player..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label>
          Position
          <select value={position} onChange={(event) => setPosition(event.target.value as PositionFilter)}>
            <option value="ALL">All</option>
            <option value="GK">GK</option>
            <option value="DEF">DEF</option>
            <option value="MID">MID</option>
            <option value="FWD">FWD</option>
          </select>
        </label>

        <label>
          Club
          <select value={club} onChange={(event) => setClub(event.target.value)}>
            {clubOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Sort
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)}>
            <option value="price_desc">Price (High-Low)</option>
            <option value="price_asc">Price (Low-High)</option>
            <option value="name_asc">Name (A-Z)</option>
            <option value="name_desc">Name (Z-A)</option>
            <option value="club_asc">Club (A-Z)</option>
            <option value="club_desc">Club (Z-A)</option>
          </select>
        </label>

        <button type="button" className="secondary-button team-picker-reset" onClick={onResetFilters}>
          Reset Filter
        </button>
      </section>

      <section className="card team-picker-list">
        {isLoading ? <LoadingState label="Loading players list" /> : null}

        {!isLoading && sortedPlayers.length === 0 ? (
          <p className="muted">No players match this slot/filter.</p>
        ) : null}

        {!isLoading && sortedPlayers.length > 0 ? (
          <>
            <p className="small-label">Showing {sortedPlayers.length} players</p>

            <div className="team-picker-table-wrap">
              <table className="team-picker-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Club</th>
                    <th>Pos</th>
                    <th>Price</th>
                    <th>Form</th>
                    <th>Proj</th>
                    <th>Inj</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.map((player) => {
                    const playerName = normalizeDisplayText(player.name, "Unknown Player");
                    const playerClub = normalizeDisplayText(player.club, "Unknown Club");

                    return (
                      <tr
                        key={player.id}
                        className="team-picker-clickable"
                        onClick={() => onPick(player.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onPick(player.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`Pick ${playerName}`}
                      >
                        <td className="entity-media-cell">
                          <div className="media-line">
                            {normalizeUrl(player.imageUrl) ? (
                              <img
                                src={normalizeUrl(player.imageUrl)}
                                alt={playerName}
                                className="media-thumb"
                                loading="lazy"
                              />
                            ) : (
                              <span className="media-thumb media-thumb-fallback" aria-hidden="true">
                                P
                              </span>
                            )}
                            <div className="media-copy">
                              <strong>{playerName}</strong>
                            </div>
                          </div>
                        </td>
                        <td className="entity-media-cell">
                          <div className="media-line">
                            {normalizeUrl(player.teamLogoUrl) ? (
                              <img
                                src={normalizeUrl(player.teamLogoUrl)}
                                alt={playerClub}
                                className="media-thumb media-thumb-small"
                                loading="lazy"
                              />
                            ) : (
                              <span className="media-thumb media-thumb-small media-thumb-fallback" aria-hidden="true">
                                T
                              </span>
                            )}
                            <div className="media-copy">
                              <strong>{playerClub}</strong>
                            </div>
                          </div>
                        </td>
                        <td>{player.position}</td>
                        <td>£{player.price.toFixed(1)}</td>
                        <td>{player.form.toFixed(1)}</td>
                        <td>{player.projectedPoints.toFixed(1)}</td>
                        <td>{player.isInjured ? "Yes" : "No"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      <div className="team-picker-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};
