import type { FantasyRepository } from "../../domain/fantasy/repositories/FantasyRepository";
import type { Dashboard, TeamLineup } from "../../domain/fantasy/entities/Team";
import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import type { League } from "../../domain/fantasy/entities/League";
import type { Player } from "../../domain/fantasy/entities/Player";
import type { PlayerDetails } from "../../domain/fantasy/entities/PlayerDetails";
import type { Club } from "../../domain/fantasy/entities/Club";
import type {
  CompleteOnboardingInput,
  CompleteOnboardingResult,
  OnboardingProfile,
  SaveFavoriteClubInput
} from "../../domain/fantasy/entities/Onboarding";
import type { PickSquadInput, Squad } from "../../domain/fantasy/entities/Squad";
import type {
  CreateCustomLeagueInput,
  CustomLeague,
  CustomLeagueStanding
} from "../../domain/fantasy/entities/CustomLeague";
import {
  defaultLineup,
  mockDashboard,
  mockFixtures,
  mockLeagues,
  mockPlayers,
  mockTeams
} from "../mocks/data";

const STORAGE_KEY = "fantasy-mock-lineups";
const SQUAD_STORAGE_KEY = "fantasy-mock-squads";
const CUSTOM_LEAGUE_STORAGE_KEY = "fantasy-mock-custom-leagues";
const CUSTOM_LEAGUE_STANDING_STORAGE_KEY = "fantasy-mock-custom-league-standings";
const ONBOARDING_STORAGE_KEY = "fantasy-mock-onboarding-profiles";

export class MockFantasyRepository implements FantasyRepository {
  async getDashboard(): Promise<Dashboard> {
    await delay(200);
    return mockDashboard;
  }

  async getLeagues(): Promise<League[]> {
    await delay(250);
    return mockLeagues;
  }

  async getTeams(leagueId: string): Promise<Club[]> {
    await delay(200);
    return mockTeams.filter((team) => team.leagueId === leagueId);
  }

  async getFixtures(leagueId: string): Promise<Fixture[]> {
    await delay(280);
    return mockFixtures.filter((fixture) => fixture.leagueId === leagueId);
  }

  async getPlayers(leagueId: string): Promise<Player[]> {
    await delay(240);
    return mockPlayers.filter((player) => player.leagueId === leagueId);
  }

  async getPlayerDetails(leagueId: string, playerId: string): Promise<PlayerDetails> {
    await delay(180);

    const player = mockPlayers.find((item) => item.leagueId === leagueId && item.id === playerId);
    if (!player) {
      throw new Error("Player not found.");
    }

    return {
      player: {
        ...player,
        fullName: player.name,
        nationality: "Indonesia",
        countryOfBirth: "Indonesia",
        height: "180 cm",
        weight: "74 kg",
        preferredFoot: "Right",
        shirtNumber: 10,
        age: 28
      },
      statistics: {
        minutesPlayed: 1080,
        goals: player.position === "FWD" ? 9 : player.position === "MID" ? 5 : 1,
        assists: player.position === "FWD" ? 3 : player.position === "MID" ? 7 : 2,
        cleanSheets: player.position === "GK" || player.position === "DEF" ? 6 : 0,
        yellowCards: 2,
        redCards: 0,
        appearances: 12,
        totalPoints: Math.round(player.projectedPoints * 11)
      },
      history: [],
      extraInfo: []
    };
  }

  async getLineup(leagueId: string, _accessToken?: string): Promise<TeamLineup | null> {
    await delay(200);

    const lineups = readStoredLineups();
    return lineups[leagueId] ?? (defaultLineup.leagueId === leagueId ? defaultLineup : null);
  }

