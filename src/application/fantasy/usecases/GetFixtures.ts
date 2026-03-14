import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";

export class GetFixtures {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute(leagueId: string, gameweek: number, page = 1, pageSize = 20) {
    if (!leagueId.trim()) {
      throw new Error("League id is required.");
    }
    if (!Number.isFinite(gameweek) || gameweek <= 0) {
      throw new Error("Gameweek must be greater than zero.");
    }
    if (!Number.isFinite(page) || page <= 0) {
      throw new Error("Page must be greater than zero.");
    }
    if (!Number.isFinite(pageSize) || pageSize <= 0) {
      throw new Error("Page size must be greater than zero.");
    }

    return this.fantasyRepository.getFixtures(leagueId, gameweek, page, pageSize);
  }
}
