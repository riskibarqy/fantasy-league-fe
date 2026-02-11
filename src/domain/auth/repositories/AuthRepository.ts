import type { AuthSession, LoginCredentials } from "../entities/User";

export interface AuthRepository {
  loginWithPassword(credentials: LoginCredentials): Promise<AuthSession>;
  logout(accessToken: string): Promise<void>;
}
