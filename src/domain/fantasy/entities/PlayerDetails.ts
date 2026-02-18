import type { Player } from "./Player";

export type PlayerProfile = Player & {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  nationality?: string;
  countryOfBirth?: string;
  birthDate?: string;
  age?: number;
  height?: string;
  weight?: string;
  preferredFoot?: string;
  shirtNumber?: number;
  marketValue?: string;
};

export type PlayerStatistics = {
  minutesPlayed: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  yellowCards: number;
  redCards: number;
  appearances: number;
  totalPoints: number;
};

export type PlayerMatchHistory = {
  fixtureId: string;
  gameweek: number;
  opponent: string;
  homeAway: string;
  kickoffAt: string;
  minutes: number;
  goals: number;
  assists: number;
  cleanSheet: boolean;
  yellowCards: number;
  redCards: number;
  points: number;
};

export type PlayerExtraInfo = {
  key: string;
  label: string;
  value: string;
};

export type PlayerDetails = {
  player: PlayerProfile;
  statistics: PlayerStatistics;
  history: PlayerMatchHistory[];
  extraInfo: PlayerExtraInfo[];
};
