import { describe, expect, it, vi } from "vitest";
import { CompleteOnboarding } from "./CompleteOnboarding";
import { GetTeams } from "./GetTeams";
import { SaveOnboardingFavoriteClub } from "./SaveOnboardingFavoriteClub";
import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";
import { defaultLineup, mockPlayers, mockTeams } from "../../../infrastructure/mocks/data";

const fantasyRepositoryStub = (): FantasyRepository => ({
  getDashboard: vi.fn(),
  getLeagues: vi.fn(),
  getTeams: vi.fn(),
  getFixtures: vi.fn(),
  getPlayers: vi.fn(),
  getLineup: vi.fn(),
  saveLineup: vi.fn(),
  getMySquad: vi.fn(),
  pickSquad: vi.fn(),
  saveOnboardingFavoriteClub: vi.fn(),
  completeOnboarding: vi.fn(),
  getMyCustomLeagues: vi.fn(),
  createCustomLeague: vi.fn(),
  joinCustomLeagueByInvite: vi.fn(),
  getCustomLeague: vi.fn(),
  getCustomLeagueStandings: vi.fn()
});

describe("Onboarding usecases", () => {
  it("GetTeams trims league id before calling repository", async () => {
    const repo = fantasyRepositoryStub();
    vi.mocked(repo.getTeams).mockResolvedValue(mockTeams);

    const usecase = new GetTeams(repo);
    const result = await usecase.execute("  idn-liga-1-2025  ");

    expect(repo.getTeams).toHaveBeenCalledWith("idn-liga-1-2025");
    expect(result).toHaveLength(mockTeams.length);
  });

  it("SaveOnboardingFavoriteClub validates and forwards trimmed payload", async () => {
    const repo = fantasyRepositoryStub();
    vi.mocked(repo.saveOnboardingFavoriteClub).mockResolvedValue({
      userId: "u1",
      favoriteLeagueId: "idn-liga-1-2025",
      favoriteTeamId: "persib-bandung",
      onboardingCompleted: false
    });

    const usecase = new SaveOnboardingFavoriteClub(repo);

    await usecase.execute(
      {
        leagueId: "  idn-liga-1-2025 ",
        teamId: " persib-bandung "
      },
      " token-123 "
    );

    expect(repo.saveOnboardingFavoriteClub).toHaveBeenCalledWith(
      {
        leagueId: "idn-liga-1-2025",
        teamId: "persib-bandung"
      },
      "token-123"
    );
  });

  it("CompleteOnboarding rejects non-15 players", async () => {
    const repo = fantasyRepositoryStub();
    const usecase = new CompleteOnboarding(repo);

    await expect(
      usecase.execute(
        {
          leagueId: "idn-liga-1-2025",
          squadName: "My Squad",
          playerIds: mockPlayers.slice(0, 14).map((player) => player.id),
          lineup: defaultLineup
        },
        "token-123"
      )
    ).rejects.toThrow("exactly 15 players");
  });

  it("CompleteOnboarding forwards normalized payload", async () => {
    const repo = fantasyRepositoryStub();
    vi.mocked(repo.completeOnboarding).mockResolvedValue({
      profile: {
        userId: "u1",
        favoriteLeagueId: "idn-liga-1-2025",
        favoriteTeamId: "persib-bandung",
        onboardingCompleted: true
      },
      squad: {
        id: "s1",
        userId: "u1",
        leagueId: "idn-liga-1-2025",
        name: "My Squad",
        budgetCap: 1000,
        totalCost: 998,
        picks: [],
        createdAtUtc: new Date().toISOString(),
        updatedAtUtc: new Date().toISOString()
      },
      lineup: defaultLineup
    });

    const usecase = new CompleteOnboarding(repo);
    const playerIds = mockPlayers.slice(0, 15).map((player) => player.id);

    await usecase.execute(
      {
        leagueId: " idn-liga-1-2025 ",
        squadName: "  ",
        playerIds,
        lineup: defaultLineup
      },
      " token-123 "
    );

    expect(repo.completeOnboarding).toHaveBeenCalledWith(
      {
        leagueId: "idn-liga-1-2025",
        squadName: "",
        playerIds,
        lineup: defaultLineup
      },
      "token-123"
    );
  });
});
