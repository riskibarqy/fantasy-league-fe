import type { Dashboard, TeamLineup } from "../entities/Team";
import type { Fixture } from "../entities/Fixture";
import type { League } from "../entities/League";
import type { Player } from "../entities/Player";
import type { PlayerDetails } from "../entities/PlayerDetails";
import type { Club } from "../entities/Club";
import type { PickSquadInput, Squad } from "../entities/Squad";
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

export interface FantasyRepository {
  getDashboard(accessToken: string): Promise<Dashboard>;
  getLeagues(): Promise<League[]>;
  getTeams(leagueId: string): Promise<Club[]>;
  getFixtures(leagueId: string): Promise<Fixture[]>;
  getPlayers(leagueId: string): Promise<Player[]>;
  getPlayerDetails(leagueId: string, playerId: string): Promise<PlayerDetails>;
  getLineup(leagueId: string, accessToken?: string): Promise<TeamLineup | null>;
  saveLineup(lineup: TeamLineup, accessToken?: string): Promise<TeamLineup>;
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
  getMyCustomLeagues(accessToken: string): Promise<CustomLeague[]>;
  createCustomLeague(input: CreateCustomLeagueInput, accessToken: string): Promise<CustomLeague>;
  joinCustomLeagueByInvite(inviteCode: string, accessToken: string): Promise<CustomLeague>;
  getCustomLeague(groupId: string, accessToken: string): Promise<CustomLeague>;
  getCustomLeagueStandings(groupId: string, accessToken: string): Promise<CustomLeagueStanding[]>;
}
