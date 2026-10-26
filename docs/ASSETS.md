# Card inventory and artwork audit

Reviewed October 25, 2026.

The [existing read-only API](https://github.com/EnmaSantos/here-to-slay-api) supplies card records and external `imageUrl` links. It does not host the image bytes. The current data snapshot is unchanged in substance from the API's July 13 dataset; it was fetched again for this audit.

## Published retail cards only

Names, types, and copy counts match these three published inventories:

- [Base game inventory](https://www.unstablegameswiki.com/index.php?title=Here_To_Slay_Base_Deck_-_Inventory_List): 95 distinct playable definitions; 115 main cards, 15 monsters, 6 leaders.
- [Warriors & Druids inventory](https://www.unstablegameswiki.com/index.php?title=Here_To_Slay_-_Warrior_and_Druid_Expansion_-_Inventory_List): 35 definitions; 31 main cards, 2 monsters, 2 leaders.
- [Berserkers & Necromancers inventory](https://www.unstablegameswiki.com/index.php?title=Here_To_Slay_Dragon_Berserkers_and_Necromancers_Expansion_-_Inventory_List): 33 definitions; 31 main cards, 2 monsters, 2 leaders.

All 163 included definitions match those inventories. No invented card definitions were found. The unfamiliar portraits in the earlier preview were generated stand-ins; they have been removed from the UI and public assets.

`backend/data/verified-inventory.json` is the reviewed allowlist. Rust and the browser use it, and `sync:catalog` verifies incoming records before writing files. Unreviewed entries are excluded even if the API tags them as a supported set. Missing, duplicated, renamed, retyped, or quantity-changed approved entries stop the sync for review. Reprints and promo releases are excluded from game membership. API record suffixes such as `Modifier +4 (2)` become the printed name `Modifier +4`; the source slug remains unchanged. The Charismatic Song's class is corrected to Bard.

## Actual card images

All 163 reviewed card definitions have actual cached images in `public/cards/`. The cache manifest records the API source URL, exported image URL, content hash, byte count, and dimensions for each card. Images are rendered whole with `object-fit: contain`. The app prefers the local cache, falls back to the API URL if a local image fails, and shows a neutral unavailable state if both fail. Card inspection links to the original API image.

Direct requests initially returned 403. The ordinary in-app browser subsequently completed the wiki's automatic verification and displayed its file pages normally. Their observed image assets were exported using the browser's supported asset bundling capability, then imported by `scripts/sync-card-art.mjs`. No CAPTCHA was solved, no security check was bypassed, and no browser cookies or credentials were extracted. All cached cards have at least 300px width; two large expansion monster images are the wiki's 694px preview derivatives of the exact API source file. Other files are the observed original images. No composition or card text was edited. Some Party Leaders use the official 2025 playmat artwork selected by the API, rather than the original base printing; these are alternate illustrations of the same published leader, not extra card definitions.

The reusable script supports direct missing-file downloads, manually saved images (`--from`), and browser asset export manifests (`--manifest`). It never saves HTML/security-check responses as image files. `npm run test:art` checks coverage, source identity, image format, file name, byte length, and SHA-256 for every card. New blocked requests stop further downloads to that host. Existing valid files remain usable offline.

Generated stand-in portraits and their source-art feature flag have been removed. Original game text/artwork remains owned by Unstable Games; the API's software license does not license the game content. Individual wiki references remain in the raw source snapshot.

## Sound

The optional interface chime is synthesized in Web Audio. No third-party recording is bundled.

Planned CC0 sources, not yet downloaded or bundled:

- https://kenney.nl/assets/casino-audio
- https://kenney.nl/assets/rpg-audio
- https://kenney.nl/assets/impact-sounds
- https://opengameart.org/content/fantasy-0 — Fantasy by Boogey999
