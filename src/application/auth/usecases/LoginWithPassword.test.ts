import { describe, expect, it, vi } from "vitest";
import { LoginWithPassword } from "./LoginWithPassword";
import type { AuthRepository } from "../../../domain/auth/repositories/AuthRepository";

const authRepositoryStub = (): AuthRepository => ({
  loginWithPassword: vi.fn(),
  loginWithGoogleIdToken: vi.fn(),
  logout: vi.fn()
});

describe("LoginWithPassword", () => {
  it("normalizes email before forwarding to repository", async () => {
    const repo = authRepositoryStub();
    const usecase = new LoginWithPassword(repo);

    vi.mocked(repo.loginWithPassword).mockResolvedValue({
      accessToken: "token",
      refreshToken: "refresh",
      expiresAt: new Date().toISOString(),
      user: {
        id: "u1",
        email: "manager@fantasy.id",
        displayName: "Manager"
      }
    });

    await usecase.execute({
      email: "  MANAGER@Fantasy.ID ",
      password: "password123"
    });

    expect(repo.loginWithPassword).toHaveBeenCalledWith({
      email: "manager@fantasy.id",
      password: "password123"
    });
  });

  it("throws when email is empty", async () => {
    const repo = authRepositoryStub();
    const usecase = new LoginWithPassword(repo);

    await expect(
      usecase.execute({
        email: "",
        password: "password123"
      })
    ).rejects.toThrow("required");
  });
});
