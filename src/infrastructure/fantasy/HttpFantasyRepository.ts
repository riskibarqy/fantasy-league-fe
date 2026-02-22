import type { FantasyRepository } from "../../domain/fantasy/repositories/FantasyRepository";
import type { Dashboard, TeamLineup } from "../../domain/fantasy/entities/Team";
import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import type { League } from "../../domain/fantasy/entities/League";
import type { Player } from "../../domain/fantasy/entities/Player";
import type { PlayerDetails, PlayerExtraInfo, PlayerMatchHistory, PlayerProfile, PlayerStatistics } from "../../domain/fantasy/entities/PlayerDetails";
import type { Club } from "../../domain/fantasy/entities/Club";
import type { PickSquadInput, Squad } from "../../domain/fantasy/entities/Squad";
import type {
  CompleteOnboardingInput,
  CompleteOnboardingResult,
  OnboardingProfile,
  SaveFavoriteClubInput
} from "../../domain/fantasy/entities/Onboarding";
import type {
  CreateCustomLeagueInput,
  CustomLeague,
  CustomLeagueStanding,
  RankMovement
} from "../../domain/fantasy/entities/CustomLeague";
import { HttpClient, HttpError } from "../http/httpClient";

export class HttpFantasyRepository implements FantasyRepository {
  constructor(private readonly httpClient: HttpClient) {}

  async getDashboard(accessToken: string): Promise<Dashboard> {
    const payload = await this.httpClient.get<unknown>("/v1/dashboard", this.authHeader(accessToken));
    return mapDashboard(payload);
  }

  async getLeagues(): Promise<League[]> {
    const payload = await this.httpClient.get<unknown>("/v1/leagues");
    return mapLeagues(payload);
  }

  async getTeams(leagueId: string): Promise<Club[]> {
    const payload = await this.httpClient.get<unknown>(
      `/v1/leagues/${encodeURIComponent(leagueId)}/teams`
    );
    return mapTeams(payload, leagueId);
  }

  async getFixtures(leagueId: string): Promise<Fixture[]> {
    const payload = await this.httpClient.get<unknown>(`/v1/leagues/${leagueId}/fixtures`);
    return mapFixtures(payload);
  }

  async getPlayers(leagueId: string): Promise<Player[]> {
    const payload = await this.httpClient.get<unknown>(`/v1/leagues/${leagueId}/players`);
    return mapPlayers(payload, leagueId);
  }

  async getPlayerDetails(leagueId: string, playerId: string): Promise<PlayerDetails> {
    const payload = await this.httpClient.get<unknown>(
      `/v1/leagues/${encodeURIComponent(leagueId)}/players/${encodeURIComponent(playerId)}`
    );
    return mapPlayerDetails(payload, leagueId, playerId);
  }

  async getLineup(leagueId: string, accessToken?: string): Promise<TeamLineup | null> {
    const payload = await this.httpClient.get<unknown>(
      `/v1/leagues/${leagueId}/lineup`,
      this.authHeaderIfPresent(accessToken)
    );
    return mapLineup(payload, leagueId);
  }

  async saveLineup(lineup: TeamLineup, accessToken?: string): Promise<TeamLineup> {
    const payload = await this.httpClient.put<TeamLineup, unknown>(
      `/v1/leagues/${lineup.leagueId}/lineup`,
      lineup,
      this.authHeaderIfPresent(accessToken)
    );

    return mapLineup(payload, lineup.leagueId) ?? lineup;
  }

