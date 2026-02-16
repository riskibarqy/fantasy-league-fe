import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import { cacheKeys, cacheTtlMs, getOrLoadCached } from "../../app/cache/requestCache";
import type { Dashboard } from "../../domain/fantasy/entities/Team";
import type { CustomLeague } from "../../domain/fantasy/entities/CustomLeague";
import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import type { League } from "../../domain/fantasy/entities/League";
import { FixtureCard } from "../components/FixtureCard";
import { LoadingState } from "../components/LoadingState";
import { getGlobalNewsItems } from "./newsFeed";
import { useSession } from "../hooks/useSession";

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
  const { getDashboard, getLeagues, getFixtures, getMyCustomLeagues } = useContainer();
  const { session } = useSession();

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [customLeagues, setCustomLeagues] = useState<CustomLeague[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const dashboardResult = await getOrLoadCached({
          key: cacheKeys.dashboard(),
          ttlMs: cacheTtlMs.dashboard,
          loader: () => getDashboard.execute()
        });
        const leaguesResult = await getOrLoadCached({
          key: cacheKeys.leagues(),
          ttlMs: cacheTtlMs.leagues,
          loader: () => getLeagues.execute()
        });
        const fixtureResult = await getOrLoadCached({
          key: cacheKeys.fixtures(dashboardResult.selectedLeagueId),
          ttlMs: cacheTtlMs.fixtures,
          loader: () => getFixtures.execute(dashboardResult.selectedLeagueId),
          allowStaleOnError: true
        });

        const accessToken = session?.accessToken?.trim() ?? "";
        const userId = session?.user.id?.trim() ?? "";
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
        setLeagues(leaguesResult);
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
  }, [getDashboard, getFixtures, getLeagues, getMyCustomLeagues, session?.accessToken, session?.user.id]);

  const selectedLeague = useMemo(() => {
    return leagues.find((league) => league.id === dashboard?.selectedLeagueId);
  }, [dashboard?.selectedLeagueId, leagues]);

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

  const newsItems = useMemo(() => getGlobalNewsItems(2), []);

  if (errorMessage) {
    return <p className="error-text">{errorMessage}</p>;
  }

  if (!dashboard) {
    return (
      <div className="page-grid">
        <section className="card home-hero">
          <LoadingState label="Preparing dashboard data" />
          <div className="home-quick-grid">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
        </section>
        <section className="card home-news">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </section>
        <section className="card home-news">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </section>
      </div>
    );
  }

  return (
    <div className="page-grid dashboard-page">
      <section className="card home-hero">
        <div>
          <h2>Home Overview • {selectedLeague?.name ?? "League"}</h2>
          <p className="muted">
            Gameweek {dashboard.gameweek}
            {nextFixture ? ` • Deadline ${formatDeadlineWindow(nextFixture.kickoffAt)}` : ""}
          </p>
        </div>

        <div className="home-quick-grid">
          <Link to="/team" className="home-quick-link">
            <strong>Manage Team</strong>
            <small>Edit lineup and transfers</small>
          </Link>
          <Link to="/fixtures" className="home-quick-link">
            <strong>Fixtures</strong>
            <small>See match schedule</small>
          </Link>
          <Link to="/leagues" className="home-quick-link">
            <strong>Leagues</strong>
            <small>Competition overview</small>
          </Link>
        </div>
      </section>

      <section className="card home-news">
        <div className="home-section-head">
          <div className="section-title">
            <h3>Custom Leagues</h3>
            <p className="muted">Your private leagues overview.</p>
          </div>
          <Link to="/custom-leagues" className="secondary-button home-news-more">
            See more
          </Link>
        </div>
        <div className="home-news-list">
          {customLeagues.length === 0 ? <p className="muted">No custom leagues yet.</p> : null}
          {customLeagues.map((group) => (
            <article key={group.id} className="home-news-item">
              <strong>{group.name}</strong>
              <p className="muted">
                Rank #{group.myRank > 0 ? group.myRank : "-"} • Movement {group.rankMovement}
              </p>
              <span className="small-label">Code: {group.inviteCode}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="card home-news">
        <div className="home-section-head">
          <div className="section-title">
            <h3>Latest News</h3>
            <p className="muted">Top 2 highlights from the global news feed.</p>
          </div>
          <Link to="/news" className="secondary-button home-news-more">
            See more
          </Link>
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
      </section>

      <section className="card home-news">
        <div className="home-section-head">
          <div className="section-title">
            <h3>Upcoming Fixtures</h3>
            <p className="muted">{selectedLeague?.countryCode ?? "-"} • {featuredFixtures.length} matches shown</p>
          </div>
          <Link to="/fixtures" className="secondary-button home-news-more">
            See more
          </Link>
        </div>
        <div className="home-news-list">
          {featuredFixtures.length === 0 ? <p className="muted">No fixtures found.</p> : null}
          {featuredFixtures.map((fixture) => (
            <FixtureCard key={fixture.id} fixture={fixture} />
          ))}
        </div>
      </section>
    </div>
  );
};
