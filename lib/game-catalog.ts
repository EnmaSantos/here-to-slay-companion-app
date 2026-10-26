import clientCards from "@/lib/catalog-data.json";
import verifiedInventory from "@/backend/data/verified-inventory.json";
import { selectVerifiedCards } from "./verified-catalog.mjs";
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

export const CARD_SETS = verifiedInventory.sets.map(
  ({ id, name, sourceUrl }) => ({ id, name, sourceUrl }),
);
export const GAME_CARDS = selectVerifiedCards(
  clientCards,
  verifiedInventory,
) as Card[];
export const CARD_BY_SLUG = new Map(GAME_CARDS.map((c) => [c.slug, c]));
export function cardSetName(card: Card) {
  return (
    CARD_SETS.find((s) => card.sets.includes(s.id))?.name ?? "Here to Slay"
  );
}
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
