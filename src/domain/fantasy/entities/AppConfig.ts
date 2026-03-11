export type MaintenanceMode = "off" | "read_only" | "full";

export type MaintenanceConfig = {
  enabled: boolean;
  mode: MaintenanceMode;
  title: string;
  message: string;
  startsAt: string | null;
  endsAt: string | null;
  allowPaths: string[];
  blockedPaths: string[];
  allowedUserIds: string[];
};

export type PublicAppConfig = {
  maintenance: MaintenanceConfig;
};

export const defaultPublicAppConfig = (): PublicAppConfig => ({
  maintenance: {
    enabled: false,
    mode: "off",
    title: "Scheduled Maintenance",
    message: "We are working on the app right now. Please try again shortly.",
    startsAt: null,
    endsAt: null,
    allowPaths: ["/login"],
    blockedPaths: [],
    allowedUserIds: []
  }
});
