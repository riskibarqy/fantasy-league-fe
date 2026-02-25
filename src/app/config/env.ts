const toBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  return value.trim().toLowerCase() === "true";
};

export const appEnv = {
  useMocks: toBool(process.env.NEXT_PUBLIC_USE_MOCKS, true),
  anubisBaseUrl: process.env.NEXT_PUBLIC_ANUBIS_BASE_URL ?? "http://localhost:8081",
  anubisAppId: process.env.NEXT_PUBLIC_ANUBIS_APP_ID ?? "",
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
  fantasyApiBaseUrl: process.env.NEXT_PUBLIC_FANTASY_API_BASE_URL ?? "http://localhost:8080"
} as const;
