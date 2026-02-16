import { describe, expect, it, vi } from "vitest";
import { SaveLineup } from "./SaveLineup";
import type { FantasyRepository } from "../../../domain/fantasy/repositories/FantasyRepository";
import { defaultLineup, mockPlayers } from "../../../infrastructure/mocks/data";

const fantasyRepositoryStub = (): FantasyRepository => ({
  getDashboard: vi.fn(),
  getLeagues: vi.fn(),
  getFixtures: vi.fn(),
  getPlayers: vi.fn(),
  getLineup: vi.fn(),
  saveLineup: vi.fn(),
  getMySquad: vi.fn(),
  pickSquad: vi.fn(),
  getMyCustomLeagues: vi.fn(),
  getCustomLeague: vi.fn(),
  getCustomLeagueStandings: vi.fn()
});

describe("SaveLineup", () => {
  it("persists lineup when valid", async () => {
    const repo = fantasyRepositoryStub();
    vi.mocked(repo.saveLineup).mockResolvedValue(defaultLineup);

    const usecase = new SaveLineup(repo);
    const result = await usecase.execute(defaultLineup, mockPlayers);

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
        mockPlayers
      )
    ).rejects.toThrow("different");
  });
});
