export type UserPlayerPoint = {
  playerId: string;
  playerName?: string;
  position: string;
  isStarter: boolean;
  isCaptain: boolean;
  isViceCaptain: boolean;
  multiplier: number;
  basePoints: number;
  countedPoints: number;
};

export type UserGameweekPoints = {
  leagueId: string;
  userId: string;
  gameweek: number;
  totalPoints: number;
  players: UserPlayerPoint[];
};
