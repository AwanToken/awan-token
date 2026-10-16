import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const repo = path.resolve(root, "..");

const GEN =
  "C:/Users/admin/.cursor/projects/c-Users-admin-Desktop-awann-token/assets/awn-logo-3d.jpg";
const ORIG = path.join(root, "public", "awn-logo.jpg");
const OUT_MINI = path.join(root, "public", "awn-logo.png");
const OUT_ADMIN = path.join(repo, "admin", "public", "awn-logo.png");

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
      // knock residual near-white / stucco fringe near the rim
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const nearWhite = r > 230 && g > 230 && b > 230 && Math.abs(r - g) < 12 && Math.abs(g - b) < 12;
      if (dist > rr * 0.82 && nearWhite) {
        data[i + 3] = 0;
      }
    }
  }
}

async function detectRadius(srcPath) {
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cx = info.width / 2;
  const cy = info.height / 2;
  let maxR = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r < 235 || g < 235 || b < 235) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > maxR) maxR = d;
      }
    }
  }
  // Pull in slightly so textured white fringe outside the black ring is excluded
  const radius = Math.min(maxR * 0.985, Math.min(cx, cy) - 2);
  return { cx, cy, radius, w: info.width, h: info.height };
}

function goldRimSvg(size) {
  const c = size / 2;
  return Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="goldRim" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fff3a0"/>
          <stop offset="28%" stop-color="#f0c14a"/>
          <stop offset="55%" stop-color="#c9a227"/>
          <stop offset="78%" stop-color="#8b6914"/>
          <stop offset="100%" stop-color="#ffe9a0"/>
        </linearGradient>
      </defs>
      <circle cx="${c}" cy="${c}" r="${c - 3}" fill="none" stroke="url(#goldRim)" stroke-width="16"/>
      <circle cx="${c}" cy="${c}" r="${c - 10}" fill="none" stroke="#4a3208" stroke-width="2.5" opacity="0.55"/>
      <circle cx="${c}" cy="${c}" r="${c - 4}" fill="none" stroke="#fff8d0" stroke-width="2" opacity="0.5"/>
      <path d="M ${size * 0.18} ${size * 0.28} A ${size * 0.38} ${size * 0.38} 0 0 1 ${size * 0.72} ${size * 0.18}"
        fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.32"/>
    </svg>`,
  );
}

async function processLogo(srcPath, outPath, size = 512) {
  const { cx, cy, radius, w, h } = await detectRadius(srcPath);
  console.log("source", srcPath, `${w}x${h}`, "radius", radius.toFixed(1));

  const left = Math.max(0, Math.floor(cx - radius));
  const top = Math.max(0, Math.floor(cy - radius));
  const diam = Math.min(Math.ceil(radius * 2), w - left, h - top);

  const cropped = await sharp(srcPath)
    .extract({ left, top, width: diam, height: diam })
    .ensureAlpha()
    .resize(size, size, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  await circleMaskRaw(cropped.data, cropped.info.width, cropped.info.height);

  let base = await sharp(cropped.data, {
    raw: { width: size, height: size, channels: 4 },
  })
    .png()
    .toBuffer();

  const withRim = await sharp(base)
    .composite([{ input: goldRimSvg(size), blend: "over" }])
    .png()
    .toBuffer();

  const finalRaw = await sharp(withRim).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  await circleMaskRaw(finalRaw.data, size, size);

  await sharp(finalRaw.data, { raw: { width: size, height: size, channels: 4 } })
    .png()
    .toFile(outPath);
  console.log("wrote", outPath);
}

// AI 3D medallion (gold rim already) + circle punch for transparency.
// Fall back to original + SVG rim if GEN missing.
const src = fs.existsSync(GEN) ? GEN : ORIG;
await processLogo(src, OUT_MINI, 512);
await sharp(OUT_MINI).toFile(OUT_ADMIN);
console.log("copied to", OUT_ADMIN, "from", src);
