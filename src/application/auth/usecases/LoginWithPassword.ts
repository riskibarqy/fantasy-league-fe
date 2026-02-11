import type { AuthRepository } from "../../../domain/auth/repositories/AuthRepository";
import type { AuthSession, LoginCredentials } from "../../../domain/auth/entities/User";

export class LoginWithPassword {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(credentials: LoginCredentials): Promise<AuthSession> {
    if (!credentials.email.trim() || !credentials.password.trim()) {
      throw new Error("Email and password are required.");
    }

    return this.authRepository.loginWithPassword({
      email: credentials.email.trim().toLowerCase(),
      password: credentials.password
    });
  }
}
