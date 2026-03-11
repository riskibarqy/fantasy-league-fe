import type { Dashboard, TeamLineup } from "../entities/Team";
import type { Fixture } from "../entities/Fixture";
import type { FixtureDetails } from "../entities/FixtureDetails";
import type { LeagueStanding } from "../entities/LeagueStanding";
import type { League } from "../entities/League";
import type { Player } from "../entities/Player";
import type { PlayerDetails } from "../entities/PlayerDetails";
import type { Club } from "../entities/Club";
import type { PickSquadInput, Squad } from "../entities/Squad";
import type { SeasonPointsSummary } from "../entities/SeasonPointsSummary";
import type { UserGameweekPoints } from "../entities/UserGameweekPoints";
import type { PublicAppConfig } from "../entities/AppConfig";
import type {
  CompleteOnboardingInput,
  CompleteOnboardingResult,
  OnboardingProfile,
  SaveFavoriteClubInput
} from "../entities/Onboarding";
import type {
  CreateCustomLeagueInput,
  CustomLeague,
  CustomLeagueStanding
} from "../entities/CustomLeague";
import {TopScoresDetail, TopScoreType} from "@/domain/fantasy/entities/TopScore";

export interface FantasyRepository {
  getPublicAppConfig(): Promise<PublicAppConfig>;
  getDashboard(accessToken: string): Promise<Dashboard>;
  getLeagues(): Promise<League[]>;
  getTeams(leagueId: string): Promise<Club[]>;
  getFixtures(leagueId: string): Promise<Fixture[]>;
  getSeasonPointsSummary(leagueId: string, accessToken: string): Promise<SeasonPointsSummary>;
  getMyPlayerPointsByGameweek(
    leagueId: string,
    accessToken: string,
    gameweek?: number
  ): Promise<UserGameweekPoints[]>;
  getHighestPlayerPointsByGameweek(
    leagueId: string,
    accessToken: string,
    gameweek?: number
  ): Promise<UserGameweekPoints | null>;
  getLeagueStandings(leagueId: string, live?: boolean): Promise<LeagueStanding[]>;
  getFixtureDetails(leagueId: string, fixtureId: string): Promise<FixtureDetails>;
  getTopScoreDetails(
      leagueId: string,
      season: string,
      type: TopScoreType
  ): Promise<TopScoresDetail[]>;
  getPlayers(leagueId: string): Promise<Player[]>;
  getPlayerDetails(leagueId: string, playerId: string): Promise<PlayerDetails>;
  getLineup(leagueId: string, accessToken: string): Promise<TeamLineup | null>;
  saveLineup(lineup: TeamLineup, accessToken: string): Promise<TeamLineup>;
  getMySquad(leagueId: string, accessToken: string): Promise<Squad | null>;
  pickSquad(input: PickSquadInput, accessToken: string): Promise<Squad>;
  saveOnboardingFavoriteClub(
    input: SaveFavoriteClubInput,
    accessToken: string
  ): Promise<OnboardingProfile>;
  completeOnboarding(
    input: CompleteOnboardingInput,
    accessToken: string
  ): Promise<CompleteOnboardingResult>;
  getPublicCustomLeagues(leagueId?: string): Promise<CustomLeague[]>;
  getMyCustomLeagues(accessToken: string): Promise<CustomLeague[]>;
  createCustomLeague(input: CreateCustomLeagueInput, accessToken: string): Promise<CustomLeague>;
  joinPublicCustomLeague(groupId: string, accessToken: string): Promise<CustomLeague>;
  joinCustomLeagueByInvite(inviteCode: string, accessToken: string): Promise<CustomLeague>;
  getCustomLeague(groupId: string, accessToken: string): Promise<CustomLeague>;
  getCustomLeagueStandings(groupId: string, accessToken: string): Promise<CustomLeagueStanding[]>;
}
