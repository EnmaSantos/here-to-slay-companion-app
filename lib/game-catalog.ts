import clientCards from "@/lib/catalog-data.json";
import type { Card } from "./generated/Card";

export const SETS = [
  {
    id: "warrior-and-druid",
    name: "Warriors & Druids",
    short: "Warriors + Druids",
    description: "Steel meets the wild.",
    classes: ["warrior", "druid"],
    art: "big-buckley",
  },
  {
    id: "berserkers-and-necromancers",
    name: "Berserkers & Necromancers",
    short: "Berserkers + Necromancers",
    description: "Fury meets dark magic.",
    classes: ["berserker", "necromancer"],
    art: "annihilator",
  },
];

const supported = new Set(["base-game", ...SETS.map((s) => s.id)]);
export const GAME_CARDS = (clientCards as unknown as Card[])
  .filter((c) => c.type !== "rule-card" && c.sets.some((s) => supported.has(s)))
  .map((c) =>
    c.slug === "the-charismatic-song" ? { ...c, classes: ["bard"] } : c,
  );
export const CARD_BY_SLUG = new Map(GAME_CARDS.map((c) => [c.slug, c]));
export function title(value: string) {
  return value.replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
export function inventory(expansions: string[]) {
  return {
    main: 115 + expansions.length * 31,
    monsters: 15 + expansions.length * 2,
    leaders: 6 + expansions.length * 2,
  };
}
