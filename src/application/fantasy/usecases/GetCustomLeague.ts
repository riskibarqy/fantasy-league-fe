import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";

export class GetCustomLeague {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute(groupId: string, accessToken: string) {
    const id = groupId.trim();
    const token = accessToken.trim();
    if (!id) {
      throw new Error("Group id is required.");
    }
    if (!token) {
      throw new Error("Access token is required.");
    }

    return this.fantasyRepository.getCustomLeague(id, token);
  }
}
