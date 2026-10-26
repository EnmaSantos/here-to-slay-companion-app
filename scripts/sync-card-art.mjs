import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, rename, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { canonicalImageUrl, inspectCardImage } from "../lib/card-art-cache.mjs";
import { selectVerifiedCards } from "../lib/verified-catalog.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const readJson = async (name) =>
  JSON.parse(await readFile(path.resolve(root, name), "utf8"));
const catalog = selectVerifiedCards(
  (await readJson("backend/data/catalog.json")).cards,
  await readJson("backend/data/verified-inventory.json"),
);
const manifest = await readJson("lib/card-art-manifest.json");
const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  if (at < 0) return null;
  if (!args[at + 1] || args[at + 1].startsWith("--"))
    throw new Error(`Supply a path after ${name}`);
  return path.resolve(args[at + 1]);
};
const from = option("--from"),
  exported = option("--manifest"),
  check = args.includes("--check");
if (args.includes("--help")) {
  console.log(
    "npm run sync:art                  Download missing API images\nnpm run sync:art -- --from DIR     Import manually saved images by card slug or API image filename\nnpm run sync:art -- --manifest FILE Import a browser pageAssets export manifest\nnpm run sync:art -- --check        Verify every cached image and checksum",
  );
  process.exit(0);
}
if ([!!from, !!exported, check].filter(Boolean).length > 1)
  throw new Error("Choose one import/check mode");
const exportedAssets = exported ? (await readJson(exported)).assets : [];
const bySource = new Map();
for (const asset of exportedAssets) {
  try {
    bySource.set(canonicalImageUrl(asset.url), asset);
  } catch {
    /* Ignore unrelated page icons/assets. */
  }
}
const report = { saved: [], verified: [], missing: [], errors: [] };
const obsolete = new Set();
const blockedHosts = new Set();
await mkdir(path.join(root, "public/cards"), { recursive: true });
for (const card of catalog) {
  const entry = manifest.cards[card.slug];
  if (entry && ((!from && !exported) || check)) {
    try {
      if (
        !/^\/cards\/[a-z0-9-]+\.(png|jpg|webp)$/.test(entry.src) ||
        canonicalImageUrl(entry.sourceUrl) !==
          canonicalImageUrl(card.imageUrl) ||
        canonicalImageUrl(entry.assetUrl) !== canonicalImageUrl(card.imageUrl)
      )
        throw new Error("Cache entry does not match the API card");
      const bytes = await readFile(path.join(root, "public", entry.src));
      const info = inspectCardImage(bytes);
      const hash = createHash("sha256").update(bytes).digest("hex");
      if (
        hash !== entry.sha256 ||
        entry.bytes !== bytes.length ||
        entry.src !== `/cards/${card.slug}-${hash.slice(0, 12)}.${info.format}`
      )
        throw new Error("Cached image checksum differs");
      report.verified.push(card.slug);
      continue;
    } catch (error) {
      if (check) {
        report.errors.push({ slug: card.slug, error: error.message });
        continue;
      }
    }
  }
  if (check) {
    report.missing.push(card.slug);
    continue;
  }
  try {
    let bytes,
      assetUrl = card.imageUrl;
    if (from) {
      const filename = decodeURIComponent(
        new URL(card.imageUrl).pathname.split("/").at(-1),
      );
      for (const name of [
        `${card.slug}.png`,
        `${card.slug}.jpg`,
        `${card.slug}.jpeg`,
        `${card.slug}.webp`,
        filename,
      ]) {
        try {
          bytes = await readFile(path.join(from, name));
          break;
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
      if (!bytes) {
        if (!entry) report.missing.push(card.slug);
        continue;
      }
    } else if (exported) {
      const asset = bySource.get(canonicalImageUrl(card.imageUrl));
      if (!asset) {
        if (!entry) report.missing.push(card.slug);
        continue;
      }
      bytes = await readFile(asset.path);
      assetUrl = asset.url;
    } else {
      const host = new URL(card.imageUrl).host;
      canonicalImageUrl(card.imageUrl);
      if (blockedHosts.has(host)) {
        report.missing.push(card.slug);
        continue;
      }
      const response = await fetch(card.imageUrl, {
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      });
      if ([401, 403, 429].includes(response.status)) {
        blockedHosts.add(host);
        throw new Error(
          `Image host returned ${response.status}. Stopped requests to this host; use a manual/browser export import.`,
        );
      }
      if (!response.ok)
        throw new Error(`Image host returned ${response.status}`);
      if (!/^image\//.test(response.headers.get("content-type") ?? "")) {
        blockedHosts.add(host);
        throw new Error(
          "Response is not an image; security-check pages are not cached",
        );
      }
      const reader = response.body.getReader();
      let size = 0;
      const chunks = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 16 * 1024 * 1024) {
          await reader.cancel();
          throw new Error("Image exceeds 16 MB");
        }
        chunks.push(value);
      }
      bytes = Buffer.concat(chunks);
    }
    const info = inspectCardImage(bytes),
      sha256 = createHash("sha256").update(bytes).digest("hex");
    const src = `/cards/${card.slug}-${sha256.slice(0, 12)}.${info.format}`;
    const target = path.join(root, "public", src);
    await writeFile(target + ".tmp", bytes);
    await rename(target + ".tmp", target);
    manifest.cards[card.slug] = {
      src,
      sourceUrl: card.imageUrl,
      assetUrl,
      sha256,
      bytes: bytes.length,
      ...info,
    };
    if (
      entry &&
      entry.src !== src &&
      entry.src.startsWith(`/cards/${card.slug}-`) &&
      /^\/cards\/[a-z0-9-]+\.(png|jpg|webp)$/.test(entry.src)
    )
      obsolete.add(path.join(root, "public", entry.src));
    report.saved.push(card.slug);
  } catch (error) {
    report.errors.push({ slug: card.slug, error: error.message });
  }
}
await mkdir(path.join(root, "work"), { recursive: true });
await writeFile(
  path.join(root, "work/card-art-report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
if (!check) {
  const sorted = Object.fromEntries(
    Object.entries(manifest.cards).sort(([a], [b]) => a.localeCompare(b)),
  );
  await writeFile(
    path.join(root, "lib/card-art-manifest.json.tmp"),
    JSON.stringify({ cards: sorted }, null, 2) + "\n",
  );
  await rename(
    path.join(root, "lib/card-art-manifest.json.tmp"),
    path.join(root, "lib/card-art-manifest.json"),
  );
  for (const oldFile of obsolete) await rm(oldFile, { force: true });
}
console.log(
  `Card art: ${report.saved.length} saved, ${report.verified.length} verified, ${report.missing.length} missing, ${report.errors.length} errors. Details: work/card-art-report.json`,
);
for (const error of report.errors)
  console.error(`${error.slug}: ${error.error}`);
if (
  (check && (report.missing.length || report.errors.length)) ||
  report.errors.length
)
  process.exitCode = 1;
