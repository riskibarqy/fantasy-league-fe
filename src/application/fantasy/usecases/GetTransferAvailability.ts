import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";

export class GetTransferAvailability {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute(leagueId: string, gameweek: number, accessToken: string) {
    if (!leagueId.trim()) {
      throw new Error("League id is required.");
    }
    if (!Number.isFinite(gameweek) || gameweek <= 0) {
      throw new Error("Gameweek must be greater than zero.");
    }
    if (!accessToken.trim()) {
      throw new Error("Access token is required.");
    }

    return this.fantasyRepository.getTransferAvailability(
      leagueId,
      gameweek,
      accessToken,
    );
  }
}
