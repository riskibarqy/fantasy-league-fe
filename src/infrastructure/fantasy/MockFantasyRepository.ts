import type { FantasyRepository } from "../../domain/fantasy/repositories/FantasyRepository";
import type { Dashboard, TeamLineup } from "../../domain/fantasy/entities/Team";
import type { Fixture } from "../../domain/fantasy/entities/Fixture";
import type { FixtureDetails } from "../../domain/fantasy/entities/FixtureDetails";
import type { LeagueStanding } from "../../domain/fantasy/entities/LeagueStanding";
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
import type { SeasonPointsSummary } from "../../domain/fantasy/entities/SeasonPointsSummary";
import type { UserGameweekPoints } from "../../domain/fantasy/entities/UserGameweekPoints";
import type { PublicAppConfig } from "../../domain/fantasy/entities/AppConfig";
import type { TeamNextMatch } from "../../domain/fantasy/entities/TeamNextMatch";
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
  mockTeams,
  mockTopScoreStatsApiDetail
} from "../mocks/data";
import {TopScoresDetail, TopScoreStatsApiResponse, TopScoreType} from "@/domain/fantasy/entities/TopScore";
import { appEnv } from "../../app/config/env";
import { buildEnvPublicAppConfig } from "../../presentation/lib/maintenanceMode";

const STORAGE_KEY = "fantasy-mock-lineups";
const SQUAD_STORAGE_KEY = "fantasy-mock-squads";
const CUSTOM_LEAGUE_STORAGE_KEY = "fantasy-mock-custom-leagues";
const CUSTOM_LEAGUE_STANDING_STORAGE_KEY = "fantasy-mock-custom-league-standings";
const ONBOARDING_STORAGE_KEY = "fantasy-mock-onboarding-profiles";

export class MockFantasyRepository implements FantasyRepository {
  async getPublicAppConfig(): Promise<PublicAppConfig> {
    await delay(50);
    return buildEnvPublicAppConfig(appEnv);
  }

  async getPublicCustomLeagues(leagueId?: string): Promise<CustomLeague[]> {
    await delay(120);
    const normalizedLeagueId = leagueId?.trim() ?? "";
    const items = readStoredCustomLeagues().filter((item) => item.isPublic);
    if (!normalizedLeagueId) {
      return items.slice(0, 8).map((item) => withMockMemberCount(item));
    }

    return items
      .filter((item) => item.leagueId === normalizedLeagueId)
      .slice(0, 8)
      .map((item) => withMockMemberCount(item));
  }

