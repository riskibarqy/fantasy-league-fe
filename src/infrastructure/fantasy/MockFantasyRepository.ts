import type { FantasyRepository } from "../../domain/fantasy/repositories/FantasyRepository";
import type { Dashboard, TeamLineup } from "../../domain/fantasy/entities/Team";
import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import type { League } from "../../domain/fantasy/entities/League";
import type { Player } from "../../domain/fantasy/entities/Player";
import {
  defaultLineup,
  mockDashboard,
  mockFixtures,
  mockLeagues,
  mockPlayers
} from "../mocks/data";

const STORAGE_KEY = "fantasy-mock-lineups";

export class MockFantasyRepository implements FantasyRepository {
  async getDashboard(): Promise<Dashboard> {
    await delay(200);
    return mockDashboard;
  }

  async getLeagues(): Promise<League[]> {
    await delay(250);
    return mockLeagues;
  }

  async getFixtures(leagueId: string): Promise<Fixture[]> {
    await delay(280);
    return mockFixtures.filter((fixture) => fixture.leagueId === leagueId);
  }

  async getPlayers(leagueId: string): Promise<Player[]> {
    await delay(240);
    return mockPlayers.filter((player) => player.leagueId === leagueId);
  }

  async getLineup(leagueId: string): Promise<TeamLineup | null> {
    await delay(200);

    const lineups = readStoredLineups();
    return lineups[leagueId] ?? (defaultLineup.leagueId === leagueId ? defaultLineup : null);
  }

  async saveLineup(lineup: TeamLineup): Promise<TeamLineup> {
    await delay(300);

    const lineups = readStoredLineups();
    const next = {
      ...lineups,
      [lineup.leagueId]: lineup
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return lineup;
  }
}

const readStoredLineups = (): Record<string, TeamLineup> => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as Record<string, TeamLineup>;
  } catch {
    return {};
  }
};

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
