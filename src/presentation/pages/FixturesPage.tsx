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
type StandingsMode = "live" | "final";
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
const FIXTURES_PAGE_SIZE = 12;

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
  const [selectedGameweek, setSelectedGameweek] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStatType, setSelectedStatType] = useState<TopScoreType>("GOAL_TOPSCORER");
  const activeGameweekButtonRef = useRef<HTMLSelectElement | null>(null);

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

  const backendGameweek = dashboardQuery.data?.currentGameweek ?? dashboardQuery.data?.gameweek ?? null;
  const activeGameweek = selectedGameweek ?? backendGameweek ?? null;

  const fixturesQuery = useQuery({
    queryKey: ["fixtures", selectedLeagueId, activeGameweek, currentPage],
    enabled: Boolean(selectedLeagueId && activeGameweek && activeGameweek > 0),
    staleTime: cacheTtlMs.fixtures,
    queryFn: async () => {
      if (!selectedLeagueId || !activeGameweek || activeGameweek <= 0) {
        return {
          leagueId: selectedLeagueId ?? "",
          gameweek: activeGameweek ?? 0,
          page: currentPage,
          pageSize: FIXTURES_PAGE_SIZE,
          total: 0,
          totalPages: 0,
          items: []
        };
      }

      return getFixtures.execute(selectedLeagueId, activeGameweek, currentPage, FIXTURES_PAGE_SIZE);
    },
    refetchInterval: (query) => {
      const current = query.state.data?.items ?? [];
      return current.some((fixture) => isLiveFixture(fixture)) ? 30_000 : 120_000;
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

  useEffect(() => {
    setSelectedGameweek(null);
    setCurrentPage(1);
    setSelectedClub("all");
  }, [selectedLeagueId]);

  useEffect(() => {
    if (selectedGameweek !== null) {
      return;
    }
    if (!backendGameweek || backendGameweek <= 0) {
      return;
    }

    setSelectedGameweek(backendGameweek);
  }, [backendGameweek, selectedGameweek]);

  const fixturePage = fixturesQuery.data;
  const fixtures = fixturePage?.items ?? [];
  const standings = standingsQuery.data?.items ?? [];
  const standingsMode = standingsQuery.data?.mode ?? "final";
  const effectiveStandings = standings;
  const effectiveStandingsMode: StandingsMode = standings.length > 0 ? standingsMode : "final";
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

  const seasonLabel = seasonLabelFromDate(fixtures[0]?.kickoffAt ?? new Date().toISOString());
  const matchweekRange = formatRangeLabel(fixtures, dateLocale);
  const apiSeasonLabel = seasonLabel.replace("/", "-");
  const statsQuery = useQuery({
    queryKey: ["top-score", selectedLeagueId, apiSeasonLabel, selectedStatType],
    enabled: Boolean(selectedLeagueId) && activeTab === "stats",
    staleTime: 60_000,
    queryFn: async () => {
      if (!selectedLeagueId) return [];
      return getTopScoreDetails.execute(selectedLeagueId, seasonLabel, selectedStatType);
    }
  });
  const availableClubs = useMemo(() => {
    const names = new Set<string>();
    for (const fixture of fixtures) {
      names.add(fixture.homeTeam);
      names.add(fixture.awayTeam);
    }
    return [...names].sort((left, right) => left.localeCompare(right));
  }, [fixtures]);

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
      return fixtures;
    }
    return fixtures.filter(
      (fixture) => fixture.homeTeam === selectedClub || fixture.awayTeam === selectedClub
    );
  }, [fixtures, selectedClub]);

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

  const gameweekOptions = useMemo(() => {
    const baseGameweek = activeGameweek && activeGameweek > 0 ? activeGameweek : backendGameweek && backendGameweek > 0 ? backendGameweek : 1;
    const start = Math.max(1, baseGameweek - 3);
    return Array.from({ length: 7 }, (_, index) => start + index);
  }, [activeGameweek, backendGameweek]);

  const onResetFilters = () => {
    setSelectedClub("all");
    setSelectedGameweek(backendGameweek ?? activeGameweek ?? 1);
    setCurrentPage(1);
    if (activeGameweekButtonRef.current) {
      activeGameweekButtonRef.current.blur();
    }
  };

  const moveWeek = (direction: -1 | 1) => {
    const baseGameweek = activeGameweek ?? 1;
    setSelectedGameweek(Math.max(1, baseGameweek + direction));
    setCurrentPage(1);
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
                    if (Number.isFinite(nextGameweek) && nextGameweek > 0) {
                      setSelectedGameweek(nextGameweek);
                      setCurrentPage(1);
                    }
                  }}
                >
                  {gameweekOptions.map((gameweek) => (
                    <option key={gameweek} value={gameweek}>
                      {t("fixtures.matchweek", { gameweek })}
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
                disabled={(activeGameweek ?? 1) <= 1}
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

            {!fixturesQuery.isPending && (fixturePage?.totalPages ?? 0) > 1 ? (
              <section className="fixtures-v2-week-head">
                <button
                  type="button"
                  className="fixtures-v2-week-nav"
                  onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="inline-icon" aria-hidden="true" />
                </button>
                <div>
                  <h3>{t("fixtures.pagination.summary", { page: currentPage, totalPages: fixturePage?.totalPages ?? 0 })}</h3>
                  <p>{t("fixtures.pagination.total", { total: fixturePage?.total ?? 0 })}</p>
                </div>
                <button
                  type="button"
                  className="fixtures-v2-week-nav"
                  onClick={() =>
                    setCurrentPage((previous) =>
                      Math.min(fixturePage?.totalPages ?? previous, previous + 1)
                    )
                  }
                  disabled={currentPage >= (fixturePage?.totalPages ?? 0)}
                >
                  <ChevronRight className="inline-icon" aria-hidden="true" />
                </button>
              </section>
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
