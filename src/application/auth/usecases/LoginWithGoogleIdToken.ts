import type { AuthRepository } from "../../../domain/auth/repositories/AuthRepository";
import type { AuthSession } from "../../../domain/auth/entities/User";

export class LoginWithGoogleIdToken {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(idToken: string): Promise<AuthSession> {
    if (!idToken.trim()) {
      throw new Error("Google id token is required.");
    }

    return this.authRepository.loginWithGoogleIdToken(idToken.trim());
  }
}
