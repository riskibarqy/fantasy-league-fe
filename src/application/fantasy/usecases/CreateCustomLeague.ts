import type { CreateCustomLeagueInput } from "../../../domain/fantasy/entities/CustomLeague";
import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";
import { createGeneratedCustomLeagueName } from "../../../domain/fantasy/services/nameGenerator";

export class CreateCustomLeague {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute(input: CreateCustomLeagueInput, accessToken: string) {
    const leagueId = input.leagueId.trim();
    const name = input.name.trim() || createGeneratedCustomLeagueName();
    const token = accessToken.trim();

    if (!leagueId) {
      throw new Error("League id is required.");
    }

    if (!token) {
      throw new Error("Access token is required.");
    }

    return this.fantasyRepository.createCustomLeague(
      {
        leagueId,
        name
      },
      token
    );
  }
}
