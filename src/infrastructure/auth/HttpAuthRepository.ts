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
    const payload = decodeGoogleIdTokenPayload(idToken);
    const result = normalizeLoginResult(rawResult, payload?.sub);

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
      return await this.httpClient.post<
        { idToken: string; id_token: string; credential: string; token: string },
        AnubisLoginResult
      >(
        `/v1/apps/${appId}/sessions/google`,
        {
          idToken,
          id_token: idToken,
          credential: idToken,
          token: idToken
        }
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

const normalizeLoginResult = (
  result: AnubisLoginResult | null | undefined,
  fallbackUserId = ""
): AnubisLoginResult => {
  if (!result || typeof result !== "object") {
    throw new Error("Invalid auth response: missing session payload.");
  }

  const userId = (
    readString(result, "userId") ??
    readString(result, "user_id") ??
    readString(result, "sub") ??
    readString(result, "user.id") ??
    readString(result, "user.user_id") ??
    readString(result, "user.sub") ??
    readString(result, "session.userId") ??
    readString(result, "session.user_id") ??
    readString(result, "session.user.id") ??
    fallbackUserId
  ).trim();
  const accessToken = (
    readString(result, "accessToken") ??
    readString(result, "access_token") ??
    readString(result, "token") ??
    readString(result, "token.accessToken") ??
    readString(result, "token.access_token") ??
    readString(result, "session.token.accessToken") ??
    readString(result, "session.token.access_token") ??
    readString(result, "session.accessToken") ??
    readString(result, "session.access_token") ??
    readString(result, "session.token")
  )?.trim() ?? "";
  const refreshToken = (
    readString(result, "refreshToken") ??
    readString(result, "refresh_token") ??
    readString(result, "token.refreshToken") ??
    readString(result, "token.refresh_token") ??
    readString(result, "session.refreshToken") ??
    readString(result, "session.refresh_token") ??
    readString(result, "session.token.refreshToken") ??
    readString(result, "session.token.refresh_token")
  )?.trim() ?? "";

  if (!userId || !accessToken) {
    throw new Error("Invalid auth response: missing userId/accessToken.");
  }

  return {
    ...result,
    userId,
    accessToken,
    refreshToken,
    expiresAt:
      readString(result, "expiresAt") ??
      readString(result, "expires_at") ??
      readString(result, "token.expiresAt") ??
      readString(result, "token.expires_at") ??
      readString(result, "session.expiresAt") ??
      readString(result, "session.expires_at") ??
      readString(result, "session.token.expiresAt") ??
      readString(result, "session.token.expires_at"),
    expiresIn:
      readNumber(result, "expiresIn") ??
      readNumber(result, "expires_in") ??
      readNumber(result, "token.expiresIn") ??
      readNumber(result, "token.expires_in") ??
      readNumber(result, "session.expiresIn") ??
      readNumber(result, "session.expires_in") ??
      readNumber(result, "session.token.expiresIn") ??
      readNumber(result, "session.token.expires_in")
  };
};

const readString = (source: unknown, path: string): string | undefined => {
  const value = readPath(source, path);
  return typeof value === "string" ? value : undefined;
};

const readNumber = (source: unknown, path: string): number | undefined => {
  const value = readPath(source, path);
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const readPath = (source: unknown, path: string): unknown => {
  if (!source || typeof source !== "object") {
    return undefined;
  }

  const segments = path.split(".");
  let cursor: unknown = source;

  for (const segment of segments) {
    if (!cursor || typeof cursor !== "object" || !(segment in (cursor as Record<string, unknown>))) {
      return undefined;
    }

    cursor = (cursor as Record<string, unknown>)[segment];
  }

  return cursor;
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
