import type { AuthRepository } from "../../../domain/auth/repositories/AuthRepository";

export class Logout {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(accessToken: string): Promise<void> {
    if (!accessToken.trim()) {
      return;
    }

    await this.authRepository.logout(accessToken);
  }
}
