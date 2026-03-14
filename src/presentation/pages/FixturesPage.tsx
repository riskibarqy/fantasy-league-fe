import { useQuery } from "@tanstack/react-query";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cacheKeys, cacheTtlMs, getOrLoadCached } from "../../app/cache/requestCache";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import type { LeagueStanding } from "../../domain/fantasy/entities/LeagueStanding";
import { TopScoreType,TopScoresDetail } from "../../domain/fantasy/entities/TopScore";
import { FixtureCard } from "../components/FixtureCard";
import { LazyImage } from "../components/LazyImage";
import { LoadingState } from "../components/LoadingState";
import { useI18n } from "../hooks/useI18n";
import { useLeagueSelection } from "../hooks/useLeagueSelection";
import { useSession } from "../hooks/useSession";
import { appAlert } from "../lib/appAlert";
import { isLiveFixture } from "../lib/fixtureDisplay";

type FixturesTab = "matches" | "table" | "stats";
type FormResult = "W" | "D" | "L";
type StandingsMode = "live" | "final" | "derived";
type StandingsResponse = {
  mode: "live" | "final";
  items: LeagueStanding[];
};

const sortStandings = (items: LeagueStanding[]): LeagueStanding[] => {
  return [...items].sort((left, right) => left.position - right.position);
};

const parseStandingForm = (rawForm?: string): Array<FormResult | null> => {
  const tokens = rawForm?.toUpperCase().match(/[WDL]/g) ?? [];
  const values = tokens.slice(-5) as FormResult[];
  if (values.length >= 5) {
    return values;
  }

  return [...Array.from({ length: 5 - values.length }, () => null), ...values];
};

const FINISHED_STATUSES = new Set(["FT", "FINISHED", "AET", "PEN"]);

const hasScore = (fixture: Fixture): boolean =>
  typeof fixture.homeScore === "number" && typeof fixture.awayScore === "number";

const isCountedStandingFixture = (fixture: Fixture): boolean => {
  if (!hasScore(fixture)) {
    return false;
  }

  const status = fixture.status?.trim().toUpperCase() ?? "";
  return FINISHED_STATUSES.has(status) || isLiveFixture(fixture);
};

const buildStandingsFromFixtures = (fixtures: Fixture[]): LeagueStanding[] => {
  const byTeam = new Map<string, LeagueStanding>();
  const formByTeam = new Map<string, FormResult[]>();
  let snapshotGameweek = 0;
  let anyLive = false;

  const sorted = [...fixtures].sort(
    (left, right) => new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime()
  );

  const ensureTeam = (
    teamKey: string,
    leagueId: string,
    teamName: string,
    teamLogoUrl?: string
  ): LeagueStanding => {
    const existing = byTeam.get(teamKey);
    if (existing) {
      if (!existing.teamLogoUrl && teamLogoUrl) {
        existing.teamLogoUrl = teamLogoUrl;
      }
      return existing;
    }

    const created: LeagueStanding = {
      leagueId,
      gameweek: 1,
      teamId: teamKey,
      teamName: teamName || teamKey,
      teamLogoUrl,
      position: 0,
      played: 0,
      won: 0,
      draw: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      form: "",
      isLive: false
    };

    byTeam.set(teamKey, created);
    formByTeam.set(teamKey, []);
    return created;
  };

  for (const fixture of sorted) {
    if (!isCountedStandingFixture(fixture)) {
      continue;
    }

    const homeKey = fixture.homeTeam.trim();
    const awayKey = fixture.awayTeam.trim();
    if (!homeKey || !awayKey || fixture.homeScore === undefined || fixture.awayScore === undefined) {
      continue;
    }

    const home = ensureTeam(homeKey, fixture.leagueId, fixture.homeTeam, fixture.homeTeamLogoUrl);
    const away = ensureTeam(awayKey, fixture.leagueId, fixture.awayTeam, fixture.awayTeamLogoUrl);
    const homeGoals = fixture.homeScore;
    const awayGoals = fixture.awayScore;

    home.played += 1;
    away.played += 1;
    home.goalsFor += homeGoals;
    home.goalsAgainst += awayGoals;
    away.goalsFor += awayGoals;
    away.goalsAgainst += homeGoals;

    const homeForm = formByTeam.get(homeKey) ?? [];
    const awayForm = formByTeam.get(awayKey) ?? [];

    if (homeGoals > awayGoals) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
      homeForm.push("W");
      awayForm.push("L");
    } else if (homeGoals < awayGoals) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
      homeForm.push("L");
      awayForm.push("W");
    } else {
      home.draw += 1;
      away.draw += 1;
      home.points += 1;
      away.points += 1;
      homeForm.push("D");
      awayForm.push("D");
    }

    formByTeam.set(homeKey, homeForm.slice(-5));
    formByTeam.set(awayKey, awayForm.slice(-5));

    if (fixture.gameweek > snapshotGameweek) {
      snapshotGameweek = fixture.gameweek;
    }
    if (isLiveFixture(fixture)) {
      anyLive = true;
    }
  }

  const rows = [...byTeam.values()];
  if (rows.length === 0) {
    return [];
  }

  rows.sort((left, right) => {
    if (left.points !== right.points) {
      return right.points - left.points;
    }

    const leftGD = left.goalsFor - left.goalsAgainst;
    const rightGD = right.goalsFor - right.goalsAgainst;
    if (leftGD !== rightGD) {
      return rightGD - leftGD;
    }

    if (left.goalsFor !== right.goalsFor) {
      return right.goalsFor - left.goalsFor;
    }

    return (left.teamName ?? left.teamId).localeCompare(right.teamName ?? right.teamId);
  });

  return rows.map((item, index) => {
    const key = item.teamId.trim();
    const form = formByTeam.get(key) ?? [];
    return {
      ...item,
      position: index + 1,
      gameweek: snapshotGameweek > 0 ? snapshotGameweek : 1,
      goalDifference: item.goalsFor - item.goalsAgainst,
      form: form.join(""),
      isLive: anyLive
    };
  });
};

