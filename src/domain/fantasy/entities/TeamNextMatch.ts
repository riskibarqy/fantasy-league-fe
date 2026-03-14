export type TeamNextMatch = {
  teamId: string;
  teamName?: string;
  opponentTeamId?: string;
  opponentTeamName?: string;
  homeAway?: "HOME" | "AWAY";
};
