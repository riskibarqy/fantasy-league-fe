import type { TeamLineup } from "./Team";
import type { Squad } from "./Squad";

export type OnboardingProfile = {
  userId: string;
  favoriteLeagueId?: string;
  favoriteTeamId?: string;
  countryCode?: string;
  ipAddress?: string;
  onboardingCompleted: boolean;
  updatedAtUtc?: string;
};

export type SaveFavoriteClubInput = {
  leagueId: string;
  teamId: string;
};

export type CompleteOnboardingInput = {
  leagueId: string;
  squadName?: string;
  playerIds: string[];
  lineup: TeamLineup;
};

export type CompleteOnboardingResult = {
  profile: OnboardingProfile;
  squad: Squad;
  lineup: TeamLineup;
};
