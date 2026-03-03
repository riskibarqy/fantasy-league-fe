import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";

export class GetHighestPlayerPointsByGameweek {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute(leagueId: string, accessToken: string, gameweek?: number) {
    const normalizedLeagueID = leagueId.trim();
    if (!normalizedLeagueID) {
      throw new Error("League id is required.");
    }

    const token = accessToken.trim();
    if (!token) {
      throw new Error("Access token is required.");
    }

    if (gameweek !== undefined && (!Number.isInteger(gameweek) || gameweek <= 0)) {
      throw new Error("Gameweek must be a positive integer.");
    }

    return this.fantasyRepository.getHighestPlayerPointsByGameweek(normalizedLeagueID, token, gameweek);
  }
}
