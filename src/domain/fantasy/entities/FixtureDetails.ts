import type { Fixture } from "./Fixture";

export type FixtureEvent = {
  eventId: number;
  fixtureId: string;
  teamId?: string;
  playerId?: string;
  assistPlayerId?: string;
  eventType: string;
  detail?: string;
  minute: number;
  extraMinute: number;
};

export type FixtureTeamStats = {
  teamId: string;
  teamName?: string;
  possessionPct: number;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  fouls: number;
  offsides: number;
};

export type FixturePlayerStats = {
  playerId: string;
  playerName?: string;
  teamId: string;
  teamName?: string;
  minutesPlayed: number;
  goals: number;
  assists: number;
  cleanSheet: boolean;
  yellowCards: number;
  redCards: number;
  saves: number;
  fantasyPoints: number;
};

export type FixtureDetails = {
  fixture: Fixture;
  teamStats: FixtureTeamStats[];
  playerStats: FixturePlayerStats[];
  events: FixtureEvent[];
};
