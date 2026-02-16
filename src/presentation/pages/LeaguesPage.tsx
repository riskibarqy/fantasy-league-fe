import { useEffect, useState } from "react";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import { cacheKeys, cacheTtlMs, getOrLoadCached } from "../../app/cache/requestCache";
import type { League } from "../../domain/fantasy/entities/League";
import { LoadingState } from "../components/LoadingState";

export const LeaguesPage = () => {
  const { getLeagues } = useContainer();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setIsLoading(true);
        const result = await getOrLoadCached({
          key: cacheKeys.leagues(),
          ttlMs: cacheTtlMs.leagues,
          loader: () => getLeagues.execute()
        });
        if (!mounted) {
          return;
        }

        setLeagues(result);
        setErrorMessage(null);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Failed to load leagues.");
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [getLeagues]);

  return (
    <div className="page-grid">
      <section className="section-title">
        <h2>Available Leagues</h2>
        <p className="muted">Architecture supports multiple leagues from one platform.</p>
      </section>

      <section className="leagues-grid">
        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        {isLoading ? <LoadingState label="Loading leagues" /> : null}
        {isLoading ? (
          <>
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </>
        ) : null}
        {!isLoading && leagues.length === 0 ? <p className="muted">No leagues available.</p> : null}
        {leagues.map((league) => (
          <article key={league.id} className="card league-card">
            <img src={league.logoUrl} alt={league.name} loading="lazy" />
            <div>
              <h3>{league.name}</h3>
              <p className="muted">Country: {league.countryCode}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
};
