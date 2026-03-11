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
