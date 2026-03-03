import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import { LazyImage } from "./LazyImage";
import { useI18n } from "../hooks/useI18n";

type FixtureState = "live" | "finished" | "upcoming";

const LIVE_STATUSES = new Set(["LIVE", "IN_PLAY", "HT", "1H", "2H", "ET"]);
const FINISHED_STATUSES = new Set([
  "FINISHED",
  "FT",
  "FULL_TIME",
  "AET",
  "PEN",
  "COMPLETED",
  "ENDED"
]);

const getFixtureState = (fixture: Fixture): FixtureState => {
  const status = fixture.status?.trim().toUpperCase() ?? "";
  const hasScore = typeof fixture.homeScore === "number" && typeof fixture.awayScore === "number";
  const kickoffAt = new Date(fixture.kickoffAt).getTime();

  if (LIVE_STATUSES.has(status) || status.includes("LIVE")) {
    return "live";
  }

  if (FINISHED_STATUSES.has(status) || (hasScore && kickoffAt <= Date.now())) {
    return "finished";
  }

  return "upcoming";
};

const formatKickoffMeta = (kickoffAt: string, locale: string): string => {
  const date = new Date(kickoffAt);
  const dayMonth = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Jakarta"
  }).format(date);
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta"
  })
    .format(date)
    .replace(".", ":");

  return `${dayMonth} • ${time} WIB`;
};

const getLiveLabel = (rawStatus: string | undefined, liveWord: string): string => {
  const status = rawStatus?.trim() ?? "";
  if (!status) {
    return liveWord;
  }

  const suffix = status.replace(/^LIVE/i, "").trim();
  return suffix ? `${liveWord} ${suffix}` : liveWord;
};

export const FixtureCard = ({ fixture }: { fixture: Fixture }) => {
  const { dateLocale, t } = useI18n();
  const kickOff = formatKickoffMeta(fixture.kickoffAt, dateLocale);
  const hasScore = typeof fixture.homeScore === "number" && typeof fixture.awayScore === "number";
  const scoreline = hasScore ? `${fixture.homeScore} - ${fixture.awayScore}` : t("fixture.center.vs");
  const state = getFixtureState(fixture);
  const liveLabel = getLiveLabel(fixture.status, t("fixture.status.live"));

  return (
    <article className="fixture-modern-card">
      <div className="fixture-modern-matchup">
        <div className="fixture-modern-team fixture-modern-team-left">
          <div className="fixture-modern-team-name">{fixture.homeTeam}</div>
          {fixture.homeTeamLogoUrl ? (
            <LazyImage
              src={fixture.homeTeamLogoUrl}
              alt={fixture.homeTeam}
              className="fixture-modern-logo"
              fallback={<span className="fixture-modern-logo fixture-modern-logo-fallback">H</span>}
            />
          ) : (
            <span className="fixture-modern-logo fixture-modern-logo-fallback">H</span>
          )}
        </div>
        <div className="fixture-modern-score">{scoreline}</div>
        <div className="fixture-modern-team fixture-modern-team-right">
          {fixture.awayTeamLogoUrl ? (
            <LazyImage
              src={fixture.awayTeamLogoUrl}
              alt={fixture.awayTeam}
              className="fixture-modern-logo"
              fallback={<span className="fixture-modern-logo fixture-modern-logo-fallback">A</span>}
            />
          ) : (
            <span className="fixture-modern-logo fixture-modern-logo-fallback">A</span>
          )}
          <div className="fixture-modern-team-name">{fixture.awayTeam}</div>
        </div>
      </div>

      <div className="fixture-modern-status-row">
        {state === "finished" ? <span className="fixture-status-badge fixture-status-finished">FT</span> : null}
        {state === "live" ? (
          <span className="fixture-status-badge fixture-status-live">
            <span className="fixture-live-dot" aria-hidden="true" />
            {liveLabel}
          </span>
        ) : null}
        {state === "upcoming" ? (
          <span className="fixture-status-badge fixture-status-upcoming">{t("fixture.status.notStarted")}</span>
        ) : null}
      </div>

      <p className="fixture-modern-meta">{kickOff}</p>
    </article>
  );
};