  async getDashboard(_accessToken: string): Promise<Dashboard> {
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

  async getTeamNextMatches(
    leagueId: string,
    gameweek: number,
    teamIds: string[]
  ): Promise<TeamNextMatch[]> {
    await delay(120);

    const teams = mockTeams.filter((team) => team.leagueId === leagueId);
    const teamById = new Map(teams.map((team) => [team.id, team]));
    const teamByName = new Map(teams.map((team) => [team.name, team]));
    const fixtureByTeamId = new Map<string, TeamNextMatch>();

    for (const fixture of mockFixtures.filter((item) => item.leagueId === leagueId && item.gameweek === gameweek)) {
      const homeTeam = teamByName.get(fixture.homeTeam);
      const awayTeam = teamByName.get(fixture.awayTeam);
      if (!homeTeam || !awayTeam) {
        continue;
      }

      if (!fixtureByTeamId.has(homeTeam.id)) {
        fixtureByTeamId.set(homeTeam.id, {
          teamId: homeTeam.id,
          teamName: homeTeam.name,
          opponentTeamId: awayTeam.id,
          opponentTeamName: awayTeam.name,
          homeAway: "HOME"
        });
      }

      if (!fixtureByTeamId.has(awayTeam.id)) {
        fixtureByTeamId.set(awayTeam.id, {
          teamId: awayTeam.id,
          teamName: awayTeam.name,
          opponentTeamId: homeTeam.id,
          opponentTeamName: homeTeam.name,
          homeAway: "AWAY"
        });
      }
    }

    return teamIds.map((teamId) => {
      const normalizedTeamId = teamId.trim();
      return (
        fixtureByTeamId.get(normalizedTeamId) ?? {
          teamId: normalizedTeamId,
          teamName: teamById.get(normalizedTeamId)?.name
        }
      );
    });
  }

  async getFixtures(leagueId: string): Promise<Fixture[]> {
    await delay(280);
    return mockFixtures.filter((fixture) => fixture.leagueId === leagueId);
  }

  async getSeasonPointsSummary(
    leagueId: string,
    _accessToken: string
  ): Promise<SeasonPointsSummary> {
    await delay(160);
    return {
      leagueId,
      userId: "mock-user",
      totalPoints: mockDashboard.totalPoints,
      averagePoints: Number(mockDashboard.averageGwPoints.toFixed(2)),
      highestPoints: Math.round(mockDashboard.highestGwPoints),
      gameweeks: Math.max(1, mockDashboard.gameweek)
    };
  }

  async getMyPlayerPointsByGameweek(
    leagueId: string,
    _accessToken: string,
    gameweek?: number
  ): Promise<UserGameweekPoints[]> {
    await delay(170);

    const lineup =
      (await this.getLineup(leagueId, "mock-access-token")) ??
      (defaultLineup.leagueId === leagueId ? defaultLineup : null);
    if (!lineup) {
      return [];
    }

    const latestGameweek = Math.max(1, mockDashboard.gameweek);
    const gameweeks = (() => {
      if (gameweek && gameweek > 0) {
        return [gameweek];
      }

      const start = Math.max(1, latestGameweek - 4);
      const rows: number[] = [];
      for (let gw = start; gw <= latestGameweek; gw += 1) {
        rows.push(gw);
      }
      return rows;
    })();

    return gameweeks.map((gw) => buildMockUserGameweekPoints(leagueId, lineup, gw));
  }

  async getHighestPlayerPointsByGameweek(
    leagueId: string,
    accessToken: string,
    gameweek?: number
  ): Promise<UserGameweekPoints | null> {
    const rows = await this.getMyPlayerPointsByGameweek(leagueId, accessToken, gameweek);
    const target = rows[rows.length - 1];
    if (!target) {
      return null;
    }

    return {
      ...target,
      userId: "mock-top-user",
      totalPoints: target.totalPoints + 8,
      players: target.players.map((item) => ({
        ...item,
        countedPoints: item.countedPoints + (item.isStarter ? 1 : 0)
      }))
    };
  }

  async getLeagueStandings(leagueId: string, live = false): Promise<LeagueStanding[]> {
    await delay(240);
    const teams = mockTeams
      .filter((item) => item.leagueId === leagueId)
      .sort((left, right) => left.name.localeCompare(right.name, "id-ID"));
    const forms = ["WWWWW", "WWDWW", "WDLWW", "WDLWD", "DDLWW", "LLWDD"];

    return teams.map((team, idx) => ({
      leagueId,
      gameweek: 23,
      teamId: team.id,
      teamName: team.name,
      teamLogoUrl: team.logoUrl,
      position: idx + 1,
      played: 23,
      won: Math.max(0, 15 - idx),
      draw: Math.max(0, 5 - (idx % 3)),
      lost: Math.max(0, 3 + idx),
      goalsFor: Math.max(12, 37 - idx * 2),
      goalsAgainst: Math.max(8, 15 + idx),
      goalDifference: Math.max(-20, (37 - idx * 2) - (15 + idx)),
      points: Math.max(10, 50 - idx * 3),
      form: forms[idx % forms.length],
      isLive: live
    }));
  }
  async getTopScoreDetails(
      _leagueId: string,
      _season: string,
      type: TopScoreType
  ): Promise<TopScoresDetail[]> {
    await delay(180);

    const data = mockTopScoreStatsApiDetail.data as TopScoreStatsApiResponse["data"];

    const bucket = data[type];

    if (!bucket) {
      return [];
    }

   return bucket
  }
  async getFixtureDetails(leagueId: string, fixtureId: string): Promise<FixtureDetails> {
    await delay(180);

    const fixture = mockFixtures.find((item) => item.leagueId === leagueId && item.id === fixtureId);
    if (!fixture) {
      throw new Error("Fixture not found.");
    }

    const picks = mockPlayers.filter((player) => player.leagueId === leagueId).slice(0, 8);

    return {
      fixture,
      teamStats: [
        {
          teamId: "home-team",
          teamName: fixture.homeTeam,
          possessionPct: 54,
          shots: 13,
          shotsOnTarget: 5,
          corners: 6,
          fouls: 11,
          offsides: 2
        },
        {
          teamId: "away-team",
          teamName: fixture.awayTeam,
          possessionPct: 46,
          shots: 9,
          shotsOnTarget: 3,
          corners: 4,
          fouls: 13,
          offsides: 1
        }
      ],
      playerStats: picks.map((player, index) => ({
        playerId: player.id,
        playerName: player.name,
        teamId: index % 2 === 0 ? "home-team" : "away-team",
        teamName: index % 2 === 0 ? fixture.homeTeam : fixture.awayTeam,
        minutesPlayed: 90 - (index % 3) * 10,
        goals: index === 0 ? 1 : 0,
        assists: index === 1 ? 1 : 0,
        cleanSheet: index % 2 === 0,
        yellowCards: index === 4 ? 1 : 0,
        redCards: 0,
        saves: player.position === "GK" ? 4 : 0,
        fantasyPoints: 8 - index
      })),
      events: [
        {
          eventId: 1,
          fixtureId: fixture.id,
          teamId: "home-team",
          eventType: "goal",
          detail: "Open play",
          minute: 24,
          extraMinute: 0,
          playerId: picks[0]?.id,
          assistPlayerId: picks[1]?.id
        },
        {
          eventId: 2,
          fixtureId: fixture.id,
          teamId: "away-team",
          eventType: "yellow_card",
          detail: "Bad foul",
          minute: 67,
          extraMinute: 0,
          playerId: picks[4]?.id
        }
      ]
    };
  }

  async getPlayers(leagueId: string): Promise<Player[]> {
    await delay(240);
    const teams = mockTeams.filter((team) => team.leagueId === leagueId);
    const colorByClub = new Map<string, [string, string]>(
      teams
        .filter((team): team is Club & { teamColor: [string, string] } => Boolean(team.teamColor))
        .flatMap((team) => {
          const pairs: Array<[string, [string, string]]> = [];
          if (team.name) {
            pairs.push([team.name.toLowerCase(), team.teamColor]);
          }
          if (team.id) {
            pairs.push([team.id.toLowerCase(), team.teamColor]);
          }
          if (team.short) {
            pairs.push([team.short.toLowerCase(), team.teamColor]);
          }
          return pairs;
        })
    );

    return mockPlayers
      .filter((player) => player.leagueId === leagueId)
      .map((player) => {
        const teamColor = colorByClub.get(player.club.toLowerCase());
        const teamId = teams.find((team) => team.name.toLowerCase() === player.club.toLowerCase())?.id;
        if (teamColor || teamId) {
          return {
            ...player,
            ...(teamColor ? { teamColor } : {}),
            ...(teamId ? { teamId } : {})
          };
        }

        return player;
      });
  }

  async getPlayerDetails(leagueId: string, playerId: string): Promise<PlayerDetails> {
    await delay(180);

    const player = mockPlayers.find((item) => item.leagueId === leagueId && item.id === playerId);
    if (!player) {
      throw new Error("Player not found.");
    }

    const teamColor = mockTeams.find(
      (team) =>
        team.leagueId === leagueId &&
        (team.name.toLowerCase() === player.club.toLowerCase() ||
          team.id.toLowerCase() === player.club.toLowerCase() ||
          team.short.toLowerCase() === player.club.toLowerCase())
    )?.teamColor;

    return {
      player: {
        ...player,
        ...(teamColor ? { teamColor } : {}),
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

  async getLineup(leagueId: string, _accessToken: string): Promise<TeamLineup | null> {
    await delay(200);

    const lineups = readStoredLineups();
    return lineups[leagueId] ?? (defaultLineup.leagueId === leagueId ? defaultLineup : null);
  }

  async saveLineup(lineup: TeamLineup, _accessToken: string): Promise<TeamLineup> {
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
    }, accessToken);

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
      isPublic: true,
      myRank: 1,
      memberCount: 1,
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
      memberCount: standings[found.id]?.length ?? found.memberCount,
      rankMovement: "new",
      updatedAtUtc: new Date().toISOString()
    };
  }

  async joinPublicCustomLeague(groupId: string, accessToken: string): Promise<CustomLeague> {
    await delay(220);

    const normalizedGroupId = groupId.trim();
    if (!normalizedGroupId) {
      throw new Error("Custom league id is required.");
    }

    const found = readStoredCustomLeagues().find((item) => item.id === normalizedGroupId && item.isPublic);
    if (!found) {
      throw new Error("Public custom league not found.");
    }

    return this.joinCustomLeagueByInvite(found.inviteCode, accessToken);
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
    isPublic: true,
    myRank: 2,
    memberCount: 4,
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
    isPublic: true,
    myRank: 5,
    memberCount: 6,
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
    isPublic: false,
    myRank: 1,
    memberCount: 3,
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
    isPublic: true,
    myRank: 8,
    memberCount: 8,
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
    return Array.isArray(parsed) ? parsed.map((item) => withMockMemberCount(item)) : defaultCustomLeagues();
  } catch {
    return defaultCustomLeagues();
  }
};

const writeStoredCustomLeagues = (items: CustomLeague[]): void => {
  localStorage.setItem(CUSTOM_LEAGUE_STORAGE_KEY, JSON.stringify(items));
};

const withMockMemberCount = (item: CustomLeague): CustomLeague => {
  const standings = readStoredCustomLeagueStandings();
  return {
    ...item,
    isPublic: Boolean(item.isPublic),
    memberCount: standings[item.id]?.length ?? item.memberCount ?? 0
  };
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

const mockPointSeed = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 1000003;
  }
  return hash;
};

