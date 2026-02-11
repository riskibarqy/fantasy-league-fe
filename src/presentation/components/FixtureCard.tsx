import type { Fixture } from "../../domain/fantasy/entities/Fixture";

export const FixtureCard = ({ fixture }: { fixture: Fixture }) => {
  const kickOff = new Date(fixture.kickoffAt).toLocaleString("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });

  return (
    <article className="card fixture-card">
      <p className="muted">GW {fixture.gameweek}</p>
      <h3>
        {fixture.homeTeam} vs {fixture.awayTeam}
      </h3>
      <p>{fixture.venue}</p>
      <p className="small-label">{kickOff} WIB</p>
    </article>
  );
};
