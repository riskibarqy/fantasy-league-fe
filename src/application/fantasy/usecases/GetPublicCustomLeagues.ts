import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";

export class GetPublicCustomLeagues {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute(leagueId?: string) {
    return this.fantasyRepository.getPublicCustomLeagues(leagueId);
  }
}
