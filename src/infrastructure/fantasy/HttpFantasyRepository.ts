import type { FantasyRepository } from "../../domain/fantasy/repositories/FantasyRepository";
import type { Dashboard, TeamLineup } from "../../domain/fantasy/entities/Team";
import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import type { League } from "../../domain/fantasy/entities/League";
import type { Player } from "../../domain/fantasy/entities/Player";
import { HttpClient } from "../http/httpClient";

export class HttpFantasyRepository implements FantasyRepository {
  constructor(private readonly httpClient: HttpClient) {}

  async getDashboard(): Promise<Dashboard> {
    return this.httpClient.get<Dashboard>("/v1/dashboard");
  }

  async getLeagues(): Promise<League[]> {
    return this.httpClient.get<League[]>("/v1/leagues");
  }

  async getFixtures(leagueId: string): Promise<Fixture[]> {
    return this.httpClient.get<Fixture[]>(`/v1/leagues/${leagueId}/fixtures`);
  }

  async getPlayers(leagueId: string): Promise<Player[]> {
    return this.httpClient.get<Player[]>(`/v1/leagues/${leagueId}/players`);
  }

  async getLineup(leagueId: string): Promise<TeamLineup | null> {
    return this.httpClient.get<TeamLineup | null>(`/v1/leagues/${leagueId}/lineup`);
  }

  async saveLineup(lineup: TeamLineup): Promise<TeamLineup> {
    return this.httpClient.put<TeamLineup, TeamLineup>(
      `/v1/leagues/${lineup.leagueId}/lineup`,
      lineup
    );
  }
}
