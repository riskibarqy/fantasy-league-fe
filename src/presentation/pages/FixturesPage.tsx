import { useEffect, useMemo, useState } from "react";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import type { League } from "../../domain/fantasy/entities/League";
import { FixtureCard } from "../components/FixtureCard";

export const FixturesPage = () => {
  const { getLeagues, getFixtures } = useContainer();

  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [fixtures, setFixtures] = useState<Fixture[]>([]);

  useEffect(() => {
    let mounted = true;

    const loadLeagues = async () => {
      const list = await getLeagues.execute();
      if (!mounted) {
        return;
      }

      setLeagues(list);
      setSelectedLeagueId((current) => current || list[0]?.id || "");
    };

    void loadLeagues();

    return () => {
      mounted = false;
    };
  }, [getLeagues]);

  useEffect(() => {
    if (!selectedLeagueId) {
      return;
    }

    let mounted = true;

    const loadFixtures = async () => {
      const result = await getFixtures.execute(selectedLeagueId);
      if (!mounted) {
        return;
      }

      setFixtures(result);
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
      <section className="section-title">
        <h2>Fixtures</h2>
        <p className="muted">Track schedule by competition.</p>
      </section>

      <section>
        <label>
          League
          <select
            value={selectedLeagueId}
            onChange={(event) => setSelectedLeagueId(event.target.value)}
          >
            {leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="fixtures-list">
        <h3>{selectedLeagueName}</h3>
        {fixtures.map((fixture) => (
          <FixtureCard key={fixture.id} fixture={fixture} />
        ))}
      </section>
    </div>
  );
};
