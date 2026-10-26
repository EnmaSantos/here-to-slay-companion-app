export function canonicalImageUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !["www.unstablegameswiki.com", "unstablegameswiki.com"].includes(
      url.hostname,
    )
  )
    throw new Error("Unapproved image source");
  url.hostname = "www.unstablegameswiki.com";
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname
    .replace("/images/thumb/", "/images/")
    .replace(/\/\d+px-[^/]+$/, "");
  if (
    !/^\/images\/[a-f0-9]\/[a-f0-9]{2}\/[^/]+\.(png|jpe?g|webp)$/i.test(
      url.pathname,
    )
  )
    throw new Error("Unapproved image path");
  return url.href;
}

export function inspectCardImage(bytes) {
  if (bytes.length < 24 || bytes.length > 16 * 1024 * 1024)
    throw new Error("Image is empty, truncated, or larger than 16 MB");
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    const width = bytes.readUInt32BE(16),
      height = bytes.readUInt32BE(20);
    if (
      bytes.toString("ascii", 12, 16) !== "IHDR" ||
      !width ||
      !height ||
      width * height > 40_000_000 ||
      bytes.toString("ascii", bytes.length - 8, bytes.length - 4) !== "IEND"
    )
      throw new Error("Invalid or incomplete PNG");
    if (width < 300 || height < 400)
      throw new Error(
        "Image is a small thumbnail; save the full card face instead",
      );
    return { format: "png", width, height };
  }
  if (
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255 &&
    bytes.at(-2) === 255 &&
    bytes.at(-1) === 217
  )
    return { format: "jpg" };
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP" &&
    bytes.readUInt32LE(4) + 8 === bytes.length
  )
    return { format: "webp" };
  throw new Error(
    "Not a supported image. HTML/security-check responses are never cached.",
  );
}
