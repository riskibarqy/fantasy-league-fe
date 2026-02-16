import type { FantasyRepository } from "../../domain/fantasy/repositories/FantasyRepository";
import type { Dashboard, TeamLineup } from "../../domain/fantasy/entities/Team";
import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import type { League } from "../../domain/fantasy/entities/League";
import type { Player } from "../../domain/fantasy/entities/Player";
import type { PickSquadInput, Squad } from "../../domain/fantasy/entities/Squad";
import type {
  CustomLeague,
  CustomLeagueStanding
} from "../../domain/fantasy/entities/CustomLeague";
import {
  defaultLineup,
  mockDashboard,
  mockFixtures,
  mockLeagues,
  mockPlayers
} from "../mocks/data";

const STORAGE_KEY = "fantasy-mock-lineups";
const SQUAD_STORAGE_KEY = "fantasy-mock-squads";
const CUSTOM_LEAGUE_STORAGE_KEY = "fantasy-mock-custom-leagues";
const CUSTOM_LEAGUE_STANDING_STORAGE_KEY = "fantasy-mock-custom-league-standings";

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

  async getMyCustomLeagues(_accessToken: string): Promise<CustomLeague[]> {
    await delay(220);
    const leagues = readStoredCustomLeagues();
    return leagues;
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

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
