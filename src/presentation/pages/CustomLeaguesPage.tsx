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
import { LazyImage } from "../components/LazyImage";
import { LoadingState } from "../components/LoadingState";
import { RankMovementBadge } from "../components/RankMovementBadge";
import { useLeagueSelection } from "../hooks/useLeagueSelection";
import { useSession } from "../hooks/useSession";
import { useI18n } from "../hooks/useI18n";
import { appAlert } from "../lib/appAlert";

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
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const {
    getMyCustomLeagues,
    getPublicCustomLeagues,
    createCustomLeague,
    joinPublicCustomLeague,
    joinCustomLeagueByInvite
  } = useContainer();
  const { leagues, selectedLeagueId } = useLeagueSelection();
  const { session } = useSession();

  const [groups, setGroups] = useState<CustomLeague[]>([]);
  const [publicGroups, setPublicGroups] = useState<CustomLeague[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPublicLoading, setIsPublicLoading] = useState(false);
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
        setErrorMessage(t("customLeagues.error.sessionExpired"));
        return;
      }

      try {
        setIsLoading(true);
        setGroups([]);
        setErrorMessage(null);
        const result = await getOrLoadCached({
          key: cacheKeys.customLeagues(userId),
          ttlMs: cacheTtlMs.customLeagues,
          loader: () => getMyCustomLeagues.execute(accessToken),
          allowStaleOnError: false,
          forceRefresh
        });

        setGroups(sortCustomLeagues(result));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : t("customLeagues.error.loadFailed"));
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken, getMyCustomLeagues, t, userId]
  );

  const loadPublicGroups = useCallback(async () => {
    try {
      setIsPublicLoading(true);
      setPublicGroups([]);
      const result = await getPublicCustomLeagues.execute(selectedLeagueId);
      setPublicGroups(sortCustomLeagues(result));
    } catch {
      setPublicGroups([]);
    } finally {
      setIsPublicLoading(false);
    }
  }, [getPublicCustomLeagues, selectedLeagueId]);

  useEffect(() => {
    void loadGroups(false);
  }, [loadGroups]);

  useEffect(() => {
    void loadPublicGroups();
  }, [loadPublicGroups]);

  useEffect(() => {
    if (errorMessage) {
      void appAlert.error(t("customLeagues.alert.error"), errorMessage);
    }
  }, [errorMessage, t]);

  useEffect(() => {
    if (actionMessage) {
      void appAlert.info(t("customLeagues.alert.info"), actionMessage);
    }
  }, [actionMessage, t]);

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
  const publicLeagueCount = useMemo(() => publicGroups.length, [publicGroups]);
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
      setActionMessage(t("customLeagues.copy.success", { label }));
    } catch {
      setActionMessage(t("customLeagues.copy.failed", { label }));
    }
  };

  const onCreate = async () => {
    const leagueId = createLeagueId.trim();
    if (!leagueId) {
      setActionMessage(t("customLeagues.validation.leagueNotReady"));
      return;
    }
    if (!accessToken || !userId) {
      setActionMessage(t("customLeagues.error.sessionExpired"));
      return;
    }

    try {
      setIsCreateLoading(true);
      const created = await createCustomLeague.execute(
        {
          leagueId,
          name: createName
        },
        accessToken
      );

      invalidateCached(cacheKeys.customLeagues(userId));
      await Promise.all([loadGroups(true), loadPublicGroups()]);
      setCreateName("");
      setJoinValue(created.inviteCode);
      setActionMessage(t("customLeagues.action.created", { code: created.inviteCode }));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("customLeagues.error.createFailed");
      setActionMessage(message);
    } finally {
      setIsCreateLoading(false);
    }
  };

  const onJoin = async () => {
    const inviteCode = extractInviteCode(joinValue);
    if (!inviteCode) {
      setActionMessage(t("customLeagues.validation.inviteRequired"));
      return;
    }
    if (!accessToken || !userId) {
      setActionMessage(t("customLeagues.error.sessionExpired"));
      return;
    }

    try {
      setIsJoinLoading(true);
      const joined = await joinCustomLeagueByInvite.execute(inviteCode, accessToken);

      invalidateCached(cacheKeys.customLeagues(userId));
      invalidateCached(cacheKeys.customLeague(joined.id, userId));
      invalidateCached(cacheKeys.customLeagueStandings(joined.id, userId));

      await Promise.all([loadGroups(true), loadPublicGroups()]);
      setJoinValue(inviteCode);
      setActionMessage(t("customLeagues.action.joined", { name: joined.name }));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("customLeagues.error.joinFailed");
      setActionMessage(message);
    } finally {
      setIsJoinLoading(false);
    }
  };

  const onJoinPublic = async (groupId: string) => {
    if (!accessToken || !userId) {
      setActionMessage(t("customLeagues.error.sessionExpired"));
      return;
    }

    try {
      setIsJoinLoading(true);
      const joined = await joinPublicCustomLeague.execute(groupId, accessToken);

      invalidateCached(cacheKeys.customLeagues(userId));
      invalidateCached(cacheKeys.customLeague(joined.id, userId));
      invalidateCached(cacheKeys.customLeagueStandings(joined.id, userId));

      await Promise.all([loadGroups(true), loadPublicGroups()]);
      setActionMessage(t("customLeagues.action.joined", { name: joined.name }));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("customLeagues.error.joinFailed");
      setActionMessage(message);
    } finally {
      setIsJoinLoading(false);
    }
  };

  return (
    <div className="page-grid">
      <section className="card page-section">
        <div className="home-section-head">
          <div className="section-title">
            <h2>{t("customLeagues.title")}</h2>
            <p className="muted">{t("customLeagues.subtitle")}</p>
          </div>
          <span className="small-label">{t("customLeagues.count", { count: leagueCount })}</span>
        </div>
      </section>

      <section className="card page-section">
        <div className="custom-league-actions-grid">
          <article className="custom-league-action-card">
            <h3>{t("customLeagues.create.title")}</h3>
            <p className="muted">{t("customLeagues.create.subtitle")}</p>
            <p className="small-label">
              {t("customLeagues.create.league", { league: (leaguesById.get(createLeagueId)?.name ?? createLeagueId) || "-" })}
            </p>
            <div className="page-filter-grid">
              <label>
                {t("customLeagues.create.nameLabel")}
                <input
                  type="text"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder={t("customLeagues.create.namePlaceholder")}
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
                {isCreateLoading ? t("customLeagues.create.creating") : t("customLeagues.create.button")}
              </button>
            </div>
          </article>

          <article className="custom-league-action-card">
            <h3>{t("customLeagues.join.title")}</h3>
            <p className="muted">{t("customLeagues.join.subtitle")}</p>
            <label>
              {t("customLeagues.join.inputLabel")}
              <input
                type="text"
                value={joinValue}
                onChange={(event) => setJoinValue(event.target.value)}
                placeholder={t("customLeagues.join.placeholder")}
              />
            </label>
            <div className="team-picker-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => void onJoin()}
                disabled={isJoinLoading}
              >
                {isJoinLoading ? t("customLeagues.join.joining") : t("customLeagues.join.button")}
              </button>
            </div>
          </article>
        </div>

      </section>

      <section className="card page-section">
        {isLoading ? <LoadingState label={t("customLeagues.loading")} /> : null}

        {!isLoading && groups.length === 0 ? <p className="muted">{t("customLeagues.empty")}</p> : null}

        <div className="custom-leagues-grid">
          {groups.map((group) => (
            <article key={group.id} className="custom-league-item">
              <div className="home-section-head">
                <strong>{group.name}</strong>
                <RankMovementBadge value={group.rankMovement} />
              </div>
              <div className="media-line">
                {leaguesById.get(group.leagueId)?.logoUrl ? (
                  <LazyImage
                    src={leaguesById.get(group.leagueId)?.logoUrl ?? ""}
                    alt={leaguesById.get(group.leagueId)?.name ?? group.leagueId}
                    className="media-thumb media-thumb-small"
                    fallback={
                      <span className="media-thumb media-thumb-small media-thumb-fallback" aria-hidden="true">
                        L
                      </span>
                    }
                  />
                ) : (
                  <span className="media-thumb media-thumb-small media-thumb-fallback" aria-hidden="true">
                    L
                  </span>
                )}
                <div className="media-copy">
                  <p className="muted">
                    {t("customLeagues.league", { league: leaguesById.get(group.leagueId)?.name ?? group.leagueId })}
                  </p>
                </div>
              </div>
              <p className="muted">{t("customLeagues.rank", { rank: group.myRank > 0 ? `#${group.myRank}` : "-" })}</p>
              <p className="small-label">{t("customLeagues.inviteCode", { code: group.inviteCode })}</p>
              <div className="custom-league-item-actions">
                <Link to={`/custom-leagues/${group.id}`} className="secondary-button home-news-more">
                  {t("customLeagues.open")}
                </Link>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void copyText(group.inviteCode, t("customLeagues.copyCode"))}
                >
                  {t("customLeagues.copyCode")}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void copyText(buildInviteLink(group.inviteCode), t("customLeagues.copyLink"))}
                >
                  {t("customLeagues.copyLink")}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card page-section">
        <div className="home-section-head">
          <div className="section-title">
            <h2>{t("customLeagues.public.title")}</h2>
            <p className="muted">{t("customLeagues.public.subtitle")}</p>
          </div>
          <span className="small-label">{t("customLeagues.count", { count: publicLeagueCount })}</span>
        </div>

        {isPublicLoading ? <LoadingState label={t("customLeagues.public.loading")} /> : null}
        {!isPublicLoading && publicGroups.length === 0 ? <p className="muted">{t("customLeagues.public.empty")}</p> : null}

        <div className="custom-leagues-grid">
          {publicGroups.map((group) => (
            <article key={`public-${group.id}`} className="custom-league-item">
              <div className="home-section-head">
                <strong>{group.name}</strong>
                <span className="small-label">{t("customLeagues.public.members", { count: group.memberCount })}</span>
              </div>
              <div className="media-line">
                {leaguesById.get(group.leagueId)?.logoUrl ? (
                  <LazyImage
                    src={leaguesById.get(group.leagueId)?.logoUrl ?? ""}
                    alt={leaguesById.get(group.leagueId)?.name ?? group.leagueId}
                    className="media-thumb media-thumb-small"
                    fallback={
                      <span className="media-thumb media-thumb-small media-thumb-fallback" aria-hidden="true">
                        L
                      </span>
                    }
                  />
                ) : (
                  <span className="media-thumb media-thumb-small media-thumb-fallback" aria-hidden="true">
                    L
                  </span>
                )}
                <div className="media-copy">
                  <p className="muted">
                    {t("customLeagues.league", { league: leaguesById.get(group.leagueId)?.name ?? group.leagueId })}
                  </p>
                </div>
              </div>
              <div className="custom-league-item-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void onJoinPublic(group.id)}
                  disabled={isJoinLoading}
                >
                  {isJoinLoading ? t("customLeagues.public.joining") : t("customLeagues.public.join")}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};
