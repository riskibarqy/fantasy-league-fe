import { useEffect, useMemo, useState } from "react";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import type { Dashboard } from "../../domain/fantasy/entities/Team";
import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import type { League } from "../../domain/fantasy/entities/League";
import { FixtureCard } from "../components/FixtureCard";
import { StatCard } from "../components/StatCard";

export const DashboardPage = () => {
  const { getDashboard, getLeagues, getFixtures } = useContainer();

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const dashboardResult = await getDashboard.execute();
        const leaguesResult = await getLeagues.execute();
        const fixtureResult = await getFixtures.execute(dashboardResult.selectedLeagueId);

        if (!mounted) {
          return;
        }

        setDashboard(dashboardResult);
        setLeagues(leaguesResult);
        setFixtures(fixtureResult);
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
  }, [getDashboard, getFixtures, getLeagues]);

  const selectedLeague = useMemo(() => {
    return leagues.find((league) => league.id === dashboard?.selectedLeagueId);
  }, [dashboard?.selectedLeagueId, leagues]);

  if (errorMessage) {
    return <p className="error-text">{errorMessage}</p>;
  }

  if (!dashboard) {
    return <p className="muted">Loading dashboard...</p>;
  }

  return (
    <div className="page-grid">
      <section>
        <h2>{selectedLeague?.name ?? "League"}</h2>
        <p className="muted">Gameweek {dashboard.gameweek}</p>
      </section>

      <section className="stats-grid">
        <StatCard title="Total Points" value={String(dashboard.totalPoints)} />
        <StatCard title="Global Rank" value={`#${dashboard.rank.toLocaleString("id-ID")}`} />
        <StatCard title="Budget" value={dashboard.budget.toFixed(1)} caption="million" />
        <StatCard title="Team Value" value={dashboard.teamValue.toFixed(1)} caption="million" />
      </section>

      <section className="fixtures-list">
        <div className="section-title">
          <h3>Upcoming Fixtures</h3>
        </div>
        {fixtures.length === 0 ? <p className="muted">No fixtures found.</p> : null}
        {fixtures.map((fixture) => (
          <FixtureCard key={fixture.id} fixture={fixture} />
        ))}
      </section>
    </div>
  );
};
