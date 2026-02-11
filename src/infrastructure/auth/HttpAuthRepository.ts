import type { AuthRepository } from "../../domain/auth/repositories/AuthRepository";
import type { AuthSession, LoginCredentials } from "../../domain/auth/entities/User";
import { HttpClient } from "../http/httpClient";

export class HttpAuthRepository implements AuthRepository {
  constructor(private readonly httpClient: HttpClient) {}

  async loginWithPassword(credentials: LoginCredentials): Promise<AuthSession> {
    return this.httpClient.post<LoginCredentials, AuthSession>(
      "/v1/auth/login",
      credentials
    );
  }

  async logout(accessToken: string): Promise<void> {
    await this.httpClient.post<{ accessToken: string }, void>(
      "/v1/auth/logout",
      { accessToken },
      {
        Authorization: `Bearer ${accessToken}`
      }
    );
  }
}
