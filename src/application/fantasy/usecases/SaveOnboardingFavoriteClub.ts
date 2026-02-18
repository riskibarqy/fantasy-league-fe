import type { SaveFavoriteClubInput } from "../../../domain/fantasy/entities/Onboarding";
import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";

export class SaveOnboardingFavoriteClub {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute(input: SaveFavoriteClubInput, accessToken: string) {
    const leagueId = input.leagueId.trim();
    const teamId = input.teamId.trim();
    const token = accessToken.trim();

    if (!leagueId) {
      throw new Error("League id is required.");
    }
    if (!teamId) {
      throw new Error("Team id is required.");
    }
    if (!token) {
      throw new Error("Access token is required.");
    }

    return this.fantasyRepository.saveOnboardingFavoriteClub(
      {
        leagueId,
        teamId
      },
      token
    );
  }
}