  async getMySquad(leagueId: string, accessToken: string): Promise<Squad | null> {
    try {
      const data = await this.httpClient.get<unknown>(
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
      unknown
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

  async saveOnboardingFavoriteClub(
    input: SaveFavoriteClubInput,
    accessToken: string
  ): Promise<OnboardingProfile> {
    const data = await this.httpClient.put<
      { league_id: string; team_id: string },
      unknown
    >(
      "/v1/onboarding/favorite-club",
      {
        league_id: input.leagueId,
        team_id: input.teamId
      },
      this.authHeader(accessToken)
    );

    return mapOnboardingProfileDTO(data);
  }

  async completeOnboarding(
    input: CompleteOnboardingInput,
    accessToken: string
  ): Promise<CompleteOnboardingResult> {
    const data = await this.httpClient.post<
      {
        league_id: string;
        squad_name?: string;
        player_ids: string[];
        goalkeeper_id: string;
        defender_ids: string[];
        midfielder_ids: string[];
        forward_ids: string[];
        substitute_ids: string[];
        captain_id: string;
        vice_captain_id: string;
      },
      unknown
    >(
      "/v1/onboarding/pick-squad",
      {
        league_id: input.leagueId,
        squad_name: input.squadName,
        player_ids: input.playerIds,
        goalkeeper_id: input.lineup.goalkeeperId,
        defender_ids: input.lineup.defenderIds,
        midfielder_ids: input.lineup.midfielderIds,
        forward_ids: input.lineup.forwardIds,
        substitute_ids: input.lineup.substituteIds,
        captain_id: input.lineup.captainId,
        vice_captain_id: input.lineup.viceCaptainId
      },
      this.authHeader(accessToken)
    );

    const response = asRecord(data) ?? {};

    return {
      profile: mapOnboardingProfileDTO(response.profile),
      squad: mapSquadDTO(response.squad),
      lineup: mapLineup(response.lineup, input.leagueId) ?? input.lineup
    };
  }

  async getMyCustomLeagues(accessToken: string): Promise<CustomLeague[]> {
    const headers = this.authHeader(accessToken);
    try {
      const data = await this.httpClient.get<unknown>("/v1/custom-leagues/me", headers);
      return mapCustomLeagues(data);
    } catch (error) {
      // Backward compatibility for deployments that expose only /v1/custom-leagues.
      if (!(error instanceof HttpError) || (error.statusCode !== 404 && error.statusCode !== 405)) {
        throw error;
      }
    }

    const fallbackData = await this.httpClient.get<unknown>("/v1/custom-leagues", headers);
    return mapCustomLeagues(fallbackData);
  }

  async createCustomLeague(input: CreateCustomLeagueInput, accessToken: string): Promise<CustomLeague> {
    const data = await this.httpClient.post<
      {
        league_id: string;
        name: string;
      },
      unknown
    >(
      "/v1/custom-leagues",
      {
        league_id: input.leagueId,
        name: input.name
      },
      this.authHeader(accessToken)
    );

    return mapCustomLeague(data);
  }

  async joinCustomLeagueByInvite(inviteCode: string, accessToken: string): Promise<CustomLeague> {
    const data = await this.httpClient.post<
      {
        invite_code: string;
      },
      unknown
    >(
      "/v1/custom-leagues/join",
      {
        invite_code: inviteCode
      },
      this.authHeader(accessToken)
    );

    return mapCustomLeague(data);
  }

  async getCustomLeague(groupId: string, accessToken: string): Promise<CustomLeague> {
    const data = await this.httpClient.get<unknown>(
      `/v1/custom-leagues/${encodeURIComponent(groupId)}`,
      this.authHeader(accessToken)
    );

    return mapCustomLeague(data);
  }

  async getCustomLeagueStandings(
    groupId: string,
    accessToken: string
  ): Promise<CustomLeagueStanding[]> {
    const data = await this.httpClient.get<unknown>(
      `/v1/custom-leagues/${encodeURIComponent(groupId)}/standings`,
      this.authHeader(accessToken)
    );

    return mapCustomLeagueStandings(data);
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

  private authHeaderIfPresent(accessToken?: string): Record<string, string> {
    const token = accessToken?.trim() ?? "";
    if (!token) {
      return {};
    }

    return {
      Authorization: `Bearer ${token}`
    };
  }
}

const mapSquadDTO = (payload: unknown): Squad => {
  const data = asRecord(payload) ?? {};

  const normalizeBudgetValue = (value: number): number => {
    return Number((value / 10).toFixed(1));
  };

  const picks = readArray(data, "picks").map((item) => {
    const pickRecord = asRecord(item) ?? {};
    return {
      playerId: readString(pickRecord, "player_id", "playerId"),
      teamId: readString(pickRecord, "team_id", "teamId"),
      position: normalizePosition(readString(pickRecord, "position")),
      price: normalizeBudgetValue(readNumber(pickRecord, "price"))
    };
  });

  return {
    id: readString(data, "id", "public_id"),
    userId: readString(data, "user_id", "userId"),
    leagueId: readString(data, "league_id", "leagueId"),
    name: readString(data, "name"),
    budgetCap: normalizeBudgetValue(readNumber(data, "budget_cap", "budgetCap")),
    totalCost: normalizeBudgetValue(readNumber(data, "total_cost", "totalCost")),
    picks: picks.filter((pick) => pick.playerId && pick.teamId),
    createdAtUtc: readString(data, "created_at_utc", "createdAtUtc"),
    updatedAtUtc: readString(data, "updated_at_utc", "updatedAtUtc")
  };
};

const mapOnboardingProfileDTO = (payload: unknown): OnboardingProfile => {
  const data = asRecord(payload) ?? {};
  return {
    userId: readString(data, "user_id", "userId"),
    favoriteLeagueId: readString(data, "favorite_league_id", "favoriteLeagueId") || undefined,
    favoriteTeamId: readString(data, "favorite_team_id", "favoriteTeamId") || undefined,
    countryCode: readString(data, "country_code", "countryCode") || undefined,
    ipAddress: readString(data, "ip_address", "ipAddress") || undefined,
    onboardingCompleted: readBoolean(data, "onboarding_completed", "onboardingCompleted"),
    updatedAtUtc: readString(data, "updated_at_utc", "updatedAtUtc") || undefined
  };
};

const normalizeRankMovement = (value: unknown): RankMovement => {
  if (typeof value !== "string") {
    return "unknown";
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "up" || normalized === "down" || normalized === "same" || normalized === "new") {
    return normalized;
  }

  return "unknown";
};

const deriveRankMovement = (rank: number, previousRank?: number): RankMovement => {
  if (!previousRank || previousRank <= 0) {
    return "unknown";
  }

  if (rank < previousRank) {
    return "up";
  }

  if (rank > previousRank) {
    return "down";
  }

  return "same";
};

const mapCustomLeague = (payload: unknown): CustomLeague => {
  const record = asRecord(payload);
  if (!record) {
    throw new Error("Invalid custom league payload.");
  }

  const id = readString(record, "id");
  if (!id) {
    throw new Error("Custom league id is missing.");
  }

  return {
    id,
    leagueId: readString(record, "league_id", "leagueId"),
    ownerUserId: readString(record, "owner_user_id", "ownerUserId"),
    name: readString(record, "name"),
    inviteCode: readString(record, "invite_code", "inviteCode"),
    isDefault: readBoolean(record, "is_default", "isDefault"),
    myRank: readNumber(record, "my_rank", "myRank"),
    rankMovement: normalizeRankMovement(record.rank_movement ?? record.rankMovement),
    createdAtUtc: readString(record, "created_at_utc", "createdAtUtc"),
    updatedAtUtc: readString(record, "updated_at_utc", "updatedAtUtc")
  };
};

const mapCustomLeagues = (payload: unknown): CustomLeague[] => {
  return toArrayFromPayload(payload, ["items", "leagues", "customLeagues", "results"])
    .map((item) => {
      try {
        return mapCustomLeague(item);
      } catch {
        return null;
      }
    })
    .filter((item): item is CustomLeague => Boolean(item));
};

const mapCustomLeagueStanding = (payload: unknown): CustomLeagueStanding | null => {
  const record = asRecord(payload);
  if (!record) {
    return null;
  }

  const userId = readString(record, "user_id", "userId");
  const squadId = readString(record, "squad_id", "squadId");
  if (!userId || !squadId) {
    return null;
  }

  const rank = readNumber(record, "rank");
  const previousRankRaw = record.previous_rank ?? record.previousRank;
  const previousRank =
    typeof previousRankRaw === "number" && Number.isFinite(previousRankRaw)
      ? previousRankRaw
      : undefined;
  const movement = normalizeRankMovement(record.rank_movement ?? record.rankMovement);

  return {
    userId,
    squadId,
    points: readNumber(record, "points"),
    rank,
    lastCalculatedAt: readString(record, "last_calculated_at", "lastCalculatedAt"),
    updatedAtUtc: readString(record, "updated_at_utc", "updatedAtUtc"),
    teamName: readString(record, "team_name", "teamName") || undefined,
    squadName: readString(record, "squad_name", "squadName") || undefined,
    rankMovement: movement === "unknown" ? deriveRankMovement(rank, previousRank) : movement
  };
};

const mapCustomLeagueStandings = (payload: unknown): CustomLeagueStanding[] => {
  return toArrayFromPayload(payload, ["items", "standings", "results"])
    .map((item) => mapCustomLeagueStanding(item))
    .filter((item): item is CustomLeagueStanding => Boolean(item));
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

const readOptionalNumber = (record: Record<string, unknown>, ...keys: string[]): number | undefined => {
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

  return undefined;
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

const readArray = (record: Record<string, unknown>, ...keys: string[]): unknown[] => {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
};

const toArrayFromPayload = (payload: unknown, keys: string[] = []): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  const record = asRecord(payload);
  if (!record) {
    return [];
  }

  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  const fallbackKeys = ["items", "results", "list", "rows", "data"];
  for (const key of fallbackKeys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
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
  return toArrayFromPayload(payload, ["leagues", "items"])
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

const mapTeams = (payload: unknown, fallbackLeagueId: string): Club[] => {
  return toArrayFromPayload(payload, ["teams", "items"])
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }

      const id = readString(record, "id", "teamId", "team_id", "public_id");
      if (!id) {
        return null;
      }

      return {
        id,
        leagueId:
          readString(record, "leagueId", "league_id", "league_public_id") || fallbackLeagueId,
        name: readString(record, "name"),
        short: readString(record, "short", "short_name", "abbreviation"),
        logoUrl: readString(record, "logoUrl", "logo_url")
      } satisfies Club;
    })
    .filter((item): item is Club => Boolean(item));
};

const mapFixtures = (payload: unknown): Fixture[] => {
  return toArrayFromPayload(payload, ["fixtures", "items"])
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }

      const id = readString(record, "id", "public_id");
      if (!id) {
        return null;
      }

      const fixture: Fixture = {
        id,
        leagueId: readString(record, "leagueId", "league_id", "league_public_id"),
        gameweek: readNumber(record, "gameweek"),
        homeTeam: readString(record, "homeTeam", "home_team"),
        awayTeam: readString(record, "awayTeam", "away_team"),
        kickoffAt: readString(record, "kickoffAt", "kickoff_at"),
        venue: readString(record, "venue")
      };

      const homeTeamLogoUrl = readString(record, "homeTeamLogoUrl", "home_team_logo_url");
      if (homeTeamLogoUrl) {
        fixture.homeTeamLogoUrl = homeTeamLogoUrl;
      }

      const awayTeamLogoUrl = readString(record, "awayTeamLogoUrl", "away_team_logo_url");
      if (awayTeamLogoUrl) {
        fixture.awayTeamLogoUrl = awayTeamLogoUrl;
      }

      const homeScore = readOptionalNumber(record, "homeScore", "home_score");
      if (homeScore !== undefined) {
        fixture.homeScore = homeScore;
      }

      const awayScore = readOptionalNumber(record, "awayScore", "away_score");
      if (awayScore !== undefined) {
        fixture.awayScore = awayScore;
      }

      const status = readString(record, "status");
      if (status) {
        fixture.status = status;
      }

      const winnerTeamId = readString(record, "winnerTeamId", "winner_team_id", "winner_team_public_id");
      if (winnerTeamId) {
        fixture.winnerTeamId = winnerTeamId;
      }

      const finishedAt = readString(record, "finishedAt", "finished_at");
      if (finishedAt) {
        fixture.finishedAt = finishedAt;
      }

      return fixture;
    })
    .filter((item): item is Fixture => Boolean(item));
};

const mapPlayers = (payload: unknown, fallbackLeagueId: string): Player[] => {
  return toArrayFromPayload(payload, ["players", "items"])
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }

