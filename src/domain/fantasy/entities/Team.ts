export type TeamLineup = {
  leagueId: string;
  goalkeeperId: string;
  defenderIds: string[];
  midfielderIds: string[];
  forwardIds: string[];
  captainId: string;
  viceCaptainId: string;
  updatedAt: string;
};

export type Dashboard = {
  gameweek: number;
  budget: number;
  teamValue: number;
  totalPoints: number;
  rank: number;
  selectedLeagueId: string;
};
