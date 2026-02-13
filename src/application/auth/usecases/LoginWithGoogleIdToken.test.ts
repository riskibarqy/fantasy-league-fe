import { describe, expect, it, vi } from "vitest";
import type { AuthRepository } from "../../../domain/auth/repositories/AuthRepository";
import { LoginWithGoogleIdToken } from "./LoginWithGoogleIdToken";

const authRepositoryStub = (): AuthRepository => ({
  loginWithPassword: vi.fn(),
  loginWithGoogleIdToken: vi.fn(),
  logout: vi.fn()
});

describe("LoginWithGoogleIdToken", () => {
  it("forwards trimmed id token to repository", async () => {
    const repo = authRepositoryStub();
    const usecase = new LoginWithGoogleIdToken(repo);

    vi.mocked(repo.loginWithGoogleIdToken).mockResolvedValue({
      accessToken: "token",
      refreshToken: "",
      expiresAt: new Date().toISOString(),
      user: {
        id: "u1",
        email: "manager@fantasy.id",
        displayName: "Manager"
      }
    });

    await usecase.execute("  header.payload.signature  ");

    expect(repo.loginWithGoogleIdToken).toHaveBeenCalledWith("header.payload.signature");
  });

  it("throws when id token is empty", async () => {
    const repo = authRepositoryStub();
    const usecase = new LoginWithGoogleIdToken(repo);

    await expect(usecase.execute(" ")).rejects.toThrow("required");
  });
});
