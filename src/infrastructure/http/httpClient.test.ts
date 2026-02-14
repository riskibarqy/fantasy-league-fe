import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpClient } from "./httpClient";

describe("HttpClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("unwraps google-style success envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        apiVersion: "2.0",
        data: [{ id: "idn-liga-1" }]
      })
    } as unknown as Response);

    vi.stubGlobal("fetch", fetchMock);

    const client = new HttpClient("https://api.example.com");
    const leagues = await client.get<Array<{ id: string }>>("/v1/leagues");

    expect(leagues).toEqual([{ id: "idn-liga-1" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/v1/leagues",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("keeps raw JSON response for non-enveloped APIs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ userId: "u1", accessToken: "token" })
      } as unknown as Response)
    );

    const client = new HttpClient("https://auth.example.com");
    const session = await client.post<{ email: string }, { userId: string; accessToken: string }>(
      "/v1/login",
      { email: "manager@fantasy.id" }
    );

    expect(session).toEqual({ userId: "u1", accessToken: "token" });
  });

  it("uses backend error message from envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          apiVersion: "2.0",
          error: { message: "validation failed: lineup id mismatch" }
        })
      } as unknown as Response)
    );

    const client = new HttpClient("https://api.example.com");

    await expect(client.get("/v1/leagues/idn/lineup")).rejects.toEqual(
      expect.objectContaining({
        message: "validation failed: lineup id mismatch",
        statusCode: 400
      })
    );
  });
});