const formatDayLabel = (kickoffAt: string, locale: string): string => {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Jakarta"
  }).format(new Date(kickoffAt));
};

const toDayKey = (kickoffAt: string): string => {
  const date = new Date(kickoffAt);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta"
  });
  return formatter.format(date);
};

const formatRangeLabel = (items: Fixture[], locale: string): string => {
  if (items.length === 0) {
    return "-";
  }

  const sorted = [...items].sort(
    (left, right) => new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime()
  );

  const start = sorted[0];
  const end = sorted[sorted.length - 1];
  const startLabel = formatDayLabel(start.kickoffAt, locale);
  const endLabel = formatDayLabel(end.kickoffAt, locale);
  return `${startLabel} - ${endLabel}`;
};

const seasonLabelFromDate = (value: string): string => {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const startYear = month >= 6 ? year : year - 1;
  const endYear = startYear + 1;
  return `${startYear}/${endYear}`;
};

const tableTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.2, ease: "easeOut" as const }
};


const topScoreOptions: { label: string; value: TopScoreType }[] = [
  { label: "Goal", value: "GOAL_TOPSCORER" },
  { label: "Assist", value: "ASSIST_TOPSCORER" },
  { label: "Yellow Card", value: "YELLOWCARDS" },
  { label: "Red Card", value: "REDCARDS" }
];

