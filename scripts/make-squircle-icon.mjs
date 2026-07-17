/**
 * Bake a macOS-style squircle (superellipse) alpha mask into an icon PNG.
 * Transparent corners make Dock show a rounded icon even when the OS
 * does not apply its live mask to flat .icns assets.
 *
 * Usage: node scripts/make-squircle-icon.mjs <src.png> <out.png>
 */
import sharp from "sharp";

const src = process.argv[2];
const out = process.argv[3];
if (!src || !out) {
  console.error("usage: node scripts/make-squircle-icon.mjs <src.png> <out.png>");
  process.exit(1);
}

const size = 1024;
const n = 5;
const inset = 0.02;

const { data } = await sharp(src)
  .resize(size, size, {
    fit: "cover",
    background: { r: 250, g: 250, b: 250, alpha: 1 },
  })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const outBuf = Buffer.from(data);

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const nx = ((x + 0.5) / size) * 2 - 1;
    const ny = ((y + 0.5) / size) * 2 - 1;
    const v =
      Math.pow(Math.abs(nx) / (1 - inset), n) +
      Math.pow(Math.abs(ny) / (1 - inset), n);
    const idx = (y * size + x) * 4;

    let alphaScale = 1;
    if (v > 1) alphaScale = 0;
    else if (v > 0.92) alphaScale = 1 - (v - 0.92) / 0.08;

    outBuf[idx + 3] = Math.round(outBuf[idx + 3] * alphaScale);
  }
}

await sharp(outBuf, {
  raw: { width: size, height: size, channels: 4 },
})
  .png()
  .toFile(out);

console.log("wrote", out);
