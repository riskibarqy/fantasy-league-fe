const toBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  return value.trim().toLowerCase() === "true";
};

export const appEnv = {
  useMocks: toBool(process.env.NEXT_PUBLIC_USE_MOCKS, true),
  skipOnboardingInDev: toBool(process.env.NEXT_PUBLIC_SKIP_ONBOARDING_DEV, false),
  anubisBaseUrl: process.env.NEXT_PUBLIC_ANUBIS_BASE_URL ?? "http://localhost:8081",
  anubisAppId: process.env.NEXT_PUBLIC_ANUBIS_APP_ID ?? "",
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
  fantasyApiBaseUrl: process.env.NEXT_PUBLIC_FANTASY_API_BASE_URL ?? "http://localhost:8080",
  maintenanceEnabled: toBool(process.env.NEXT_PUBLIC_MAINTENANCE_ENABLED, false),
  maintenanceMode: process.env.NEXT_PUBLIC_MAINTENANCE_MODE ?? "full",
  maintenanceTitle: process.env.NEXT_PUBLIC_MAINTENANCE_TITLE ?? "",
  maintenanceMessage: process.env.NEXT_PUBLIC_MAINTENANCE_MESSAGE ?? "",
  maintenanceStartsAt: process.env.NEXT_PUBLIC_MAINTENANCE_STARTS_AT ?? "",
  maintenanceEndsAt: process.env.NEXT_PUBLIC_MAINTENANCE_ENDS_AT ?? "",
  maintenanceAllowPaths: process.env.NEXT_PUBLIC_MAINTENANCE_ALLOW_PATHS ?? "/login",
  maintenanceBlockedPaths: process.env.NEXT_PUBLIC_MAINTENANCE_BLOCKED_PATHS ?? "",
  maintenanceAllowedUserIds: process.env.NEXT_PUBLIC_MAINTENANCE_ALLOWED_USER_IDS ?? ""
} as const;
