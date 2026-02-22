import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";

export class GetFixtureDetails {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute(leagueId: string, fixtureId: string) {
    const normalizedLeagueId = leagueId.trim();
    const normalizedFixtureId = fixtureId.trim();
    if (!normalizedLeagueId) {
      throw new Error("League id is required.");
    }
    if (!normalizedFixtureId) {
      throw new Error("Fixture id is required.");
    }

    return this.fantasyRepository.getFixtureDetails(normalizedLeagueId, normalizedFixtureId);
  }
}
