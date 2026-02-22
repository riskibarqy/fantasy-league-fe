import type { Fixture } from "../../domain/fantasy/entities/Fixture";

export const FixtureCard = ({ fixture }: { fixture: Fixture }) => {
  const kickOff = new Date(fixture.kickoffAt).toLocaleString("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
  const hasScore = typeof fixture.homeScore === "number" && typeof fixture.awayScore === "number";
  const scoreline = hasScore ? `${fixture.homeScore}-${fixture.awayScore}` : "vs";
  const status = fixture.status?.trim() || "SCHEDULED";

  return (
    <article className="card fixture-card">
      <p className="muted">GW {fixture.gameweek}</p>
      <div className="fixture-scoreline">{scoreline}</div>
      <div className="fixture-team-lines">
        <div className="media-line">
          {fixture.homeTeamLogoUrl ? (
            <img src={fixture.homeTeamLogoUrl} alt={fixture.homeTeam} className="media-thumb media-thumb-small" loading="lazy" />
          ) : (
            <span className="media-thumb media-thumb-small media-thumb-fallback" aria-hidden="true">
              H
            </span>
          )}
          <div className="media-copy">
            <h3>{fixture.homeTeam}</h3>
          </div>
        </div>
        <div className="media-line">
          {fixture.awayTeamLogoUrl ? (
            <img src={fixture.awayTeamLogoUrl} alt={fixture.awayTeam} className="media-thumb media-thumb-small" loading="lazy" />
          ) : (
            <span className="media-thumb media-thumb-small media-thumb-fallback" aria-hidden="true">
              A
            </span>
          )}
          <div className="media-copy">
            <h3>{fixture.awayTeam}</h3>
          </div>
        </div>
      </div>
      <p>{fixture.venue}</p>
      <p className="small-label">{status}</p>
      <p className="small-label">{kickOff} WIB</p>
    </article>
  );
};
