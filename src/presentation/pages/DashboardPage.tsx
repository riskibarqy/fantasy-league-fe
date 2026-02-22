import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, Newspaper, Shield, Trophy, Users } from "lucide-react";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import { cacheKeys, cacheTtlMs, getOrLoadCached } from "../../app/cache/requestCache";
import type { Dashboard } from "../../domain/fantasy/entities/Team";
import type { CustomLeague } from "../../domain/fantasy/entities/CustomLeague";
import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import { FixtureCard } from "../components/FixtureCard";
import { LoadingState } from "../components/LoadingState";
import { formatRankMovement, RankMovementBadge } from "../components/RankMovementBadge";
import { getGlobalNewsItems } from "./newsFeed";
import { useLeagueSelection } from "../hooks/useLeagueSelection";
import { useSession } from "../hooks/useSession";
import { appAlert } from "../lib/appAlert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

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

export const DashboardPage = () => {
  const { getDashboard, getFixtures, getMyCustomLeagues } = useContainer();
  const { leagues, selectedLeagueId, setSelectedLeagueId } = useLeagueSelection();
  const { session } = useSession();

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
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
          loader: () => getDashboard.execute(accessToken)
        });
        const leagueIdForFixtures = selectedLeagueId || dashboardResult.selectedLeagueId;
        const fixtureResult = leagueIdForFixtures
          ? await getOrLoadCached({
              key: cacheKeys.fixtures(leagueIdForFixtures),
              ttlMs: cacheTtlMs.fixtures,
              loader: () => getFixtures.execute(leagueIdForFixtures),
              allowStaleOnError: true
            })
          : [];
        const customLeagueResult =
          accessToken && userId
            ? await getOrLoadCached({
                key: cacheKeys.customLeagues(userId),
                ttlMs: cacheTtlMs.customLeagues,
                loader: () => getMyCustomLeagues.execute(accessToken),
                allowStaleOnError: true
              })
            : [];

        if (!mounted) {
          return;
        }

        setDashboard(dashboardResult);
        setFixtures(fixtureResult);
        setCustomLeagues(customLeagueResult.slice(0, 3));
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
  }, [getDashboard, getFixtures, getMyCustomLeagues, selectedLeagueId, session?.accessToken, session?.user.id]);

  const selectedLeague = useMemo(() => {
    const targetLeagueId = selectedLeagueId || dashboard?.selectedLeagueId;
    return leagues.find((league) => league.id === targetLeagueId);
  }, [dashboard?.selectedLeagueId, leagues, selectedLeagueId]);

  const sortedFixtures = useMemo(() => {
    return [...fixtures].sort(
      (left, right) => new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime()
    );
  }, [fixtures]);

  const nextFixture = useMemo(() => {
    const now = Date.now();
    return sortedFixtures.find((fixture) => new Date(fixture.kickoffAt).getTime() >= now) ?? sortedFixtures[0] ?? null;
  }, [sortedFixtures]);

  const featuredFixtures = useMemo(() => {
    return sortedFixtures.slice(0, 4);
  }, [sortedFixtures]);
  const leaguesById = useMemo(() => new Map(leagues.map((league) => [league.id, league])), [leagues]);

  const newsItems = useMemo(() => getGlobalNewsItems(2), []);

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
      <Card className="card home-hero">
        <div>
          <h2 className="section-icon-title">
            <Trophy className="inline-icon" aria-hidden="true" />
            Home Overview • {selectedLeague?.name ?? "League"}
          </h2>
          <p className="muted">
            Gameweek {dashboard.gameweek}
            {nextFixture ? ` • Deadline ${formatDeadlineWindow(nextFixture.kickoffAt)}` : ""}
          </p>
          {leagues.length > 0 ? (
            <label className="dashboard-league-select">
              League
              <Select
                value={selectedLeagueId || dashboard.selectedLeagueId}
                onChange={(event) => setSelectedLeagueId(event.target.value)}
              >
                {leagues.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.name}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
        </div>

        <div className="home-quick-grid">
          <Link to="/team" className="home-quick-link">
            <strong className="quick-link-title">
              <Shield className="inline-icon" aria-hidden="true" />
              Manage Team
            </strong>
            <small>Edit lineup and transfers</small>
          </Link>
          <Link to="/fixtures" className="home-quick-link">
            <strong className="quick-link-title">
              <CalendarDays className="inline-icon" aria-hidden="true" />
              Fixtures
            </strong>
            <small>See match schedule</small>
          </Link>
          <Link to="/leagues" className="home-quick-link">
            <strong className="quick-link-title">
              <Trophy className="inline-icon" aria-hidden="true" />
              Leagues
            </strong>
            <small>Competition overview</small>
          </Link>
        </div>
      </Card>

      <Card className="card home-news">
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
                  <img
                    src={leaguesById.get(group.leagueId)?.logoUrl}
                    alt={leaguesById.get(group.leagueId)?.name ?? group.leagueId}
                    className="media-thumb media-thumb-small"
                    loading="lazy"
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
              Upcoming Fixtures
            </h3>
            <p className="muted">{selectedLeague?.countryCode ?? "-"} • {featuredFixtures.length} matches shown</p>
          </div>
          <Button asChild size="sm" variant="secondary" className="home-news-more">
            <Link to="/fixtures">
              See more
              <ArrowRight className="inline-icon" aria-hidden="true" />
            </Link>
          </Button>
        </div>
        <div className="home-news-list">
          {featuredFixtures.length === 0 ? <p className="muted">No fixtures found.</p> : null}
          {featuredFixtures.map((fixture) => (
            <FixtureCard key={fixture.id} fixture={fixture} />
          ))}
        </div>
      </Card>
    </div>
  );
};
