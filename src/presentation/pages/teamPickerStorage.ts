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

const PICKER_CONTEXT_KEY = "fantasy-picker-context";
const PICKER_RESULT_KEY = "fantasy-picker-result";
const LINEUP_DRAFTS_KEY = "fantasy-lineup-drafts";

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

export const savePickerContext = (context: PickerContext): void => {
  writeJSON(PICKER_CONTEXT_KEY, context);
};

export const readPickerContext = (): PickerContext | null => {
  return readJSON<PickerContext>(PICKER_CONTEXT_KEY);
};

export const clearPickerContext = (): void => {
  localStorage.removeItem(PICKER_CONTEXT_KEY);
};

export const savePickerResult = (result: PickerResult): void => {
  writeJSON(PICKER_RESULT_KEY, result);
};

export const consumePickerResult = (): PickerResult | null => {
  const result = readJSON<PickerResult>(PICKER_RESULT_KEY);
  localStorage.removeItem(PICKER_RESULT_KEY);
  return result;
};

export const readLineupDraft = (leagueId: string): TeamLineup | null => {
  const drafts = readJSON<Record<string, TeamLineup>>(LINEUP_DRAFTS_KEY) ?? {};
  return drafts[leagueId] ?? null;
};

export const writeLineupDraft = (lineup: TeamLineup): void => {
  const drafts = readJSON<Record<string, TeamLineup>>(LINEUP_DRAFTS_KEY) ?? {};
  drafts[lineup.leagueId] = lineup;
  writeJSON(LINEUP_DRAFTS_KEY, drafts);
};
