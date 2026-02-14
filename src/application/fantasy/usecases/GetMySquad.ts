import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";

export class GetMySquad {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute(leagueId: string, accessToken: string) {
    if (!leagueId.trim()) {
      throw new Error("League id is required.");
    }

    if (!accessToken.trim()) {
      throw new Error("Access token is required.");
    }

    return this.fantasyRepository.getMySquad(leagueId, accessToken);
  }
}
