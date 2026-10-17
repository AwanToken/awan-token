/**
 * Build GeckoTerminal logo + banner from user-provided sources.
 * GT rules: logo square PNG/JPG ≥30px <2MB; banner PNG/JPG ≥1280×430 <2MB.
 */
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const repo = path.resolve(root, "..");

const LOGO_SRC = path.join(repo, "assets", "gt-src", "logo-src.jpg");
const BANNER_SRC = path.join(repo, "assets", "gt-src", "banner-src.jpg");
const OUT_LOGO = path.join(root, "public", "awn-logo-gt.png");
const OUT_LOGO_MAIN = path.join(root, "public", "awn-logo.png");
const OUT_BANNER = path.join(root, "public", "awn-banner-gt.png");
const SIZE = 512;
const BANNER_W = 1500;
const BANNER_H = 500;

async function circleMaskRaw(data, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const rr = Math.min(cx, cy) - 0.5;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (dist > rr) {
        data[i + 3] = 0;
      } else if (dist > rr - 1.4) {
        const a = Math.round(((rr - dist) / 1.4) * 255);
        data[i + 3] = Math.min(data[i + 3], a);
      }
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const nearGray =
        r > 200 &&
        g > 200 &&
        b > 200 &&
        Math.abs(r - g) < 18 &&
        Math.abs(g - b) < 18;
      if (dist > rr * 0.8 && nearGray) {
        data[i + 3] = 0;
      }
    }
  }
}

async function detectRadius(srcPath) {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const cx = info.width / 2;
  const cy = info.height / 2;
  let maxR = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // dark ring / portrait content vs light speckled canvas
      if (r < 220 || g < 220 || b < 220) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > maxR) maxR = d;
      }
    }
  }
  const radius = Math.min(maxR * 0.988, Math.min(cx, cy) - 2);
  return { cx, cy, radius, w: info.width, h: info.height };
}

async function makeLogo() {
  const meta = await sharp(LOGO_SRC).metadata();
  console.log("logo source", meta.width, "x", meta.height, meta.format);

  const { cx, cy, radius, w, h } = await detectRadius(LOGO_SRC);
  console.log("detected radius", radius.toFixed(1), "of", w, "x", h);

  const left = Math.max(0, Math.floor(cx - radius));
  const top = Math.max(0, Math.floor(cy - radius));
  const diam = Math.min(Math.ceil(radius * 2), w - left, h - top);

  const cropped = await sharp(LOGO_SRC)
    .extract({ left, top, width: diam, height: diam })
    .ensureAlpha()
    .resize(SIZE, SIZE, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  await circleMaskRaw(cropped.data, cropped.info.width, cropped.info.height);

  await sharp(cropped.data, {
    raw: { width: SIZE, height: SIZE, channels: 4 },
  })
    .png()
    .toFile(OUT_LOGO);

  await sharp(OUT_LOGO).toFile(OUT_LOGO_MAIN);

  const outMeta = await sharp(OUT_LOGO).metadata();
  console.log("wrote", OUT_LOGO, `${outMeta.width}x${outMeta.height}`, outMeta.size, "bytes");
}

async function makeBanner() {
  const meta = await sharp(BANNER_SRC).metadata();
  console.log("banner source", meta.width, "x", meta.height, meta.format);

  await sharp(BANNER_SRC)
    .resize(BANNER_W, BANNER_H, { fit: "cover", position: "centre" })
    .png({ compressionLevel: 8 })
    .toFile(OUT_BANNER);

  const outMeta = await sharp(OUT_BANNER).metadata();
  console.log(
    "wrote",
    OUT_BANNER,
    `${outMeta.width}x${outMeta.height}`,
    outMeta.size,
    "bytes",
  );
}

await makeLogo();
await makeBanner();
console.log("done");
