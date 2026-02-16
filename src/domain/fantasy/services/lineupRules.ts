import type { Player } from "../entities/Player";
import type { TeamLineup } from "../entities/Team";

export const FORMATION_LIMITS = {
  GK: { min: 1, max: 1 },
  DEF: { min: 2, max: 5 },
  MID: { min: 0, max: 5 },
  FWD: { min: 0, max: 3 }
} as const;

export const STARTER_SIZE = 11;
export const SUBSTITUTE_SIZE = 4;
export const SQUAD_SIZE = STARTER_SIZE + SUBSTITUTE_SIZE;

export const validateLineup = (
  lineup: TeamLineup,
  playersById: Map<string, Player>
): { valid: boolean; reason?: string } => {
  const starterIds = [
    lineup.goalkeeperId,
    ...lineup.defenderIds,
    ...lineup.midfielderIds,
    ...lineup.forwardIds
  ];
  const substituteIds = lineup.substituteIds;
  const squadIds = [...starterIds, ...substituteIds];

  const uniqueStarterIds = new Set(starterIds);
  if (starterIds.length !== STARTER_SIZE || uniqueStarterIds.size !== STARTER_SIZE) {
    return { valid: false, reason: "Starting lineup must have 11 unique players." };
  }

  if (lineup.substituteIds.length !== SUBSTITUTE_SIZE) {
    return { valid: false, reason: "Substitute bench must contain exactly 4 players." };
  }

  // Bench can contain any position but cannot include starting players.
  if (substituteIds.some((id) => uniqueStarterIds.has(id))) {
    return { valid: false, reason: "Substitutes must be different from starters." };
  }

  const uniqueSquadIds = new Set(squadIds);
  if (squadIds.length !== SQUAD_SIZE || uniqueSquadIds.size !== SQUAD_SIZE) {
    return { valid: false, reason: "Squad must contain 15 unique players (11 starters + 4 subs)." };
  }

  if (
    lineup.defenderIds.length < FORMATION_LIMITS.DEF.min ||
    lineup.defenderIds.length > FORMATION_LIMITS.DEF.max
  ) {
    return { valid: false, reason: "Defender count must be between 2 and 5." };
  }

  if (lineup.midfielderIds.length > FORMATION_LIMITS.MID.max) {
    return { valid: false, reason: "Midfielder count must not exceed 5." };
  }

  if (lineup.forwardIds.length > FORMATION_LIMITS.FWD.max) {
    return { valid: false, reason: "Forward count must not exceed 3." };
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

  if (!validatePosition(lineup.defenderIds, "DEF")) {
    return { valid: false, reason: "All defender slots must contain DEF players." };
  }

  if (!validatePosition(lineup.midfielderIds, "MID")) {
    return { valid: false, reason: "All midfielder slots must contain MID players." };
  }

  if (!validatePosition(lineup.forwardIds, "FWD")) {
    return { valid: false, reason: "All forward slots must contain FWD players." };
  }

  return { valid: true };
};
