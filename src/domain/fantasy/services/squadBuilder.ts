import type { Player } from "../entities/Player";
import type { TeamLineup } from "../entities/Team";

const AUTO_SQUAD_SIZE = 11;
const BENCH_SIZE = 5;
const MAX_PLAYERS_PER_TEAM = 3;
const BUDGET_CAP = 100;

type Formation = {
  DEF: number;
  MID: number;
  FWD: number;
};

const STARTER_FORMATIONS: Formation[] = [];

for (let defender = 2; defender <= 5; defender += 1) {
  for (let midfielder = 2; midfielder <= 5; midfielder += 1) {
    for (let forward = 1; forward <= 3; forward += 1) {
      if (defender + midfielder + forward === 10) {
        STARTER_FORMATIONS.push({
          DEF: defender,
          MID: midfielder,
          FWD: forward
        });
      }
    }
  }
}

const AUTO_SQUAD_FORMATIONS: Formation[] = [];

for (let defender = 3; defender <= 5; defender += 1) {
  for (let midfielder = 3; midfielder <= 5; midfielder += 1) {
    for (let forward = 1; forward <= 3; forward += 1) {
      if (defender + midfielder + forward === 10) {
        AUTO_SQUAD_FORMATIONS.push({
          DEF: defender,
          MID: midfielder,
          FWD: forward
        });
      }
    }
  }
}

const byProjectedThenPrice = (left: Player, right: Player): number => {
  if (left.projectedPoints !== right.projectedPoints) {
    return right.projectedPoints - left.projectedPoints;
  }

  if (left.form !== right.form) {
    return right.form - left.form;
  }

  if (left.price !== right.price) {
    return left.price - right.price;
  }

  return left.id.localeCompare(right.id);
};

const byValueThenProjected = (left: Player, right: Player): number => {
  const leftValue = left.projectedPoints / Math.max(left.price, 0.1);
  const rightValue = right.projectedPoints / Math.max(right.price, 0.1);
  if (leftValue !== rightValue) {
    return rightValue - leftValue;
  }

  return byProjectedThenPrice(left, right);
};

const sortWithPreference = (
  players: Player[],
  preferredIds: string[],
  fallbackSort: (left: Player, right: Player) => number
): Player[] => {
  const order = new Map<string, number>();
  preferredIds.forEach((id, index) => {
    order.set(id, index);
  });

  return [...players].sort((left, right) => {
    const leftOrder = order.get(left.id);
    const rightOrder = order.get(right.id);

    if (leftOrder !== undefined && rightOrder !== undefined) {
      return leftOrder - rightOrder;
    }

    if (leftOrder !== undefined) {
      return -1;
    }

    if (rightOrder !== undefined) {
      return 1;
    }

    return fallbackSort(left, right);
  });
};

const pickFirstAvailable = (
  pool: Player[],
  count: number,
  used: Set<string>
): Player[] | null => {
  const picked: Player[] = [];

  for (const player of pool) {
    if (used.has(player.id)) {
      continue;
    }

    picked.push(player);
    if (picked.length === count) {
      return picked;
    }
  }

  return null;
};

const selectStartingOutfield = (
  players: Player[],
  used: Set<string>,
  preferredStarterIds: string[]
): {
  defenders: Player[];
  midfielders: Player[];
  forwards: Player[];
} | null => {
  const defenders = sortWithPreference(
    players.filter((player) => player.position === "DEF"),
    preferredStarterIds,
    byProjectedThenPrice
  );
  const midfielders = sortWithPreference(
    players.filter((player) => player.position === "MID"),
    preferredStarterIds,
    byProjectedThenPrice
  );
  const forwards = sortWithPreference(
    players.filter((player) => player.position === "FWD"),
    preferredStarterIds,
    byProjectedThenPrice
  );

  let best:
    | {
        defenders: Player[];
        midfielders: Player[];
        forwards: Player[];
        score: number;
      }
    | null = null;

  for (const formation of STARTER_FORMATIONS) {
    const selectedDefenders = pickFirstAvailable(defenders, formation.DEF, used);
    const selectedMidfielders = pickFirstAvailable(midfielders, formation.MID, used);
    const selectedForwards = pickFirstAvailable(forwards, formation.FWD, used);

    if (!selectedDefenders || !selectedMidfielders || !selectedForwards) {
      continue;
    }

    const score = [...selectedDefenders, ...selectedMidfielders, ...selectedForwards].reduce(
      (sum, player) => sum + player.projectedPoints,
      0
    );

    if (!best || score > best.score) {
      best = {
        defenders: selectedDefenders,
        midfielders: selectedMidfielders,
        forwards: selectedForwards,
        score
      };
    }
  }

  if (!best) {
    return null;
  }

  return {
    defenders: best.defenders,
    midfielders: best.midfielders,
    forwards: best.forwards
  };
};

