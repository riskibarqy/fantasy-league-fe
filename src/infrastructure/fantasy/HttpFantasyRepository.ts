import type { FantasyRepository } from "../../domain/fantasy/repositories/FantasyRepository";
import type { Dashboard, TeamLineup } from "../../domain/fantasy/entities/Team";
import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import type { League } from "../../domain/fantasy/entities/League";
import type { Player } from "../../domain/fantasy/entities/Player";
import type { PickSquadInput, Squad } from "../../domain/fantasy/entities/Squad";
import { HttpClient, HttpError } from "../http/httpClient";

type SquadPickDTO = {
  player_id: string;
  team_id: string;
  position: Player["position"];
  price: number;
};

type SquadDTO = {
  id: string;
  user_id: string;
  league_id: string;
  name: string;
  budget_cap: number;
  total_cost: number;
  picks: SquadPickDTO[];
  created_at_utc: string;
  updated_at_utc: string;
};

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

  async getMySquad(leagueId: string, accessToken: string): Promise<Squad | null> {
    try {
      const data = await this.httpClient.get<SquadDTO>(
        `/v1/fantasy/squads/me?league_id=${encodeURIComponent(leagueId)}`,
        this.authHeader(accessToken)
      );

      return mapSquadDTO(data);
    } catch (error) {
      if (error instanceof HttpError && error.statusCode === 404) {
        return null;
      }

      throw error;
    }
  }

  async pickSquad(input: PickSquadInput, accessToken: string): Promise<Squad> {
    const data = await this.httpClient.post<
      { league_id: string; squad_name?: string; player_ids: string[] },
      SquadDTO
    >(
      "/v1/fantasy/squads/picks",
      {
        league_id: input.leagueId,
        squad_name: input.squadName,
        player_ids: input.playerIds
      },
      this.authHeader(accessToken)
    );

    return mapSquadDTO(data);
  }

  private authHeader(accessToken: string): Record<string, string> {
    const token = accessToken.trim();
    if (!token) {
      throw new Error("Access token is required.");
    }

    return {
      Authorization: `Bearer ${token}`
    };
  }
}

const mapSquadDTO = (data: SquadDTO): Squad => {
  return {
    id: data.id,
    userId: data.user_id,
    leagueId: data.league_id,
    name: data.name,
    budgetCap: data.budget_cap,
    totalCost: data.total_cost,
    picks: data.picks.map((pick) => ({
      playerId: pick.player_id,
      teamId: pick.team_id,
      position: pick.position,
      price: pick.price
    })),
    createdAtUtc: data.created_at_utc,
    updatedAtUtc: data.updated_at_utc
  };
};
