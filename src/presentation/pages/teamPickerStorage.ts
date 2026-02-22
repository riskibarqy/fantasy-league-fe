import type { TeamLineup } from "../../domain/fantasy/entities/Team";

export type SlotZone = "GK" | "DEF" | "MID" | "FWD" | "BENCH";

export type SlotPickerTarget = {
  zone: SlotZone;
  index: number;
};

type PickerContext = {
  leagueId: string;
  target: SlotPickerTarget;
  lineup: TeamLineup;
  returnPath?: string;
};

type PickerResult = {
  leagueId: string;
  target: SlotPickerTarget;
  playerId: string;
};

type ScopedPickerContext = PickerContext & {
  scopeKey: string;
};

type ScopedPickerResult = PickerResult & {
  scopeKey: string;
};

const PICKER_CONTEXT_KEY = "fantasy-picker-context";
const PICKER_RESULT_KEY = "fantasy-picker-result";
const LINEUP_DRAFTS_KEY = "fantasy-lineup-drafts";
const ANON_SCOPE = "anon";

const readJSON = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeJSON = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
};

const resolveScopeKey = (scope?: string): string => {
  const trimmed = scope?.trim() ?? "";
  return trimmed || ANON_SCOPE;
};

const canReadWithScope = (storedScope: string, requestedScope?: string): boolean => {
  const resolved = resolveScopeKey(requestedScope);
  if (storedScope === resolved) {
    return true;
  }

  // Session scope can change during first load after login; allow anon fallback once.
  if (resolved !== ANON_SCOPE && storedScope === ANON_SCOPE) {
    return true;
  }

  return false;
};

const toDraftKey = (leagueId: string, scope?: string): string => {
  return `${resolveScopeKey(scope)}::${leagueId.trim()}`;
};

export const savePickerContext = (context: PickerContext, scope?: string): void => {
  writeJSON(PICKER_CONTEXT_KEY, {
    ...context,
    scopeKey: resolveScopeKey(scope)
  } satisfies ScopedPickerContext);
};

export const readPickerContext = (scope?: string): PickerContext | null => {
  const parsed = readJSON<ScopedPickerContext>(PICKER_CONTEXT_KEY);
  if (!parsed || !canReadWithScope(parsed.scopeKey, scope)) {
    return null;
  }

  return {
    leagueId: parsed.leagueId,
    target: parsed.target,
    lineup: parsed.lineup,
    returnPath: parsed.returnPath
  };
};

export const clearPickerContext = (scope?: string): void => {
  if (typeof scope === "undefined") {
    localStorage.removeItem(PICKER_CONTEXT_KEY);
    return;
  }

  const parsed = readJSON<ScopedPickerContext>(PICKER_CONTEXT_KEY);
  if (!parsed || !canReadWithScope(parsed.scopeKey, scope)) {
    return;
  }

  localStorage.removeItem(PICKER_CONTEXT_KEY);
};

export const savePickerResult = (result: PickerResult, scope?: string): void => {
  writeJSON(PICKER_RESULT_KEY, {
    ...result,
    scopeKey: resolveScopeKey(scope)
  } satisfies ScopedPickerResult);
};

export const consumePickerResult = (scope?: string): PickerResult | null => {
  const result = readJSON<ScopedPickerResult>(PICKER_RESULT_KEY);
  localStorage.removeItem(PICKER_RESULT_KEY);
  if (!result || !canReadWithScope(result.scopeKey, scope)) {
    return null;
  }

  return {
    leagueId: result.leagueId,
    target: result.target,
    playerId: result.playerId
  };
};

export const readLineupDraft = (leagueId: string, scope?: string): TeamLineup | null => {
  const drafts = readJSON<Record<string, TeamLineup>>(LINEUP_DRAFTS_KEY) ?? {};
  return drafts[toDraftKey(leagueId, scope)] ?? null;
};

export const writeLineupDraft = (lineup: TeamLineup, scope?: string): void => {
  const drafts = readJSON<Record<string, TeamLineup>>(LINEUP_DRAFTS_KEY) ?? {};
  drafts[toDraftKey(lineup.leagueId, scope)] = lineup;
  writeJSON(LINEUP_DRAFTS_KEY, drafts);
};
