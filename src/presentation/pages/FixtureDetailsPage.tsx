import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Clock3, Flag, Goal, ShieldAlert, Target } from "lucide-react";
import { cacheKeys, cacheTtlMs, getOrLoadCached } from "../../app/cache/requestCache";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import type { FixtureDetails } from "../../domain/fantasy/entities/FixtureDetails";
import { LoadingState } from "../components/LoadingState";
import { useLeagueSelection } from "../hooks/useLeagueSelection";
import { appAlert } from "../lib/appAlert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const toMinuteText = (minute: number, extraMinute: number): string => {
  if (extraMinute > 0) {
    return `${minute}+${extraMinute}'`;
  }
  return `${minute}'`;
};

export const FixtureDetailsPage = () => {
  const { fixtureId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const leagueIdFromQuery = searchParams.get("leagueId")?.trim() ?? "";

  const { getFixtureDetails } = useContainer();
  const { selectedLeagueId, setSelectedLeagueId } = useLeagueSelection();

  const [details, setDetails] = useState<FixtureDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resolvedLeagueId = leagueIdFromQuery || selectedLeagueId;
  const normalizedFixtureId = fixtureId.trim();

  useEffect(() => {
    if (leagueIdFromQuery && leagueIdFromQuery !== selectedLeagueId) {
      setSelectedLeagueId(leagueIdFromQuery);
    }
  }, [leagueIdFromQuery, selectedLeagueId, setSelectedLeagueId]);

  useEffect(() => {
    if (errorMessage) {
      void appAlert.error("Fixture Details Error", errorMessage);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (!resolvedLeagueId || !normalizedFixtureId) {
      setDetails(null);
      return;
    }

    let mounted = true;

    const load = async () => {
      try {
        setIsLoading(true);
        const payload = await getOrLoadCached({
          key: cacheKeys.fixtureDetails(resolvedLeagueId, normalizedFixtureId),
          ttlMs: cacheTtlMs.fixtureDetails,
          loader: () => getFixtureDetails.execute(resolvedLeagueId, normalizedFixtureId),
          allowStaleOnError: true
        });
        if (!mounted) {
          return;
        }

        setDetails(payload);
        setErrorMessage(null);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Failed to load fixture details.");
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
  }, [getFixtureDetails, normalizedFixtureId, resolvedLeagueId]);

  const topPlayerStats = useMemo(() => {
    if (!details) {
      return [];
    }

    return [...details.playerStats]
      .sort((left, right) => right.fantasyPoints - left.fantasyPoints)
      .slice(0, 8);
  }, [details]);

  const playerNameByID = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of details?.playerStats ?? []) {
      if (item.playerName?.trim()) {
        map.set(item.playerId, item.playerName.trim());
      }
    }
    return map;
  }, [details?.playerStats]);

  const teamNameByID = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of details?.teamStats ?? []) {
      if (item.teamName?.trim()) {
        map.set(item.teamId, item.teamName.trim());
      }
    }
    return map;
  }, [details?.teamStats]);

  if (!normalizedFixtureId) {
    return (
      <div className="page-grid">
        <Card className="card page-section">
          <p className="muted">Fixture id is missing.</p>
          <Button asChild variant="secondary" size="sm">
            <Link to="/fixtures">Back to Fixtures</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <Card className="card page-section">
        <div className="fixture-detail-head">
          <Button asChild size="sm" variant="secondary">
            <Link
              to={
                resolvedLeagueId
                  ? `/fixtures?leagueId=${encodeURIComponent(resolvedLeagueId)}`
                  : "/fixtures"
              }
            >
              <ArrowLeft className="inline-icon" aria-hidden="true" />
              Back
            </Link>
          </Button>
          <p className="small-label">Fixture Details</p>
        </div>

        {isLoading ? <LoadingState label="Loading fixture details" /> : null}
        {!isLoading && !details ? <p className="muted">Fixture details not found.</p> : null}

        {!isLoading && details ? (
          <>
            <div className="fixture-detail-scoreboard">
              <div className="fixture-score-team">
                {details.fixture.homeTeamLogoUrl ? (
                  <img
                    src={details.fixture.homeTeamLogoUrl}
                    alt={details.fixture.homeTeam}
                    className="media-thumb"
                    loading="lazy"
                  />
                ) : null}
                <strong>{details.fixture.homeTeam}</strong>
              </div>
              <div className="fixture-score-number">
                {typeof details.fixture.homeScore === "number" && typeof details.fixture.awayScore === "number"
                  ? `${details.fixture.homeScore} - ${details.fixture.awayScore}`
                  : "vs"}
              </div>
              <div className="fixture-score-team">
                {details.fixture.awayTeamLogoUrl ? (
                  <img
                    src={details.fixture.awayTeamLogoUrl}
                    alt={details.fixture.awayTeam}
                    className="media-thumb"
                    loading="lazy"
                  />
                ) : null}
                <strong>{details.fixture.awayTeam}</strong>
              </div>
            </div>
            <div className="fixture-detail-meta">
              <span>
                <Clock3 className="inline-icon" aria-hidden="true" />
                {new Date(details.fixture.kickoffAt).toLocaleString("id-ID")}
              </span>
              <span>
                <Flag className="inline-icon" aria-hidden="true" />
                {details.fixture.venue || "-"}
              </span>
              <span className="pill">{details.fixture.status || "SCHEDULED"}</span>
            </div>

            <div className="fixture-detail-grid">
              <Card className="card fixture-detail-card">
                <h3 className="section-icon-title">
                  <Target className="inline-icon" aria-hidden="true" />
                  Team Stats
                </h3>
                {details.teamStats.length === 0 ? <p className="muted">No team stats available.</p> : null}
                {details.teamStats.length > 0 ? (
                  <div className="fixture-detail-table-wrap">
                    <table className="fixture-detail-table">
                      <thead>
                        <tr>
                          <th>Team</th>
                          <th>Possession</th>
                          <th>Shots</th>
                          <th>On Target</th>
                          <th>Corners</th>
                          <th>Fouls</th>
                          <th>Offsides</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.teamStats.map((item) => (
                          <tr key={item.teamId}>
                            <td>{item.teamName || item.teamId}</td>
                            <td>{item.possessionPct.toFixed(1)}%</td>
                            <td>{item.shots}</td>
                            <td>{item.shotsOnTarget}</td>
                            <td>{item.corners}</td>
                            <td>{item.fouls}</td>
                            <td>{item.offsides}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </Card>

              <Card className="card fixture-detail-card">
                <h3 className="section-icon-title">
                  <ShieldAlert className="inline-icon" aria-hidden="true" />
                  Top Players
                </h3>
                {topPlayerStats.length === 0 ? <p className="muted">No player stats available.</p> : null}
                {topPlayerStats.length > 0 ? (
                  <ul className="fixture-top-player-list">
                    {topPlayerStats.map((item) => (
                      <li key={item.playerId}>
                        <div>
                          <strong>{item.playerName || item.playerId}</strong>
                          <p className="muted">{item.teamName || item.teamId}</p>
                        </div>
                        <div className="fixture-player-points">{item.fantasyPoints} pts</div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            </div>

            <Card className="card fixture-detail-card">
              <h3 className="section-icon-title">
                <Goal className="inline-icon" aria-hidden="true" />
                Events
              </h3>
              {details.events.length === 0 ? <p className="muted">No events available.</p> : null}
              {details.events.length > 0 ? (
                <ul className="fixture-events-list">
                  {details.events.map((item) => (
                    <li key={`${item.eventId}-${item.minute}-${item.extraMinute}`}>
                      <span className="fixture-event-minute">
                        {toMinuteText(item.minute, item.extraMinute)}
                      </span>
                      <div>
                        <strong>{item.eventType}</strong>
                        <p className="muted">
                          {[
                            item.teamId ? teamNameByID.get(item.teamId) || item.teamId : "",
                            item.playerId ? playerNameByID.get(item.playerId) || item.playerId : "",
                            item.detail ?? ""
                          ]
                            .filter(Boolean)
                            .join(" • ") || "No details"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          </>
        ) : null}
      </Card>
    </div>
  );
};
