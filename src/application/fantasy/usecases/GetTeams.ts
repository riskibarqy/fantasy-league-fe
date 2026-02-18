import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";

export class GetTeams {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute(leagueId: string) {
    const id = leagueId.trim();
    if (!id) {
      throw new Error("League id is required.");
    }

    return this.fantasyRepository.getTeams(id);
  }
}
