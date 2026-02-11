import type { AuthRepository } from "../../domain/auth/repositories/AuthRepository";
import type { AuthSession, LoginCredentials } from "../../domain/auth/entities/User";

const MOCK_PASSWORD = "password123";

export class MockAuthRepository implements AuthRepository {
  async loginWithPassword(credentials: LoginCredentials): Promise<AuthSession> {
    await delay(350);

    if (credentials.password !== MOCK_PASSWORD) {
      throw new Error("Invalid email or password.");
    }

    return {
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      user: {
        id: "mock-user-1",
        email: credentials.email,
        displayName: "Riska Dev"
      }
    };
  }

  async logout(_accessToken: string): Promise<void> {
    await delay(100);
  }
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
