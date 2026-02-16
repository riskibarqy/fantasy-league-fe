import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";

export class GetMyCustomLeagues {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute(accessToken: string) {
    const token = accessToken.trim();
    if (!token) {
      throw new Error("Access token is required.");
    }

    return this.fantasyRepository.getMyCustomLeagues(token);
  }
}
