export type Fixture = {
  id: string;
  leagueId: string;
  gameweek: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogoUrl?: string;
  awayTeamLogoUrl?: string;
  kickoffAt: string;
  venue: string;
  homeScore?: number;
  awayScore?: number;
  status?: string;
  winnerTeamId?: string;
  finishedAt?: string;
};

export type FixturePage = {
  leagueId: string;
  gameweek: number;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: Fixture[];
};
