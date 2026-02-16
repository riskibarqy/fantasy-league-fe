export type RankMovement = "up" | "down" | "same" | "new" | "unknown";

export type CustomLeague = {
  id: string;
  leagueId: string;
  ownerUserId: string;
  name: string;
  inviteCode: string;
  isDefault: boolean;
  myRank: number;
  rankMovement: RankMovement;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type CustomLeagueStanding = {
  userId: string;
  squadId: string;
  points: number;
  rank: number;
  lastCalculatedAt: string;
  updatedAtUtc: string;
  teamName?: string;
  squadName?: string;
  rankMovement: RankMovement;
};

