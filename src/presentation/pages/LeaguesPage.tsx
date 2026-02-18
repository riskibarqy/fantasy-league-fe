import { LoadingState } from "../components/LoadingState";
import { useLeagueSelection } from "../hooks/useLeagueSelection";

export const LeaguesPage = () => {
  const {
    leagues,
    selectedLeagueId,
    setSelectedLeagueId,
    isLoading,
    errorMessage
  } = useLeagueSelection();

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
              <a
                className="media-url"
                href={league.logoUrl || "#"}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => {
                  if (!league.logoUrl) {
                    event.preventDefault();
                  }
                }}
              >
                {league.logoUrl || "Logo URL not available"}
              </a>
              <div className="team-picker-actions">
                {league.id === selectedLeagueId ? (
                  <span className="small-label">Active League</span>
                ) : (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setSelectedLeagueId(league.id)}
                  >
                    Set Active
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
};
