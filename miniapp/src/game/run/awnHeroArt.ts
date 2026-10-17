/**
 * Canvas art for RunAwan presentation: platformer hero resembling the
 * AWN logo figure (hat + jacket), without using the circular logo asset.
 */

export type AwnHeroOpts = {
  /** animation time in seconds */
  t: number;
  /** face direction 1 | -1 */
  faces?: 1 | -1;
  fire?: boolean;
  leaf?: boolean;
};

/** Draw full-body Awan runner into a square canvas (clears first). */
export function drawAwnHero(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: AwnHeroOpts,
) {
  const t = opts.t;
  const dir = opts.faces ?? 1;
  const fire = !!opts.fire;
  const leaf = !!opts.leaf;

  ctx.clearRect(0, 0, w, h);

  const bg = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * 0.55);
  bg.addColorStop(0, "rgba(255,200,60,0.28)");
  bg.addColorStop(0.45, "rgba(255,43,214,0.14)");
  bg.addColorStop(1, "rgba(8,2,18,0.92)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const bob = Math.sin(t * 3.2) * (h * 0.018);
  const walk = Math.sin(t * 8) * 0.55;
  const scale = Math.min(w, h) / 112;

  const bodyH = 28 * scale;
  const bodyW = 34 * scale;
  const headR = 16 * scale;
  const legH = 16 * scale;
  const armH = 14 * scale;
  const cx = w / 2;
  const footY = h * 0.88 + bob;
  const bodyBot = footY - legH;
  const bodyTop = bodyBot - bodyH;
  const headCy = bodyTop - headR + 3 * scale;

  ctx.save();

  // soft ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(cx, footY + 4 * scale, bodyW * 0.7, 5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  const legW = bodyW * 0.3;
  const legGap = bodyW * 0.1;
  const legSwing = walk * 6 * scale;
  ctx.fillStyle = "#5c3a1e";
  ctx.fillRect(
    cx - legGap - legW - (dir > 0 ? legSwing : -legSwing) * 0.35,
    bodyBot - 1,
    legW,
    legH + 2,
  );
  ctx.fillRect(
    cx + legGap + (dir > 0 ? legSwing : -legSwing) * 0.35,
    bodyBot - 1,
    legW,
    legH + 2,
  );
  ctx.fillStyle = "#1e1208";
  ctx.fillRect(cx - legGap - legW - 1, footY - 3 * scale, legW + 2, 4 * scale);
  ctx.fillRect(cx + legGap - 1, footY - 3 * scale, legW + 2, 4 * scale);

  const bx = cx - bodyW / 2;
  const jacket = ctx.createLinearGradient(bx, bodyTop, bx, bodyBot);
  jacket.addColorStop(0, fire ? "#d4682e" : "#a86b35");
  jacket.addColorStop(1, "#5c3a1e");
  ctx.fillStyle = jacket;
  ctx.fillRect(bx, bodyTop, bodyW, bodyH);
  // shirt
  ctx.fillStyle = fire ? "#ff9f1c" : "#7eb8e8";
  ctx.fillRect(cx - bodyW * 0.16, bodyTop + 2 * scale, bodyW * 0.32, bodyH * 0.55);

  const armW = Math.max(3, bodyW * 0.18);
  const armY = bodyTop + 3 * scale;
  const armSwing = walk * 5 * scale;
  ctx.fillStyle = "#8b5a2b";
  if (dir >= 0) {
    ctx.fillRect(bx - armW + 1, armY + armSwing, armW, armH);
    ctx.fillRect(bx + bodyW - 1, armY - armSwing, armW, armH);
  } else {
    ctx.fillRect(bx - armW + 1, armY - armSwing, armW, armH);
    ctx.fillRect(bx + bodyW - 1, armY + armSwing, armW, armH);
  }

  // head / skin
  ctx.beginPath();
  ctx.arc(cx, headCy, headR, 0, Math.PI * 2);
  ctx.fillStyle = "#e8b896";
  ctx.fill();

  // beard hint (logo vibe)
  ctx.fillStyle = "rgba(70,45,30,0.55)";
  ctx.beginPath();
  ctx.ellipse(cx + dir * 1, headCy + headR * 0.35, headR * 0.55, headR * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();

  // eyes
  ctx.fillStyle = "#1a0a08";
  ctx.beginPath();
  ctx.arc(cx + dir * headR * 0.28, headCy - headR * 0.05, Math.max(1.5, 2.2 * scale), 0, Math.PI * 2);
  ctx.arc(cx - dir * headR * 0.22, headCy - headR * 0.05, Math.max(1.2, 1.8 * scale), 0, Math.PI * 2);
  ctx.fill();

  // wide brim hat (logo man)
  ctx.fillStyle = "#3d2914";
  ctx.beginPath();
  ctx.ellipse(cx + dir * 1, headCy - headR * 0.55, headR * 1.15, headR * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#5c3a1e";
  ctx.fillRect(cx - headR * 0.55, headCy - headR * 1.15, headR * 1.1, headR * 0.55);
  ctx.fillStyle = "#c9a227";
  ctx.fillRect(cx - headR * 0.55, headCy - headR * 0.72, headR * 1.1, Math.max(2, 2.5 * scale));

  if (leaf) {
    ctx.fillStyle = "#7dffb0";
    ctx.beginPath();
    ctx.ellipse(cx - dir * 6 * scale, headCy - headR - 2 * scale, 12 * scale, 5 * scale, dir * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // sparkle
  const sp = 0.5 + 0.5 * Math.sin(t * 5);
  ctx.fillStyle = `rgba(255,230,120,${0.25 + sp * 0.45})`;
  ctx.beginPath();
  ctx.arc(cx + headR * 0.9, headCy - headR * 0.8, 3 * scale * sp, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
