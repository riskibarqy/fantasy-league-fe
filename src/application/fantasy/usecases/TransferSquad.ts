import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";
import type { TransferSquadInput } from "../../../domain/fantasy/entities/Squad";

export class TransferSquad {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute(input: TransferSquadInput, accessToken: string) {
    if (!input.leagueId.trim()) {
      throw new Error("League id is required.");
    }
    if (!Number.isFinite(input.gameweek) || input.gameweek <= 0) {
      throw new Error("Gameweek must be greater than zero.");
    }
    if (!input.outPlayerId.trim() || !input.inPlayerId.trim()) {
      throw new Error("Outgoing and incoming player ids are required.");
    }
    if (!accessToken.trim()) {
      throw new Error("Access token is required.");
    }

    return this.fantasyRepository.transferSquad(input, accessToken);
  }
}
