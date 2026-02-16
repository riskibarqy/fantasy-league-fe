import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import { cacheKeys, cacheTtlMs, getOrLoadCached } from "../../app/cache/requestCache";
import type { CustomLeague } from "../../domain/fantasy/entities/CustomLeague";
import { LoadingState } from "../components/LoadingState";
import { useSession } from "../hooks/useSession";

const sortCustomLeagues = (items: CustomLeague[]): CustomLeague[] => {
  return [...items].sort((left, right) => {
    const leftRank = left.myRank > 0 ? left.myRank : Number.MAX_SAFE_INTEGER;
    const rightRank = right.myRank > 0 ? right.myRank : Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return left.name.localeCompare(right.name, "id-ID");
  });
};

export const CustomLeaguesPage = () => {
  const { getMyCustomLeagues } = useContainer();
  const { session } = useSession();

  const [groups, setGroups] = useState<CustomLeague[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = session?.accessToken?.trim() ?? "";
    const userId = session?.user.id?.trim() ?? "";

    if (!accessToken || !userId) {
      setGroups([]);
      setErrorMessage("Session expired. Please login again.");
      return;
    }

    let mounted = true;

    const load = async () => {
      try {
        setIsLoading(true);
        const result = await getOrLoadCached({
          key: cacheKeys.customLeagues(userId),
          ttlMs: cacheTtlMs.customLeagues,
          loader: () => getMyCustomLeagues.execute(accessToken),
          allowStaleOnError: true
        });

        if (!mounted) {
          return;
        }

        setGroups(sortCustomLeagues(result));
        setErrorMessage(null);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Failed to load custom leagues.");
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
  }, [getMyCustomLeagues, session?.accessToken, session?.user.id]);

  const leagueCount = useMemo(() => groups.length, [groups]);

  return (
    <div className="page-grid">
      <section className="card page-section">
        <div className="home-section-head">
          <div className="section-title">
            <h2>Custom Leagues</h2>
            <p className="muted">All your custom leagues with rank and movement.</p>
          </div>
          <span className="small-label">{leagueCount} leagues</span>
        </div>
      </section>

      <section className="card page-section">
        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        {isLoading ? <LoadingState label="Loading custom leagues" /> : null}

        {!isLoading && groups.length === 0 ? <p className="muted">No custom leagues found.</p> : null}

        <div className="custom-leagues-grid">
          {groups.map((group) => (
            <article key={group.id} className="custom-league-item">
              <div className="home-section-head">
                <strong>{group.name}</strong>
                <span className={`movement-pill movement-${group.rankMovement}`}>{group.rankMovement}</span>
              </div>
              <p className="muted">League: {group.leagueId}</p>
              <p className="muted">My Rank: {group.myRank > 0 ? `#${group.myRank}` : "-"}</p>
              <p className="small-label">Invite Code: {group.inviteCode}</p>
              <div className="team-picker-actions">
                <Link to={`/custom-leagues/${group.id}`} className="secondary-button home-news-more">
                  Open
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};
