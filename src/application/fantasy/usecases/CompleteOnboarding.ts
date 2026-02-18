import type { CompleteOnboardingInput } from "../../../domain/fantasy/entities/Onboarding";
import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";

export class CompleteOnboarding {
  constructor(private readonly fantasyRepository: FantasyRepository) {}

  async execute(input: CompleteOnboardingInput, accessToken: string) {
    const leagueId = input.leagueId.trim();
    const token = accessToken.trim();
    const playerIds = input.playerIds.filter((item): item is string => typeof item === "string");

    if (!leagueId) {
      throw new Error("League id is required.");
    }
    if (!token) {
      throw new Error("Access token is required.");
    }
    if (playerIds.length !== 15) {
      throw new Error("Onboarding squad must contain exactly 15 players.");
    }

    return this.fantasyRepository.completeOnboarding(
      {
        ...input,
        leagueId,
        squadName: input.squadName?.trim() || "",
        playerIds
      },
      token
    );
  }
}
