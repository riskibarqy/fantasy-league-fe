import { useEffect, useMemo, useState } from "react";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import { cacheKeys, cacheTtlMs, getOrLoadCached } from "../../app/cache/requestCache";
import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import { FixtureCard } from "../components/FixtureCard";
import { LoadingState } from "../components/LoadingState";
import { useLeagueSelection } from "../hooks/useLeagueSelection";
import { appAlert } from "../lib/appAlert";

export const FixturesPage = () => {
  const { getFixtures } = useContainer();
  const {
    leagues,
    selectedLeagueId,
    setSelectedLeagueId,
    isLoading: isLeaguesLoading,
    errorMessage: leagueErrorMessage
  } = useLeagueSelection();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [isFixturesLoading, setIsFixturesLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (leagueErrorMessage) {
      void appAlert.error("League Load Failed", leagueErrorMessage);
    }
  }, [leagueErrorMessage]);

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

    const loadFixtures = async () => {
      try {
        setIsFixturesLoading(true);
        const result = await getOrLoadCached({
          key: cacheKeys.fixtures(selectedLeagueId),
          ttlMs: cacheTtlMs.fixtures,
          loader: () => getFixtures.execute(selectedLeagueId),
          allowStaleOnError: true
        });
        if (!mounted) {
          return;
        }

        setFixtures(result);
        setErrorMessage(null);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Failed to load fixtures.");
      } finally {
        if (mounted) {
          setIsFixturesLoading(false);
        }
      }
    };

    void loadFixtures();

    return () => {
      mounted = false;
    };
  }, [getFixtures, selectedLeagueId]);

  const selectedLeagueName = useMemo(() => {
    return leagues.find((league) => league.id === selectedLeagueId)?.name ?? "League";
  }, [leagues, selectedLeagueId]);

  return (
    <div className="page-grid">
      <section className="card page-section">
        <div className="home-section-head">
          <div className="section-title">
            <h2>Fixtures</h2>
            <p className="muted">Track schedule by competition.</p>
          </div>
        </div>

        <div className="page-filter-grid">
          <label>
            League
            <select
              value={selectedLeagueId}
              onChange={(event) => setSelectedLeagueId(event.target.value)}
              disabled={isLeaguesLoading}
            >
              {leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {isLeaguesLoading ? <LoadingState label="Loading leagues" inline compact /> : null}
      </section>

      <section className="card page-section">
        <div className="home-section-head">
          <div className="section-title">
            <h3>{selectedLeagueName}</h3>
            <p className="muted">{fixtures.length} matches</p>
          </div>
        </div>

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
          {fixtures.map((fixture) => (
            <FixtureCard key={fixture.id} fixture={fixture} />
          ))}
        </div>
      </section>
    </div>
  );
};
