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

export type TransferSquadInput = {
  leagueId: string;
  gameweek: number;
  outPlayerId: string;
  inPlayerId: string;
};

export type TransferSquadResult = {
  gameweek: number;
  freeTransfersRemaining: number;
  transferCost: number;
  squad: Squad;
  lineup?: import("./Team").TeamLineup;
};

export type TransferAvailability = {
  gameweek: number;
  freeTransfersAvailable: number;
  maxFreeTransfersBank: number;
};
