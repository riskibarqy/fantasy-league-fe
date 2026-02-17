import type { CreateCustomLeagueInput } from "../../../domain/fantasy/entities/CustomLeague";
import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";

export class CreateCustomLeague {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute(input: CreateCustomLeagueInput, accessToken: string) {
    const leagueId = input.leagueId.trim();
    const name = input.name.trim();
    const token = accessToken.trim();

    if (!leagueId) {
      throw new Error("League id is required.");
    }

    if (!name) {
      throw new Error("Custom league name is required.");
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
