import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cacheKeys, cacheTtlMs, getOrLoadCached } from "../../app/cache/requestCache";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import type { Club } from "../../domain/fantasy/entities/Club";
import type { Player } from "../../domain/fantasy/entities/Player";
import type { TeamLineup } from "../../domain/fantasy/entities/Team";
import { LoadingState } from "../components/LoadingState";
import { useLeagueSelection } from "../hooks/useLeagueSelection";
import { markOnboardingCompleted } from "../hooks/useOnboardingStatus";
import { useSession } from "../hooks/useSession";
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
const FORMATION_SLOTS = {
  DEF: 4,
  MID: 4,
  FWD: 2,
  BENCH: 4
} as const;

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

const createEmptyLineupDraft = (leagueId: string): TeamLineup => ({
  leagueId,
  goalkeeperId: "",
  defenderIds: Array.from({ length: FORMATION_SLOTS.DEF }, () => ""),
  midfielderIds: Array.from({ length: FORMATION_SLOTS.MID }, () => ""),
  forwardIds: Array.from({ length: FORMATION_SLOTS.FWD }, () => ""),
  substituteIds: Array.from({ length: FORMATION_SLOTS.BENCH }, () => ""),
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
    defenderIds: [...draft.defenderIds.slice(0, FORMATION_SLOTS.DEF), ...Array.from({ length: FORMATION_SLOTS.DEF }, () => "")].slice(0, FORMATION_SLOTS.DEF),
    midfielderIds: [...draft.midfielderIds.slice(0, FORMATION_SLOTS.MID), ...Array.from({ length: FORMATION_SLOTS.MID }, () => "")].slice(0, FORMATION_SLOTS.MID),
    forwardIds: [...draft.forwardIds.slice(0, FORMATION_SLOTS.FWD), ...Array.from({ length: FORMATION_SLOTS.FWD }, () => "")].slice(0, FORMATION_SLOTS.FWD),
    substituteIds: [...draft.substituteIds.slice(0, FORMATION_SLOTS.BENCH), ...Array.from({ length: FORMATION_SLOTS.BENCH }, () => "")].slice(0, FORMATION_SLOTS.BENCH)
  };
};

const assignAt = (ids: string[], index: number, value: string): string[] => {
  const next = [...ids];
  while (next.length <= index) {
    next.push("");
  }
  next[index] = value;
  return next;
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
      defenderIds: assignAt(lineup.defenderIds, index, playerId),
      updatedAt: new Date().toISOString()
    };
  }

  if (zone === "MID") {
    return {
      ...lineup,
      midfielderIds: assignAt(lineup.midfielderIds, index, playerId),
      updatedAt: new Date().toISOString()
    };
  }

  if (zone === "FWD") {
    return {
      ...lineup,
      forwardIds: assignAt(lineup.forwardIds, index, playerId),
      updatedAt: new Date().toISOString()
    };
  }

  return {
    ...lineup,
    substituteIds: assignAt(lineup.substituteIds, index, playerId),
    updatedAt: new Date().toISOString()
  };
};

const clearSlotPlayerId = (lineup: TeamLineup, zone: SlotZone, index: number): TeamLineup => {
  return setSlotPlayerId(lineup, zone, index, "");
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

  return Boolean(
    lineup.goalkeeperId &&
      lineup.defenderIds.every(Boolean) &&
      lineup.midfielderIds.every(Boolean) &&
      lineup.forwardIds.every(Boolean) &&
      lineup.substituteIds.every(Boolean)
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

export const OnboardingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getTeams, getPlayers, saveOnboardingFavoriteClub, completeOnboarding } = useContainer();
  const { leagues, selectedLeagueId, setSelectedLeagueId } = useLeagueSelection();
  const { session } = useSession();

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
          const persistedDraft = readLineupDraft(leagueId);
          setLineupDraft(normalizeLineupDraft(leagueId, persistedDraft));
          loadedLeagueRef.current = leagueId;
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

    writeLineupDraft(lineupDraft);
  }, [lineupDraft]);

  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);

  useEffect(() => {
    if (!lineupDraft || !leagueId || playersById.size === 0) {
      return;
    }

    const result = consumePickerResult();
    if (!result || result.leagueId !== leagueId) {
      return;
    }

    const pickedPlayer = playersById.get(result.playerId);
    if (!pickedPlayer) {
      setErrorMessage("Selected player not found. Please retry.");
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
  }, [leagueId, lineupDraft, playersById]);

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
      positionCounter.DEF >= 3 &&
      positionCounter.MID >= 3 &&
      positionCounter.FWD >= 1 &&
      totalCost <= BUDGET_CAP &&
      Object.values(teamCounter).every((count) => count <= MAX_PER_TEAM)
  );

  const pitchRows = useMemo<PitchRow[]>(() => {
    if (!lineupDraft) {
      return [
        { label: "GK", slots: 1, ids: [] },
        { label: "DEF", slots: FORMATION_SLOTS.DEF, ids: [] },
        { label: "MID", slots: FORMATION_SLOTS.MID, ids: [] },
        { label: "FWD", slots: FORMATION_SLOTS.FWD, ids: [] }
      ];
    }

    return [
      { label: "GK", slots: 1, ids: [lineupDraft.goalkeeperId] },
      { label: "DEF", slots: FORMATION_SLOTS.DEF, ids: lineupDraft.defenderIds },
      { label: "MID", slots: FORMATION_SLOTS.MID, ids: lineupDraft.midfielderIds },
      { label: "FWD", slots: FORMATION_SLOTS.FWD, ids: lineupDraft.forwardIds }
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

    savePickerContext({
      leagueId,
      target: {
        zone,
        index
      },
      lineup: lineupDraft,
      returnPath: "/onboarding?step=squad"
    });

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
          lineup: {
            ...lineupDraft,
            defenderIds: lineupDraft.defenderIds.filter(Boolean),
            midfielderIds: lineupDraft.midfielderIds.filter(Boolean),
            forwardIds: lineupDraft.forwardIds.filter(Boolean),
            substituteIds: lineupDraft.substituteIds.filter(Boolean),
            captainId,
            viceCaptainId,
            updatedAt: new Date().toISOString()
          }
        },
        accessToken
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
                <select value={leagueId} onChange={(event) => setLeagueId(event.target.value)}>
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
                  {Array.from({ length: FORMATION_SLOTS.BENCH }).map((_, index) => {
                    const playerId = getSlotPlayerId(lineupDraft ?? createEmptyLineupDraft(leagueId), "BENCH", index);
                    const player = playerId ? playersById.get(playerId) ?? null : null;
                    return <div key={`bench-${index}`}>{renderPitchCard("BENCH", index, "BENCH", player)}</div>;
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
