import type { AuthSession, LoginCredentials } from "../entities/User";

export interface AuthRepository {
  loginWithPassword(credentials: LoginCredentials): Promise<AuthSession>;
  loginWithGoogleIdToken(idToken: string): Promise<AuthSession>;
  logout(accessToken: string): Promise<void>;
}
