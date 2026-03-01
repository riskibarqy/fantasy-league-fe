export type LeagueStanding = {
  leagueId: string;
  gameweek: number;
  teamId: string;
  teamName?: string;
  teamLogoUrl?: string;
  position: number;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form?: string;
  isLive: boolean;
};
