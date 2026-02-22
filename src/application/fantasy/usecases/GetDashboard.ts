import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";

export class GetDashboard {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute(accessToken: string) {
    const token = accessToken.trim();
    if (!token) {
      throw new Error("Access token is required to load dashboard.");
    }

    return this.fantasyRepository.getDashboard(token);
  }
}
