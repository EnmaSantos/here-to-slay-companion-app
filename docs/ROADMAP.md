# Here to Slay Online

## Milestone 1 — room to table (implemented)

- React interface: room creation/joining, card library, expandable rules, private table, card inspection, dice, leader draft, private hands.
- Rust/Axum: server-owned rooms, guest seat tokens, validated commands, revision checks, idempotency, authenticated WebSockets, durable snapshots, turn deadlines.
- Exact inventories: base 115/15/6; either expansion 146/17/8; both 177/19/10 (main deck/monsters/leaders).
- Draft: roll two dice, rank descending, resolve nested ties within the original group, choose unique leaders. Last picker starts; turns follow original seating order. The Shadow Claw is unavailable in two-player games.
- Actions: draw for 1 AP, discard hand/draw five for 3 AP, end turn. The server passes the turn at the deadline. No client-supplied dice or deck order.
- Standard (default): 120-second turns, 10-second challenges, 10-second modifiers. Quick: 60/10/5. Reaction windows are configured and displayed but not yet executed in this milestone.
- Optional SQLx/Postgres storage, including a private schema. Without DATABASE_URL, local JSON snapshots make development work without cloud credentials.

## Milestone 2 — fully playable card engine (not yet implemented)

- Stage Hero/Item/Magic plays, debit AP, offer one challenge; only show Challenge for an eligible card actually in that guest's hand.
- Global challenge opportunity: maximum 10 seconds, automatic pass on expiry, early resolution after everyone passes. Both challenge participants roll 2d6; ties favor the challenger.
- Modifier opportunities: begin after dice and relevant targets are visible; Quick 5 seconds, Standard 10. Each valid modifier resets the response window/pass state. Pause and resume the turn budget across reaction phases.
- Durable pending decisions, disconnect pauses, no automatic forfeits, and restoring remaining time without granting extra time on process restart.
- Reviewed deterministic handlers for every included card; no natural-language interpretation during play. Optional Hero activation on entering play, activation limits, triggered effects, class Masks, protections, and item movement.
- Marked Warriors/Berserkers can carry two items, with at most one Mask. Druid low-roll success. Necromancer up-front costs. Gnawing Dread once per own turn, 2 AP; Raging Manticore draws two after its owner slays.
- Monster requirements, distinct requirement slots, attack/failure/success, permanent slain-monster abilities, replenishment, and victory after resolution. Class victory only at end of own turn; leaders represent a class but are not Heroes.
- Host target minimums 6 classes/3 monsters; reachable upper bounds; settings locked after the lobby. Document the printed expansion class target of seven alongside custom targets.

## Milestone 3 — animation and release

- Event-driven card plays, targeting, dice, spell trails, impacts, and monster defeat; reduced motion and lower mobile particle quality.
- CC0 audio from Kenney (Casino, RPG, Impact packs) and the chosen OpenGameArt fantasy music; separate music and effects controls. Current preview uses a small synthesized interface chime only.
- Verified card artwork availability; preserve original attribution. The source wiki currently returns HTTP 403 to image requests. Fallback portraits must be identified as original placeholder art, never passed off as the official card face.
- Guest recovery/device transfer, room cleanup/retention, rate limiting before a public backend release, deployment health probes, and production privacy review.
- Deploy Rust as a separate native service/container, configure the Sites frontend with its HTTPS origin, connect Supabase Postgres, then test real remote devices. Do not present a frontend without a reachable Rust service as working online multiplayer.

## Product boundaries

Private friend rooms, 2–6 players, computers/tablets/phones. Base + Warriors & Druids + Berserkers & Necromancers only. No public matchmaking, bots, or full 3D arena in v1. Existing read-only card API stays compatible. Room names, private hands and deck order never appear in public catalog responses.
