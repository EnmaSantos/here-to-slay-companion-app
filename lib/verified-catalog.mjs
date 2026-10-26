/**
 * The reviewed retail roster is an allowlist, not whatever an upstream API
 * happens to tag as a base/expansion card. Unknown entries never enter a game.
 */
export function selectVerifiedCards(source, inventory) {
  const selected = [];
  const seen = new Set();
  for (const set of inventory.sets) {
    for (const approved of set.cards) {
      if (seen.has(approved.slug))
        throw new Error(`Duplicate reviewed card: ${approved.slug}`);
      seen.add(approved.slug);
      const matches = source.filter((c) => c.slug === approved.slug);
      if (matches.length !== 1)
        throw new Error(`Expected one API record for ${approved.slug}`);
      const card = matches[0];
      const name = card.name.replace(/ \(\d+\)$/, "");
      if (name !== approved.name || card.type !== approved.type)
        throw new Error(`Review changed identity for ${approved.slug}`);
      const releases = card.releases.filter((r) => r.set === set.id);
      if (
        !releases.length ||
        releases.some((r) => r.quantity !== approved.quantity)
      )
        throw new Error(
          `Review changed quantity for ${approved.slug} in ${set.id}`,
        );
      if (!card.sets.includes(set.id))
        throw new Error(`Review changed set for ${approved.slug}`);
      selected.push({
        ...card,
        name: approved.name,
        sets: [set.id],
        releases: [{ ...releases[0], quantity: approved.quantity }],
        classes: card.slug === "the-charismatic-song" ? ["bard"] : card.classes,
      });
    }
  }
  return selected;
}
