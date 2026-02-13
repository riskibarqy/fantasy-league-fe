import type { AuthRepository } from "../../domain/auth/repositories/AuthRepository";
import type { AuthSession, LoginCredentials } from "../../domain/auth/entities/User";
import { HttpClient } from "../http/httpClient";

type AnubisLoginResult = {
  userId: string;
  accessToken: string;
};

type GoogleIdTokenPayload = {
  email?: string;
  name?: string;
  sub?: string;
};

export class HttpAuthRepository implements AuthRepository {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly appId: string
  ) {}

  async loginWithPassword(credentials: LoginCredentials): Promise<AuthSession> {
    const appId = this.getAppId();

    const result = await this.httpClient.post<LoginCredentials, AnubisLoginResult>(
      `/v1/apps/${appId}/sessions`,
      credentials
    );

    return buildSession(result, {
      email: credentials.email,
      displayName: toDisplayName(credentials.email)
    });
  }

  async loginWithGoogleIdToken(idToken: string): Promise<AuthSession> {
    const appId = this.getAppId();

    const result = await this.httpClient.post<{ idToken: string }, AnubisLoginResult>(
      `/v1/apps/${appId}/sessions/google`,
      { idToken }
    );

    const payload = decodeGoogleIdTokenPayload(idToken);

    return buildSession(result, {
      email: payload?.email ?? "google-user@unknown.local",
      displayName: payload?.name ?? toDisplayName(payload?.email ?? "Google User")
    });
  }

  async logout(_accessToken: string): Promise<void> {
    // Anubis currently exposes token introspection but no logout/revocation endpoint.
    return;
  }

  private getAppId(): string {
    const appId = this.appId.trim();
    if (!appId) {
      throw new Error("Missing Anubis app id (VITE_ANUBIS_APP_ID).");
    }

    return appId;
  }
}

const buildSession = (
  result: AnubisLoginResult,
  profile: { email: string; displayName: string }
): AuthSession => {
  return {
    accessToken: result.accessToken,
    refreshToken: "",
    // Access token expiry is not returned directly by Anubis login response.
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    user: {
      id: result.userId,
      email: profile.email,
      displayName: profile.displayName
    }
  };
};

const toDisplayName = (value: string): string => {
  const emailPrefix = value.includes("@") ? value.split("@")[0] : value;
  const clean = emailPrefix.trim();

  if (!clean) {
    return "Manager";
  }

  return clean
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const decodeGoogleIdTokenPayload = (idToken: string): GoogleIdTokenPayload | null => {
  const parts = idToken.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

    const json = atob(padded);
    return JSON.parse(json) as GoogleIdTokenPayload;
  } catch {
    return null;
  }
};
