import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";

export class JoinPublicCustomLeague {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute(groupId: string, accessToken: string) {
    const normalizedGroupId = groupId.trim();
    if (!normalizedGroupId) {
      throw new Error("Custom league id is required.");
    }

    return this.fantasyRepository.joinPublicCustomLeague(normalizedGroupId, accessToken);
  }
}
