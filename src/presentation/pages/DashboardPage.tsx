import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, ArrowRight, CalendarDays, Newspaper, Pickaxe, Users } from "lucide-react";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import { cacheKeys, cacheTtlMs, getOrLoadCached } from "../../app/cache/requestCache";
import type { Dashboard } from "../../domain/fantasy/entities/Team";
import type { CustomLeague } from "../../domain/fantasy/entities/CustomLeague";
import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import type { SeasonPointsSummary } from "../../domain/fantasy/entities/SeasonPointsSummary";
import { FixtureMatchRow } from "../components/FixtureMatchRow";
import { LazyImage } from "../components/LazyImage";
import { LoadingState } from "../components/LoadingState";
import { formatRankMovement, RankMovementBadge } from "../components/RankMovementBadge";
import { getGlobalNewsItems } from "./newsFeed";
import { useLeagueSelection } from "../hooks/useLeagueSelection";
import { useSession } from "../hooks/useSession";
import { appAlert } from "../lib/appAlert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const formatDeadlineWindow = (kickoffAt: string): string => {
  const diffMs = new Date(kickoffAt).getTime() - Date.now();
  if (diffMs <= 0) {
    return "Live";
  }

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h left`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }

  return `${Math.max(1, minutes)}m left`;
};

const parseKickoffMs = (kickoffAt: string): number => {
  const value = new Date(kickoffAt).getTime();
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
};

const formatFantasyPoints = (value: number, fractionDigits = 1): string => {
  if (!Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(Math.max(0, fractionDigits));
};

export const DashboardPage = () => {
  const { getDashboard, getFixtures, getMyCustomLeagues, getSeasonPointsSummary } = useContainer();
  const { leagues, selectedLeagueId } = useLeagueSelection();
  const { session } = useSession();

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [seasonPointsSummary, setSeasonPointsSummary] = useState<SeasonPointsSummary | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [customLeagues, setCustomLeagues] = useState<CustomLeague[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (errorMessage) {
      void appAlert.error("Dashboard Failed", errorMessage);
    }
  }, [errorMessage]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const accessToken = session?.accessToken?.trim() ?? "";
        const userId = session?.user.id?.trim() ?? "";
        if (!accessToken || !userId) {
          throw new Error("Please sign in to view your dashboard.");
        }

        const dashboardResult = await getOrLoadCached({
          key: cacheKeys.dashboard(userId),
          ttlMs: cacheTtlMs.dashboard,
          loader: () => getDashboard.execute(accessToken),
          allowStaleOnError: true
        });
        if (mounted) {
          setDashboard(dashboardResult);
        }

        const leagueIDForHome = selectedLeagueId || dashboardResult.selectedLeagueId;
        const fixturePromise = leagueIDForHome
          ? getOrLoadCached({
              key: cacheKeys.fixtures(leagueIDForHome),
              ttlMs: cacheTtlMs.fixtures,
              loader: () => getFixtures.execute(leagueIDForHome),
              allowStaleOnError: true
            })
          : Promise.resolve<Fixture[]>([]);
        const summaryPromise = leagueIDForHome
          ? getOrLoadCached({
              key: cacheKeys.seasonPointsSummary(userId, leagueIDForHome),
              ttlMs: cacheTtlMs.seasonPointsSummary,
              loader: () => getSeasonPointsSummary.execute(leagueIDForHome, accessToken),
              allowStaleOnError: true
            })
          : Promise.resolve<SeasonPointsSummary | null>(null);
        const customLeaguePromise =
          accessToken && userId
            ? getOrLoadCached({
                key: cacheKeys.customLeagues(userId),
                ttlMs: cacheTtlMs.customLeagues,
                loader: () => getMyCustomLeagues.execute(accessToken),
                allowStaleOnError: true
              })
            : Promise.resolve<CustomLeague[]>([]);

        const [fixtureResultRaw, summaryResultRaw, customLeagueResultRaw] = await Promise.allSettled([
          fixturePromise,
          summaryPromise,
          customLeaguePromise
        ]);

        if (!mounted) {
          return;
        }

        const fixtureResult =
          fixtureResultRaw.status === "fulfilled" ? fixtureResultRaw.value : [];
        const summaryResult =
          summaryResultRaw.status === "fulfilled" ? summaryResultRaw.value : null;
        const customLeagueResult =
          customLeagueResultRaw.status === "fulfilled" ? customLeagueResultRaw.value : [];

        setSeasonPointsSummary(summaryResult);
        setFixtures(fixtureResult);
        setCustomLeagues(customLeagueResult.slice(0, 3));
        setErrorMessage(null);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Failed to load dashboard.");
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [
    getDashboard,
    getFixtures,
    getMyCustomLeagues,
    getSeasonPointsSummary,
    selectedLeagueId,
    session?.accessToken,
    session?.user.id
  ]);

  const selectedLeague = useMemo(() => {
    const targetLeagueId = selectedLeagueId || dashboard?.selectedLeagueId;
    return leagues.find((league) => league.id === targetLeagueId);
  }, [dashboard?.selectedLeagueId, leagues, selectedLeagueId]);

  const sortedFixtures = useMemo(() => {
    return [...fixtures].sort((left, right) => parseKickoffMs(left.kickoffAt) - parseKickoffMs(right.kickoffAt));
  }, [fixtures]);

  const nextUpcomingFixture = useMemo(() => {
    const now = Date.now();
    return sortedFixtures.find((fixture) => parseKickoffMs(fixture.kickoffAt) >= now) ?? null;
  }, [sortedFixtures]);

  const featuredGameweek = useMemo(() => {
    if (sortedFixtures.length === 0) {
      return null;
    }

    const now = Date.now();
    let nearestFixture = sortedFixtures[0];
    let nearestDiff = Math.abs(parseKickoffMs(nearestFixture.kickoffAt) - now);

    for (const fixture of sortedFixtures.slice(1)) {
      const diff = Math.abs(parseKickoffMs(fixture.kickoffAt) - now);
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearestFixture = fixture;
      }
    }

    return nearestFixture.gameweek;
  }, [sortedFixtures]);

  const featuredFixtures = useMemo(() => {
    if (featuredGameweek === null) {
      return [];
    }

    return sortedFixtures
      .filter((fixture) => fixture.gameweek === featuredGameweek)
      .slice(0, 4);
  }, [featuredGameweek, sortedFixtures]);

  const headerFixture = nextUpcomingFixture ?? featuredFixtures[0] ?? null;
  const fixtureSectionLabel = featuredGameweek !== null ? `GW ${featuredGameweek}` : "-";
  const fixtureSectionTitle =
    nextUpcomingFixture || featuredFixtures.length === 0 ? "Upcoming Fixtures" : "Recent Fixtures";
  const fixturesLeagueId = selectedLeagueId || dashboard?.selectedLeagueId || "";

  const leaguesById = useMemo(() => new Map(leagues.map((league) => [league.id, league])), [leagues]);

  const newsItems = useMemo(() => getGlobalNewsItems(2), []);
  const averagePointsValue = seasonPointsSummary
    ? formatFantasyPoints(seasonPointsSummary.averagePoints)
    : dashboard
      ? formatFantasyPoints(dashboard.averageGwPoints)
      : "-";
  const totalPointsValue = seasonPointsSummary
    ? formatFantasyPoints(seasonPointsSummary.totalPoints, 0)
    : dashboard
      ? formatFantasyPoints(dashboard.myGwPoints || dashboard.totalPoints, 0)
      : "-";
  const highestPointsValue = seasonPointsSummary
    ? formatFantasyPoints(seasonPointsSummary.highestPoints, 0)
    : dashboard
      ? formatFantasyPoints(dashboard.highestGwPoints, 0)
      : "-";
  const rankLabel = dashboard && dashboard.rank > 0 ? `#${dashboard.rank.toLocaleString("en-US")}` : "-";

  if (!dashboard) {
    if (errorMessage) {
      return (
        <div className="page-grid">
          <Card className="card home-hero">
            <p className="muted">Unable to load dashboard right now. Please refresh and try again.</p>
          </Card>
        </div>
      );
    }

    return (
      <div className="page-grid">
        <Card className="card home-hero">
          <LoadingState label="Preparing dashboard data" />
          <div className="home-quick-grid">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
        </Card>
        <Card className="card home-news">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </Card>
        <Card className="card home-news">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </Card>
      </div>
    );
  }

  return (
    <div className="page-grid dashboard-page">
      <Card className="card menu-home-hero">
        <div className="menu-home-hero-head">
          <div>
            <p className="menu-home-kicker">Fantasy Nusantara</p>
            <h2>My Team</h2>
            <p className="menu-home-subtitle">
              GW {dashboard.gameweek} • {selectedLeague?.name ?? "League"}
              {headerFixture ? ` • Deadline ${formatDeadlineWindow(headerFixture.kickoffAt)}` : ""}
            </p>
          </div>
          <div className="menu-home-rank-badge">
            <span>Rank</span>
            <strong>{rankLabel}</strong>
          </div>
        </div>

        <div className="menu-home-points-inline" aria-label="Average, total points, and highest points">
          <Link to="/pick-team?view=points&metric=average" className="menu-home-point-inline-item menu-home-point-link">
            <p className="small-label">Average</p>
            <strong>{averagePointsValue}</strong>
          </Link>
          <Link to="/pick-team?view=points&metric=my" className="menu-home-point-inline-item menu-home-point-link">
            <p className="small-label">Squad Points</p>
            <strong>{totalPointsValue}</strong>
          </Link>
          <Link to="/pick-team?view=points&metric=highest" className="menu-home-point-inline-item menu-home-point-link">
            <p className="small-label">Highest</p>
            <strong>{highestPointsValue}</strong>
          </Link>
        </div>

      </Card>

      <div className="menu-home-actions">
        <Link to="/pick-team" className="menu-home-action-card">
          <span className="menu-home-action-icon">
            <Pickaxe className="inline-icon" aria-hidden="true" />
          </span>
          <span className="menu-home-action-copy">
            <strong>Pick Team</strong>
            <small>Build your squad</small>
          </span>
        </Link>
        <Link to="/transfers" className="menu-home-action-card">
          <span className="menu-home-action-icon">
            <ArrowLeftRight className="inline-icon" aria-hidden="true" />
          </span>
          <span className="menu-home-action-copy">
            <strong>Transfers</strong>
            <small>Make changes</small>
          </span>
        </Link>
      </div>

      <Card className="card home-news home-fixtures">
        <div className="home-section-head">
          <div className="section-title">
            <h3 className="section-icon-title">
              <Users className="inline-icon" aria-hidden="true" />
              Custom Leagues
            </h3>
            <p className="muted">Your private leagues overview.</p>
          </div>
          <Button asChild size="sm" variant="secondary" className="home-news-more">
            <Link to="/custom-leagues">
              See more
              <ArrowRight className="inline-icon" aria-hidden="true" />
            </Link>
          </Button>
        </div>
        <div className="home-news-list">
          {customLeagues.length === 0 ? <p className="muted">No custom leagues yet.</p> : null}
          {customLeagues.map((group) => (
            <article key={group.id} className="home-news-item">
              <strong>{group.name}</strong>
              <div className="media-line">
                {leaguesById.get(group.leagueId)?.logoUrl ? (
                  <LazyImage
                    src={leaguesById.get(group.leagueId)?.logoUrl ?? ""}
                    alt={leaguesById.get(group.leagueId)?.name ?? group.leagueId}
                    className="media-thumb media-thumb-small"
                    fallback={
                      <span className="media-thumb media-thumb-small media-thumb-fallback" aria-hidden="true">
                        L
                      </span>
                    }
                  />
                ) : (
                  <span className="media-thumb media-thumb-small media-thumb-fallback" aria-hidden="true">
                    L
                  </span>
                )}
              </div>
              <p className="muted">
                Rank #{group.myRank > 0 ? group.myRank : "-"} • Movement {formatRankMovement(group.rankMovement)}
              </p>
              <RankMovementBadge value={group.rankMovement} />
              <span className="small-label">Code: {group.inviteCode}</span>
            </article>
          ))}
        </div>
      </Card>

      <Card className="card home-news">
        <div className="home-section-head">
          <div className="section-title">
            <h3 className="section-icon-title">
              <Newspaper className="inline-icon" aria-hidden="true" />
              Latest News
            </h3>
            <p className="muted">Top 2 highlights from the global news feed.</p>
          </div>
          <Button asChild size="sm" variant="secondary" className="home-news-more">
            <Link to="/news">
              See more
              <ArrowRight className="inline-icon" aria-hidden="true" />
            </Link>
          </Button>
        </div>
        <div className="home-news-list">
          {newsItems.map((item) => (
            <article key={item.id} className="home-news-item">
              <strong>{item.title}</strong>
              <p className="muted">{item.summary}</p>
              <span className="small-label">{item.timestamp}</span>
            </article>
          ))}
        </div>
      </Card>

      <Card className="card home-news">
        <div className="home-section-head">
          <div className="section-title">
            <h3 className="section-icon-title">
              <CalendarDays className="inline-icon" aria-hidden="true" />
              {fixtureSectionTitle}
            </h3>
            <p className="muted">{fixtureSectionLabel} • {featuredFixtures.length} matches shown</p>
          </div>
          <Button asChild size="sm" variant="secondary" className="home-news-more">
            <Link to="/fixtures">
              See more
              <ArrowRight className="inline-icon" aria-hidden="true" />
            </Link>
          </Button>
        </div>
        <div className="home-news-list home-fixtures-list">
          {featuredFixtures.length === 0 ? <p className="muted">No fixtures found.</p> : null}
          {featuredFixtures.length > 0 ? (
            <section className="fixtures-v2-day-card home-fixtures-day-card">
              <h4>{fixtureSectionLabel}</h4>
              <div className="fixtures-v2-match-list">
                {featuredFixtures.map((fixture) => (
                  <FixtureMatchRow
                    key={fixture.id}
                    fixture={fixture}
                    to={`/fixtures/${encodeURIComponent(fixture.id)}${
                      fixturesLeagueId ? `?leagueId=${encodeURIComponent(fixturesLeagueId)}` : ""
                    }`}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </Card>
    </div>
  );
};
