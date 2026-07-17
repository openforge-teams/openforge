const sharp = require("sharp");

async function main() {
  const src = process.argv[2];
  const out = process.argv[3];
  const size = 1024;
  // macOS Dock optically matches Finder when the squircle sits inside
  // ~10% transparent margin (content ~80% of canvas).
  const shapeScale = 0.80;
  const n = 5.0; // continuous corner (superellipse)

  const inner = Math.round(size * shapeScale);
  const pad = Math.floor((size - inner) / 2);

  // Prepare artwork on light background, sized to fill the inner squircle
  const art = await sharp(src)
    .resize(inner, inner, {
      fit: "cover",
      background: { r: 250, g: 250, b: 250, alpha: 1 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const canvas = Buffer.alloc(size * size * 4, 0); // fully transparent

  for (let y = 0; y < inner; y++) {
    for (let x = 0; x < inner; x++) {
      const nx = ((x + 0.5) / inner) * 2 - 1;
      const ny = ((y + 0.5) / inner) * 2 - 1;
      const v = Math.pow(Math.abs(nx), n) + Math.pow(Math.abs(ny), n);

      let alphaScale = 1;
      if (v > 1) alphaScale = 0;
      else if (v > 0.92) alphaScale = 1 - (v - 0.92) / 0.08;

      const si = (y * inner + x) * 4;
      const di = ((y + pad) * size + (x + pad)) * 4;
      canvas[di] = art.data[si];
      canvas[di + 1] = art.data[si + 1];
      canvas[di + 2] = art.data[si + 2];
      canvas[di + 3] = Math.round(art.data[si + 3] * alphaScale);
    }
  }

  await sharp(canvas, { raw: { width: size, height: size, channels: 4 } })
    .png()
    .toFile(out);
  console.log("wrote", out, "shapeScale=", shapeScale);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
