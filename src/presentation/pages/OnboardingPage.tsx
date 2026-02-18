import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cacheKeys, cacheTtlMs, getOrLoadCached } from "../../app/cache/requestCache";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import type { Club } from "../../domain/fantasy/entities/Club";
import type { Player } from "../../domain/fantasy/entities/Player";
import { buildLineupFromPlayers, pickAutoSquadPlayerIds } from "../../domain/fantasy/services/squadBuilder";
import { LoadingState } from "../components/LoadingState";
import { useLeagueSelection } from "../hooks/useLeagueSelection";
import { markOnboardingCompleted } from "../hooks/useOnboardingStatus";
import { useSession } from "../hooks/useSession";

type PositionFilter = "ALL" | Player["position"];

const BUDGET_CAP = 150;
const MAX_PER_TEAM = 3;

const normalizeUrl = (value?: string): string => value?.trim() ?? "";

export const OnboardingPage = () => {
  const navigate = useNavigate();
  const { getTeams, getPlayers, saveOnboardingFavoriteClub, completeOnboarding } = useContainer();
  const { leagues, selectedLeagueId, setSelectedLeagueId } = useLeagueSelection();
  const { session } = useSession();

  const [leagueId, setLeagueId] = useState("");
  const [teams, setTeams] = useState<Club[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [squadName, setSquadName] = useState("My Squad");
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<PositionFilter>("ALL");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const loadedLeagueRef = useRef("");

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
        const [teamsResult, playersResult] = await Promise.all([
          getOrLoadCached({
            key: cacheKeys.teams(leagueId),
            ttlMs: cacheTtlMs.teams,
            loader: () => getTeams.execute(leagueId),
            allowStaleOnError: true
          }),
          getOrLoadCached({
            key: cacheKeys.players(leagueId),
            ttlMs: cacheTtlMs.players,
            loader: () => getPlayers.execute(leagueId),
            allowStaleOnError: true
          })
        ]);

        if (!mounted) {
          return;
        }

        setTeams(teamsResult);
        setPlayers(playersResult);

        setSelectedTeamId((previous) =>
          teamsResult.some((team) => team.id === previous) ? previous : teamsResult[0]?.id ?? ""
        );

        if (loadedLeagueRef.current !== leagueId) {
          const autoPlayerIds = pickAutoSquadPlayerIds(playersResult);
          setSelectedPlayerIds(autoPlayerIds);
          loadedLeagueRef.current = leagueId;
          setInfoMessage("Auto-picked 15 players. You can adjust before submit.");
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
  }, [getPlayers, getTeams, leagueId]);

  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);

  const selectedPlayers = useMemo(() => {
    return selectedPlayerIds
      .map((id) => playersById.get(id))
      .filter((player): player is Player => Boolean(player));
  }, [playersById, selectedPlayerIds]);

  const selectedIdsSet = useMemo(() => new Set(selectedPlayerIds), [selectedPlayerIds]);

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

  const filteredPlayers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return players.filter((player) => {
      const byPosition = position === "ALL" ? true : player.position === position;
      const byKeyword = keyword
        ? player.name.toLowerCase().includes(keyword) || player.club.toLowerCase().includes(keyword)
        : true;

      return byPosition && byKeyword;
    });
  }, [players, position, search]);

  const canSubmit = Boolean(
    leagueId &&
      selectedTeamId &&
      selectedPlayers.length === 15 &&
      positionCounter.GK >= 1 &&
      positionCounter.DEF >= 3 &&
      positionCounter.MID >= 3 &&
      positionCounter.FWD >= 1 &&
      totalCost <= BUDGET_CAP
  );

  const togglePlayer = (playerId: string) => {
    const player = playersById.get(playerId);
    if (!player) {
      return;
    }

    setErrorMessage(null);

    if (selectedIdsSet.has(playerId)) {
      setSelectedPlayerIds((previous) => previous.filter((id) => id !== playerId));
      return;
    }

    if (selectedPlayerIds.length >= 15) {
      setErrorMessage("Squad can only contain 15 players.");
      return;
    }

    if ((teamCounter[player.club] ?? 0) >= MAX_PER_TEAM) {
      setErrorMessage(`Max ${MAX_PER_TEAM} players from ${player.club}.`);
      return;
    }

    if (totalCost + player.price > BUDGET_CAP) {
      setErrorMessage(`Budget cap exceeded (${BUDGET_CAP.toFixed(1)}).`);
      return;
    }

    setSelectedPlayerIds((previous) => [...previous, playerId]);
  };

  const onAutoPick = () => {
    if (players.length === 0) {
      return;
    }

    const autoPlayerIds = pickAutoSquadPlayerIds(players);
    setSelectedPlayerIds(autoPlayerIds);
    setErrorMessage(null);
    setInfoMessage("Auto-picked 15 players using valid formation constraints.");
  };

  const onSubmit = async () => {
    const accessToken = session?.accessToken?.trim() ?? "";
    if (!accessToken) {
      setErrorMessage("Session expired. Please login again.");
      return;
    }

    if (!leagueId || !selectedTeamId) {
      setErrorMessage("League and favorite club are required.");
      return;
    }

    if (!canSubmit) {
      setErrorMessage("Squad is not valid yet. Check count, positions, team limit, and budget.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setInfoMessage(null);

      const lineup = buildLineupFromPlayers(leagueId, selectedPlayers, selectedPlayerIds);

      await saveOnboardingFavoriteClub.execute(
        {
          leagueId,
          teamId: selectedTeamId
        },
        accessToken
      );

      await completeOnboarding.execute(
        {
          leagueId,
          squadName: squadName.trim(),
          playerIds: selectedPlayerIds,
          lineup
        },
        accessToken
      );

      setSelectedLeagueId(leagueId);
      markOnboardingCompleted(session?.user.id ?? "");
      navigate("/team", { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to complete onboarding.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-shell onboarding-shell">
      <main className="content">
        <section className="card onboarding-hero">
          <p className="small-label">Onboarding</p>
          <h2>Set Your Favorite Club and Build First Squad</h2>
          <p className="muted">
            Complete this once to start playing. Backend endpoints used:{" "}
            <code>/v1/onboarding/favorite-club</code> and <code>/v1/onboarding/pick-squad</code>.
          </p>
        </section>

        <section className="card onboarding-section">
          <div className="home-section-head">
            <h3>1. Favorite Club</h3>
          </div>

          <div className="page-filter-grid">
            <label>
              League
              <select value={leagueId} onChange={(event) => setLeagueId(event.target.value)}>
                {leagues.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {isLoading ? <LoadingState label="Loading clubs and players" /> : null}

          <div className="onboarding-team-grid">
            {teams.map((team) => (
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
                    <span className="media-url">{team.logoUrl}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="card onboarding-section">
          <div className="home-section-head">
            <h3>2. Select Squad (15 Players)</h3>
            <button type="button" className="secondary-button" onClick={onAutoPick}>
              Auto Pick
            </button>
          </div>

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
            <label>
              Search
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by player or club"
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
          </div>

          <div className="onboarding-summary-grid">
            <article className="onboarding-summary-card">
              <p className="small-label">Selected</p>
              <strong>{selectedPlayers.length} / 15</strong>
            </article>
            <article className="onboarding-summary-card">
              <p className="small-label">Budget</p>
              <strong>
                £{totalCost.toFixed(1)} / £{BUDGET_CAP.toFixed(1)}
              </strong>
            </article>
            <article className="onboarding-summary-card">
              <p className="small-label">Position Min</p>
              <strong>
                GK {positionCounter.GK} · DEF {positionCounter.DEF} · MID {positionCounter.MID} · FWD{" "}
                {positionCounter.FWD}
              </strong>
            </article>
          </div>

          <div className="team-picker-table-wrap onboarding-player-table">
            <table className="team-picker-table">
              <thead>
                <tr>
                  <th>Pick</th>
                  <th>Name</th>
                  <th>Club</th>
                  <th>Pos</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((player) => {
                  const picked = selectedIdsSet.has(player.id);
                  const teamCount = teamCounter[player.club] ?? 0;
                  const blockedByTeamLimit = !picked && teamCount >= MAX_PER_TEAM;
                  const blockedByBudget = !picked && totalCost + player.price > BUDGET_CAP;

                  return (
                    <tr
                      key={player.id}
                      className={`team-picker-clickable ${picked ? "onboarding-picked" : ""}`}
                      onClick={() => togglePlayer(player.id)}
                    >
                      <td>{picked ? "✓" : "+"}</td>
                      <td className="entity-media-cell">
                        <div className="media-line">
                          {normalizeUrl(player.imageUrl) ? (
                            <img src={normalizeUrl(player.imageUrl)} alt={player.name} className="media-thumb" loading="lazy" />
                          ) : (
                            <span className="media-thumb media-thumb-fallback" aria-hidden="true">
                              P
                            </span>
                          )}
                          <div className="media-copy">
                            <strong>{player.name}</strong>
                            <span className="media-url">{normalizeUrl(player.imageUrl) || "No player image URL"}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="media-line">
                          {normalizeUrl(player.teamLogoUrl) ? (
                            <img
                              src={normalizeUrl(player.teamLogoUrl)}
                              alt={player.club}
                              className="media-thumb media-thumb-small"
                              loading="lazy"
                            />
                          ) : (
                            <span className="media-thumb media-thumb-small media-thumb-fallback" aria-hidden="true">
                              T
                            </span>
                          )}
                          <div className="media-copy">
                            <strong>{player.club}</strong>
                            {blockedByTeamLimit ? <small className="error-text">Team limit reached</small> : null}
                            {!blockedByTeamLimit && blockedByBudget ? (
                              <small className="error-text">Budget exceeded</small>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>{player.position}</td>
                      <td>£{player.price.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        {infoMessage ? <p className="small-label">{infoMessage}</p> : null}

        <section className="onboarding-actions">
          <button type="button" onClick={onSubmit} disabled={isSubmitting || isLoading || !canSubmit}>
            {isSubmitting ? "Saving..." : "Complete Onboarding"}
          </button>
        </section>
      </main>
    </div>
  );
};
