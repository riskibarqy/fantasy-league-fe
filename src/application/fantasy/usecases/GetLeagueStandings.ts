import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";

export class GetLeagueStandings {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute(leagueId: string, live = false) {
    const normalizedLeagueID = leagueId.trim();
    if (!normalizedLeagueID) {
      throw new Error("League id is required.");
    }

    return this.fantasyRepository.getLeagueStandings(normalizedLeagueID, live);
  }
}
