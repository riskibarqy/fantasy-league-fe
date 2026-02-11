import { appEnv } from "../config/env";
import { LoginWithPassword } from "../../application/auth/usecases/LoginWithPassword";
import { Logout } from "../../application/auth/usecases/Logout";
import { GetDashboard } from "../../application/fantasy/usecases/GetDashboard";
import { GetFixtures } from "../../application/fantasy/usecases/GetFixtures";
import { GetLeagues } from "../../application/fantasy/usecases/GetLeagues";
import { GetLineup } from "../../application/fantasy/usecases/GetLineup";
import { GetPlayers } from "../../application/fantasy/usecases/GetPlayers";
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
    authRepository: new HttpAuthRepository(anubisClient),
    fantasyRepository: new HttpFantasyRepository(fantasyClient)
  };
};

export const buildContainer = () => {
  const repositories = buildRepositories();

  return {
    loginWithPassword: new LoginWithPassword(repositories.authRepository),
    logout: new Logout(repositories.authRepository),
    getDashboard: new GetDashboard(repositories.fantasyRepository),
    getLeagues: new GetLeagues(repositories.fantasyRepository),
    getFixtures: new GetFixtures(repositories.fantasyRepository),
    getPlayers: new GetPlayers(repositories.fantasyRepository),
    getLineup: new GetLineup(repositories.fantasyRepository),
    saveLineup: new SaveLineup(repositories.fantasyRepository)
  };
};

export type AppContainer = ReturnType<typeof buildContainer>;
