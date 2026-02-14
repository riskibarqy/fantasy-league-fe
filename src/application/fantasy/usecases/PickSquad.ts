import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";
import type { PickSquadInput } from "../../../domain/fantasy/entities/Squad";

export class PickSquad {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute(input: PickSquadInput, accessToken: string) {
    if (!input.leagueId.trim()) {
      throw new Error("League id is required.");
    }

    if (input.playerIds.length === 0) {
      throw new Error("Player ids are required.");
    }

    if (!accessToken.trim()) {
      throw new Error("Access token is required.");
    }

    return this.fantasyRepository.pickSquad(input, accessToken);
  }
}