      return mapPlayerFromRecord(record, fallbackLeagueId);
    })
    .filter((item): item is Player => Boolean(item));
};

const mapPlayerFromRecord = (
  record: Record<string, unknown>,
  fallbackLeagueId: string
): Player | null => {
  const id = readString(record, "id", "playerId", "player_id", "public_id");
  if (!id) {
    return null;
  }

  const positionRaw = readString(record, "position");
  if (!positionRaw) {
    return null;
  }

  const player: Player = {
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
  };

  const imageUrl = readString(
    record,
    "imageUrl",
    "image_url",
    "photoUrl",
    "photo_url",
    "playerImageUrl",
    "player_image_url"
  );
  if (imageUrl) {
    player.imageUrl = imageUrl;
  }

  const teamLogoUrl = readString(
    record,
    "teamLogoUrl",
    "team_logo_url",
    "clubLogoUrl",
    "club_logo_url",
    "teamImageUrl",
    "team_image_url"
  );
  if (teamLogoUrl) {
    player.teamLogoUrl = teamLogoUrl;
  }

  return player;
};

const mapPlayerDetails = (
  payload: unknown,
  fallbackLeagueId: string,
  fallbackPlayerId: string
): PlayerDetails => {
  const rootRecord = asRecord(payload);
  const playerRecord = asRecord(rootRecord?.player) ?? rootRecord;
  const fallbackPlayerRecord = {
    id: fallbackPlayerId,
    leagueId: fallbackLeagueId,
    name: "Unknown Player",
    club: "-",
    position: "MID",
    price: 0,
    form: 0,
    projectedPoints: 0,
    isInjured: false
  } satisfies Record<string, unknown>;

  const mappedPlayer =
    (playerRecord ? mapPlayerFromRecord(playerRecord, fallbackLeagueId) : null) ??
    mapPlayerFromRecord(fallbackPlayerRecord, fallbackLeagueId);
  if (!mappedPlayer) {
    throw new Error("Invalid player details payload.");
  }

  const profile = mapPlayerProfile(playerRecord ?? fallbackPlayerRecord, mappedPlayer);
  const statistics = mapPlayerStatistics(asRecord(rootRecord?.statistics));
  const history = mapPlayerHistory(rootRecord?.history);
  const extraInfo = mapPlayerExtraInfo(playerRecord ?? fallbackPlayerRecord);

  return {
    player: profile,
    statistics,
    history,
    extraInfo
  };
};

