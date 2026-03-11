import { describe, expect, it, vi } from "vitest";
import { SaveLineup } from "./SaveLineup";
import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";
import { defaultPublicAppConfig } from "../../../domain/fantasy/entities/AppConfig";
import { defaultLineup, mockPlayers } from "../../../infrastructure/mocks/data";

const fantasyRepositoryStub = (): FantasyRepository => ({
  getPublicAppConfig: vi.fn().mockResolvedValue(defaultPublicAppConfig()),
  getPublicCustomLeagues: vi.fn(),
  getDashboard: vi.fn(),
  getLeagues: vi.fn(),
  getTeams: vi.fn(),
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

describe("SaveLineup", () => {
  it("persists lineup when valid", async () => {
    const repo = fantasyRepositoryStub();
    vi.mocked(repo.saveLineup).mockResolvedValue(defaultLineup);

    const usecase = new SaveLineup(repo);
    const result = await usecase.execute(defaultLineup, mockPlayers, "token");

    expect(result.leagueId).toBe(defaultLineup.leagueId);
    expect(repo.saveLineup).toHaveBeenCalledOnce();
  });

  it("rejects lineup when captain and vice captain are identical", async () => {
    const repo = fantasyRepositoryStub();
    const usecase = new SaveLineup(repo);

    await expect(
      usecase.execute(
        {
          ...defaultLineup,
          viceCaptainId: defaultLineup.captainId
        },
        mockPlayers,
        "token"
      )
    ).rejects.toThrow("different");
  });

  it("rejects save when access token is missing", async () => {
    const repo = fantasyRepositoryStub();
    const usecase = new SaveLineup(repo);

    await expect(usecase.execute(defaultLineup, mockPlayers, "")).rejects.toThrow(
      "Access token is required."
    );
  });
});
