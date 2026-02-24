import type { Player } from "../entities/Player";
import type { TeamLineup } from "../entities/Team";

export const FORMATION_LIMITS = {
  GK: { min: 1, max: 1 },
  DEF: { min: 3, max: 5 },
  MID: { min: 3, max: 5 },
  FWD: { min: 1, max: 3 }
} as const;

export const SQUAD_POSITION_LIMITS = {
  GK: 2,
  DEF: 5,
  MID: 5,
  FWD: 3
} as const;

export const STARTER_SIZE = 11;
export const SUBSTITUTE_SIZE = 4;
export const SQUAD_SIZE = STARTER_SIZE + SUBSTITUTE_SIZE;
export const BENCH_SLOT_POSITIONS: Player["position"][] = ["GK", "DEF", "MID", "FWD"];

type LineupPositionSource = Pick<TeamLineup, "defenderIds" | "midfielderIds" | "forwardIds">;

export const getBenchRequirementByPosition = (
  lineup: LineupPositionSource
): Record<Player["position"], number> => {
  const defenderCount = lineup.defenderIds.filter(Boolean).length;
  const midfielderCount = lineup.midfielderIds.filter(Boolean).length;
  const forwardCount = lineup.forwardIds.filter(Boolean).length;

  return {
    GK: 1,
    DEF: SQUAD_POSITION_LIMITS.DEF - defenderCount,
    MID: SQUAD_POSITION_LIMITS.MID - midfielderCount,
    FWD: SQUAD_POSITION_LIMITS.FWD - forwardCount
  };
};

export const getBenchSlotPositions = (lineup: LineupPositionSource | null): Player["position"][] => {
  if (!lineup) {
    return BENCH_SLOT_POSITIONS;
  }

  const requirements = getBenchRequirementByPosition(lineup);
  if (
    requirements.GK < 0 ||
    requirements.DEF < 0 ||
    requirements.MID < 0 ||
    requirements.FWD < 0 ||
    requirements.GK + requirements.DEF + requirements.MID + requirements.FWD !== SUBSTITUTE_SIZE
  ) {
    return BENCH_SLOT_POSITIONS;
  }

  const slots: Player["position"][] = [];
  for (let i = 0; i < requirements.GK; i += 1) {
    slots.push("GK");
  }
  for (let i = 0; i < requirements.DEF; i += 1) {
    slots.push("DEF");
  }
  for (let i = 0; i < requirements.MID; i += 1) {
    slots.push("MID");
  }
  for (let i = 0; i < requirements.FWD; i += 1) {
    slots.push("FWD");
  }

  return slots;
};