const buildMockUserGameweekPoints = (
  leagueId: string,
  lineup: TeamLineup,
  gameweek: number
): UserGameweekPoints => {
  const playersById = new Map(
    mockPlayers
      .filter((player) => player.leagueId === leagueId)
      .map((player) => [player.id, player])
  );

  const starterIds = [
    lineup.goalkeeperId,
    ...lineup.defenderIds,
    ...lineup.midfielderIds,
    ...lineup.forwardIds
  ].filter(Boolean);
  const benchIds = lineup.substituteIds.filter(Boolean);
  const orderedIds = [...starterIds, ...benchIds];

  const players = orderedIds
    .map((playerId) => {
      const player = playersById.get(playerId);
      if (!player) {
        return null;
      }

      const seed = mockPointSeed(`${playerId}:${gameweek}`);
      const basePoints = Math.max(0, Math.round(player.projectedPoints * 0.62 + player.form * 0.36 + (seed % 4) - 1));
      const multiplier = lineup.captainId === playerId ? 2 : 1;
      const countedPoints = basePoints * multiplier;

      return {
        playerId,
        playerName: player.name,
        position: player.position,
        isStarter: starterIds.includes(playerId),
        isCaptain: lineup.captainId === playerId,
        isViceCaptain: lineup.viceCaptainId === playerId,
        multiplier,
        basePoints,
        countedPoints
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const totalPoints = players.reduce((sum, item) => sum + item.countedPoints, 0);

  return {
    leagueId,
    userId: "mock-user",
    gameweek,
    totalPoints,
    players
  };
};