  async saveLineup(lineup: TeamLineup, _accessToken?: string): Promise<TeamLineup> {
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

  async saveOnboardingFavoriteClub(
    input: SaveFavoriteClubInput,
    _accessToken: string
  ): Promise<OnboardingProfile> {
    await delay(220);

    const leagueId = input.leagueId.trim();
    const teamId = input.teamId.trim();
    if (!leagueId) {
      throw new Error("League id is required.");
    }
    if (!teamId) {
      throw new Error("Team id is required.");
    }

    const exists = mockTeams.some((team) => team.leagueId === leagueId && team.id === teamId);
    if (!exists) {
      throw new Error("Favorite team not found in selected league.");
    }

    const profiles = readStoredOnboardingProfiles();
    const now = new Date().toISOString();
    const current = profiles["mock-user"];
    const next: OnboardingProfile = {
      userId: "mock-user",
      favoriteLeagueId: leagueId,
      favoriteTeamId: teamId,
      countryCode: current?.countryCode || "ID",
      ipAddress: current?.ipAddress || "127.0.0.1",
      onboardingCompleted: current?.onboardingCompleted ?? false,
      updatedAtUtc: now
    };

    profiles["mock-user"] = next;
    writeStoredOnboardingProfiles(profiles);
    return next;
  }

  async completeOnboarding(
    input: CompleteOnboardingInput,
    accessToken: string
  ): Promise<CompleteOnboardingResult> {
    await delay(260);

    const pickedSquad = await this.pickSquad(
      {
        leagueId: input.leagueId,
        squadName: input.squadName,
        playerIds: input.playerIds
      },
      accessToken
    );

    const savedLineup = await this.saveLineup({
      ...input.lineup,
      leagueId: input.leagueId,
      updatedAt: new Date().toISOString()
    });

    const profiles = readStoredOnboardingProfiles();
    const current = profiles["mock-user"];
    const now = new Date().toISOString();
    const profile: OnboardingProfile = {
      userId: "mock-user",
      favoriteLeagueId: input.leagueId,
      favoriteTeamId: current?.favoriteTeamId,
      countryCode: current?.countryCode || "ID",
      ipAddress: current?.ipAddress || "127.0.0.1",
      onboardingCompleted: true,
      updatedAtUtc: now
    };
    profiles["mock-user"] = profile;
    writeStoredOnboardingProfiles(profiles);

    return {
      profile,
      squad: pickedSquad,
      lineup: savedLineup
    };
  }

  async getMyCustomLeagues(_accessToken: string): Promise<CustomLeague[]> {
    await delay(220);
    const leagues = readStoredCustomLeagues();
    return leagues;
  }

  async createCustomLeague(
    input: CreateCustomLeagueInput,
    _accessToken: string
  ): Promise<CustomLeague> {
    await delay(260);

    const leagueId = input.leagueId.trim();
    const name = input.name.trim();
    if (!leagueId) {
      throw new Error("League id is required.");
    }
    if (!name) {
      throw new Error("Custom league name is required.");
    }

    const squads = readStoredSquads();
    if (!squads[leagueId]) {
      throw new Error("You must pick squad first before creating custom league.");
    }

    const groups = readStoredCustomLeagues();
    const inviteCode = generateInviteCode(groups);
    const now = new Date().toISOString();
    const created: CustomLeague = {
      id: `cl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      leagueId,
      ownerUserId: "mock-user",
      name,
      inviteCode,
      isDefault: false,
      myRank: 1,
      rankMovement: "new",
      createdAtUtc: now,
      updatedAtUtc: now
    };

    const nextGroups = [created, ...groups];
    writeStoredCustomLeagues(nextGroups);

    const standings = readStoredCustomLeagueStandings();
    standings[created.id] = [
      {
        userId: "mock-user",
        squadId: squads[leagueId]?.id ?? `squad-${leagueId}`,
        points: 0,
        rank: 1,
        lastCalculatedAt: now,
        updatedAtUtc: now,
        teamName: "My Fantasy XI",
        squadName: "My Fantasy XI",
        rankMovement: "new"
      }
    ];
    writeStoredCustomLeagueStandings(standings);

    return created;
  }

  async joinCustomLeagueByInvite(inviteCode: string, _accessToken: string): Promise<CustomLeague> {
    await delay(240);

    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      throw new Error("Invite code is required.");
    }

    const groups = readStoredCustomLeagues();
    const found = groups.find((item) => item.inviteCode.trim().toUpperCase() === code);
    if (!found) {
      throw new Error("Invite code not found.");
    }

    const standings = readStoredCustomLeagueStandings();
    const existing = standings[found.id] ?? [];
    const alreadyJoined = existing.some((item) => item.userId === "mock-user");
    if (!alreadyJoined) {
      const nextRank = existing.length + 1;
      const now = new Date().toISOString();
      const leagueSquad = readStoredSquads()[found.leagueId];
      const joinedRow: CustomLeagueStanding = {
        userId: "mock-user",
        squadId: leagueSquad?.id ?? `squad-${found.leagueId}`,
        points: 0,
        rank: nextRank,
        lastCalculatedAt: now,
        updatedAtUtc: now,
        teamName: "My Fantasy XI",
        squadName: "My Fantasy XI",
        rankMovement: "new"
      };

      standings[found.id] = [...existing, joinedRow];
      writeStoredCustomLeagueStandings(standings);
    }

    return {
      ...found,
      myRank: alreadyJoined ? found.myRank : standings[found.id]?.length ?? found.myRank,
      rankMovement: "new",
      updatedAtUtc: new Date().toISOString()
    };
  }

  async getCustomLeague(groupId: string, _accessToken: string): Promise<CustomLeague> {
    await delay(180);
    const group = readStoredCustomLeagues().find((item) => item.id === groupId);
    if (!group) {
      throw new Error("Custom league not found.");
    }

    return group;
  }

  async getCustomLeagueStandings(
    groupId: string,
    _accessToken: string
  ): Promise<CustomLeagueStanding[]> {
    await delay(220);
    const standings = readStoredCustomLeagueStandings()[groupId] ?? [];
    return standings;
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

const defaultCustomLeagues = (): CustomLeague[] => [
  {
    id: "cl-idn-001",
    leagueId: "idn-liga-1-2025",
    ownerUserId: "mock-user",
    name: "Liga 1 Weekend Warriors",
    inviteCode: "WARRIOR8",
    isDefault: false,
    myRank: 2,
    rankMovement: "up",
    createdAtUtc: "2026-02-10T10:00:00.000Z",
    updatedAtUtc: "2026-02-16T09:00:00.000Z"
  },
  {
    id: "cl-idn-002",
    leagueId: "idn-liga-1-2025",
    ownerUserId: "mock-user",
    name: "Jakarta Mini League",
    inviteCode: "JAKARTA9",
    isDefault: false,
    myRank: 5,
    rankMovement: "down",
    createdAtUtc: "2026-02-08T06:00:00.000Z",
    updatedAtUtc: "2026-02-16T09:00:00.000Z"
  },
  {
    id: "cl-idn-003",
    leagueId: "idn-liga-1-2025",
    ownerUserId: "mock-user",
    name: "Office Fantasy Cup",
    inviteCode: "OFFICE77",
    isDefault: false,
    myRank: 1,
    rankMovement: "same",
    createdAtUtc: "2026-02-01T06:00:00.000Z",
    updatedAtUtc: "2026-02-16T09:00:00.000Z"
  },
  {
    id: "cl-idn-004",
    leagueId: "idn-liga-1-2025",
    ownerUserId: "mock-user",
    name: "Community Challenge",
    inviteCode: "COMM678",
    isDefault: false,
    myRank: 8,
    rankMovement: "new",
    createdAtUtc: "2026-02-12T12:00:00.000Z",
    updatedAtUtc: "2026-02-16T09:00:00.000Z"
  }
];

const defaultCustomLeagueStandings = (): Record<string, CustomLeagueStanding[]> => ({
  "cl-idn-001": [
    {
      userId: "user-a",
      squadId: "squad-a",
      points: 478,
      rank: 1,
      lastCalculatedAt: "2026-02-16T09:00:00.000Z",
      updatedAtUtc: "2026-02-16T09:00:00.000Z",
      teamName: "Andi FC",
      squadName: "Andi FC",
      rankMovement: "same"
    },
    {
      userId: "mock-user",
      squadId: "squad-me",
      points: 472,
      rank: 2,
      lastCalculatedAt: "2026-02-16T09:00:00.000Z",
      updatedAtUtc: "2026-02-16T09:00:00.000Z",
      teamName: "My Fantasy XI",
      squadName: "My Fantasy XI",
      rankMovement: "up"
    },
    {
      userId: "user-c",
      squadId: "squad-c",
      points: 469,
      rank: 3,
      lastCalculatedAt: "2026-02-16T09:00:00.000Z",
      updatedAtUtc: "2026-02-16T09:00:00.000Z",
      teamName: "Borneo Kings",
      squadName: "Borneo Kings",
      rankMovement: "down"
    }
  ],
  "cl-idn-002": [
    {
      userId: "user-k",
      squadId: "squad-k",
      points: 502,
      rank: 1,
      lastCalculatedAt: "2026-02-16T09:00:00.000Z",
      updatedAtUtc: "2026-02-16T09:00:00.000Z",
      teamName: "Klok Masters",
      squadName: "Klok Masters",
      rankMovement: "same"
    },
    {
      userId: "mock-user",
      squadId: "squad-me",
      points: 451,
      rank: 5,
      lastCalculatedAt: "2026-02-16T09:00:00.000Z",
      updatedAtUtc: "2026-02-16T09:00:00.000Z",
      teamName: "My Fantasy XI",
      squadName: "My Fantasy XI",
      rankMovement: "down"
    }
  ],
  "cl-idn-003": [
    {
      userId: "mock-user",
      squadId: "squad-me",
      points: 530,
      rank: 1,
      lastCalculatedAt: "2026-02-16T09:00:00.000Z",
      updatedAtUtc: "2026-02-16T09:00:00.000Z",
      teamName: "My Fantasy XI",
      squadName: "My Fantasy XI",
      rankMovement: "same"
    }
  ],
  "cl-idn-004": [
    {
      userId: "mock-user",
      squadId: "squad-me",
      points: 412,
      rank: 8,
      lastCalculatedAt: "2026-02-16T09:00:00.000Z",
      updatedAtUtc: "2026-02-16T09:00:00.000Z",
      teamName: "My Fantasy XI",
      squadName: "My Fantasy XI",
      rankMovement: "new"
    }
  ]
});

const readStoredCustomLeagues = (): CustomLeague[] => {
  const raw = localStorage.getItem(CUSTOM_LEAGUE_STORAGE_KEY);
  if (!raw) {
    const defaults = defaultCustomLeagues();
    localStorage.setItem(CUSTOM_LEAGUE_STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw) as CustomLeague[];
    return Array.isArray(parsed) ? parsed : defaultCustomLeagues();
  } catch {
    return defaultCustomLeagues();
  }
};

const writeStoredCustomLeagues = (items: CustomLeague[]): void => {
  localStorage.setItem(CUSTOM_LEAGUE_STORAGE_KEY, JSON.stringify(items));
};

const readStoredCustomLeagueStandings = (): Record<string, CustomLeagueStanding[]> => {
  const raw = localStorage.getItem(CUSTOM_LEAGUE_STANDING_STORAGE_KEY);
  if (!raw) {
    const defaults = defaultCustomLeagueStandings();
    localStorage.setItem(CUSTOM_LEAGUE_STANDING_STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }

  try {
    return JSON.parse(raw) as Record<string, CustomLeagueStanding[]>;
  } catch {
    return defaultCustomLeagueStandings();
  }
};

const writeStoredCustomLeagueStandings = (
  standings: Record<string, CustomLeagueStanding[]>
): void => {
  localStorage.setItem(CUSTOM_LEAGUE_STANDING_STORAGE_KEY, JSON.stringify(standings));
};

const readStoredOnboardingProfiles = (): Record<string, OnboardingProfile> => {
  const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, OnboardingProfile>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeStoredOnboardingProfiles = (
  profiles: Record<string, OnboardingProfile>
): void => {
  localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(profiles));
};

const generateInviteCode = (items: CustomLeague[]): string => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let code = "";
    for (let index = 0; index < 8; index += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }

    if (!items.some((item) => item.inviteCode === code)) {
      return code;
    }
  }

  return `CODE${Date.now().toString(36).slice(-4).toUpperCase()}`;
};

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