export const validateLineup = (
  lineup: TeamLineup,
  playersById: Map<string, Player>
): { valid: boolean; reason?: string } => {
  const defenders = lineup.defenderIds.filter(Boolean);
  const midfielders = lineup.midfielderIds.filter(Boolean);
  const forwards = lineup.forwardIds.filter(Boolean);
  const substitutes = lineup.substituteIds.filter(Boolean);
  const starterIds = [
    lineup.goalkeeperId,
    ...defenders,
    ...midfielders,
    ...forwards
  ];
  const squadIds = [...starterIds, ...substitutes];

  const uniqueStarterIds = new Set(starterIds);
  if (starterIds.length !== STARTER_SIZE || uniqueStarterIds.size !== STARTER_SIZE) {
    return { valid: false, reason: "Starting lineup must have 11 unique players." };
  }

  if (substitutes.length !== SUBSTITUTE_SIZE) {
    return { valid: false, reason: "Substitute bench must contain exactly 4 players." };
  }

  if (substitutes.some((id) => uniqueStarterIds.has(id))) {
    return { valid: false, reason: "Substitutes must be different from starters." };
  }

  const uniqueSquadIds = new Set(squadIds);
  if (squadIds.length !== SQUAD_SIZE || uniqueSquadIds.size !== SQUAD_SIZE) {
    return { valid: false, reason: "Squad must contain 15 unique players (11 starters + 4 subs)." };
  }

  if (
    defenders.length < FORMATION_LIMITS.DEF.min ||
    defenders.length > FORMATION_LIMITS.DEF.max
  ) {
    return { valid: false, reason: "Defender count must be between 3 and 5." };
  }

  if (
    midfielders.length < FORMATION_LIMITS.MID.min ||
    midfielders.length > FORMATION_LIMITS.MID.max
  ) {
    return { valid: false, reason: "Midfielder count must be between 3 and 5." };
  }

  if (
    forwards.length < FORMATION_LIMITS.FWD.min ||
    forwards.length > FORMATION_LIMITS.FWD.max
  ) {
    return { valid: false, reason: "Forward count must be between 1 and 3." };
  }

  if (!uniqueStarterIds.has(lineup.captainId) || !uniqueStarterIds.has(lineup.viceCaptainId)) {
    return { valid: false, reason: "Captain and vice captain must be in lineup." };
  }

  if (lineup.captainId === lineup.viceCaptainId) {
    return { valid: false, reason: "Captain and vice captain must be different." };
  }

  for (const playerId of squadIds) {
    const player = playersById.get(playerId);

    if (!player) {
      return { valid: false, reason: `Unknown player: ${playerId}` };
    }
  }

  const validatePosition = (ids: string[], position: Player["position"]): boolean => {
    return ids.every((id) => playersById.get(id)?.position === position);
  };

  const gk = playersById.get(lineup.goalkeeperId);
  if (!gk || gk.position !== "GK") {
    return { valid: false, reason: "Goalkeeper slot must contain a GK." };
  }

  if (!validatePosition(defenders, "DEF")) {
    return { valid: false, reason: "All defender slots must contain DEF players." };
  }

  if (!validatePosition(midfielders, "MID")) {
    return { valid: false, reason: "All midfielder slots must contain MID players." };
  }

  if (!validatePosition(forwards, "FWD")) {
    return { valid: false, reason: "All forward slots must contain FWD players." };
  }

  const expectedBench = getBenchRequirementByPosition(lineup);
  if (
    expectedBench.GK < 0 ||
    expectedBench.DEF < 0 ||
    expectedBench.MID < 0 ||
    expectedBench.FWD < 0 ||
    expectedBench.GK + expectedBench.DEF + expectedBench.MID + expectedBench.FWD !== SUBSTITUTE_SIZE
  ) {
    return { valid: false, reason: "Invalid bench composition for selected formation." };
  }

  const benchPositionCount: Record<Player["position"], number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const playerID of substitutes) {
    const player = playersById.get(playerID);
    if (!player) {
      return { valid: false, reason: `Unknown player: ${playerID}` };
    }

    benchPositionCount[player.position] += 1;
  }

  if (
    benchPositionCount.GK !== expectedBench.GK ||
    benchPositionCount.DEF !== expectedBench.DEF ||
    benchPositionCount.MID !== expectedBench.MID ||
    benchPositionCount.FWD !== expectedBench.FWD
  ) {
    return {
      valid: false,
      reason: `Bench composition must be GK=${expectedBench.GK}, DEF=${expectedBench.DEF}, MID=${expectedBench.MID}, FWD=${expectedBench.FWD}.`
    };
  }

  const squadPositionCount: Record<Player["position"], number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const playerID of squadIds) {
    const player = playersById.get(playerID);
    if (!player) {
      return { valid: false, reason: `Unknown player: ${playerID}` };
    }

    squadPositionCount[player.position] += 1;
  }

  if (
    squadPositionCount.GK !== SQUAD_POSITION_LIMITS.GK ||
    squadPositionCount.DEF !== SQUAD_POSITION_LIMITS.DEF ||
    squadPositionCount.MID !== SQUAD_POSITION_LIMITS.MID ||
    squadPositionCount.FWD !== SQUAD_POSITION_LIMITS.FWD
  ) {
    return {
      valid: false,
      reason: "Squad composition must be exactly 2 GK, 5 DEF, 5 MID, and 3 FWD."
    };
  }

  return { valid: true };
};
