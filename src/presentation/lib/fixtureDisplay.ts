import type { Fixture } from "../../domain/fantasy/entities/Fixture";

const LIVE_STATUSES = new Set(["LIVE", "IN_PLAY", "HT", "1H", "2H", "ET"]);

const formatMatchTime = (kickoffAt: string): string => {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta"
  }).format(new Date(kickoffAt));
};

export const isLiveFixture = (fixture: Fixture): boolean => {
  const status = fixture.status?.trim().toUpperCase() ?? "";
  return LIVE_STATUSES.has(status) || status.includes("LIVE");
};

export const formatFixtureCenterLabel = (fixture: Fixture): string => {
  const hasScore = typeof fixture.homeScore === "number" && typeof fixture.awayScore === "number";
  if (hasScore) {
    return `${fixture.homeScore} - ${fixture.awayScore}`;
  }

  if (isLiveFixture(fixture)) {
    return fixture.status?.trim() || "LIVE";
  }

  return formatMatchTime(fixture.kickoffAt);
};
