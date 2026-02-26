import type { AuthRepository } from "../../domain/auth/repositories/AuthRepository";
import type { AuthSession, LoginCredentials } from "../../domain/auth/entities/User";
import { HttpClient, HttpError } from "../http/httpClient";

type AnubisLoginResult = {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  expires_at?: string;
  expiresIn?: number;
  expires_in?: number;
  user_id?: string;
  access_token?: string;
  refresh_token?: string;
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

    const rawResult = await this.httpClient.post<LoginCredentials, AnubisLoginResult>(
      `/v1/apps/${appId}/sessions`,
      credentials
    );
    const result = normalizeLoginResult(rawResult);

    return buildSession(result, {
      email: credentials.email,
      displayName: toDisplayName(credentials.email)
    });
  }

  async loginWithGoogleIdToken(idToken: string): Promise<AuthSession> {
    const appId = this.getAppId();

    const rawResult = await this.loginWithGooglePayloadFallback(appId, idToken);
    const result = normalizeLoginResult(rawResult);

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

  private async loginWithGooglePayloadFallback(appId: string, idToken: string): Promise<AnubisLoginResult> {
    try {
      return await this.httpClient.post<{ idToken: string }, AnubisLoginResult>(
        `/v1/apps/${appId}/sessions/google`,
        { idToken }
      );
    } catch (error) {
      if (!(error instanceof HttpError) || (error.statusCode !== 400 && error.statusCode !== 422)) {
        throw error;
      }

      return this.httpClient.post<{ id_token: string }, AnubisLoginResult>(
        `/v1/apps/${appId}/sessions/google`,
        { id_token: idToken }
      );
    }
  }

  private getAppId(): string {
    const appId = this.appId.trim();
    if (!appId) {
      throw new Error("Missing Anubis app id (NEXT_PUBLIC_ANUBIS_APP_ID).");
    }

    return appId;
  }
}

const buildSession = (
  result: AnubisLoginResult,
  profile: { email: string; displayName: string }
): AuthSession => {
  const expiresAt = resolveSessionExpiryIso(result);

  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken?.trim() ?? "",
    expiresAt,
    user: {
      id: result.userId,
      email: profile.email,
      displayName: profile.displayName
    }
  };
};

const normalizeLoginResult = (result: AnubisLoginResult | null | undefined): AnubisLoginResult => {
  if (!result || typeof result !== "object") {
    throw new Error("Invalid auth response: missing session payload.");
  }

  const userId = (result.userId ?? result.user_id ?? "").trim();
  const accessToken = (result.accessToken ?? result.access_token ?? "").trim();
  const refreshToken = (result.refreshToken ?? result.refresh_token ?? "").trim();

  if (!userId || !accessToken) {
    throw new Error("Invalid auth response: missing userId/accessToken.");
  }

  return {
    ...result,
    userId,
    accessToken,
    refreshToken
  };
};

const resolveSessionExpiryIso = (result: AnubisLoginResult): string => {
  const explicitIso = (result.expiresAt ?? result.expires_at ?? "").trim();
  const explicitMs = Date.parse(explicitIso);
  if (Number.isFinite(explicitMs)) {
    return new Date(explicitMs).toISOString();
  }

  const expiresInSeconds =
    typeof result.expiresIn === "number"
      ? result.expiresIn
      : typeof result.expires_in === "number"
        ? result.expires_in
        : null;
  if (expiresInSeconds && Number.isFinite(expiresInSeconds) && expiresInSeconds > 0) {
    return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  }

  const jwtExpiryMs = readJwtExpiryMs(result.accessToken);
  if (jwtExpiryMs) {
    return new Date(jwtExpiryMs).toISOString();
  }

  // Conservative fallback when backend does not expose expiry metadata.
  return new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
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

const readJwtExpiryMs = (token: string): number | null => {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded)) as { exp?: number };

    if (typeof payload.exp === "number" && Number.isFinite(payload.exp) && payload.exp > 0) {
      return payload.exp * 1000;
    }
  } catch {
    return null;
  }

  return null;
};
