type CacheStorageMode = "memory" | "memory+local";

type CacheEnvelope<T> = {
  value: T;
  expiresAt: number;
};

type LoadCachedOptions<T> = {
  key: string;
  ttlMs: number;
  loader: () => Promise<T>;
  storage?: CacheStorageMode;
  allowStaleOnError?: boolean;
  forceRefresh?: boolean;
};

const CACHE_VERSION = "v1";
const STORAGE_PREFIX = `fantasy-request-cache:${CACHE_VERSION}:`;

const memoryCache = new Map<string, CacheEnvelope<unknown>>();
const inFlightCache = new Map<string, Promise<unknown>>();

const now = (): number => Date.now();

const storageKey = (key: string): string => `${STORAGE_PREFIX}${key}`;

const readFromLocalStorage = <T,>(key: string): CacheEnvelope<T> | null => {
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed.expiresAt !== "number") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const writeToLocalStorage = <T,>(key: string, entry: CacheEnvelope<T>): void => {
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    return;
  }
};

const deleteFromLocalStorage = (key: string): void => {
  try {
    localStorage.removeItem(storageKey(key));
  } catch {
    return;
  }
};

const isFresh = (entry: CacheEnvelope<unknown>): boolean => entry.expiresAt > now();

export const getOrLoadCached = async <T,>({
  key,
  ttlMs,
  loader,
  storage = "memory+local",
  allowStaleOnError = true,
  forceRefresh = false
}: LoadCachedOptions<T>): Promise<T> => {
  let staleValue: T | undefined;
  let hasStaleValue = false;

  if (!forceRefresh) {
    const memoryEntry = memoryCache.get(key) as CacheEnvelope<T> | undefined;
    if (memoryEntry) {
      if (isFresh(memoryEntry)) {
        return memoryEntry.value;
      }

      staleValue = memoryEntry.value;
      hasStaleValue = true;
    }

    if (storage === "memory+local") {
      const localEntry = readFromLocalStorage<T>(key);
      if (localEntry) {
        memoryCache.set(key, localEntry as CacheEnvelope<unknown>);
        if (isFresh(localEntry)) {
          return localEntry.value;
        }

        staleValue = localEntry.value;
        hasStaleValue = true;
      }
    }
  }

  const existingInFlight = inFlightCache.get(key) as Promise<T> | undefined;
  if (existingInFlight) {
    return existingInFlight;
  }

  const request = loader()
    .then((value) => {
      const entry: CacheEnvelope<T> = {
        value,
        expiresAt: now() + Math.max(1, ttlMs)
      };

      memoryCache.set(key, entry as CacheEnvelope<unknown>);
      if (storage === "memory+local") {
        writeToLocalStorage(key, entry);
      }

      return value;
    })
    .catch((error) => {
      if (allowStaleOnError && hasStaleValue) {
        return staleValue as T;
      }

      throw error;
    })
    .finally(() => {
      inFlightCache.delete(key);
    });

  inFlightCache.set(key, request as Promise<unknown>);
  return request;
};

export const invalidateCached = (key: string): void => {
  memoryCache.delete(key);
  inFlightCache.delete(key);
  deleteFromLocalStorage(key);
};

export const clearRequestCache = (): void => {
  memoryCache.clear();
  inFlightCache.clear();

  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    return;
  }
};

export const cacheTtlMs = {
  dashboard: 30_000,
  leagues: 5 * 60_000,
  teams: 5 * 60_000,
  fixtures: 2 * 60_000,
  players: 3 * 60_000,
  playerDetails: 3 * 60_000,
  customLeagues: 60_000,
  customLeagueStandings: 60_000
} as const;

export const cacheKeys = {
  dashboard: (): string => "dashboard",
  leagues: (): string => "leagues",
  teams: (leagueId: string): string => `teams:${leagueId}`,
  fixtures: (leagueId: string): string => `fixtures:${leagueId}`,
  players: (leagueId: string): string => `players:${leagueId}`,
  playerDetails: (leagueId: string, playerId: string): string => `player-details:${leagueId}:${playerId}`,
  customLeagues: (userId: string): string => `custom-leagues:${userId}`,
  customLeague: (groupId: string, userId: string): string => `custom-league:${groupId}:${userId}`,
  customLeagueStandings: (groupId: string, userId: string): string =>
    `custom-league-standings:${groupId}:${userId}`
} as const;
