import type { PublicAppConfig, MaintenanceMode } from "../../domain/fantasy/entities/AppConfig";
import { defaultPublicAppConfig } from "../../domain/fantasy/entities/AppConfig";

const DEFAULT_READ_ONLY_BLOCKED_PATHS = [
  "/onboarding",
  "/onboarding/pick",
  "/pick-team",
  "/pick-team/pick",
  "/transfers",
  "/custom-leagues"
];

const normalizePath = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "/";
  }

  if (trimmed === "/") {
    return "/";
  }

  return trimmed.startsWith("/") ? trimmed.replace(/\/+$/, "") : `/${trimmed.replace(/\/+$/, "")}`;
};

const parseOptionalDate = (value: string | null | undefined): string | null => {
  if (!value?.trim()) {
    return null;
  }

  const iso = new Date(value).toISOString();
  return Number.isNaN(new Date(iso).getTime()) ? null : value.trim();
};

const ensureMode = (value: string | undefined, fallback: MaintenanceMode): MaintenanceMode => {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "off" || normalized === "read_only" || normalized === "full") {
    return normalized;
  }

  return fallback;
};

const parseList = (value: string | undefined): string[] =>
  value
    ?.split(",")
    .map((item) => normalizePath(item))
    .filter((item, index, items) => Boolean(item) && items.indexOf(item) === index) ?? [];

const parseUserList = (value: string | undefined): string[] =>
  value
    ?.split(",")
    .map((item) => item.trim())
    .filter((item, index, items) => Boolean(item) && items.indexOf(item) === index) ?? [];

export const buildEnvPublicAppConfig = (env: {
  maintenanceEnabled: boolean;
  maintenanceMode: string;
  maintenanceTitle: string;
  maintenanceMessage: string;
  maintenanceStartsAt: string;
  maintenanceEndsAt: string;
  maintenanceAllowPaths: string;
  maintenanceBlockedPaths: string;
  maintenanceAllowedUserIds: string;
}): PublicAppConfig => {
  const fallback = defaultPublicAppConfig();
  const enabled = env.maintenanceEnabled;
  const mode = enabled ? ensureMode(env.maintenanceMode, "full") : "off";

  return {
    maintenance: {
      enabled,
      mode,
      title: env.maintenanceTitle.trim() || fallback.maintenance.title,
      message: env.maintenanceMessage.trim() || fallback.maintenance.message,
      startsAt: parseOptionalDate(env.maintenanceStartsAt),
      endsAt: parseOptionalDate(env.maintenanceEndsAt),
      allowPaths: parseList(env.maintenanceAllowPaths).length > 0
        ? parseList(env.maintenanceAllowPaths)
        : fallback.maintenance.allowPaths,
      blockedPaths: parseList(env.maintenanceBlockedPaths),
      allowedUserIds: parseUserList(env.maintenanceAllowedUserIds)
    }
  };
};

const readString = (record: Record<string, unknown>, ...keys: string[]): string => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
};

const readBool = (record: Record<string, unknown>, ...keys: string[]): boolean | null => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }

  return null;
};

const readArray = (record: Record<string, unknown>, ...keys: string[]): string[] => {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
    }
  }

  return [];
};

export const normalizePublicAppConfig = (payload: unknown, fallback: PublicAppConfig): PublicAppConfig => {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const root = payload as Record<string, unknown>;
  const maintenanceRecord =
    (root.maintenance && typeof root.maintenance === "object" ? (root.maintenance as Record<string, unknown>) : null) ??
    root;
  if (!maintenanceRecord) {
    return fallback;
  }

  const enabled = readBool(maintenanceRecord, "enabled", "maintenanceEnabled");
  const mode = ensureMode(readString(maintenanceRecord, "mode", "maintenanceMode"), fallback.maintenance.mode);

  return {
    maintenance: {
      enabled: enabled ?? fallback.maintenance.enabled,
      mode,
      title: readString(maintenanceRecord, "title") || fallback.maintenance.title,
      message: readString(maintenanceRecord, "message", "description") || fallback.maintenance.message,
      startsAt: parseOptionalDate(readString(maintenanceRecord, "startsAt", "startAt", "start_time")) ?? fallback.maintenance.startsAt,
      endsAt: parseOptionalDate(readString(maintenanceRecord, "endsAt", "endAt", "end_time")) ?? fallback.maintenance.endsAt,
      allowPaths: readArray(maintenanceRecord, "allowPaths", "allowedPaths").length > 0
        ? readArray(maintenanceRecord, "allowPaths", "allowedPaths").map(normalizePath)
        : fallback.maintenance.allowPaths,
      blockedPaths: readArray(maintenanceRecord, "blockedPaths").map(normalizePath),
      allowedUserIds: readArray(maintenanceRecord, "allowedUserIds", "bypassUserIds")
    }
  };
};

const matchesPathRule = (pathname: string, rule: string): boolean => {
  const normalizedPath = normalizePath(pathname);
  const normalizedRule = normalizePath(rule);

  if (normalizedRule === "/") {
    return normalizedPath === "/";
  }

  return normalizedPath === normalizedRule || normalizedPath.startsWith(`${normalizedRule}/`);
};

const isWithinWindow = (startsAt: string | null, endsAt: string | null, nowMs: number): boolean => {
  const startMs = startsAt ? new Date(startsAt).getTime() : null;
  const endMs = endsAt ? new Date(endsAt).getTime() : null;

  if (startMs !== null && Number.isFinite(startMs) && nowMs < startMs) {
    return false;
  }

  if (endMs !== null && Number.isFinite(endMs) && nowMs > endMs) {
    return false;
  }

  return true;
};

export const shouldBlockForMaintenance = ({
  pathname,
  config,
  userId,
  nowMs = Date.now()
}: {
  pathname: string;
  config: PublicAppConfig;
  userId?: string | null;
  nowMs?: number;
}): boolean => {
  const maintenance = config.maintenance;
  if (!maintenance.enabled || maintenance.mode === "off") {
    return false;
  }

  if (!isWithinWindow(maintenance.startsAt, maintenance.endsAt, nowMs)) {
    return false;
  }

  const normalizedUserId = userId?.trim() ?? "";
  if (normalizedUserId && maintenance.allowedUserIds.includes(normalizedUserId)) {
    return false;
  }

  if (maintenance.allowPaths.some((item) => matchesPathRule(pathname, item))) {
    return false;
  }

  if (maintenance.mode === "full") {
    return true;
  }

  const blockedPaths = maintenance.blockedPaths.length > 0
    ? maintenance.blockedPaths
    : DEFAULT_READ_ONLY_BLOCKED_PATHS;

  return blockedPaths.some((item) => matchesPathRule(pathname, item));
};
