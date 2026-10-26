import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { selectVerifiedCards } from "../lib/verified-catalog.mjs";
import { describeRoll, neutralRollRange } from "../lib/monster-rolls.mjs";

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

test("all 19 monster details reach the client, including class slots and the reversed Dracos rolls", () => {
  const cards = selectVerifiedCards(client, inventory).filter(
    (c) => c.type === "monster",
  );
  assert.equal(cards.length, 19);
  for (const card of cards) {
    assert.ok(card.requirements.length);
    for (const field of [
      "heroRequirement",
      "slayRollRequirement",
      "failureRollRequirement",
      "failurePenalty",
      "passiveAbility",
    ])
      assert.ok(card[field], `${card.slug} missing ${field}`);
    const original = selectVerifiedCards(source, inventory).find(
      (c) => c.slug === card.slug,
    );
    for (const field of [
      "requirements",
      "heroRequirement",
      "slayRollRequirement",
      "failureRollRequirement",
      "failurePenalty",
      "passiveAbility",
    ])
      assert.deepEqual(card[field], original[field]);
  }
  const orthus = cards.find((c) => c.slug === "orthus"),
    dracos = cards.find((c) => c.slug === "dracos");
  assert.deepEqual(orthus.requirements, ["wizard", "any-hero"]);
  assert.equal(describeRoll(orthus.slayRollRequirement), "8 or higher");
  assert.equal(
    neutralRollRange(orthus.slayRollRequirement, orthus.failureRollRequirement),
    "5–7",
  );
  assert.equal(describeRoll(dracos.slayRollRequirement), "5 or lower");
  assert.equal(describeRoll(dracos.failureRollRequirement), "8 or higher");
  assert.equal(dracos.failurePenalty, "SACRIFICE a Hero card");
  assert.equal(
    neutralRollRange(dracos.slayRollRequirement, dracos.failureRollRequirement),
    "6–7",
  );
  assert.throws(
    () =>
      selectVerifiedCards(
        source.map((card) =>
          card.slug === "orthus" ? { ...card, requirements: [] } : card,
        ),
        inventory,
      ),
    /missing monster attack details/,
  );
});

test("adjacent attack ranges have no neutral result; plus/minus mean inclusive thresholds", () => {
  assert.equal(describeRoll("11+"), "11 or higher");
  assert.equal(describeRoll("7-"), "7 or lower");
  assert.equal(neutralRollRange("7+", "6-"), null);
  assert.equal(neutralRollRange("10+", "7-"), "8–9");
  assert.equal(neutralRollRange(null, "7-"), null);
});