const mapPlayerProfile = (
  record: Record<string, unknown>,
  basePlayer: Player
): PlayerProfile => {
  const profile: PlayerProfile = {
    ...basePlayer
  };

  const fullName = readString(record, "fullName", "full_name");
  if (fullName) {
    profile.fullName = fullName;
  }

  const firstName = readString(record, "firstName", "first_name");
  if (firstName) {
    profile.firstName = firstName;
  }

  const lastName = readString(record, "lastName", "last_name");
  if (lastName) {
    profile.lastName = lastName;
  }

  const nationality = readString(record, "nationality", "nationality_name", "country", "country_name");
  if (nationality) {
    profile.nationality = nationality;
  }

  const countryOfBirth = readString(
    record,
    "countryOfBirth",
    "country_of_birth",
    "birthCountry",
    "birth_country"
  );
  if (countryOfBirth) {
    profile.countryOfBirth = countryOfBirth;
  }

  const birthDate = readString(
    record,
    "birthDate",
    "birth_date",
    "dateOfBirth",
    "date_of_birth",
    "dob"
  );
  if (birthDate) {
    profile.birthDate = birthDate;
  }

  const age = readOptionalNumber(record, "age");
  if (typeof age === "number" && age > 0) {
    profile.age = age;
  }

  const heightRaw = record.height ?? record.height_cm ?? record.heightCm;
  const height = primitiveToDisplayString(heightRaw);
  if (height) {
    profile.height = height;
  }

  const weightRaw = record.weight ?? record.weight_kg ?? record.weightKg;
  const weight = primitiveToDisplayString(weightRaw);
  if (weight) {
    profile.weight = weight;
  }

  const preferredFoot = readString(record, "preferredFoot", "preferred_foot", "foot");
  if (preferredFoot) {
    profile.preferredFoot = preferredFoot;
  }

  const shirtNumber = readOptionalNumber(record, "shirtNumber", "shirt_number", "jerseyNumber", "jersey_number");
  if (typeof shirtNumber === "number" && shirtNumber > 0) {
    profile.shirtNumber = shirtNumber;
  }

  const marketValue = primitiveToDisplayString(
    record.marketValue ?? record.market_value ?? record.value ?? record.player_value
  );
  if (marketValue) {
    profile.marketValue = marketValue;
  }

  return profile;
};

