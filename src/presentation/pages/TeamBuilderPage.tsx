import { useEffect, useMemo, useState } from "react";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import type { League } from "../../domain/fantasy/entities/League";
import type { Player, Position } from "../../domain/fantasy/entities/Player";
import type { TeamLineup } from "../../domain/fantasy/entities/Team";
import { TEAM_SIZE } from "../../domain/fantasy/services/lineupRules";
import { PlayerRow } from "../components/PlayerRow";

const POSITION_LIMIT: Record<Position, number> = {
  GK: 1,
  DEF: 4,
  MID: 4,
  FWD: 2
};

export const TeamBuilderPage = () => {
  const { getLeagues, getPlayers, getLineup, saveLineup } = useContainer();

  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [lineup, setLineup] = useState<TeamLineup | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadLeagues = async () => {
      const list = await getLeagues.execute();
      if (!mounted) {
        return;
      }

      setLeagues(list);
      setSelectedLeagueId((current) => current || list[0]?.id || "");
    };

    void loadLeagues();

    return () => {
      mounted = false;
    };
  }, [getLeagues]);

  useEffect(() => {
    if (!selectedLeagueId) {
      return;
    }

    let mounted = true;

    const load = async () => {
      try {
        const [playersResult, lineupResult] = await Promise.all([
          getPlayers.execute(selectedLeagueId),
          getLineup.execute(selectedLeagueId)
        ]);

        if (!mounted) {
          return;
        }

        setPlayers(playersResult);

        if (lineupResult) {
          setLineup(lineupResult);
          setInfoMessage(`Last saved at ${new Date(lineupResult.updatedAt).toLocaleString("id-ID")}`);
          return;
        }

        setLineup(null);
        setInfoMessage("No lineup saved for this league yet.");
      } catch (error) {
        if (!mounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Failed to load lineup.");
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [getLineup, getPlayers, selectedLeagueId]);

  const selectedIds = useMemo(() => {
    if (!lineup) {
      return new Set<string>();
    }

    return new Set([
      lineup.goalkeeperId,
      ...lineup.defenderIds,
      ...lineup.midfielderIds,
      ...lineup.forwardIds
    ]);
  }, [lineup]);

  const selectedCounts = useMemo(() => {
    if (!lineup) {
      return { GK: 0, DEF: 0, MID: 0, FWD: 0 } as Record<Position, number>;
    }

    return {
      GK: lineup.goalkeeperId ? 1 : 0,
      DEF: lineup.defenderIds.length,
      MID: lineup.midfielderIds.length,
      FWD: lineup.forwardIds.length
    };
  }, [lineup]);

  const setLineupBySelection = (nextSelection: string[]) => {
    const playersById = new Map(players.map((player) => [player.id, player]));

    const nextGoalkeeperId = nextSelection.find((id) => playersById.get(id)?.position === "GK") ?? "";
    const nextDefenders = nextSelection.filter((id) => playersById.get(id)?.position === "DEF");
    const nextMidfielders = nextSelection.filter((id) => playersById.get(id)?.position === "MID");
    const nextForwards = nextSelection.filter((id) => playersById.get(id)?.position === "FWD");

    const captainId = lineup?.captainId && nextSelection.includes(lineup.captainId)
      ? lineup.captainId
      : nextSelection[0] ?? "";

    const viceCaptainId = lineup?.viceCaptainId && nextSelection.includes(lineup.viceCaptainId)
      ? lineup.viceCaptainId
      : nextSelection.find((id) => id !== captainId) ?? "";

    setLineup({
      leagueId: selectedLeagueId,
      goalkeeperId: nextGoalkeeperId,
      defenderIds: nextDefenders,
      midfielderIds: nextMidfielders,
      forwardIds: nextForwards,
      captainId,
      viceCaptainId,
      updatedAt: lineup?.updatedAt ?? new Date().toISOString()
    });
  };

  const onToggle = (playerId: string) => {
    const playersById = new Map(players.map((player) => [player.id, player]));
    const player = playersById.get(playerId);
    if (!player) {
      return;
    }

    setErrorMessage(null);
    setInfoMessage(null);

    const selected = new Set(selectedIds);
    if (selected.has(playerId)) {
      selected.delete(playerId);
      setLineupBySelection(Array.from(selected));
      return;
    }

    if (selected.size >= TEAM_SIZE) {
      setErrorMessage("Team already has 11 players. Remove one first.");
      return;
    }

    if (selectedCounts[player.position] >= POSITION_LIMIT[player.position]) {
      setErrorMessage(`Limit reached for ${player.position}.`);
      return;
    }

    selected.add(playerId);
    setLineupBySelection(Array.from(selected));
  };

  const onSave = async () => {
    if (!lineup) {
      setErrorMessage("Select lineup first.");
      return;
    }

    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const saved = await saveLineup.execute(lineup, players);
      setLineup(saved);
      setInfoMessage(`Lineup saved at ${new Date(saved.updatedAt).toLocaleString("id-ID")}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save lineup.");
    }
  };

  const playersByPosition = useMemo(() => {
    return {
      GK: players.filter((player) => player.position === "GK"),
      DEF: players.filter((player) => player.position === "DEF"),
      MID: players.filter((player) => player.position === "MID"),
      FWD: players.filter((player) => player.position === "FWD")
    };
  }, [players]);

  return (
    <div className="page-grid">
      <section className="section-title">
        <h2>Team Builder</h2>
        <p className="muted">Formation fixed to 1-4-4-2 for initial release.</p>
      </section>

      <section>
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
      </section>

      <section className="card">
        <h3>Selection</h3>
        <p className="muted">
          {selectedIds.size}/11 players · GK {selectedCounts.GK}/1 · DEF {selectedCounts.DEF}/4 · MID{" "}
          {selectedCounts.MID}/4 · FWD {selectedCounts.FWD}/2
        </p>

        <div className="captain-grid">
          <label>
            Captain
            <select
              value={lineup?.captainId ?? ""}
              onChange={(event) =>
                lineup
                  ? setLineup({ ...lineup, captainId: event.target.value })
                  : undefined
              }
            >
              <option value="">Select captain</option>
              {Array.from(selectedIds).map((id) => {
                const player = players.find((item) => item.id === id);
                return player ? (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ) : null;
              })}
            </select>
          </label>

          <label>
            Vice Captain
            <select
              value={lineup?.viceCaptainId ?? ""}
              onChange={(event) =>
                lineup
                  ? setLineup({ ...lineup, viceCaptainId: event.target.value })
                  : undefined
              }
            >
              <option value="">Select vice captain</option>
              {Array.from(selectedIds).map((id) => {
                const player = players.find((item) => item.id === id);
                return player ? (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ) : null;
              })}
            </select>
          </label>
        </div>

        <button type="button" onClick={onSave}>
          Save lineup
        </button>
        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        {infoMessage ? <p className="small-label">{infoMessage}</p> : null}
      </section>

      <section className="players-board">
        {(["GK", "DEF", "MID", "FWD"] as const).map((position) => (
          <article key={position} className="card">
            <h3>{position}</h3>
            {playersByPosition[position].map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                selected={selectedIds.has(player.id)}
                onToggle={onToggle}
              />
            ))}
          </article>
        ))}
      </section>
    </div>
  );
};
