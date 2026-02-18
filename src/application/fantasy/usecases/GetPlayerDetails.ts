import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";

export class GetPlayerDetails {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute(leagueId: string, playerId: string) {
    const normalizedLeagueId = leagueId.trim();
    const normalizedPlayerId = playerId.trim();

    if (!normalizedLeagueId) {
      throw new Error("League id is required.");
    }

    if (!normalizedPlayerId) {
      throw new Error("Player id is required.");
    }

    return this.fantasyRepository.getPlayerDetails(normalizedLeagueId, normalizedPlayerId);
  }
}
