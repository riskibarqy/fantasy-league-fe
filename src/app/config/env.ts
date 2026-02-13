const env = import.meta.env;

const toBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === "true";
};

export const appEnv = {
  useMocks: toBool(env.VITE_USE_MOCKS, true),
  anubisBaseUrl: env.VITE_ANUBIS_BASE_URL ?? "http://localhost:8081",
  anubisAppId: env.VITE_ANUBIS_APP_ID ?? "",
  googleClientId: env.VITE_GOOGLE_CLIENT_ID ?? "",
  fantasyApiBaseUrl: env.VITE_FANTASY_API_BASE_URL ?? "http://localhost:8080"
} as const;
