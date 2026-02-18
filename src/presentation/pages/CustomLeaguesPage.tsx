import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useContainer } from "../../app/dependencies/DependenciesProvider";
import {
  cacheKeys,
  cacheTtlMs,
  getOrLoadCached,
  invalidateCached
} from "../../app/cache/requestCache";
import type { CustomLeague } from "../../domain/fantasy/entities/CustomLeague";
import { LoadingState } from "../components/LoadingState";
import { RankMovementBadge } from "../components/RankMovementBadge";
import { useLeagueSelection } from "../hooks/useLeagueSelection";
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
  const [searchParams] = useSearchParams();
  const { getMyCustomLeagues, createCustomLeague, joinCustomLeagueByInvite } = useContainer();
  const { leagues, selectedLeagueId, setSelectedLeagueId } = useLeagueSelection();
  const { session } = useSession();

  const [groups, setGroups] = useState<CustomLeague[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateLoading, setIsCreateLoading] = useState(false);
  const [isJoinLoading, setIsJoinLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [createLeagueId, setCreateLeagueId] = useState("");
  const [createName, setCreateName] = useState("");
  const [joinValue, setJoinValue] = useState("");

  const accessToken = session?.accessToken?.trim() ?? "";
  const userId = session?.user.id?.trim() ?? "";

  const loadGroups = useCallback(
    async (forceRefresh: boolean) => {
      if (!accessToken || !userId) {
        setGroups([]);
        setErrorMessage("Session expired. Please login again.");
        return;
      }

      try {
        setIsLoading(true);
        const result = await getOrLoadCached({
          key: cacheKeys.customLeagues(userId),
          ttlMs: cacheTtlMs.customLeagues,
          loader: () => getMyCustomLeagues.execute(accessToken),
          allowStaleOnError: true,
          forceRefresh
        });

        setGroups(sortCustomLeagues(result));
        setErrorMessage(null);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to load custom leagues.");
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken, getMyCustomLeagues, userId]
  );

  useEffect(() => {
    void loadGroups(false);
  }, [loadGroups]);

  useEffect(() => {
    if (createLeagueId) {
      return;
    }

    const fallbackLeagueId = selectedLeagueId || leagues[0]?.id || "";
    if (fallbackLeagueId) {
      setCreateLeagueId(fallbackLeagueId);
    }
  }, [createLeagueId, leagues, selectedLeagueId]);

  useEffect(() => {
    const fromQuery = searchParams.get("invite") ?? searchParams.get("code") ?? "";
    if (fromQuery.trim()) {
      setJoinValue(fromQuery.trim());
    }
  }, [searchParams]);

  const leagueCount = useMemo(() => groups.length, [groups]);
  const leaguesById = useMemo(() => new Map(leagues.map((league) => [league.id, league])), [leagues]);

  const buildInviteLink = (inviteCode: string): string => {
    if (typeof window === "undefined") {
      return `/custom-leagues?invite=${encodeURIComponent(inviteCode)}`;
    }

    const origin = window.location.origin;
    return `${origin}/custom-leagues?invite=${encodeURIComponent(inviteCode)}`;
  };

  const extractInviteCode = (value: string): string => {
    const raw = value.trim();
    if (!raw) {
      return "";
    }

    if (/^https?:\/\//i.test(raw)) {
      try {
        const parsed = new URL(raw);
        const fromQuery =
          parsed.searchParams.get("invite") ??
          parsed.searchParams.get("code") ??
          parsed.searchParams.get("invite_code");
        if (fromQuery?.trim()) {
          return fromQuery.trim().toUpperCase();
        }
      } catch {
        return raw.toUpperCase();
      }
    }

    return raw.toUpperCase();
  };

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setActionMessage(`${label} copied.`);
    } catch {
      setActionMessage(`Failed to copy ${label.toLowerCase()}.`);
    }
  };

  const onCreate = async () => {
    const leagueId = createLeagueId.trim();
    const name = createName.trim();
    if (!leagueId) {
      setActionMessage("Select league first.");
      return;
    }
    if (!name) {
      setActionMessage("Custom league name is required.");
      return;
    }
    if (!accessToken || !userId) {
      setActionMessage("Session expired. Please login again.");
      return;
    }

    try {
      setIsCreateLoading(true);
      const created = await createCustomLeague.execute(
        {
          leagueId,
          name
        },
        accessToken
      );

      invalidateCached(cacheKeys.customLeagues(userId));
      await loadGroups(true);
      setCreateName("");
      setSelectedLeagueId(leagueId);
      setActionMessage(`Custom league created. Invite code: ${created.inviteCode}`);
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "Failed to create custom league."
      );
    } finally {
      setIsCreateLoading(false);
    }
  };

  const onJoin = async () => {
    const inviteCode = extractInviteCode(joinValue);
    if (!inviteCode) {
      setActionMessage("Invite code is required.");
      return;
    }
    if (!accessToken || !userId) {
      setActionMessage("Session expired. Please login again.");
      return;
    }

    try {
      setIsJoinLoading(true);
      const joined = await joinCustomLeagueByInvite.execute(inviteCode, accessToken);

      invalidateCached(cacheKeys.customLeagues(userId));
      invalidateCached(cacheKeys.customLeague(joined.id, userId));
      invalidateCached(cacheKeys.customLeagueStandings(joined.id, userId));

      await loadGroups(true);
      setJoinValue(inviteCode);
      setActionMessage(`Joined "${joined.name}".`);
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "Failed to join custom league."
      );
    } finally {
      setIsJoinLoading(false);
    }
  };

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
        <div className="custom-league-actions-grid">
          <article className="custom-league-action-card">
            <h3>Create Custom League</h3>
            <p className="muted">Create a private league and share invite code/link.</p>
            <div className="page-filter-grid">
              <label>
                League
                <select
                  value={createLeagueId}
                  onChange={(event) => setCreateLeagueId(event.target.value)}
                >
                  {leagues.map((league) => (
                    <option key={league.id} value={league.id}>
                      {league.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                League Name
                <input
                  type="text"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder="e.g. Bandung Weekend League"
                  maxLength={120}
                />
              </label>
            </div>
            <div className="team-picker-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => void onCreate()}
                disabled={isCreateLoading}
              >
                {isCreateLoading ? "Creating..." : "Create"}
              </button>
            </div>
          </article>

          <article className="custom-league-action-card">
            <h3>Join By Invite</h3>
            <p className="muted">Paste invite code or invite link.</p>
            <label>
              Invite Code / Link
              <input
                type="text"
                value={joinValue}
                onChange={(event) => setJoinValue(event.target.value)}
                placeholder="e.g. WARRIOR8 or https://.../custom-leagues?invite=WARRIOR8"
              />
            </label>
            <div className="team-picker-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => void onJoin()}
                disabled={isJoinLoading}
              >
                {isJoinLoading ? "Joining..." : "Join"}
              </button>
            </div>
          </article>
        </div>

        {actionMessage ? <p className="small-label">{actionMessage}</p> : null}
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
                <RankMovementBadge value={group.rankMovement} />
              </div>
              <div className="media-line">
                {leaguesById.get(group.leagueId)?.logoUrl ? (
                  <img
                    src={leaguesById.get(group.leagueId)?.logoUrl}
                    alt={leaguesById.get(group.leagueId)?.name ?? group.leagueId}
                    className="media-thumb media-thumb-small"
                    loading="lazy"
                  />
                ) : (
                  <span className="media-thumb media-thumb-small media-thumb-fallback" aria-hidden="true">
                    L
                  </span>
                )}
                <div className="media-copy">
                  <p className="muted">League: {leaguesById.get(group.leagueId)?.name ?? group.leagueId}</p>
                  <a
                    className="media-url"
                    href={leaguesById.get(group.leagueId)?.logoUrl || "#"}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => {
                      if (!leaguesById.get(group.leagueId)?.logoUrl) {
                        event.preventDefault();
                      }
                    }}
                  >
                    {leaguesById.get(group.leagueId)?.logoUrl || "Logo URL not available"}
                  </a>
                </div>
              </div>
              <p className="muted">My Rank: {group.myRank > 0 ? `#${group.myRank}` : "-"}</p>
              <p className="small-label">Invite Code: {group.inviteCode}</p>
              <div className="custom-league-item-actions">
                <Link to={`/custom-leagues/${group.id}`} className="secondary-button home-news-more">
                  Open
                </Link>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void copyText(group.inviteCode, "Invite code")}
                >
                  Copy Code
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void copyText(buildInviteLink(group.inviteCode), "Invite link")}
                >
                  Copy Link
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};
