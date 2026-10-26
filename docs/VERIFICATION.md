# Milestone verification

Checked locally on October 25, 2026. This verifies the room-to-table foundation, not the unimplemented card-resolution engine.

## Automated checks

- Rust engine: 16 passing tests, including generated-contract exports. Scenarios cover exact inventories, nested/repeated and independent tie groups, leader selection, last-picker-first, private hands, authorization, stale revisions, command idempotency, and setting limits.
- Rust formatting and Clippy with warnings denied: pass.
- TypeScript typecheck: pass.
- Production frontend build and an HTTP render through the actual local Worker runtime: pass. The page renders the room form without the old starter skeleton or private state.
- Live API: three passing tests covering two-player and six-player flows plus concurrent independent room creation. Both expansions are enabled; dealing leaves exactly `177 - (5 × players)` main cards and 16 unrevealed monsters.

## Browser checks

Two browser clients created/joined a room, readied, rolled, selected distinct leaders, and reached the same table through WebSocket updates. Each received its own five-card hand. Refresh restored the host's seat and hand. Direct and frontend-proxied WebSocket connections returned authenticated personalized snapshots.

The phone layout was checked at 390 × 844, including all three monsters, the turn clock, private hand, and the card library. A library search for “Gnawing” returned The Gnawing Dread; inspection displayed its once-per-turn, 2 AP recovery text. Native dialog closing returned to the table. The responsive check caught and fixed an intrinsic grid-width issue.

![Dealt table](preview-table.png)

![Phone table](preview-mobile.png)

## Remaining limits

No public deployment or Supabase persistence connection was tested. Development uses ignored local snapshots; no cloud schema or project settings were changed. Native Rust requires its own reachable service for remote multiplayer.

Card plays, reactions, abilities, combat, and victory resolution are not implemented. Disconnect pauses, exact remaining-time recovery after server restart, guest recovery, retention, and public-service rate limiting remain on the roadmap. Artwork uses labeled original placeholders because source image URLs returned 403. Music and third-party sound packs are not bundled yet.
