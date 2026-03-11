const LEAGUE_ADJECTIVES = [
  "Weekend",
  "Golden",
  "Prime",
  "Lucky",
  "Sharp",
  "Rising",
  "Electric",
  "Brave",
  "Urban",
  "Royal",
  "Elite",
  "Epic",
  "Legendary",
  "Turbo",
  "Midnight",
  "Iron",
  "Velocity",
  "Dynamic"
];

const LEAGUE_NOUNS = [
  "Garuda",
  "Warriors",
  "Titans",
  "Voyagers",
  "Raiders",
  "Challengers",
  "United",
  "Collective",
  "Alliance",
  "Circle",
  "Dynasty",
  "Legion",
  "Empire",
  "Squad",
  "League",
  "Division",
  "Council"
];

const FOOTBALL_TERMS = [
  "Kickoff",
  "Final",
  "Extra Time",
  "Derby",
  "Matchday",
  "Super League",
  "Champions",
  "Premier",
  "Ultra League"
];

const SQUAD_ADJECTIVES = [
  "Rapid",
  "Solid",
  "Fearless",
  "Storm",
  "Red",
  "Blue",
  "Steady",
  "Bold",
  "Wild",
  "Iron",
  "Savage",
  "Turbo",
  "Silent",
  "Shadow",
  "Electric",
  "Phantom"
];

const SQUAD_NOUNS = [
  "Eagles",
  "Phoenix",
  "Lions",
  "Comets",
  "Falcons",
  "Sharks",
  "Rockets",
  "Tigers",
  "Panthers",
  "Dragons",
  "Wolves",
  "Cobras",
  "Spartans",
  "Guardians",
  "Knights"
];

const CONNECTORS = [
  "FC",
  "Club",
  "Squad",
  "Crew",
  "XI"
];

const pick = (items: string[]): string =>
  items[Math.floor(Math.random() * items.length)] ?? items[0] ?? "Fantasy";

const suffix = (): string =>
  String(Math.floor(Math.random() * 90) + 10);

const maybe = (chance = 0.5): boolean =>
  Math.random() < chance;

export const createGeneratedCustomLeagueName = (): string => {
  const style = Math.floor(Math.random() * 3);

  switch (style) {
    case 0:
      return `${pick(LEAGUE_ADJECTIVES)} ${pick(LEAGUE_NOUNS)} ${suffix()}`;
    case 1:
      return `${pick(LEAGUE_ADJECTIVES)} ${pick(FOOTBALL_TERMS)}`;
    case 2:
      return `${pick(LEAGUE_NOUNS)} ${pick(FOOTBALL_TERMS)} ${suffix()}`;
    default:
      return `${pick(LEAGUE_ADJECTIVES)} ${pick(LEAGUE_NOUNS)}`;
  }
};

export const createGeneratedSquadName = (): string => {
  const base = `${pick(SQUAD_ADJECTIVES)} ${pick(SQUAD_NOUNS)}`;

  if (maybe(0.4)) {
    return `${base} ${pick(CONNECTORS)}`;
  }

  if (maybe(0.5)) {
    return `${base} ${suffix()}`;
  }

  return base;
};
