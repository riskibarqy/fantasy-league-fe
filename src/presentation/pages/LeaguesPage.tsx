import { useEffect, useState } from "react";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import type { League } from "../../domain/fantasy/entities/League";

export const LeaguesPage = () => {
  const { getLeagues } = useContainer();
  const [leagues, setLeagues] = useState<League[]>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const result = await getLeagues.execute();
      if (!mounted) {
        return;
      }

      setLeagues(result);
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