export const buildLineupFromPlayers = (
  leagueId: string,
  players: Player[],
  preferredStarterIds: string[] = []
): TeamLineup => {
  const orderedGoalkeepers = sortWithPreference(
    players.filter((player) => player.position === "GK"),
    preferredStarterIds,
    byProjectedThenPrice
  );

  const goalkeeper = orderedGoalkeepers[0];
  if (!goalkeeper) {
    throw new Error("Cannot build lineup without at least one goalkeeper.");
  }

  const used = new Set<string>([goalkeeper.id]);
  const outfield = selectStartingOutfield(players, used, preferredStarterIds);

  if (!outfield) {
    throw new Error("Cannot build a valid starting formation from available players.");
  }

  outfield.defenders.forEach((player) => used.add(player.id));
  outfield.midfielders.forEach((player) => used.add(player.id));
  outfield.forwards.forEach((player) => used.add(player.id));

  const bench = sortWithPreference(
    players.filter((player) => !used.has(player.id)),
    preferredStarterIds,
    byProjectedThenPrice
  )
    .slice(0, BENCH_SIZE)
    .map((player) => player.id);

  const starters = [
    goalkeeper,
    ...outfield.defenders,
    ...outfield.midfielders,
    ...outfield.forwards
  ];
  const captainCandidates = [...starters].sort(byProjectedThenPrice);
  const captainId = captainCandidates[0]?.id ?? "";
  const viceCaptainId = captainCandidates[1]?.id ?? "";

  return {
    leagueId,
    goalkeeperId: goalkeeper.id,
    defenderIds: outfield.defenders.map((player) => player.id),
    midfielderIds: outfield.midfielders.map((player) => player.id),
    forwardIds: outfield.forwards.map((player) => player.id),
    substituteIds: bench,
    captainId,
    viceCaptainId,
    updatedAt: new Date().toISOString()
  };
};

const canPick = (
  player: Player,
  selectedById: Set<string>,
  selectedByTeam: Map<string, number>,
  totalBudget: number,
  enforceBudget: boolean
): boolean => {
  if (selectedById.has(player.id)) {
    return false;
  }

  if ((selectedByTeam.get(player.club) ?? 0) >= MAX_PLAYERS_PER_TEAM) {
    return false;
  }

  if (enforceBudget && totalBudget + player.price > BUDGET_CAP) {
    return false;
  }

  return true;
};

const tryBuildAutoSquad = (
  players: Player[],
  comparator: (left: Player, right: Player) => number,
  enforceBudget: boolean
): string[] | null => {
  const selected: Player[] = [];
  const selectedById = new Set<string>();
  const selectedByTeam = new Map<string, number>();
  let totalBudget = 0;

  const sortedByPosition: Record<Player["position"], Player[]> = {
    GK: [...players.filter((player) => player.position === "GK")].sort(comparator),
    DEF: [...players.filter((player) => player.position === "DEF")].sort(comparator),
    MID: [...players.filter((player) => player.position === "MID")].sort(comparator),
    FWD: [...players.filter((player) => player.position === "FWD")].sort(comparator)
  };

  const sortedAll = [...players].sort(comparator);

  const addPlayer = (player: Player): void => {
    selected.push(player);
    selectedById.add(player.id);
    selectedByTeam.set(player.club, (selectedByTeam.get(player.club) ?? 0) + 1);
    totalBudget += player.price;
  };

  const pickFromPool = (pool: Player[], count: number): boolean => {
    let picked = 0;
    for (const player of pool) {
      if (!canPick(player, selectedById, selectedByTeam, totalBudget, enforceBudget)) {
        continue;
      }

      addPlayer(player);
      picked += 1;
      if (picked === count) {
        return true;
      }
    }

    return false;
  };

  if (!pickFromPool(sortedByPosition.GK, 1)) {
    return null;
  }

  let formationApplied = false;
  for (const formation of AUTO_SQUAD_FORMATIONS) {
    const checkpointSelected = [...selected];
    const checkpointById = new Set(selectedById);
    const checkpointByTeam = new Map(selectedByTeam);
    const checkpointBudget = totalBudget;

    if (
      pickFromPool(sortedByPosition.DEF, formation.DEF) &&
      pickFromPool(sortedByPosition.MID, formation.MID) &&
      pickFromPool(sortedByPosition.FWD, formation.FWD)
    ) {
      formationApplied = true;
      break;
    }

    selected.length = 0;
    checkpointSelected.forEach((player) => selected.push(player));

    selectedById.clear();
    checkpointById.forEach((id) => selectedById.add(id));

    selectedByTeam.clear();
    checkpointByTeam.forEach((count, club) => selectedByTeam.set(club, count));

    totalBudget = checkpointBudget;
  }

  if (!formationApplied) {
    return null;
  }

  for (const player of sortedAll) {
    if (selected.length === AUTO_SQUAD_SIZE) {
      break;
    }

    if (!canPick(player, selectedById, selectedByTeam, totalBudget, enforceBudget)) {
      continue;
    }

    addPlayer(player);
  }

  if (selected.length !== AUTO_SQUAD_SIZE) {
    return null;
  }

  const positionCount = selected.reduce<Record<Player["position"], number>>(
    (count, player) => {
      count[player.position] += 1;
      return count;
    },
    { GK: 0, DEF: 0, MID: 0, FWD: 0 }
  );

  if (positionCount.GK < 1 || positionCount.DEF < 3 || positionCount.MID < 3 || positionCount.FWD < 1) {
    return null;
  }

  if (enforceBudget && totalBudget > BUDGET_CAP) {
    return null;
  }

  return selected.map((player) => player.id);
};

export const pickAutoSquadPlayerIds = (players: Player[]): string[] => {
  const attempts = [
    { comparator: byProjectedThenPrice, enforceBudget: true },
    { comparator: byValueThenProjected, enforceBudget: true },
    { comparator: byProjectedThenPrice, enforceBudget: false }
  ];

  for (const attempt of attempts) {
    const selected = tryBuildAutoSquad(players, attempt.comparator, attempt.enforceBudget);
    if (selected) {
      return selected;
    }
  }

  throw new Error("Unable to auto-pick a valid squad from available players.");
};
