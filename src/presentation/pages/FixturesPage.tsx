import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import { cacheTtlMs } from "../../app/cache/requestCache";
import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import type { LeagueStanding } from "../../domain/fantasy/entities/LeagueStanding";
import { LoadingState } from "../components/LoadingState";
import { useLeagueSelection } from "../hooks/useLeagueSelection";
import { appAlert } from "../lib/appAlert";
import { LazyImage } from "../components/LazyImage";
import { isLiveFixture } from "../lib/fixtureDisplay";
import { FixtureMatchRow } from "../components/FixtureMatchRow";

type FixturesTab = "matches" | "table" | "stats";
type FormResult = "W" | "D" | "L";
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

const formatDayLabel = (kickoffAt: string): string => {
  return new Intl.DateTimeFormat("en-GB", {
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

const formatRangeLabel = (items: Fixture[]): string => {
  if (items.length === 0) {
    return "-";
  }

  const sorted = [...items].sort(
    (left, right) => new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime()
  );

  const start = sorted[0];
  const end = sorted[sorted.length - 1];
  const startLabel = formatDayLabel(start.kickoffAt);
  const endLabel = formatDayLabel(end.kickoffAt);
  return `${startLabel} - ${endLabel}`;
};

const seasonLabelFromDate = (value: string): string => {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const startYear = month >= 6 ? year : year - 1;
  const endYear = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}/${endYear}`;
};

const tableTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.2, ease: "easeOut" as const }
};

export const FixturesPage = () => {
  const { getFixtures, getLeagueStandings } = useContainer();
  const { leagues, selectedLeagueId } = useLeagueSelection();

  const [activeTab, setActiveTab] = useState<FixturesTab>("matches");
  const [selectedClub, setSelectedClub] = useState("all");
  const [gameweekPageIndex, setGameweekPageIndex] = useState(0);
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

    void appAlert.error("Fixtures", fixturesQuery.error.message);
  }, [fixturesQuery.error]);

  useEffect(() => {
    if (!(standingsQuery.error instanceof Error)) {
      return;
    }

    void appAlert.error("Standings", standingsQuery.error.message);
  }, [standingsQuery.error]);

  const fixtures = fixturesQuery.data ?? [];
  const standings = standingsQuery.data?.items ?? [];
  const standingsMode = standingsQuery.data?.mode ?? "final";

  const selectedLeagueName = useMemo(() => {
    return leagues.find((league) => league.id === selectedLeagueId)?.name ?? "Liga 1 Indonesia";
  }, [leagues, selectedLeagueId]);

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

  useEffect(() => {
    setGameweekPageIndex(nearestGameweekIndex);
  }, [nearestGameweekIndex, selectedLeagueId]);

  const activeGameweekGroup = groupedByGameweek[gameweekPageIndex] ?? null;
  const activeGameweekFixtures = activeGameweekGroup?.items ?? [];
  const activeGameweek = activeGameweekGroup?.gameweek ?? null;
  const seasonLabel = seasonLabelFromDate(activeGameweekFixtures[0]?.kickoffAt ?? new Date().toISOString());
  const matchweekRange = formatRangeLabel(activeGameweekFixtures);

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
        label: formatDayLabel(items[0]?.kickoffAt ?? new Date().toISOString()),
        items: [...items].sort(
          (left, right) => new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime()
        )
      };
    });
  }, [filteredFixtures]);

  const standingsColumns = useMemo<ColumnDef<LeagueStanding>[]>(
    () => [
      {
        id: "position",
        accessorKey: "position",
        header: "#"
      },
      {
        id: "club",
        header: "Club",
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
        header: "Last 5",
        cell: ({ row }) => {
          const recentForm = parseStandingForm(row.original.form);
          return (
            <div className="fixtures-standing-form" aria-label="Last five form">
              {recentForm.map((result, index) => (
                <span
                  key={`${row.original.teamId}-form-${index}`}
                  className={`fixtures-standing-form-chip ${result ? `fixtures-standing-form-${result.toLowerCase()}` : "fixtures-standing-form-empty-chip"} ${index === recentForm.length - 1 ? "latest" : ""}`}
                  title={
                    result === "W" ? "Win" : result === "D" ? "Draw" : result === "L" ? "Loss" : "No data"
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
    []
  );

  const standingsTable = useReactTable({
    data: standings,
    columns: standingsColumns,
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
        <p className="fixtures-v2-hero-label">Season</p>
        <button type="button" className="fixtures-v2-season-button">
          {seasonLabel}
          <ChevronDown className="inline-icon" aria-hidden="true" />
        </button>
      </section>

      <section className="fixtures-v2-tabs" role="tablist" aria-label="Fixtures tabs">
        <button
          type="button"
          role="tab"
          className={`fixtures-v2-tab ${activeTab === "matches" ? "active" : ""}`}
          aria-selected={activeTab === "matches"}
          onClick={() => setActiveTab("matches")}
        >
          Matches
        </button>
        <button
          type="button"
          role="tab"
          className={`fixtures-v2-tab ${activeTab === "table" ? "active" : ""}`}
          aria-selected={activeTab === "table"}
          onClick={() => setActiveTab("table")}
        >
          Table
        </button>
        <button
          type="button"
          role="tab"
          className={`fixtures-v2-tab ${activeTab === "stats" ? "active" : ""}`}
          aria-selected={activeTab === "stats"}
          onClick={() => setActiveTab("stats")}
        >
          Stats
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
                      Matchweek {group.gameweek}
                    </option>
                  ))}
                </select>
                <ChevronDown className="inline-icon" aria-hidden="true" />
              </label>

              <label className="fixtures-v2-filter-select">
                <select value={selectedClub} onChange={(event) => setSelectedClub(event.target.value)}>
                  <option value="all">All Clubs</option>
                  {availableClubs.map((club) => (
                    <option key={club} value={club}>
                      {club}
                    </option>
                  ))}
                </select>
                <ChevronDown className="inline-icon" aria-hidden="true" />
              </label>

              <button type="button" className="fixtures-v2-filter-reset" onClick={onResetFilters}>
                Reset
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
                <h3>Matchweek {activeGameweek ?? "-"}</h3>
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

            {fixturesQuery.isPending ? <LoadingState label="Loading fixtures" /> : null}
            {!fixturesQuery.isPending && fixturesByDay.length === 0 ? <p className="muted">No fixtures found.</p> : null}

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
                        <FixtureMatchRow
                          key={fixture.id}
                          fixture={fixture}
                          to={`/fixtures/${encodeURIComponent(fixture.id)}?leagueId=${encodeURIComponent(selectedLeagueId)}`}
                        />
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
            {standingsQuery.isPending ? <LoadingState label="Loading standings" /> : null}
            {!standingsQuery.isPending && standings.length === 0 ? <p className="muted">No standings found.</p> : null}

            {!standingsQuery.isPending && standings.length > 0 ? (
              <div className="fixtures-standings-shell">
                <div className="fixtures-standings-shell-head">
                  <span className={`fixtures-standings-mode ${standingsMode === "live" ? "live" : ""}`}>
                    {standingsMode === "live" ? "Live" : "Official"}
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
          <motion.section key="fixtures-stats" className="fixtures-v2-stats-placeholder" {...tableTransition}>
            <h3>Stats</h3>
            <p>Advanced match stats and trends will appear here.</p>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
