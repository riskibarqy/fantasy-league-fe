import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";

export class GetSeasonPointsSummary {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute(leagueId: string, accessToken: string) {
    const normalizedLeagueID = leagueId.trim();
    if (!normalizedLeagueID) {
      throw new Error("League id is required.");
    }

    const token = accessToken.trim();
    if (!token) {
      throw new Error("Access token is required.");
    }

    return this.fantasyRepository.getSeasonPointsSummary(normalizedLeagueID, token);
  }
}
