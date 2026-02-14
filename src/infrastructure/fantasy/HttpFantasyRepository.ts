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
    const payload = await this.httpClient.get<unknown>("/v1/dashboard");
    return mapDashboard(payload);
  }

  async getLeagues(): Promise<League[]> {
    const payload = await this.httpClient.get<unknown>("/v1/leagues");
    return mapLeagues(payload);
  }

  async getFixtures(leagueId: string): Promise<Fixture[]> {
    const payload = await this.httpClient.get<unknown>(`/v1/leagues/${leagueId}/fixtures`);
    return mapFixtures(payload);
  }

  async getPlayers(leagueId: string): Promise<Player[]> {
    const payload = await this.httpClient.get<unknown>(`/v1/leagues/${leagueId}/players`);
    return mapPlayers(payload, leagueId);
  }

  async getLineup(leagueId: string): Promise<TeamLineup | null> {
    const payload = await this.httpClient.get<unknown>(`/v1/leagues/${leagueId}/lineup`);
    return mapLineup(payload, leagueId);
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

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
};

const readString = (record: Record<string, unknown>, ...keys: string[]): string => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
};

const readNumber = (record: Record<string, unknown>, ...keys: string[]): number => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
};

const readBoolean = (record: Record<string, unknown>, ...keys: string[]): boolean => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }

  return false;
};

const normalizePosition = (value: string): Player["position"] => {
  const normalized = value.trim().toUpperCase();
  switch (normalized) {
    case "GK":
    case "GKP":
    case "GOALKEEPER":
      return "GK";
    case "DEF":
    case "D":
    case "DEFENDER":
      return "DEF";
    case "MID":
    case "M":
    case "MIDFIELDER":
      return "MID";
    case "FWD":
    case "FW":
    case "ST":
    case "STRIKER":
    case "FORWARD":
      return "FWD";
    default:
      return "MID";
  }
};

const normalizePrice = (raw: number): number => {
  if (raw > 20) {
    return Number((raw / 10).toFixed(1));
  }

  return Number(raw.toFixed(1));
};

const toArray = (value: unknown): unknown[] => {
  return Array.isArray(value) ? value : [];
};

const mapDashboard = (payload: unknown): Dashboard => {
  const record = asRecord(payload) ?? {};

  return {
    gameweek: readNumber(record, "gameweek"),
    budget: readNumber(record, "budget"),
    teamValue: readNumber(record, "teamValue", "team_value"),
    totalPoints: readNumber(record, "totalPoints", "total_points"),
    rank: readNumber(record, "rank"),
    selectedLeagueId: readString(record, "selectedLeagueId", "selected_league_id")
  };
};

const mapLeagues = (payload: unknown): League[] => {
  return toArray(payload)
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }

      const id = readString(record, "id", "leagueId", "league_id", "public_id");
      if (!id) {
        return null;
      }

      return {
        id,
        name: readString(record, "name"),
        countryCode: readString(record, "countryCode", "country_code"),
        logoUrl: readString(record, "logoUrl", "logo_url")
      } satisfies League;
    })
    .filter((item): item is League => Boolean(item));
};

const mapFixtures = (payload: unknown): Fixture[] => {
  return toArray(payload)
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }

      const id = readString(record, "id", "public_id");
      if (!id) {
        return null;
      }

      return {
        id,
        leagueId: readString(record, "leagueId", "league_id", "league_public_id"),
        gameweek: readNumber(record, "gameweek"),
        homeTeam: readString(record, "homeTeam", "home_team"),
        awayTeam: readString(record, "awayTeam", "away_team"),
        kickoffAt: readString(record, "kickoffAt", "kickoff_at"),
        venue: readString(record, "venue")
      } satisfies Fixture;
    })
    .filter((item): item is Fixture => Boolean(item));
};

const mapPlayers = (payload: unknown, fallbackLeagueId: string): Player[] => {
  return toArray(payload)
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }

      const id = readString(record, "id", "playerId", "player_id", "public_id");
      if (!id) {
        return null;
      }

      const positionRaw = readString(record, "position");
      if (!positionRaw) {
        return null;
      }

      return {
        id,
        leagueId:
          readString(record, "leagueId", "league_id", "league_public_id") || fallbackLeagueId,
        name: readString(record, "name"),
        club: readString(record, "club", "teamName", "team_name", "teamId", "team_id"),
        position: normalizePosition(positionRaw),
        price: normalizePrice(readNumber(record, "price")),
        form: readNumber(record, "form"),
        projectedPoints: readNumber(record, "projectedPoints", "projected_points"),
        isInjured: readBoolean(record, "isInjured", "is_injured")
      } satisfies Player;
    })
    .filter((item): item is Player => Boolean(item));
};

const mapLineup = (payload: unknown, leagueIdFromPath: string): TeamLineup | null => {
  if (payload === null) {
    return null;
  }

  const record = asRecord(payload);
  if (!record) {
    return null;
  }

  const readStringArray = (keyA: string, keyB: string): string[] => {
    const value = record[keyA] ?? record[keyB];
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === "string");
  };

  const goalkeeperId = readString(record, "goalkeeperId", "goalkeeper_id");
  const leagueId = readString(record, "leagueId", "league_id") || leagueIdFromPath;

  return {
    leagueId,
    goalkeeperId,
    defenderIds: readStringArray("defenderIds", "defender_ids"),
    midfielderIds: readStringArray("midfielderIds", "midfielder_ids"),
    forwardIds: readStringArray("forwardIds", "forward_ids"),
    substituteIds: readStringArray("substituteIds", "substitute_ids"),
    captainId: readString(record, "captainId", "captain_id"),
    viceCaptainId: readString(record, "viceCaptainId", "vice_captain_id"),
    updatedAt: readString(record, "updatedAt", "updated_at") || new Date().toISOString()
  };
};
