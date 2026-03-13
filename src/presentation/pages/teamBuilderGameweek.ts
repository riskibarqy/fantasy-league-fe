export const resolveFixtureTargetGameweek = (
  dashboardGameweek: number | null,
  activeFixtureGameweek: number | null
): number | null => {
  if (dashboardGameweek && dashboardGameweek > 0) {
    return dashboardGameweek;
  }

  if (activeFixtureGameweek && activeFixtureGameweek > 0) {
    return activeFixtureGameweek;
  }

  return null;
};
