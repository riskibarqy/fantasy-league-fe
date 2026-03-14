export type TeamFixture = {
  teamId: string;
  teamName?: string;
  teamShort?: string;
  opponentTeamId?: string;
  opponentTeamName?: string;
  opponentTeamShort?: string;
  homeAway?: "HOME" | "AWAY";
};
