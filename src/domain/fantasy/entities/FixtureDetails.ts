import type { Fixture } from "./Fixture";

export type FixtureEvent = {
  eventId: number;
  fixtureId: string;
  fixtureExternalId?: number;
  teamId?: string;
  teamExternalId?: number;
  playerId?: string;
  playerExternalId?: number;
  assistPlayerId?: string;
  assistPlayerExternalId?: number;
  eventType: string;
  detail?: string;
  minute: number;
  extraMinute: number;
  metadata?: Record<string, unknown>;
};

export type FixtureTeamStats = {
  teamId: string;
  teamExternalId?: number;
  teamName?: string;
  possessionPct: number;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  fouls: number;
  offsides: number;
  advancedStats?: Record<string, unknown>;
};

export type FixturePlayerStats = {
  playerId: string;
  playerExternalId?: number;
  playerName?: string;
  teamId: string;
  teamExternalId?: number;
  teamName?: string;
  minutesPlayed: number;
  goals: number;
  assists: number;
  cleanSheet: boolean;
  yellowCards: number;
  redCards: number;
  saves: number;
  fantasyPoints: number;
  advancedStats?: Record<string, unknown>;
};

export type FixtureDetails = {
  fixture: Fixture;
  teamStats: FixtureTeamStats[];
  playerStats: FixturePlayerStats[];
  events: FixtureEvent[];
};
