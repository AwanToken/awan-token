/** Procedural cyber ambient + SFX (no external audio files / no copyright). */

const LS_MUTE = "awn_mute_game";
const LS_MUTE_LEGACY = "awn_audio_mute";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicTimer: number | null = null;
let started = false;
let muted = false;

try {
  const v = localStorage.getItem(LS_MUTE) ?? localStorage.getItem(LS_MUTE_LEGACY);
  muted = v === "1";
} catch {
  /* ignore */
}

function ac(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.22;
    musicGain.connect(master);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.35;
    sfxGain.connect(master);
  }
  return ctx;
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  gainNode: GainNode,
  when = 0,
  vol = 0.12,
) {
  const c = ac();
  const t0 = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(gainNode);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

/** Soft cyber pad / arp loop */
function scheduleBar() {
  if (!musicGain || muted || !started) return;
  const c = ac();
  // Am ambient-ish: A3 C4 E4 G4
  const root = [220, 261.63, 329.63, 392];
  const beat = 0.42;
  for (let i = 0; i < 8; i++) {
    const f = root[i % root.length]! * (i % 4 === 3 ? 2 : 1);
    tone(f, 0.35, "triangle", musicGain, i * beat, 0.045);
    if (i % 2 === 0) tone(f * 0.5, 0.5, "sine", musicGain, i * beat, 0.03);
  }
  // hi pulse
  for (let i = 0; i < 4; i++) {
    tone(880 + i * 40, 0.08, "square", musicGain, i * beat * 2 + 0.05, 0.012);
  }
}

function startMusicLoop() {
  if (musicTimer != null) return;
  scheduleBar();
  musicTimer = window.setInterval(scheduleBar, 3400);
}

export async function ensureAudio() {
  const c = ac();
  if (c.state === "suspended") await c.resume();
  started = true;
  if (!muted) startMusicLoop();
}

export function isMuted() {
  return muted;
}

/** Alias — game Web Audio SFX/BGM mute. */
export function isGameMuted() {
  return muted;
}

export function setMuted(v: boolean) {
  muted = v;
  try {
    localStorage.setItem(LS_MUTE, v ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (master) master.gain.value = muted ? 0 : 0.55;
  if (!muted && started) startMusicLoop();
  if (muted && musicTimer != null) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

export function setGameMuted(v: boolean) {
  setMuted(v);
}

export function toggleMute() {
  setMuted(!muted);
  return muted;
}

export function toggleGameMute() {
  return toggleMute();
}

export function sfxShoot() {
  if (muted || !sfxGain) return;
  try {
    tone(660, 0.06, "square", sfxGain, 0, 0.05);
    tone(990, 0.05, "square", sfxGain, 0.02, 0.03);
  } catch {
    /* ignore */
  }
}

export function sfxHit() {
  if (muted || !sfxGain) return;
  try {
    tone(180, 0.12, "sawtooth", sfxGain, 0, 0.07);
  } catch {
    /* ignore */
  }
}

export function sfxPower() {
  if (muted || !sfxGain) return;
  try {
    tone(520, 0.1, "sine", sfxGain, 0, 0.06);
    tone(780, 0.14, "sine", sfxGain, 0.08, 0.05);
  } catch {
    /* ignore */
  }
}

export function sfxBoom() {
  if (muted || !sfxGain) return;
  try {
    tone(90, 0.25, "sawtooth", sfxGain, 0, 0.1);
    tone(60, 0.3, "triangle", sfxGain, 0.02, 0.08);
  } catch {
    /* ignore */
  }
}