const mapPlayerStatistics = (record: Record<string, unknown> | null): PlayerStatistics => {
  if (!record) {
    return {
      minutesPlayed: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      appearances: 0,
      totalPoints: 0
    };
  }

  return {
    minutesPlayed: readNumber(record, "minutesPlayed", "minutes_played"),
    goals: readNumber(record, "goals"),
    assists: readNumber(record, "assists"),
    cleanSheets: readNumber(record, "cleanSheets", "clean_sheets"),
    yellowCards: readNumber(record, "yellowCards", "yellow_cards"),
    redCards: readNumber(record, "redCards", "red_cards"),
    appearances: readNumber(record, "appearances"),
    totalPoints: readNumber(record, "totalPoints", "total_points")
  };
};

const mapPlayerHistory = (payload: unknown): PlayerMatchHistory[] => {
  return toArrayFromPayload(payload, ["history", "items"])
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }

      return {
        fixtureId: readString(record, "fixtureId", "fixture_id"),
        gameweek: readNumber(record, "gameweek"),
        opponent: readString(record, "opponent"),
        homeAway: readString(record, "homeAway", "home_away"),
        kickoffAt: readString(record, "kickoffAt", "kickoff_at"),
        minutes: readNumber(record, "minutes", "minutesPlayed", "minutes_played"),
        goals: readNumber(record, "goals"),
        assists: readNumber(record, "assists"),
        cleanSheet: readBoolean(record, "cleanSheet", "clean_sheet"),
        yellowCards: readNumber(record, "yellowCards", "yellow_cards"),
        redCards: readNumber(record, "redCards", "red_cards"),
        points: readNumber(record, "points")
      } satisfies PlayerMatchHistory;
    })
    .filter((item): item is PlayerMatchHistory => Boolean(item));
};

