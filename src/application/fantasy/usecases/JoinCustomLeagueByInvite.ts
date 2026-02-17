import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";

export class JoinCustomLeagueByInvite {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute(inviteCode: string, accessToken: string) {
    const code = inviteCode.trim();
    const token = accessToken.trim();

    if (!code) {
      throw new Error("Invite code is required.");
    }

    if (!token) {
      throw new Error("Access token is required.");
    }

    return this.fantasyRepository.joinCustomLeagueByInvite(code, token);
  }
}
