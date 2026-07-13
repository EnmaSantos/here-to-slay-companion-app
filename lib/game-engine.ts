export const HERO_CLASSES = [
  "bard",
  "berserker",
  "druid",
  "fighter",
  "guardian",
  "necromancer",
  "ranger",
  "sorcerer",
  "thief",
  "warrior",
  "wizard",
] as const;

export type HeroClass = (typeof HERO_CLASSES)[number];

export type EnginePlayer = {
  id: string;
  leaderClass: HeroClass | null;
  heroClassCounts: Partial<Record<HeroClass, number>>;
  monstersSlain: number;
};

export type VictorySettings = {
  classVictoryTarget: number;
  monsterVictoryTarget: number;
};

export function getUniqueClasses(player: EnginePlayer): HeroClass[] {
  const classes = HERO_CLASSES.filter(
    (heroClass) => (player.heroClassCounts[heroClass] ?? 0) > 0,
  );

  if (player.leaderClass) classes.push(player.leaderClass);
  return [...new Set(classes)];
}

export function hasPlayerWon(
  player: EnginePlayer,
  settings: VictorySettings,
): boolean {
  return (
    getUniqueClasses(player).length >= settings.classVictoryTarget ||
    player.monstersSlain >= settings.monsterVictoryTarget
  );
}

export function canSpendActionPoints(
  available: number,
  amount: number,
): boolean {
  return amount >= 0 && available >= amount;
}

export function getNextPlayerId(
  players: Array<{ id: string }>,
  currentPlayerId: string | null,
): string | null {
  if (players.length === 0) return null;
  const currentIndex = players.findIndex(
    (player) => player.id === currentPlayerId,
  );
  return players[(currentIndex + 1 + players.length) % players.length].id;
}

export function updateNonNegativeCount(current: number, delta: number): number {
  return Math.max(0, current + delta);
}

export function formatClassName(heroClass: string): string {
  return heroClass
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
