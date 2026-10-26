import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalImageUrl, inspectCardImage } from "../lib/card-art-cache.mjs";

test("security-check HTML and incomplete image responses are rejected", () => {
  assert.throws(
    () =>
      inspectCardImage(
        Buffer.from(
          "<html><h1>Just a moment... security verification</h1></html>",
        ),
      ),
    /Not a supported image/,
  );
  assert.throws(() => inspectCardImage(Buffer.alloc(8)), /truncated/);
  const broken = Buffer.alloc(40);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(broken);
  assert.throws(() => inspectCardImage(broken), /Invalid or incomplete PNG/);
});

test("browser-exported image variants must resolve to the exact API image", () => {
  assert.equal(
    canonicalImageUrl(
      "https://www.unstablegameswiki.com/images/thumb/b/b7/HtS-Base-034-2E.png/428px-HtS-Base-034-2E.png?20240324",
    ),
    "https://www.unstablegameswiki.com/images/b/b7/HtS-Base-034-2E.png",
  );
  assert.throws(
    () => canonicalImageUrl("https://example.com/card.png"),
    /Unapproved/,
  );
  assert.throws(
    () =>
      canonicalImageUrl(
        "https://www.unstablegameswiki.com/index.php?title=File:Card.png",
      ),
    /Unapproved/,
  );
});

test("the saved Bad Axe asset is an actual complete card image", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../lib/card-art-manifest.json", import.meta.url),
      "utf8",
    ),
  );
  const bytes = await readFile(
    new URL(`../public${manifest.cards["bad-axe"].src}`, import.meta.url),
  );
  const info = inspectCardImage(bytes);
  assert.equal(info.format, "png");
  assert.ok(info.width >= 400 && info.height >= 550);
});
