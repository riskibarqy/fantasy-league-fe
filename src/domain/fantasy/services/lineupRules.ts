import type { Player } from "../entities/Player";
import type { TeamLineup } from "../entities/Team";

export const FORMATION_LIMITS = {
  GK: { min: 1, max: 1 },
  DEF: { min: 3, max: 5 },
  MID: { min: 3, max: 5 },
  FWD: { min: 1, max: 3 }
} as const;

export const STARTER_SIZE = 11;
export const SUBSTITUTE_SIZE = 4;
export const SQUAD_SIZE = STARTER_SIZE + SUBSTITUTE_SIZE;
export const BENCH_SLOT_POSITIONS: Player["position"][] = ["GK", "DEF", "MID", "FWD"];

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

  if (midfielders.length < FORMATION_LIMITS.MID.min || midfielders.length > FORMATION_LIMITS.MID.max) {
    return { valid: false, reason: "Midfielder count must be between 3 and 5." };
  }

  if (forwards.length < FORMATION_LIMITS.FWD.min || forwards.length > FORMATION_LIMITS.FWD.max) {
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

  const gk = playersById.get(lineup.goalkeeperId);
  if (!gk || gk.position !== "GK") {
    return { valid: false, reason: "Goalkeeper slot must contain a GK." };
  }

  const validatePosition = (ids: string[], position: Player["position"]): boolean => {
    return ids.every((id) => playersById.get(id)?.position === position);
  };

  if (!validatePosition(defenders, "DEF")) {
    return { valid: false, reason: "All defender slots must contain DEF players." };
  }

  if (!validatePosition(midfielders, "MID")) {
    return { valid: false, reason: "All midfielder slots must contain MID players." };
  }

  if (!validatePosition(forwards, "FWD")) {
    return { valid: false, reason: "All forward slots must contain FWD players." };
  }

  const benchGoalkeepers = substitutes.filter((id) => playersById.get(id)?.position === "GK").length;
  if (benchGoalkeepers !== 1) {
    return { valid: false, reason: "Substitutes must include exactly one GK." };
  }

  return { valid: true };
};