const totalHeaderFromType = (type: TopScoreType): string => {
  switch (type) {
    case "GOAL_TOPSCORER":
      return "Goals";
    case "ASSIST_TOPSCORER":
      return "Assists";
    case "YELLOWCARDS":
      return "Yellow";
    case "REDCARDS":
      return "Red";
    default:
      return "Total";
  }
}
export const FixturesPage = () => {
  const { t, dateLocale } = useI18n();
  const { getDashboard, getFixtures, getLeagueStandings, getTopScoreDetails } = useContainer();
  const { leagues, selectedLeagueId } = useLeagueSelection();
  const { session } = useSession();

  const [activeTab, setActiveTab] = useState<FixturesTab>("matches");
  const [selectedClub, setSelectedClub] = useState("all");
  const [gameweekPageIndex, setGameweekPageIndex] = useState(0);
  const [selectedStatType, setSelectedStatType] = useState<TopScoreType>("GOAL_TOPSCORER");
  const activeGameweekButtonRef = useRef<HTMLSelectElement | null>(null);

  const fixturesQuery = useQuery({
    queryKey: ["fixtures", selectedLeagueId],
    enabled: Boolean(selectedLeagueId),
    staleTime: cacheTtlMs.fixtures,
    queryFn: async () => {
      if (!selectedLeagueId) {
        return [];
      }

      return getFixtures.execute(selectedLeagueId);
    },
    refetchInterval: (query) => {
      const current = query.state.data ?? [];
      return current.some((fixture) => isLiveFixture(fixture)) ? 30_000 : 120_000;
    }
  });

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", session?.user.id],
    enabled: Boolean(session?.accessToken && session?.user.id),
    staleTime: cacheTtlMs.dashboard,
    queryFn: async () => {
      const accessToken = session?.accessToken?.trim() ?? "";
      const userId = session?.user.id?.trim() ?? "";
      if (!accessToken || !userId) {
        return null;
      }

      return getOrLoadCached({
        key: cacheKeys.dashboard(userId),
        ttlMs: cacheTtlMs.dashboard,
        loader: () => getDashboard.execute(accessToken),
        allowStaleOnError: false
      });
    }
  });

  const standingsQuery = useQuery<StandingsResponse>({
    queryKey: ["standings", selectedLeagueId],
    enabled: Boolean(selectedLeagueId) && activeTab === "table",
    staleTime: cacheTtlMs.liveStandings,
    queryFn: async () => {
      if (!selectedLeagueId) {
        return { mode: "final", items: [] };
      }

      try {
        const live = await getLeagueStandings.execute(selectedLeagueId, true);
        if (live.length > 0) {
          return {
            mode: "live",
            items: sortStandings(live)
          };
        }
      } catch {
        // Fallback to final standings.
      }

      const final = await getLeagueStandings.execute(selectedLeagueId, false);
      return {
        mode: "final",
        items: sortStandings(final)
      };
    },
    refetchInterval: (query) => {
      return query.state.data?.mode === "live" ? 30_000 : 120_000;
    }
  });

  useEffect(() => {
    if (!(fixturesQuery.error instanceof Error)) {
      return;
    }

    void appAlert.error(t("fixtures.alert.title"), fixturesQuery.error.message);
  }, [fixturesQuery.error, t]);

  useEffect(() => {
    if (!(standingsQuery.error instanceof Error)) {
      return;
    }

    void appAlert.error(t("fixtures.alert.standingsTitle"), standingsQuery.error.message);
  }, [standingsQuery.error, t]);

  const fixtures = fixturesQuery.data ?? [];
  const standings = standingsQuery.data?.items ?? [];
  const standingsMode = standingsQuery.data?.mode ?? "final";
  const derivedStandings = useMemo(() => buildStandingsFromFixtures(fixtures), [fixtures]);
  const effectiveStandings = standings.length > 0 ? standings : derivedStandings;
  const effectiveStandingsMode: StandingsMode =
    standings.length > 0
      ? standingsMode
      : derivedStandings.length > 0
        ? derivedStandings.some((item) => item.isLive)
          ? "live"
          : "derived"
        : "final";
  const standingsGameweek = useMemo(() => {
    let latest = 0;
    for (const item of effectiveStandings) {
      if (item.gameweek > latest) {
        latest = item.gameweek;
      }
    }
    return latest > 0 ? latest : null;
  }, [effectiveStandings]);

  const selectedLeagueName = useMemo(() => {
    return leagues.find((league) => league.id === selectedLeagueId)?.name ?? t("fixtures.defaultLeague");
  }, [leagues, selectedLeagueId, t]);

  const groupedByGameweek = useMemo(() => {
    const sorted = [...fixtures].sort(
      (left, right) => new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime()
    );
    const grouped = new Map<number, Fixture[]>();

    for (const fixture of sorted) {
      const bucket = grouped.get(fixture.gameweek) ?? [];
      bucket.push(fixture);
      grouped.set(fixture.gameweek, bucket);
    }

    return [...grouped.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([gameweek, items]) => ({ gameweek, items }));
  }, [fixtures]);

  const nearestGameweekIndex = useMemo(() => {
    if (groupedByGameweek.length === 0) {
      return 0;
    }

    const now = Date.now();
    let bestIndex = 0;
    let bestDiff = Number.POSITIVE_INFINITY;

    groupedByGameweek.forEach((group, index) => {
      for (const fixture of group.items) {
        const diff = Math.abs(new Date(fixture.kickoffAt).getTime() - now);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIndex = index;
        }
      }
    });

    return bestIndex;
  }, [groupedByGameweek]);

  const backendGameweek = dashboardQuery.data?.currentGameweek ?? dashboardQuery.data?.gameweek ?? null;
  const preferredGameweekIndex = useMemo(() => {
    if (groupedByGameweek.length === 0) {
      return 0;
    }
    if (backendGameweek) {
      const backendIndex = groupedByGameweek.findIndex((item) => item.gameweek === backendGameweek);
      if (backendIndex >= 0) {
        return backendIndex;
      }
    }

    return nearestGameweekIndex;
  }, [backendGameweek, groupedByGameweek, nearestGameweekIndex]);

  useEffect(() => {
    setGameweekPageIndex(preferredGameweekIndex);
  }, [preferredGameweekIndex, selectedLeagueId]);

  const activeGameweekGroup = groupedByGameweek[gameweekPageIndex] ?? null;
  const activeGameweekFixtures = activeGameweekGroup?.items ?? [];
  const activeGameweek = activeGameweekGroup?.gameweek ?? null;
  const seasonLabel = seasonLabelFromDate(activeGameweekFixtures[0]?.kickoffAt ?? new Date().toISOString());
  const matchweekRange = formatRangeLabel(activeGameweekFixtures, dateLocale);
  const apiSeasonLabel = seasonLabel.replace("/", "-");
  const statsQuery = useQuery({
    queryKey: ["top-score", selectedLeagueId, apiSeasonLabel, selectedStatType],
    enabled: Boolean(selectedLeagueId) && activeTab === "stats",
    staleTime: 60_000,
    queryFn: async () => {
      if (!selectedLeagueId) return [];
      const response = getTopScoreDetails.execute(selectedLeagueId, seasonLabel, selectedStatType);
      console.log( "----->", response);
      return response
    }
  });
  const availableClubs = useMemo(() => {
    const names = new Set<string>();
    for (const fixture of activeGameweekFixtures) {
      names.add(fixture.homeTeam);
      names.add(fixture.awayTeam);
    }
    return [...names].sort((left, right) => left.localeCompare(right));
  }, [activeGameweekFixtures]);

  useEffect(() => {
    if (selectedClub === "all") {
      return;
    }
    if (!availableClubs.includes(selectedClub)) {
      setSelectedClub("all");
    }
  }, [availableClubs, selectedClub]);

  const filteredFixtures = useMemo(() => {
    if (selectedClub === "all") {
      return activeGameweekFixtures;
    }
    return activeGameweekFixtures.filter(
      (fixture) => fixture.homeTeam === selectedClub || fixture.awayTeam === selectedClub
    );
  }, [activeGameweekFixtures, selectedClub]);

  const fixturesByDay = useMemo(() => {
    const grouped = new Map<string, Fixture[]>();
    const orderedKeys: string[] = [];

    for (const fixture of filteredFixtures) {
      const key = toDayKey(fixture.kickoffAt);
      if (!grouped.has(key)) {
        grouped.set(key, []);
        orderedKeys.push(key);
      }
      grouped.get(key)?.push(fixture);
    }

    return orderedKeys.map((key) => {
      const items = grouped.get(key) ?? [];
      return {
        key,
        label: formatDayLabel(items[0]?.kickoffAt ?? new Date().toISOString(), dateLocale),
        items: [...items].sort(
          (left, right) => new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime()
        )
      };
    });
  }, [dateLocale, filteredFixtures]);

  const standingsColumns = useMemo<ColumnDef<LeagueStanding>[]>(
    () => [
      {
        id: "position",
        accessorKey: "position",
        header: "#"
      },
      {
        id: "club",
        header: t("fixtures.table.club"),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="fixtures-standing-team-cell">
              {item.teamLogoUrl ? (
                <LazyImage
                  src={item.teamLogoUrl}
                  alt={item.teamName ?? item.teamId}
                  className="fixtures-standing-logo"
                  fallback={<span className="fixtures-standing-logo fixtures-standing-logo-fallback">T</span>}
                />
              ) : (
                <span className="fixtures-standing-logo fixtures-standing-logo-fallback">T</span>
              )}
              <strong>{item.teamName ?? item.teamId}</strong>
            </div>
          );
        }
      },
      { id: "played", accessorKey: "played", header: "MP" },
      { id: "won", accessorKey: "won", header: "W" },
      { id: "draw", accessorKey: "draw", header: "D" },
      { id: "lost", accessorKey: "lost", header: "L" },
      { id: "goalsFor", accessorKey: "goalsFor", header: "GF" },
      { id: "goalsAgainst", accessorKey: "goalsAgainst", header: "GA" },
      { id: "goalDifference", accessorKey: "goalDifference", header: "GD" },
      {
        id: "points",
        accessorKey: "points",
        header: "Pts"
      },
      {
        id: "form",
        header: t("fixtures.table.lastFive"),
        cell: ({ row }) => {
          const recentForm = parseStandingForm(row.original.form);
          return (
            <div className="fixtures-standing-form" aria-label={t("fixtures.form.aria")}>
              {recentForm.map((result, index) => (
                <span
                  key={`${row.original.teamId}-form-${index}`}
                  className={`fixtures-standing-form-chip ${result ? `fixtures-standing-form-${result.toLowerCase()}` : "fixtures-standing-form-empty-chip"} ${index === recentForm.length - 1 ? "latest" : ""}`}
                  title={
                    result === "W"
                      ? t("fixtures.form.win")
                      : result === "D"
                        ? t("fixtures.form.draw")
                        : result === "L"
                          ? t("fixtures.form.loss")
                          : t("fixtures.form.noData")
                  }
                >
                  {result === "W" ? "✓" : result === "D" ? "—" : result === "L" ? "✕" : "·"}
                </span>
              ))}
            </div>
          );
        }
      }
    ],
    [t]
  );
  const statsItems = statsQuery.data ?? [];

  const statsColumns = useMemo<ColumnDef<TopScoresDetail>[]>(
    () => [
      { id: "rank", accessorKey: "rank", header: "#" },
      {
        id: "player",
        header: "Player",
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="fixtures-standing-team-cell">
              {item.imagePlayer ? (
                <LazyImage
                  src={item.imagePlayer}
                  alt={item.playerName}
                  className="fixtures-standing-logo"
                  fallback={<span className="fixtures-standing-logo fixtures-standing-logo-fallback">P</span>}
                />
              ) : (
                <span className="fixtures-standing-logo fixtures-standing-logo-fallback">P</span>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <strong>{item.playerName}</strong>
                {item.positionName ? <span className="muted">{item.positionName}</span> : null}
              </div>
            </div>
          );
        }
      },
      {
        id: "club",
        header: "Club",
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="fixtures-standing-team-cell">
              {item.imageParticipant ? (
                <LazyImage
                  src={item.imageParticipant}
                  alt={item.participantName}
                  className="fixtures-standing-logo"
                  fallback={<span className="fixtures-standing-logo fixtures-standing-logo-fallback">C</span>}
                />
              ) : (
                <span className="fixtures-standing-logo fixtures-standing-logo-fallback">C</span>
              )}
              <strong>{item.participantName}</strong>
            </div>
          );
        }
      },
      {
        id: "nationality",
        header: "Nationality",
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="fixtures-standing-team-cell">
              {item.imageNationality ? (
                <LazyImage
                  src={item.imageNationality}
                  alt={item.nationality ?? "Nationality"}
                  className="fixtures-standing-logo"
                  fallback={<span className="fixtures-standing-logo fixtures-standing-logo-fallback">N</span>}
                />
              ) : (
                <span className="fixtures-standing-logo fixtures-standing-logo-fallback">N</span>
              )}
              <span>{item.nationality ?? "-"}</span>
            </div>
          );
        }
      },
      {
        id: "total",
        accessorKey: "total",
        header: totalHeaderFromType(selectedStatType)
      }
    ],
    [selectedStatType]
  );

  const standingsTable = useReactTable({
    data: effectiveStandings,
    columns: standingsColumns,
    getCoreRowModel: getCoreRowModel()
  });

  const statsTable = useReactTable({
    data: statsItems,
    columns: statsColumns,
    getCoreRowModel: getCoreRowModel()
  });

  const onResetFilters = () => {
    setSelectedClub("all");
    setGameweekPageIndex(nearestGameweekIndex);
    if (activeGameweekButtonRef.current) {
      activeGameweekButtonRef.current.blur();
    }
  };

  const moveWeek = (direction: -1 | 1) => {
    setGameweekPageIndex((previous) => {
      const next = previous + direction;
      if (next < 0) {
        return 0;
      }
      if (next > groupedByGameweek.length - 1) {
        return groupedByGameweek.length - 1;
      }
      return next;
    });
  };

  return (
    <div className="page-grid fixtures-v2-page">
      <section className="fixtures-v2-hero">
        <p className="fixtures-v2-hero-label">{t("fixtures.season")}</p>
        <button type="button" className="fixtures-v2-season-button">
          {seasonLabel}
          <ChevronDown className="inline-icon" aria-hidden="true" />
        </button>
      </section>

      <section className="fixtures-v2-tabs" role="tablist" aria-label={t("fixtures.alert.title")}>
        <button
          type="button"
          role="tab"
          className={`fixtures-v2-tab ${activeTab === "matches" ? "active" : ""}`}
          aria-selected={activeTab === "matches"}
          onClick={() => setActiveTab("matches")}
        >
          {t("fixtures.tab.matches")}
        </button>
        <button
          type="button"
          role="tab"
          className={`fixtures-v2-tab ${activeTab === "table" ? "active" : ""}`}
          aria-selected={activeTab === "table"}
          onClick={() => setActiveTab("table")}
        >
          {t("fixtures.tab.table")}
        </button>
        <button
          type="button"
          role="tab"
          className={`fixtures-v2-tab ${activeTab === "stats" ? "active" : ""}`}
          aria-selected={activeTab === "stats"}
          onClick={() => setActiveTab("stats")}
        >
          {t("fixtures.tab.stats")}
        </button>
      </section>

      <AnimatePresence mode="wait" initial={false}>
        {activeTab === "matches" ? (
          <motion.div key="fixtures-matches" {...tableTransition}>
            <section className="fixtures-v2-filters">
              <button type="button" className="fixtures-v2-filter-chip">
                {selectedLeagueName}
                <ChevronDown className="inline-icon" aria-hidden="true" />
              </button>

              <label className="fixtures-v2-filter-select">
                <select
                  ref={activeGameweekButtonRef}
                  value={String(activeGameweek ?? "")}
                  onChange={(event) => {
                    const nextGameweek = Number(event.target.value);
                    const nextIndex = groupedByGameweek.findIndex((item) => item.gameweek === nextGameweek);
                    if (nextIndex >= 0) {
                      setGameweekPageIndex(nextIndex);
                    }
                  }}
                >
                  {groupedByGameweek.map((group) => (
                    <option key={group.gameweek} value={group.gameweek}>
                      {t("fixtures.matchweek", { gameweek: group.gameweek })}
                    </option>
                  ))}
                </select>
                <ChevronDown className="inline-icon" aria-hidden="true" />
              </label>

              <label className="fixtures-v2-filter-select">
                <select value={selectedClub} onChange={(event) => setSelectedClub(event.target.value)}>
                  <option value="all">{t("fixtures.filter.allClubs")}</option>
                  {availableClubs.map((club) => (
                    <option key={club} value={club}>
                      {club}
                    </option>
                  ))}
                </select>
                <ChevronDown className="inline-icon" aria-hidden="true" />
              </label>

              <button type="button" className="fixtures-v2-filter-reset" onClick={onResetFilters}>
                {t("fixtures.filter.reset")}
              </button>
            </section>

            <section className="fixtures-v2-week-head">
              <button
                type="button"
                className="fixtures-v2-week-nav"
                onClick={() => moveWeek(-1)}
                disabled={gameweekPageIndex <= 0}
              >
                <ChevronLeft className="inline-icon" aria-hidden="true" />
              </button>
              <div>
                <h3>{t("fixtures.matchweek", { gameweek: activeGameweek ?? "-" })}</h3>
                <p>{matchweekRange}</p>
              </div>
              <button
                type="button"
                className="fixtures-v2-week-nav"
                onClick={() => moveWeek(1)}
                disabled={gameweekPageIndex >= groupedByGameweek.length - 1}
              >
                <ChevronRight className="inline-icon" aria-hidden="true" />
              </button>
            </section>

            {fixturesQuery.isPending ? <LoadingState label={t("fixtures.loading.fixtures")} /> : null}
            {!fixturesQuery.isPending && fixturesByDay.length === 0 ? <p className="muted">{t("fixtures.empty.fixtures")}</p> : null}

            {!fixturesQuery.isPending ? (
              <div className="fixtures-v2-day-list">
                {fixturesByDay.map((dayGroup, index) => (
                  <motion.section
                    key={dayGroup.key}
                    className="fixtures-v2-day-card"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                  >
                    <h4>{dayGroup.label}</h4>
                    <div className="fixtures-v2-match-list">
                      {dayGroup.items.map((fixture) => (
                        <Link
                          key={fixture.id}
                          className="fixture-modern-link"
                          to={`/fixtures/${encodeURIComponent(fixture.id)}?leagueId=${encodeURIComponent(selectedLeagueId)}`}
                        >
                          <FixtureCard fixture={fixture} />
                        </Link>
                      ))}
                    </div>
                  </motion.section>
                ))}
              </div>
            ) : null}
          </motion.div>
        ) : null}

        {activeTab === "table" ? (
          <motion.div key="fixtures-table" {...tableTransition}>
            {standingsQuery.isPending && effectiveStandings.length === 0 ? (
              <LoadingState label={t("fixtures.loading.standings")} />
            ) : null}
            {!standingsQuery.isPending && effectiveStandings.length === 0 ? (
              <p className="muted">{t("fixtures.empty.standings")}</p>
            ) : null}

            {!standingsQuery.isPending && effectiveStandings.length > 0 ? (
              <div className="fixtures-standings-shell">
                <div className="fixtures-standings-shell-head">
                  <span className={`fixtures-standings-mode ${effectiveStandingsMode === "live" ? "live" : ""}`}>
                    {effectiveStandingsMode === "live"
                      ? t("fixtures.mode.live")
                      : effectiveStandingsMode === "derived"
                        ? t("fixtures.mode.provisional")
                        : t("fixtures.mode.official")}
                  </span>
                  <span className="fixtures-standings-snapshot">
                    {standingsGameweek !== null
                      ? t("fixtures.snapshot.gw", { gameweek: standingsGameweek })
                      : t("fixtures.snapshot.latest")}
                  </span>
                </div>

                <div className="fixtures-standings-table-wrap">
                  <table className="fixtures-standings-table">
                    <thead>
                      {standingsTable.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <th key={header.id}>
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {standingsTable.getRowModel().rows.map((row) => (
                        <tr key={row.id}>
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className={cell.column.id === "points" ? "fixtures-standing-points" : undefined}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </motion.div>
        ) : null}

        {activeTab === "stats" ? (
          <motion.div key="fixtures-stats" {...tableTransition}>
            <div className="fixtures-standings-shell">
              <div className="fixtures-standings-shell-head" style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <label className="fixtures-v2-filter-select" style={{ minWidth: 220 }}>
                  <select
                    value={selectedStatType}
                    onChange={(e) => setSelectedStatType(e.target.value as TopScoreType)}
                  >
                    {topScoreOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="inline-icon" aria-hidden="true" />
                </label>

                <span className="muted">Topscorers — {seasonLabel}</span>
              </div>

              {statsQuery.isPending ? <LoadingState label="Loading stats" /> : null}
              {!statsQuery.isPending && statsItems.length === 0 ? <p className="muted">No stats found.</p> : null}

              {!statsQuery.isPending && statsItems.length > 0 ? (
                <div className="fixtures-standings-table-wrap">
                  <table className="fixtures-standings-table">
                    <thead>
                      {statsTable.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <th key={header.id}>
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {statsTable.getRowModel().rows.map((row) => (
                        <tr key={row.id}>
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className={cell.column.id === "total" ? "fixtures-standing-points" : undefined}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
