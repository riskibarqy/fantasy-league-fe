import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";

export class GetLineup {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute(leagueId: string, accessToken?: string) {
    if (!leagueId.trim()) {
      throw new Error("League id is required.");
    }

    return this.fantasyRepository.getLineup(leagueId, accessToken);
  }
}
