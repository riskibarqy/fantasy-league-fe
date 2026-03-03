import { Link } from "react-router-dom";
import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import { formatFixtureCenterLabel } from "../lib/fixtureDisplay";
import { LazyImage } from "./LazyImage";
import { useI18n } from "../hooks/useI18n";

type FixtureMatchRowProps = {
  fixture: Fixture;
  to: string;
};

export const FixtureMatchRow = ({ fixture, to }: FixtureMatchRowProps) => {
  const { dateLocale, t } = useI18n();

  return (
    <Link to={to} className="fixtures-v2-match-row">
      <div className="fixtures-v2-team fixtures-v2-team-left">
        <span>{fixture.homeTeam}</span>
        {fixture.homeTeamLogoUrl ? (
          <LazyImage
            src={fixture.homeTeamLogoUrl}
            alt={fixture.homeTeam}
            className="fixtures-v2-team-logo"
            fallback={<span className="fixtures-v2-team-logo fixtures-v2-team-logo-fallback">H</span>}
          />
        ) : (
          <span className="fixtures-v2-team-logo fixtures-v2-team-logo-fallback">H</span>
        )}
      </div>

      <strong className="fixtures-v2-center-label">
        {formatFixtureCenterLabel(fixture, { locale: dateLocale, liveLabel: t("fixture.status.live") })}
      </strong>

      <div className="fixtures-v2-team fixtures-v2-team-right">
        {fixture.awayTeamLogoUrl ? (
          <LazyImage
            src={fixture.awayTeamLogoUrl}
            alt={fixture.awayTeam}
            className="fixtures-v2-team-logo"
            fallback={<span className="fixtures-v2-team-logo fixtures-v2-team-logo-fallback">A</span>}
          />
        ) : (
          <span className="fixtures-v2-team-logo fixtures-v2-team-logo-fallback">A</span>
        )}
        <span>{fixture.awayTeam}</span>
      </div>
    </Link>
  );
};
