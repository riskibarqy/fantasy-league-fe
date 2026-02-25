import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import { cacheKeys, cacheTtlMs, getOrLoadCached } from "../../app/cache/requestCache";
import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import type { LeagueStanding } from "../../domain/fantasy/entities/LeagueStanding";
import { FixtureCard } from "../components/FixtureCard";
import { LoadingState } from "../components/LoadingState";
import { useLeagueSelection } from "../hooks/useLeagueSelection";
import { useSession } from "../hooks/useSession";
import { appAlert } from "../lib/appAlert";
import { LazyImage } from "../components/LazyImage";

const LIVE_STATUSES = new Set(["LIVE", "IN_PLAY", "HT", "1H", "2H", "ET"]);
type FixturesTab = "fixtures" | "standings";
type FormResult = "W" | "D" | "L";

const isLiveFixture = (fixture: Fixture): boolean => {
  const status = fixture.status?.trim().toUpperCase() ?? "";
  return LIVE_STATUSES.has(status) || status.includes("LIVE");
};

const parseStandingForm = (rawForm?: string): FormResult[] => {
  const tokens = rawForm?.toUpperCase().match(/[WDL]/g) ?? [];
  return tokens.slice(-5) as FormResult[];
};

const parseStandingFormLastFive = (rawForm?: string): Array<FormResult | null> => {
  const values = parseStandingForm(rawForm);
  if (values.length >= 5) {
    return values;
  }

  return [...Array.from({ length: 5 - values.length }, () => null), ...values];
};

export const FixturesPage = () => {
  const { getFixtures, getLeagueStandings } = useContainer();
  const { leagues, selectedLeagueId } = useLeagueSelection();
  const { session } = useSession();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [standings, setStandings] = useState<LeagueStanding[]>([]);
  const [standingsMode, setStandingsMode] = useState<"live" | "final">("final");
  const [activeTab, setActiveTab] = useState<FixturesTab>("fixtures");
  const [isFixturesLoading, setIsFixturesLoading] = useState(false);
  const [isStandingsLoading, setIsStandingsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
  const activeFixtures = activeGameweekGroup?.items ?? [];
  const displayName = session?.user.displayName?.trim() || "Riski Ramdan";

  return (
    <div className="page-grid fixtures-modern-page">
      <section className="fixtures-modern-header">
        <p className="fixtures-app-name">Fantasy Nusantara</p>
        <h1 className="fixtures-user-name">{displayName}</h1>
        <p className="fixtures-gw-summary">
          {activeGameweek ? `GW${activeGameweek}` : "GW -"} • {selectedLeagueName}
        </p>
        <p className="fixtures-match-count">
          {activeTab === "fixtures"
            ? `${activeFixtures.length} matches`
            : `${standings.length} teams • ${standingsMode === "live" ? "Live" : "Official"}`}
        </p>
      </section>

      <section className="fixtures-modern-tabs" role="tablist" aria-label="Fixtures and standings tabs">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "fixtures"}
          className={`fixtures-modern-tab ${activeTab === "fixtures" ? "active" : ""}`}
          onClick={() => setActiveTab("fixtures")}
        >
          Fixtures
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "standings"}
          className={`fixtures-modern-tab ${activeTab === "standings" ? "active" : ""}`}
          onClick={() => setActiveTab("standings")}
        >
          Standings
        </button>
      </section>

      {activeTab === "fixtures" ? (
        <>
          <section className="fixtures-gw-section">
            <div className="fixtures-modern-gw-strip" role="tablist" aria-label="Gameweek list">
              {groupedByGameweek.map((group, index) => {
                const isActive = index === gameweekPageIndex;
                return (
                  <button
                    key={group.gameweek}
                    ref={isActive ? activeGameweekButtonRef : null}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`fixtures-modern-gw-pill ${isActive ? "active" : ""}`}
                    onClick={() => setGameweekPageIndex(index)}
                  >
                    GW{group.gameweek}
                  </button>
                );
              })}
            </div>
          </section>

          {isFixturesLoading ? <LoadingState label="Loading fixtures" /> : null}
          {isFixturesLoading ? (
            <div className="fixtures-modern-list" aria-hidden="true">
              <div className="fixtures-modern-skeleton" />
              <div className="fixtures-modern-skeleton" />
              <div className="fixtures-modern-skeleton" />
            </div>
          ) : null}

          {!isFixturesLoading && activeFixtures.length === 0 ? (
            <p className="muted">No fixtures found.</p>
          ) : null}

          {!isFixturesLoading && activeFixtures.length > 0 ? (
            <div className="fixtures-modern-list">
              {activeFixtures.map((fixture) => (
                <Link
                  key={fixture.id}
                  to={`/fixtures/${encodeURIComponent(fixture.id)}?leagueId=${encodeURIComponent(selectedLeagueId)}`}
                  className="fixture-modern-link"
                >
                  <FixtureCard fixture={fixture} />
                </Link>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <>
          {isStandingsLoading ? <LoadingState label="Loading standings" /> : null}
          {!isStandingsLoading && standings.length === 0 ? <p className="muted">No standings found.</p> : null}

          {!isStandingsLoading && standings.length > 0 ? (
            <div className="fixtures-standings-shell">
              <div className="fixtures-standings-shell-head">
                <span className={`fixtures-standings-mode ${standingsMode === "live" ? "live" : ""}`}>
                  {standingsMode === "live" ? "Live" : "Official"}
                </span>
              </div>

              <div className="fixtures-standings-table-wrap">
                <table className="fixtures-standings-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Club</th>
                      <th>MP</th>
                      <th>W</th>
                      <th>D</th>
                      <th>L</th>
                      <th>GF</th>
                      <th>GA</th>
                      <th>GD</th>
                      <th>Pts</th>
                      <th>Last 5</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((item) => {
                      const recentForm = parseStandingFormLastFive(item.form);

                      return (
                        <tr key={`${item.teamId}-${item.position}-${item.isLive ? "live" : "final"}`}>
                          <td>{item.position}</td>
                          <td>
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
                          </td>
                          <td>{item.played}</td>
                          <td>{item.won}</td>
                          <td>{item.draw}</td>
                          <td>{item.lost}</td>
                          <td>{item.goalsFor}</td>
                          <td>{item.goalsAgainst}</td>
                          <td>{item.goalDifference}</td>
                          <td className="fixtures-standing-points">{item.points}</td>
                          <td>
                            <div className="fixtures-standing-form" aria-label="Last five form">
                              {recentForm.map((result, index) => (
                                <span
                                  key={`${item.teamId}-form-${index}`}
                                  className={`fixtures-standing-form-chip ${result ? `fixtures-standing-form-${result.toLowerCase()}` : "fixtures-standing-form-empty-chip"} ${index === recentForm.length - 1 ? "latest" : ""}`}
                                  title={
                                    result === "W"
                                      ? "Win"
                                      : result === "D"
                                        ? "Draw"
                                        : result === "L"
                                          ? "Loss"
                                          : "No data"
                                  }
                                >
                                  {result === "W" ? "✓" : result === "D" ? "—" : result === "L" ? "✕" : "·"}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};
