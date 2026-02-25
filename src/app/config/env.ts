type EnvRecord = Record<string, string | undefined>;

const nextEnv: EnvRecord =
  typeof process !== "undefined" && process.env
    ? (process.env as EnvRecord)
    : {};

const viteEnv: EnvRecord =
  typeof import.meta !== "undefined" && (import.meta as ImportMeta).env
    ? ((import.meta as ImportMeta & { env: EnvRecord }).env as EnvRecord)
    : {};

const readEnv = (nextKey: string, viteKey: string): string | undefined => {
  const nextValue = nextEnv[nextKey];
  if (typeof nextValue === "string" && nextValue.length > 0) {
    return nextValue;
  }

  const viteValue = viteEnv[viteKey];
  if (typeof viteValue === "string" && viteValue.length > 0) {
    return viteValue;
  }

  return undefined;
};

const toBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === "true";
};

export const appEnv = {
  useMocks: toBool(
    readEnv("NEXT_PUBLIC_USE_MOCKS", "NEXT_PUBLIC_USE_MOCKS") ??
      readEnv("VITE_USE_MOCKS", "VITE_USE_MOCKS"),
    true
  ),
  anubisBaseUrl:
    readEnv("NEXT_PUBLIC_ANUBIS_BASE_URL", "NEXT_PUBLIC_ANUBIS_BASE_URL") ??
    readEnv("VITE_ANUBIS_BASE_URL", "VITE_ANUBIS_BASE_URL") ??
    "http://localhost:8081",
  anubisAppId:
    readEnv("NEXT_PUBLIC_ANUBIS_APP_ID", "NEXT_PUBLIC_ANUBIS_APP_ID") ??
    readEnv("VITE_ANUBIS_APP_ID", "VITE_ANUBIS_APP_ID") ??
    "",
  googleClientId:
    readEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "NEXT_PUBLIC_GOOGLE_CLIENT_ID") ??
    readEnv("VITE_GOOGLE_CLIENT_ID", "VITE_GOOGLE_CLIENT_ID") ??
    "",
  fantasyApiBaseUrl:
    readEnv("NEXT_PUBLIC_FANTASY_API_BASE_URL", "NEXT_PUBLIC_FANTASY_API_BASE_URL") ??
    readEnv("VITE_FANTASY_API_BASE_URL", "VITE_FANTASY_API_BASE_URL") ??
    "http://localhost:8080"
} as const;
