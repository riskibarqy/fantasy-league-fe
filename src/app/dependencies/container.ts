import { GetTopScore } from "@/application/fantasy/usecases/GetTopScore";
import { LoginWithGoogleIdToken } from "../../application/auth/usecases/LoginWithGoogleIdToken";
import { LoginWithPassword } from "../../application/auth/usecases/LoginWithPassword";
import { Logout } from "../../application/auth/usecases/Logout";
import { CompleteOnboarding } from "../../application/fantasy/usecases/CompleteOnboarding";
import { CreateCustomLeague } from "../../application/fantasy/usecases/CreateCustomLeague";
import { GetCustomLeague } from "../../application/fantasy/usecases/GetCustomLeague";
import { GetCustomLeagueStandings } from "../../application/fantasy/usecases/GetCustomLeagueStandings";
import { GetDashboard } from "../../application/fantasy/usecases/GetDashboard";
import { GetFixtureDetails } from "../../application/fantasy/usecases/GetFixtureDetails";
import { GetFixtures } from "../../application/fantasy/usecases/GetFixtures";
import { GetHighestPlayerPointsByGameweek } from "../../application/fantasy/usecases/GetHighestPlayerPointsByGameweek";
import { GetLeagues } from "../../application/fantasy/usecases/GetLeagues";
import { GetLeagueStandings } from "../../application/fantasy/usecases/GetLeagueStandings";
import { GetLineup } from "../../application/fantasy/usecases/GetLineup";
import { GetMyCustomLeagues } from "../../application/fantasy/usecases/GetMyCustomLeagues";
import { GetMyPlayerPointsByGameweek } from "../../application/fantasy/usecases/GetMyPlayerPointsByGameweek";
import { GetMySquad } from "../../application/fantasy/usecases/GetMySquad";
import { GetPlayerDetails } from "../../application/fantasy/usecases/GetPlayerDetails";
import { GetPlayers } from "../../application/fantasy/usecases/GetPlayers";
import { GetPublicAppConfig } from "../../application/fantasy/usecases/GetPublicAppConfig";
import { GetPublicCustomLeagues } from "../../application/fantasy/usecases/GetPublicCustomLeagues";
import { GetSeasonPointsSummary } from "../../application/fantasy/usecases/GetSeasonPointsSummary";
import { GetTeams } from "../../application/fantasy/usecases/GetTeams";
import { GetTeamFixtures } from "../../application/fantasy/usecases/GetTeamNextMatches";
import { GetTransferAvailability } from "../../application/fantasy/usecases/GetTransferAvailability";
import { JoinCustomLeagueByInvite } from "../../application/fantasy/usecases/JoinCustomLeagueByInvite";
import { JoinPublicCustomLeague } from "../../application/fantasy/usecases/JoinPublicCustomLeague";
import { PickSquad } from "../../application/fantasy/usecases/PickSquad";
import { SaveLineup } from "../../application/fantasy/usecases/SaveLineup";
import { SaveOnboardingFavoriteClub } from "../../application/fantasy/usecases/SaveOnboardingFavoriteClub";
import { TransferSquad } from "../../application/fantasy/usecases/TransferSquad";
import { HttpAuthRepository } from "../../infrastructure/auth/HttpAuthRepository";
import { MockAuthRepository } from "../../infrastructure/auth/MockAuthRepository";
import { HttpFantasyRepository } from "../../infrastructure/fantasy/HttpFantasyRepository";
import { MockFantasyRepository } from "../../infrastructure/fantasy/MockFantasyRepository";
import { HttpClient } from "../../infrastructure/http/httpClient";
import { appEnv } from "../config/env";

const buildRepositories = () => {
  if (appEnv.useMocks) {
    return {
      authRepository: new MockAuthRepository(),
      fantasyRepository: new MockFantasyRepository(),
    };
  }

  const anubisClient = new HttpClient(appEnv.anubisBaseUrl);
  const fantasyClient = new HttpClient(appEnv.fantasyApiBaseUrl);

  return {
    authRepository: new HttpAuthRepository(anubisClient, appEnv.anubisAppId),
    fantasyRepository: new HttpFantasyRepository(fantasyClient),
  };
};

export const buildContainer = () => {
  const repositories = buildRepositories();

  return {
    loginWithPassword: new LoginWithPassword(repositories.authRepository),
    loginWithGoogleIdToken: new LoginWithGoogleIdToken(
      repositories.authRepository,
    ),
    logout: new Logout(repositories.authRepository),
    getPublicAppConfig: new GetPublicAppConfig(repositories.fantasyRepository),
    getPublicCustomLeagues: new GetPublicCustomLeagues(
      repositories.fantasyRepository,
    ),
    getDashboard: new GetDashboard(repositories.fantasyRepository),
    getLeagues: new GetLeagues(repositories.fantasyRepository),
    getTeams: new GetTeams(repositories.fantasyRepository),
    getTeamFixtures: new GetTeamFixtures(repositories.fantasyRepository),
    getTransferAvailability: new GetTransferAvailability(
      repositories.fantasyRepository,
    ),
    getFixtures: new GetFixtures(repositories.fantasyRepository),
    getTopScoreDetails: new GetTopScore(repositories.fantasyRepository),
    getSeasonPointsSummary: new GetSeasonPointsSummary(
      repositories.fantasyRepository,
    ),
    getMyPlayerPointsByGameweek: new GetMyPlayerPointsByGameweek(
      repositories.fantasyRepository,
    ),
    getHighestPlayerPointsByGameweek: new GetHighestPlayerPointsByGameweek(
      repositories.fantasyRepository,
    ),
    getLeagueStandings: new GetLeagueStandings(repositories.fantasyRepository),
    getFixtureDetails: new GetFixtureDetails(repositories.fantasyRepository),
    getMyCustomLeagues: new GetMyCustomLeagues(repositories.fantasyRepository),
    createCustomLeague: new CreateCustomLeague(repositories.fantasyRepository),
    joinPublicCustomLeague: new JoinPublicCustomLeague(
      repositories.fantasyRepository,
    ),
    joinCustomLeagueByInvite: new JoinCustomLeagueByInvite(
      repositories.fantasyRepository,
    ),
    getCustomLeague: new GetCustomLeague(repositories.fantasyRepository),
    getCustomLeagueStandings: new GetCustomLeagueStandings(
      repositories.fantasyRepository,
    ),
    getPlayers: new GetPlayers(repositories.fantasyRepository),
    getPlayerDetails: new GetPlayerDetails(repositories.fantasyRepository),
    getLineup: new GetLineup(repositories.fantasyRepository),
    getMySquad: new GetMySquad(repositories.fantasyRepository),
    pickSquad: new PickSquad(repositories.fantasyRepository),
    transferSquad: new TransferSquad(repositories.fantasyRepository),
    saveOnboardingFavoriteClub: new SaveOnboardingFavoriteClub(
      repositories.fantasyRepository,
    ),
    completeOnboarding: new CompleteOnboarding(repositories.fantasyRepository),
    saveLineup: new SaveLineup(repositories.fantasyRepository),
  };
};

export type AppContainer = ReturnType<typeof buildContainer>;
