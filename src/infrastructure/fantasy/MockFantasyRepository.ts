import type { FantasyRepository } from "../../domain/fantasy/repositories/FantasyRepository";
import type { Dashboard, TeamLineup } from "../../domain/fantasy/entities/Team";
import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import type { League } from "../../domain/fantasy/entities/League";
import type { Player } from "../../domain/fantasy/entities/Player";
import type { PickSquadInput, Squad } from "../../domain/fantasy/entities/Squad";
import {
  defaultLineup,
  mockDashboard,
  mockFixtures,
  mockLeagues,
  mockPlayers
} from "../mocks/data";

const STORAGE_KEY = "fantasy-mock-lineups";
const SQUAD_STORAGE_KEY = "fantasy-mock-squads";

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

  async getMySquad(leagueId: string, _accessToken: string): Promise<Squad | null> {
    await delay(200);
    const squads = readStoredSquads();
    return squads[leagueId] ?? null;
  }

  async pickSquad(input: PickSquadInput, _accessToken: string): Promise<Squad> {
    await delay(280);

    const playersById = new Map(
      mockPlayers
        .filter((player) => player.leagueId === input.leagueId)
        .map((player) => [player.id, player])
    );

    const picks = input.playerIds
      .map((id) => playersById.get(id))
      .filter((player): player is Player => Boolean(player))
      .map((player) => ({
        playerId: player.id,
        teamId: player.club,
        position: player.position,
        price: Math.round(player.price * 10)
      }));

    if (picks.length === 0) {
      throw new Error("No players can be picked for this league.");
    }

    const totalCost = picks.reduce((sum, pick) => sum + pick.price, 0);

    const squad: Squad = {
      id: `mock-squad-${input.leagueId}`,
      userId: "mock-user",
      leagueId: input.leagueId,
      name: input.squadName?.trim() || "My Squad",
      budgetCap: 1000,
      totalCost,
      picks,
      createdAtUtc: new Date().toISOString(),
      updatedAtUtc: new Date().toISOString()
    };

    const squads = readStoredSquads();
    localStorage.setItem(
      SQUAD_STORAGE_KEY,
      JSON.stringify({
        ...squads,
        [input.leagueId]: squad
      })
    );

    return squad;
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

const readStoredSquads = (): Record<string, Squad> => {
  const raw = localStorage.getItem(SQUAD_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as Record<string, Squad>;
  } catch {
    return {};
  }
};

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
