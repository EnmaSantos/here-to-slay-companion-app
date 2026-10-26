import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { selectVerifiedCards } from "../lib/verified-catalog.mjs";

const read = async (path) =>
  JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const inventory = await read("../backend/data/verified-inventory.json");
const source = (await read("../backend/data/catalog.json")).cards;
const client = await read("../lib/catalog-data.json");

test("reviewed API and browser catalogs agree on every retail card and physical copy count", () => {
  const cards = selectVerifiedCards(source, inventory);
  const browser = selectVerifiedCards(client, inventory);
  assert.equal(cards.length, 163);
  assert.equal(browser.length, 163);
  assert.deepEqual(
    cards.map((c) => c.slug),
    browser.map((c) => c.slug),
  );
  for (const [set, main, monsters, leaders] of [
    ["base-game", 115, 15, 6],
    ["warrior-and-druid", 31, 2, 2],
    ["berserkers-and-necromancers", 31, 2, 2],
  ]) {
    const list = cards.filter((c) => c.sets.includes(set));
    const count = (type) =>
      list
        .filter((c) =>
          type === "main"
            ? !["monster", "party-leader"].includes(c.type)
            : c.type === type,
        )
        .reduce((n, c) => n + c.releases[0].quantity, 0);
    assert.deepEqual(
      [count("main"), count("monster"), count("party-leader")],
      [main, monsters, leaders],
    );
  }
  for (const card of cards) {
    assert.equal(card.sets.length, 1);
    assert.equal(card.releases.length, 1);
    assert.equal(
      card.imageUrl,
      source.find((c) => c.slug === card.slug).imageUrl,
    );
    assert.ok(
      card.imageUrl?.startsWith("https://www.unstablegameswiki.com/images/"),
    );
    assert.ok(!/ \(\d+\)$/.test(card.name));
  }
});

test("upstream fan cards, promos, and unreviewed set additions do not enter the game", () => {
  const fake = {
    ...source.find((c) => c.slug === "bad-axe"),
    slug: "invented-hero",
    name: "Invented Hero",
  };
  const cards = selectVerifiedCards([...source, fake], inventory);
  assert.equal(cards.length, 163);
  assert.ok(
    !cards.some(
      (c) =>
        c.slug === "invented-hero" ||
        c.sets.some((s) => /promo|kickstarter|banner/.test(s)),
    ),
  );
});

test("missing, duplicated, renamed, or quantity-changed reviewed cards stop a catalog update", () => {
  const card = source.find((c) => c.slug === "bad-axe");
  assert.throws(
    () =>
      selectVerifiedCards(
        source.filter((c) => c !== card),
        inventory,
      ),
    /Expected one API record/,
  );
  assert.throws(
    () => selectVerifiedCards([...source, card], inventory),
    /Expected one API record/,
  );
  for (const replacement of [
    { ...card, name: "Invented Hero" },
    { ...card, type: "monster" },
    { ...card, releases: card.releases.map((r) => ({ ...r, quantity: 99 })) },
  ]) {
    assert.throws(
      () =>
        selectVerifiedCards(
          source.map((c) => (c === card ? replacement : c)),
          inventory,
        ),
      /Review changed/,
    );
  }
});
