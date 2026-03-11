import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";

export class GetPublicAppConfig {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute() {
    return this.fantasyRepository.getPublicAppConfig();
  }
}
