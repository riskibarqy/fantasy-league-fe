import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";

export class GetTeamFixtures {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute(leagueId: string, gameweek: number, teamIds: string[]) {
    if (!leagueId.trim()) {
      throw new Error("League id is required.");
    }
    if (!Number.isFinite(gameweek) || gameweek <= 0) {
      throw new Error("Gameweek must be greater than zero.");
    }

    const normalizedTeamIds = teamIds.map((item) => item.trim()).filter(Boolean);
    if (normalizedTeamIds.length === 0) {
      return [];
    }

    return this.fantasyRepository.getTeamFixtures(leagueId, gameweek, normalizedTeamIds);
  }
}
