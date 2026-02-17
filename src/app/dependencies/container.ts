import { appEnv } from "../config/env";
import { LoginWithPassword } from "../../application/auth/usecases/LoginWithPassword";
import { LoginWithGoogleIdToken } from "../../application/auth/usecases/LoginWithGoogleIdToken";
import { Logout } from "../../application/auth/usecases/Logout";
import { CreateCustomLeague } from "../../application/fantasy/usecases/CreateCustomLeague";
import { GetDashboard } from "../../application/fantasy/usecases/GetDashboard";
import { GetFixtures } from "../../application/fantasy/usecases/GetFixtures";
import { GetCustomLeague } from "../../application/fantasy/usecases/GetCustomLeague";
import { GetCustomLeagueStandings } from "../../application/fantasy/usecases/GetCustomLeagueStandings";
import { GetLeagues } from "../../application/fantasy/usecases/GetLeagues";
import { GetLineup } from "../../application/fantasy/usecases/GetLineup";
import { GetMyCustomLeagues } from "../../application/fantasy/usecases/GetMyCustomLeagues";
import { GetMySquad } from "../../application/fantasy/usecases/GetMySquad";
import { GetPlayers } from "../../application/fantasy/usecases/GetPlayers";
import { JoinCustomLeagueByInvite } from "../../application/fantasy/usecases/JoinCustomLeagueByInvite";
import { PickSquad } from "../../application/fantasy/usecases/PickSquad";
import { SaveLineup } from "../../application/fantasy/usecases/SaveLineup";
import { HttpAuthRepository } from "../../infrastructure/auth/HttpAuthRepository";
import { MockAuthRepository } from "../../infrastructure/auth/MockAuthRepository";
import { HttpFantasyRepository } from "../../infrastructure/fantasy/HttpFantasyRepository";
import { MockFantasyRepository } from "../../infrastructure/fantasy/MockFantasyRepository";
import { HttpClient } from "../../infrastructure/http/httpClient";

const buildRepositories = () => {
  if (appEnv.useMocks) {
    return {
      authRepository: new MockAuthRepository(),
      fantasyRepository: new MockFantasyRepository()
    };
  }

  const anubisClient = new HttpClient(appEnv.anubisBaseUrl);
  const fantasyClient = new HttpClient(appEnv.fantasyApiBaseUrl);

  return {
    authRepository: new HttpAuthRepository(anubisClient, appEnv.anubisAppId),
    fantasyRepository: new HttpFantasyRepository(fantasyClient)
  };
};

export const buildContainer = () => {
  const repositories = buildRepositories();

  return {
    loginWithPassword: new LoginWithPassword(repositories.authRepository),
    loginWithGoogleIdToken: new LoginWithGoogleIdToken(repositories.authRepository),
    logout: new Logout(repositories.authRepository),
    getDashboard: new GetDashboard(repositories.fantasyRepository),
    getLeagues: new GetLeagues(repositories.fantasyRepository),
    getFixtures: new GetFixtures(repositories.fantasyRepository),
    getMyCustomLeagues: new GetMyCustomLeagues(repositories.fantasyRepository),
    createCustomLeague: new CreateCustomLeague(repositories.fantasyRepository),
    joinCustomLeagueByInvite: new JoinCustomLeagueByInvite(repositories.fantasyRepository),
    getCustomLeague: new GetCustomLeague(repositories.fantasyRepository),
    getCustomLeagueStandings: new GetCustomLeagueStandings(repositories.fantasyRepository),
    getPlayers: new GetPlayers(repositories.fantasyRepository),
    getLineup: new GetLineup(repositories.fantasyRepository),
    getMySquad: new GetMySquad(repositories.fantasyRepository),
    pickSquad: new PickSquad(repositories.fantasyRepository),
    saveLineup: new SaveLineup(repositories.fantasyRepository)
  };
};

export type AppContainer = ReturnType<typeof buildContainer>;