const mapPlayerExtraInfo = (record: Record<string, unknown>): PlayerExtraInfo[] => {
  const hiddenKeys = new Set([
    "id",
    "playerId",
    "player_id",
    "public_id",
    "leagueId",
    "league_id",
    "league_public_id",
    "name",
    "fullName",
    "full_name",
    "firstName",
    "first_name",
    "lastName",
    "last_name",
    "club",
    "teamName",
    "team_name",
    "teamId",
    "team_id",
    "position",
    "price",
    "form",
    "projectedPoints",
    "projected_points",
    "isInjured",
    "is_injured",
    "imageUrl",
    "image_url",
    "photoUrl",
    "photo_url",
    "playerImageUrl",
    "player_image_url",
    "teamLogoUrl",
    "team_logo_url",
    "clubLogoUrl",
    "club_logo_url",
    "teamImageUrl",
    "team_image_url",
    "nationality",
    "nationality_name",
    "country",
    "country_name",
    "countryOfBirth",
    "country_of_birth",
    "birthCountry",
    "birth_country",
    "birthDate",
    "birth_date",
    "dateOfBirth",
    "date_of_birth",
    "dob",
    "age",
    "height",
    "heightCm",
    "height_cm",
    "weight",
    "weightKg",
    "weight_kg",
    "preferredFoot",
    "preferred_foot",
    "foot",
    "shirtNumber",
    "shirt_number",
    "jerseyNumber",
    "jersey_number",
    "marketValue",
    "market_value",
    "value",
    "player_value"
  ]);

  return Object.entries(record)
    .filter(([key, value]) => !hiddenKeys.has(key) && isPrimitiveValue(value))
    .map(([key, value]) => ({
      key,
      label: humanizeKey(key),
      value: primitiveToDisplayString(value) ?? "-"
    }))
    .filter((item) => item.value !== "-")
    .sort((left, right) => left.label.localeCompare(right.label, "id-ID"));
};

const isPrimitiveValue = (value: unknown): value is string | number | boolean => {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
};

const primitiveToDisplayString = (value: unknown): string | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return undefined;
};

const humanizeKey = (key: string): string => {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
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
