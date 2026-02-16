import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import { cacheKeys, cacheTtlMs, getOrLoadCached } from "../../app/cache/requestCache";
import type {
  CustomLeague,
  CustomLeagueStanding,
  RankMovement
} from "../../domain/fantasy/entities/CustomLeague";
import { LoadingState } from "../components/LoadingState";
import { useSession } from "../hooks/useSession";

const movementLabel = (value: RankMovement): string => {
  switch (value) {
    case "up":
      return "↑ Up";
    case "down":
      return "↓ Down";
    case "same":
      return "→ Same";
    case "new":
      return "• New";
    default:
      return "-";
  }
};

const shortValue = (value: string): string => {
  return value.length <= 8 ? value : `${value.slice(0, 4)}...${value.slice(-2)}`;
};

const resolveTeamName = (item: CustomLeagueStanding): string => {
  const direct = item.teamName?.trim() || item.squadName?.trim();
  if (direct) {
    return direct;
  }

  if (item.squadId.trim()) {
    return `Squad ${shortValue(item.squadId)}`;
  }

  return `Manager ${shortValue(item.userId)}`;
};

export const CustomLeagueStandingsPage = () => {
  const { groupId = "" } = useParams();
  const { getCustomLeague, getCustomLeagueStandings } = useContainer();
  const { session } = useSession();

  const [group, setGroup] = useState<CustomLeague | null>(null);
  const [standings, setStandings] = useState<CustomLeagueStanding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = session?.accessToken?.trim() ?? "";
    const userId = session?.user.id?.trim() ?? "";

    if (!accessToken || !userId) {
      setGroup(null);
      setStandings([]);
      setErrorMessage("Session expired. Please login again.");
      return;
    }

    if (!groupId.trim()) {
      setGroup(null);
      setStandings([]);
      setErrorMessage("Group id is missing.");
      return;
    }

    let mounted = true;

    const load = async () => {
      try {
        setIsLoading(true);

        const [groupResult, standingsResult] = await Promise.all([
          getOrLoadCached({
            key: cacheKeys.customLeague(groupId, userId),
            ttlMs: cacheTtlMs.customLeagues,
            loader: () => getCustomLeague.execute(groupId, accessToken),
            allowStaleOnError: true
          }),
          getOrLoadCached({
            key: cacheKeys.customLeagueStandings(groupId, userId),
            ttlMs: cacheTtlMs.customLeagueStandings,
            loader: () => getCustomLeagueStandings.execute(groupId, accessToken),
            allowStaleOnError: true
          })
        ]);

        if (!mounted) {
          return;
        }

        setGroup(groupResult);
        setStandings([...standingsResult].sort((left, right) => left.rank - right.rank));
        setErrorMessage(null);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Failed to load standings.");
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
  }, [getCustomLeague, getCustomLeagueStandings, groupId, session?.accessToken, session?.user.id]);

  const calculatedAt = useMemo(() => {
    const latest = standings.find((item) => item.lastCalculatedAt.trim());
    if (!latest) {
      return "-";
    }

    return new Date(latest.lastCalculatedAt).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  }, [standings]);

  return (
    <div className="page-grid">
      <section className="card page-section">
        <div className="home-section-head">
          <div className="section-title">
            <h2>{group?.name ?? "Custom League"}</h2>
            <p className="muted">
              Invite Code: {group?.inviteCode ?? "-"} • Last Calculated: {calculatedAt}
            </p>
          </div>
          <Link to="/custom-leagues" className="secondary-button home-news-more">
            Back
          </Link>
        </div>
      </section>

      <section className="card page-section">
        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        {isLoading ? <LoadingState label="Loading standings" /> : null}

        {!isLoading && standings.length === 0 ? <p className="muted">No standings data yet.</p> : null}

        {!isLoading && standings.length > 0 ? (
          <div className="team-picker-table-wrap custom-standing-wrap">
            <table className="team-picker-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team Name</th>
                  <th>Rank Movement</th>
                  <th>Fantasy Squad Point</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((item) => (
                  <tr key={`${item.userId}-${item.squadId}`}>
                    <td>#{item.rank}</td>
                    <td>{resolveTeamName(item)}</td>
                    <td>
                      <span className={`movement-pill movement-${item.rankMovement}`}>
                        {movementLabel(item.rankMovement)}
                      </span>
                    </td>
                    <td>{item.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
};
