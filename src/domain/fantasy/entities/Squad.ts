import type { Position } from "./Player";

export type SquadPick = {
  playerId: string;
  teamId: string;
  position: Position;
  price: number;
};

export type Squad = {
  id: string;
  userId: string;
  leagueId: string;
  name: string;
  budgetCap: number;
  totalCost: number;
  picks: SquadPick[];
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type PickSquadInput = {
  leagueId: string;
  squadName?: string;
  playerIds: string[];
};
