import { readFile, writeFile } from "node:fs/promises";
import { selectVerifiedCards } from "../lib/verified-catalog.mjs";
const source =
  "https://bslsfzvnanjzjrgyvrdj.supabase.co/functions/v1/cards-api";
const sets = ["base-game", "warrior-and-druid", "berserkers-and-necromancers"];
const inventory = JSON.parse(
  await readFile(
    new URL("../backend/data/verified-inventory.json", import.meta.url),
    "utf8",
  ),
);
const cards = [];
for (let offset = 0; ; offset += 100) {
  const response = await fetch(
    `${source}/api/v1/cards?limit=100&offset=${offset}`,
  );
  if (!response.ok) throw new Error(`Catalog API returned ${response.status}`);
  const page = await response.json();
  if (!Array.isArray(page.data)) throw new Error("Invalid card API response");
  cards.push(...page.data);
  if (!page.pagination.hasMore) break;
}
const supported = selectVerifiedCards(cards, inventory);
for (const set of sets) {
  const expected = set === "base-game" ? 115 : 31;
  const quantity = supported
    .filter((c) =>
      ["hero", "item", "magic", "modifier", "challenge"].includes(c.type),
    )
    .reduce(
      (n, c) => n + (c.releases.find((r) => r.set === set)?.quantity ?? 0),
      0,
    );
  if (quantity !== expected)
    throw new Error(
      `${set} has ${quantity} main cards, expected ${expected}. Review the source before replacing the pinned snapshot.`,
    );
}
const fields = [
  "slug",
  "name",
  "type",
  "sets",
  "classes",
  "effect",
  "imageUrl",
  "rollRequirement",
  "rules",
  "releases",
];
const client = supported.map((card) =>
  Object.fromEntries(
    fields.map((key) => [key, card[key] ?? (key === "rules" ? [] : null)]),
  ),
);
await writeFile(
  new URL("../backend/data/catalog.json", import.meta.url),
  JSON.stringify({ source, cards }, null, 2) + "\n",
);
await writeFile(
  new URL("../lib/catalog-data.json", import.meta.url),
  JSON.stringify(client) + "\n",
);
console.log(
  `Pinned ${cards.length} source records; ${client.length} game card definitions. Run npm run test:engine before committing.`,
);
