import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";

export class GetDashboard {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute() {
    return this.fantasyRepository.getDashboard();
  }
}
