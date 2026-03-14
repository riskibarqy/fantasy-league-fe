import { describe, expect, it, vi } from "vitest";
import { HttpFantasyRepository } from "./HttpFantasyRepository";
import { HttpError, type HttpClient } from "../http/httpClient";

const createHttpClientStub = (): HttpClient =>
  ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn()
  }) as unknown as HttpClient;

describe("HttpFantasyRepository", () => {
  it("maps dashboard current gameweek from backend", async () => {
    const httpClient = createHttpClientStub();
    const repository = new HttpFantasyRepository(httpClient);

    vi.mocked(httpClient.get).mockResolvedValue({
      gameweek: 25,
      currentGameweek: 25,
      editableGameweek: 25,
      budget: 31.6,
      teamValue: 118.4,
      totalPoints: 437,
      rank: 4,
      selectedLeagueId: "idn-liga-1-2025"
    });

    await expect(repository.getDashboard("token")).resolves.toMatchObject({
      gameweek: 25,
      currentGameweek: 25,
      editableGameweek: 25,
      selectedLeagueId: "idn-liga-1-2025"
    });
  });

  it("loads team fixtures by league, gameweek, and team ids", async () => {
    const httpClient = createHttpClientStub();
    const repository = new HttpFantasyRepository(httpClient);

    vi.mocked(httpClient.get).mockResolvedValue({
      items: [
        {
          teamId: "sm-idn-team-10211",
          teamName: "Persib",
          teamShort: "PSB",
          opponentTeamId: "sm-idn-team-2461",
          opponentTeamName: "PSM Makassar",
          opponentTeamShort: "PSM",
          homeAway: "HOME"
        }
      ]
    });

    await expect(
      repository.getTeamFixtures("idn-liga-1-2025", 26, ["sm-idn-team-10211", "sm-idn-team-2461"])
    ).resolves.toEqual([
      {
        teamId: "sm-idn-team-10211",
        teamName: "Persib",
        teamShort: "PSB",
        opponentTeamId: "sm-idn-team-2461",
        opponentTeamName: "PSM Makassar",
        opponentTeamShort: "PSM",
        homeAway: "HOME"
      }
    ]);

    expect(vi.mocked(httpClient.get)).toHaveBeenCalledWith(
      "/v1/leagues/idn-liga-1-2025/teams/fixtures?gameweek=26&team_ids=sm-idn-team-10211%2Csm-idn-team-2461"
    );
  });

  it("returns null when lineup endpoint responds with 404", async () => {
    const httpClient = createHttpClientStub();
    const repository = new HttpFantasyRepository(httpClient);

    vi.mocked(httpClient.get).mockRejectedValue(
      new HttpError("lineup not found", 404)
    );

    await expect(repository.getLineup("idn-liga-1-2025", "token")).resolves.toBeNull();
  });

  it("rethrows lineup errors that are not 404", async () => {
    const httpClient = createHttpClientStub();
    const repository = new HttpFantasyRepository(httpClient);

    vi.mocked(httpClient.get).mockRejectedValue(
      new HttpError("internal error", 500)
    );

    await expect(repository.getLineup("idn-liga-1-2025", "token")).rejects.toThrow("internal error");
  });
});
