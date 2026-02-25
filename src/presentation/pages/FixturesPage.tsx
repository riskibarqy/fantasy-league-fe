import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import { cacheKeys, cacheTtlMs, getOrLoadCached } from "../../app/cache/requestCache";
import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import type { LeagueStanding } from "../../domain/fantasy/entities/LeagueStanding";
import { FixtureCard } from "../components/FixtureCard";
import { LazyImage } from "../components/LazyImage";
import { LoadingState } from "../components/LoadingState";
import { useLeagueSelection } from "../hooks/useLeagueSelection";
import { appAlert } from "../lib/appAlert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type FixturesTab = "fixtures" | "standings";

const LIVE_STATUSES = new Set(["LIVE", "IN_PLAY", "HT", "1H", "2H", "ET"]);

const isLiveFixture = (fixture: Fixture): boolean => {
  const status = fixture.status?.trim().toUpperCase() ?? "";
  return LIVE_STATUSES.has(status);
};

export const FixturesPage = () => {
  const { getFixtures, getLeagueStandings } = useContainer();
  const { leagues, selectedLeagueId } = useLeagueSelection();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [standings, setStandings] = useState<LeagueStanding[]>([]);
  const [standingsMode, setStandingsMode] = useState<"live" | "final">("final");
  const [isFixturesLoading, setIsFixturesLoading] = useState(false);
  const [isStandingsLoading, setIsStandingsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FixturesTab>("fixtures");
  const [gameweekPageIndex, setGameweekPageIndex] = useState(0);
  const activeGameweekButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (errorMessage) {
      void appAlert.error("Fixtures Load Failed", errorMessage);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (!selectedLeagueId) {
      setFixtures([]);
      return;
    }

    let mounted = true;
    let timerID: number | null = null;

    const loadFixtures = async (forceRefresh = false) => {
      try {
        setIsFixturesLoading(true);
        const result = await getOrLoadCached({
          key: cacheKeys.fixtures(selectedLeagueId),
          ttlMs: cacheTtlMs.fixtures,
          loader: () => getFixtures.execute(selectedLeagueId),
          allowStaleOnError: true,
          forceRefresh
        });
        if (!mounted) {
          return;
        }

        setFixtures(result);
        setErrorMessage(null);

        const pollDelay = result.some((item) => isLiveFixture(item)) ? 30_000 : 120_000;
        timerID = window.setTimeout(() => void loadFixtures(true), pollDelay);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Failed to load fixtures.");
        timerID = window.setTimeout(() => void loadFixtures(true), 120_000);
      } finally {
        if (mounted) {
          setIsFixturesLoading(false);
        }
      }
    };

    void loadFixtures();

    return () => {
      mounted = false;
      if (timerID !== null) {
        window.clearTimeout(timerID);
      }
    };
  }, [getFixtures, selectedLeagueId]);

  useEffect(() => {
    if (!selectedLeagueId || activeTab !== "standings") {
      return;
    }

    let mounted = true;
    let timerID: number | null = null;

    const loadStandings = async (forceRefresh = false) => {
      try {
        setIsStandingsLoading(true);

        let liveItems: LeagueStanding[] = [];
        try {
          liveItems = await getOrLoadCached({
            key: cacheKeys.liveStandings(selectedLeagueId),
            ttlMs: cacheTtlMs.liveStandings,
            loader: () => getLeagueStandings.execute(selectedLeagueId, true),
            allowStaleOnError: true,
            forceRefresh
          });
        } catch {
          liveItems = [];
        }

        if (liveItems.length > 0) {
          if (!mounted) {
            return;
          }
          setStandings([...liveItems].sort((left, right) => left.position - right.position));
          setStandingsMode("live");
          setErrorMessage(null);
          timerID = window.setTimeout(() => void loadStandings(true), 30_000);
          return;
        }

        const finalItems = await getOrLoadCached({
          key: cacheKeys.standings(selectedLeagueId),
          ttlMs: cacheTtlMs.standings,
          loader: () => getLeagueStandings.execute(selectedLeagueId, false),
          allowStaleOnError: true,
          forceRefresh
        });
        if (!mounted) {
          return;
        }

        setStandings([...finalItems].sort((left, right) => left.position - right.position));
        setStandingsMode("final");
        setErrorMessage(null);
        timerID = window.setTimeout(() => void loadStandings(true), 120_000);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Failed to load standings.");
        timerID = window.setTimeout(() => void loadStandings(true), 120_000);
      } finally {
        if (mounted) {
          setIsStandingsLoading(false);
        }
      }
    };

    void loadStandings();

    return () => {
      mounted = false;
      if (timerID !== null) {
        window.clearTimeout(timerID);
      }
    };
  }, [activeTab, getLeagueStandings, selectedLeagueId]);

  const selectedLeagueName = useMemo(() => {
    return leagues.find((league) => league.id === selectedLeagueId)?.name ?? "League";
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

  const nearestGameweek = useMemo(() => {
    if (fixtures.length === 0) {
      return null;
    }

    const now = Date.now();
    let nearestFixture: Fixture | null = null;
    let smallestDiff = Number.POSITIVE_INFINITY;

    for (const fixture of fixtures) {
      const fixtureAt = new Date(fixture.kickoffAt).getTime();
      const diff = Math.abs(fixtureAt - now);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        nearestFixture = fixture;
        continue;
      }

      if (
        diff === smallestDiff &&
        nearestFixture &&
        fixtureAt >= now &&
        new Date(nearestFixture.kickoffAt).getTime() < now
      ) {
        nearestFixture = fixture;
      }
    }

    return nearestFixture?.gameweek ?? null;
  }, [fixtures]);

  useEffect(() => {
    if (groupedByGameweek.length === 0) {
      setGameweekPageIndex(0);
      return;
    }

    const nearestIndex =
      nearestGameweek === null
        ? -1
        : groupedByGameweek.findIndex((group) => group.gameweek === nearestGameweek);

    setGameweekPageIndex(nearestIndex >= 0 ? nearestIndex : 0);
  }, [groupedByGameweek, nearestGameweek, selectedLeagueId]);

  useEffect(() => {
    if (!activeGameweekButtonRef.current) {
      return;
    }

    activeGameweekButtonRef.current.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest"
    });
  }, [gameweekPageIndex, groupedByGameweek.length]);

  const activeGameweekGroup = groupedByGameweek[gameweekPageIndex] ?? null;
  const activeGameweek = activeGameweekGroup?.gameweek ?? null;
  const totalGameweeks = groupedByGameweek.length;

  return (
    <div className="page-grid">
      <Card className="card page-section">
        <div className="home-section-head">
          <div className="section-title">
            <h2 className="section-icon-title">
              <CalendarDays className="inline-icon" aria-hidden="true" />
              Fixtures
            </h2>
            <p className="small-label">{selectedLeagueName}</p>
            <p className="muted">
              {activeTab === "fixtures"
                ? activeGameweekGroup
                  ? `${activeGameweekGroup.items.length} matches in GW ${activeGameweek}`
                  : "0 matches"
                : `${standings.length} teams`}
              {activeTab === "fixtures" && fixtures.length > 0 ? ` • ${fixtures.length} total` : ""}
              {activeTab === "standings" ? ` • ${standingsMode === "live" ? "Live table" : "Official table"}` : ""}
            </p>
          </div>
        </div>

        <div className="segmented-control fixtures-segmented" role="tablist" aria-label="Fixtures and standings tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "fixtures"}
            className={`segment ${activeTab === "fixtures" ? "active" : ""}`}
            onClick={() => setActiveTab("fixtures")}
          >
            Fixtures
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "standings"}
            className={`segment ${activeTab === "standings" ? "active" : ""}`}
            onClick={() => setActiveTab("standings")}
          >
            Standing
          </button>
        </div>

        {activeTab === "fixtures" ? (
          <>
            {totalGameweeks > 0 ? (
              <div className="fixtures-pagination">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="fixtures-page-nav"
                  onClick={() => setGameweekPageIndex((previous) => Math.max(0, previous - 1))}
                  disabled={gameweekPageIndex <= 0}
                >
                  <ChevronLeft className="inline-icon" aria-hidden="true" />
                  Prev
                </Button>

                <div className="fixtures-gw-strip" role="tablist" aria-label="Gameweek list">
                  {groupedByGameweek.map((group, index) => {
                    const isActive = index === gameweekPageIndex;
                    return (
                      <button
                        key={group.gameweek}
                        ref={isActive ? activeGameweekButtonRef : null}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        className={`fixtures-gw-chip ${isActive ? "active" : ""}`}
                        onClick={() => setGameweekPageIndex(index)}
                      >
                        GW {group.gameweek}
                      </button>
                    );
                  })}
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="fixtures-page-nav"
                  onClick={() =>
                    setGameweekPageIndex((previous) => Math.min(groupedByGameweek.length - 1, previous + 1))
                  }
                  disabled={gameweekPageIndex >= groupedByGameweek.length - 1}
                >
                  Next
                  <ChevronRight className="inline-icon" aria-hidden="true" />
                </Button>
              </div>
            ) : null}

            {isFixturesLoading ? <LoadingState label="Loading fixtures" /> : null}
            {isFixturesLoading ? (
              <>
                <div className="skeleton-card" />
                <div className="skeleton-card" />
                <div className="skeleton-card" />
              </>
            ) : null}
            <div className="fixtures-list">
              {!isFixturesLoading && fixtures.length === 0 ? <p className="muted">No fixtures found.</p> : null}
              {(activeGameweekGroup?.items ?? []).map((fixture) => (
                <Link
                  key={fixture.id}
                  to={`/fixtures/${encodeURIComponent(fixture.id)}?leagueId=${encodeURIComponent(selectedLeagueId)}`}
                  className="fixture-card-link"
                >
                  <FixtureCard fixture={fixture} />
                </Link>
              ))}
            </div>
          </>
        ) : (
          <>
            {isStandingsLoading ? <LoadingState label="Loading standings" /> : null}
            {!isStandingsLoading && standings.length === 0 ? <p className="muted">No standings found.</p> : null}
            {!isStandingsLoading && standings.length > 0 ? (
              <div className="team-picker-table-wrap custom-standing-wrap">
                <table className="team-picker-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Team</th>
                      <th>P</th>
                      <th>W</th>
                      <th>D</th>
                      <th>L</th>
                      <th>GF</th>
                      <th>GA</th>
                      <th>GD</th>
                      <th>Pts</th>
                      <th>Form</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((item) => (
                      <tr key={`${item.teamId}-${item.position}-${item.isLive ? "live" : "final"}`}>
                        <td>{item.position}</td>
                        <td>
                          <div className="media-line">
                            {item.teamLogoUrl ? (
                              <LazyImage
                                src={item.teamLogoUrl}
                                alt={item.teamName ?? item.teamId}
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
                            <div className="media-copy">
                              <strong>{item.teamName ?? item.teamId}</strong>
                            </div>
                          </div>
                        </td>
                        <td>{item.played}</td>
                        <td>{item.won}</td>
                        <td>{item.draw}</td>
                        <td>{item.lost}</td>
                        <td>{item.goalsFor}</td>
                        <td>{item.goalsAgainst}</td>
                        <td>{item.goalDifference}</td>
                        <td>{item.points}</td>
                        <td>{item.form?.trim() || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
};
