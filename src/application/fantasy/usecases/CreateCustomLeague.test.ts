import { describe, expect, it, vi } from "vitest";
import { CreateCustomLeague } from "./CreateCustomLeague";
import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";
import { defaultPublicAppConfig } from "../../../domain/fantasy/entities/AppConfig";

const fantasyRepositoryStub = (): FantasyRepository => ({
  getPublicAppConfig: vi.fn().mockResolvedValue(defaultPublicAppConfig()),
  getPublicCustomLeagues: vi.fn(),
  getDashboard: vi.fn(),
  getLeagues: vi.fn(),
  getTeams: vi.fn(),
  getTeamFixtures: vi.fn(),
  getFixtures: vi.fn(),
  getSeasonPointsSummary: vi.fn(),
  getMyPlayerPointsByGameweek: vi.fn(),
  getHighestPlayerPointsByGameweek: vi.fn(),
  getLeagueStandings: vi.fn(),
  getFixtureDetails: vi.fn(),
  getTopScoreDetails: vi.fn(),
  getPlayers: vi.fn(),
  getPlayerDetails: vi.fn(),
  getLineup: vi.fn(),
  saveLineup: vi.fn(),
  getMySquad: vi.fn(),
  pickSquad: vi.fn(),
  saveOnboardingFavoriteClub: vi.fn(),
  completeOnboarding: vi.fn(),
  getMyCustomLeagues: vi.fn(),
  createCustomLeague: vi.fn(),
  joinPublicCustomLeague: vi.fn(),
  joinCustomLeagueByInvite: vi.fn(),
  getCustomLeague: vi.fn(),
  getCustomLeagueStandings: vi.fn()
});

describe("CreateCustomLeague", () => {
  it("generates a name when the input is blank", async () => {
    const repo = fantasyRepositoryStub();
    vi.mocked(repo.createCustomLeague).mockImplementation(async (input) => ({
      id: "cl-1",
      leagueId: input.leagueId,
      ownerUserId: "u1",
      name: input.name,
      inviteCode: "ABC123",
      isDefault: false,
      isPublic: true,
      myRank: 1,
      memberCount: 1,
      rankMovement: "new",
      createdAtUtc: new Date().toISOString(),
      updatedAtUtc: new Date().toISOString()
    }));

    const usecase = new CreateCustomLeague(repo);
    await usecase.execute(
      {
        leagueId: " idn-liga-1-2025 ",
        name: "   "
      },
      " token "
    );

    expect(repo.createCustomLeague).toHaveBeenCalledOnce();
    expect(vi.mocked(repo.createCustomLeague).mock.calls[0]?.[0].leagueId).toBe("idn-liga-1-2025");
    expect(vi.mocked(repo.createCustomLeague).mock.calls[0]?.[0].name.trim().length).toBeGreaterThan(0);
  });
});
