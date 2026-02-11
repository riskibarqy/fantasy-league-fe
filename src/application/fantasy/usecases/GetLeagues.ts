import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";

export class GetLeagues {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute() {
    return this.fantasyRepository.getLeagues();
  }
}
