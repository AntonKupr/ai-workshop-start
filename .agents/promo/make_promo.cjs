// Turns demo_raw.mp4 into promo.mp4: animated title cards, a floating browser card with
// eased camera moves, spotlights, click pulses and captions, and an outro with the commands.
//
//   npm i --prefix /tmp/vt @napi-rs/canvas @ffmpeg-installer/ffmpeg
//   NODE_PATH=/tmp/vt/node_modules FONT_SANS=Inter.ttf FONT_MONO=JetBrainsMono.ttf \
//     node .agents/promo/make_promo.cjs
//
// Copy follows .agents/skills/promotion-post-writer: every claim is backed by spec/ or README.md.
const { spawn } = require('child_process');
const path = require('path');
const { createCanvas, GlobalFonts, ImageData } = require('@napi-rs/canvas');

const FFMPEG = process.env.FFMPEG || require('@ffmpeg-installer/ffmpeg').path;
const SRC = path.join(__dirname, 'demo_raw.mp4');
const OUT = process.env.OUT || path.join(__dirname, 'promo.mp4');
GlobalFonts.registerFromPath(process.env.FONT_SANS, 'Sans');
GlobalFonts.registerFromPath(process.env.FONT_MONO, 'Mono');

const W = 1920, H = 1080, FPS = 30;
const BW = 1100, BH = 700;                  // the browser window inside the recording
const CX = 960, CY = 500, S0 = 1.25;         // where the card sits at zoom 1
const ACCENT = '#5b8cff', ACCENT2 = '#b26bff', WARM = '#ff7a59';

// ---------- helpers ----------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, u) => a + (b - a) * u;
const ease = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const easeOut = u => 1 - Math.pow(1 - u, 3);
const back = u => { const c = 1.7; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
// 0→1 over [a, a+fin], 1→0 over [b-fout, b]
const env = (t, a, b, fin = 0.35, fout = 0.3) =>
  t < a || t > b ? 0 : Math.min(easeOut(clamp((t - a) / fin)), easeOut(clamp((b - t) / fout)));

function rr(ctx, x, y, w, h, r, begin = true) {
  if (begin) ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- background ----------
const dots = createCanvas(W, H);
{
  const d = dots.getContext('2d');
  d.fillStyle = 'rgba(255,255,255,0.05)';
  for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) d.fillRect(x, y, 2, 2);
}
function background(ctx, T) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#070b1f');
  g.addColorStop(1, '#160f38');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const blobs = [
    [ACCENT, 0.28, 300, 250, 0.11],
    [ACCENT2, 0.24, 1600, 300, 0.08],
    [WARM, 0.14, 1200, 950, 0.06],
  ];
  for (const [c, a, x0, y0, f] of blobs) {
    const x = x0 + Math.sin(T * f * 2) * 160, y = y0 + Math.cos(T * f * 1.6) * 120;
    const r = ctx.createRadialGradient(x, y, 0, x, y, 700);
    r.addColorStop(0, hexA(c, a));
    r.addColorStop(1, hexA(c, 0));
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.drawImage(dots, 0, 0);
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

function logo(ctx, x, y, s, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale(s, s);
  const g = ctx.createLinearGradient(-50, -50, 50, 50);
  g.addColorStop(0, ACCENT);
  g.addColorStop(1, ACCENT2);
  ctx.fillStyle = g;
  rr(ctx, -50, -50, 100, 100, 26);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  for (const [i, j] of [[0, 0], [1, 0], [0, 1]]) { rr(ctx, -30 + i * 34, -30 + j * 34, 26, 26, 7); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  rr(ctx, 4, 4, 26, 26, 7);
  ctx.fill();
  ctx.restore();
}

function text(ctx, s, x, y, { size = 48, weight = 700, color = '#fff', align = 'center', alpha = 1, font = 'Sans', spacing } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (spacing) ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(s, x, y);
  ctx.restore();
}

// words rise in one after another
function stagger(ctx, s, x, y, t, opts = {}) {
  const words = s.split(' ');
  ctx.save();
  ctx.font = `${opts.weight || 800} ${opts.size || 80}px Sans`;
  const space = ctx.measureText(' ').width;
  const widths = words.map(w => ctx.measureText(w).width);
  ctx.restore();
  const total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
  let cx = x - total / 2;
  words.forEach((w, i) => {
    const u = easeOut(clamp((t - i * 0.07) / 0.5));
    text(ctx, w, cx, y + (1 - u) * 40, { ...opts, size: opts.size || 80, weight: opts.weight || 800, align: 'left', alpha: u * (opts.alpha ?? 1) });
    cx += widths[i] + space;
  });
}

function chip(ctx, label, x, y, { size = 30, alpha = 1, scale = 1, color = ACCENT, mono = true, fill = 'rgba(18,22,52,0.85)' } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.font = `600 ${size}px ${mono ? 'Mono' : 'Sans'}`;
  const w = ctx.measureText(label).width + size * 1.4, h = size * 1.9;
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = fill;
  rr(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = hexA(color, 0.7);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#e9edff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 2);
  ctx.restore();
  return w;
}

// ---------- intro: scattered skills → Skill Atlas ----------
const SCATTER = [
  ['.agents/skills/code-review', 330, 520, ACCENT], ['.claude/skills/commits', 1500, 470, ACCENT2],
  ['.github/skills/code-style', 560, 700, WARM], ['agent/skills/code-review', 1320, 680, ACCENT],
  ['.agents/skills/PR-rebaser', 960, 590, ACCENT2], ['.claude/skills/red-agent', 420, 880, WARM],
  ['.github/skills/issue-to-pr', 1480, 880, ACCENT], ['.agents/skills/status-update', 960, 800, ACCENT2],
];
const INTRO = 7.6;
function intro(ctx, t) {
  // act 1: the problem
  const a1 = 1 - easeOut(clamp((t - 3.7) / 0.5));
  stagger(ctx, 'Your agent skills are everywhere.', CX, 230, t - 0.15, { size: 86, alpha: a1 });
  const sub = env(t, 1.9, 4.2, 0.5, 0.4);
  text(ctx, 'Copied between folders, and nobody knows what the repository already holds.', CX, 340,
    { size: 40, weight: 400, color: '#b9c1e6', alpha: sub });
  const gather = ease(clamp((t - 3.7) / 0.9));             // act 2: they fly into the logo
  SCATTER.forEach(([label, x, y, c], i) => {
    const pop = back(clamp((t - 0.5 - i * 0.12) / 0.45));
    const fx = x + Math.sin(t * 1.3 + i) * 10, fy = y + Math.cos(t * 1.1 + i * 2) * 8;
    const px = lerp(fx, CX, gather), py = lerp(fy, 470, gather);
    chip(ctx, label + '/SKILL.md', px, py, { size: 26, color: c, scale: pop * (1 - 0.8 * gather), alpha: clamp(pop) * (1 - gather) });
  });
  // act 2: the product
  const lu = clamp((t - 4.3) / 0.6);
  if (lu > 0) {
    const glow = ctx.createRadialGradient(CX, 470, 0, CX, 470, 420);
    glow.addColorStop(0, hexA(ACCENT, 0.35 * lu));
    glow.addColorStop(1, hexA(ACCENT, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    logo(ctx, CX, 400, 1.5 * back(lu), clamp(lu * 2));
    const tu = easeOut(clamp((t - 4.7) / 0.6));
    text(ctx, 'Skill Atlas', CX, 590 + (1 - tu) * 30, { size: 120, weight: 800, alpha: tu, spacing: -2 });
    stagger(ctx, 'See every agent skill your repository already has.', CX, 700, t - 5.3, { size: 44, weight: 500, color: '#c9d0f5' });
  }
}

// ---------- outro ----------
const OUTRO = 9;
const PERKS = ['No clone, GitHub API', 'Under 5 s on intellij-community', 'Nothing stored', 'Sanitized SKILL.md', 'GET /api/scan'];
const CMDS = [['$ ', 'npm ci && npm run build'], ['$ ', './skill-atlas web'], ['', 'Skill Atlas at http://localhost:4173']];
function outro(ctx, t) {
  const fade = 1 - clamp((t - (OUTRO - 0.7)) / 0.7);
  ctx.save();
  ctx.globalAlpha = fade;
  logo(ctx, CX - 290, 170, 0.85 * back(clamp(t / 0.5)));
  text(ctx, 'Skill Atlas', CX - 215, 172, { size: 90, weight: 800, align: 'left', alpha: clamp(t / 0.4) });
  // perks
  ctx.font = '600 30px Sans';
  const ws = PERKS.map(p => ctx.measureText(p).width + 30 * 1.4);
  let x = CX - (ws.reduce((a, b) => a + b, 0) + 22 * (PERKS.length - 1)) / 2;
  PERKS.forEach((p, i) => {
    const u = back(clamp((t - 0.4 - i * 0.12) / 0.45));
    chip(ctx, p, x + ws[i] / 2, 315 + (1 - clamp(u)) * 30, { size: 30, mono: false, scale: u, alpha: clamp(u), color: [ACCENT, ACCENT2, WARM][i % 3] });
    x += ws[i] + 22;
  });
  // terminal
  const tu = easeOut(clamp((t - 1.0) / 0.6));
  const tw = 1160, th = 330, tx = CX - tw / 2, ty = 415 + (1 - tu) * 60;
  ctx.save();
  ctx.globalAlpha *= tu;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = '#0d1024';
  rr(ctx, tx, ty, tw, th, 18);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(tx + 32 + i * 26, ty + 30, 8, 0, 7); ctx.fill(); });
  let ct = t - 1.6;
  CMDS.forEach(([prompt, cmd], i) => {
    const typed = prompt ? Math.floor(clamp(ct / 0.9) * cmd.length) : (ct > 0 ? cmd.length : 0);
    const ly = ty + 110 + i * 72;
    if (ct > 0) {
      text(ctx, prompt, tx + 50, ly, { size: 40, weight: 500, font: 'Mono', color: '#7d8bb8', align: 'left' });
      const shown = cmd.slice(0, typed);
      text(ctx, shown, tx + 50 + (prompt ? 48 : 0), ly, { size: 40, weight: 500, font: 'Mono', align: 'left', color: prompt ? '#eef1ff' : '#7ee2a8' });
      if (prompt && typed < cmd.length && Math.floor(t * 4) % 2 === 0) {
        ctx.font = '500 40px Mono';
        ctx.fillStyle = ACCENT;
        ctx.fillRect(tx + 100 + ctx.measureText(shown).width, ly - 22, 22, 44);
      }
    }
    ct -= prompt ? 1.1 : 0.4;
  });
  ctx.restore();
  // call to action
  const cu = easeOut(clamp((t - 5.2) / 0.6));
  text(ctx, 'Grab it from the repository and see your skills in one page today.', CX, 850 + (1 - cu) * 25, { size: 54, weight: 800, alpha: cu });
  text(ctx, 'Point it at a GitHub URL or a local directory.', CX, 930, { size: 36, weight: 400, color: '#aab3dd', alpha: easeOut(clamp((t - 5.7) / 0.6)) });
  ctx.restore();
}

// ---------- screen scenes ----------
// pieces: [srcStart, srcEnd, speed]. Camera keys, captions and marks take `t` (scene time) or `s` (source time).
const SCENES = [
  {
    pieces: [[28.7, 36.6, 1.25]],
    cam: [{ t: 0, x: 550, y: 380, z: 1 }, { t: 0.9, x: 545, y: 200, z: 1.38 }, { s: 32.0, x: 545, y: 200, z: 1.38 },
      { s: 32.9, x: 430, y: 330, z: 1.3 }, { s: 34.3, x: 430, y: 330, z: 1.3 }, { s: 35.6, x: 715, y: 520, z: 1.55 }],
    captions: [{ t: 0.3, e: 3.3, k: 'SCAN', h: 'Point it at a GitHub URL or a local directory' },
      { t: 3.45, e: 6.3, k: 'READ', h: 'Every SKILL.md, rendered beside the list' }],
    marks: [{ type: 'spot', s: 29.2, e: 31.9, r: [28, 167, 951, 28] },
      { type: 'box', s: 32.1, e: 34.4, r: [22, 210, 190, 34] },
      { type: 'spot', s: 35.0, e: 36.6, r: [382, 381, 675, 293] }],
  },
  {
    pieces: [[40.7, 46.6, 1]],
    cam: [{ t: 0, x: 420, y: 470, z: 1.35 }, { t: 0.8, x: 200, y: 525, z: 2.1 }, { s: 43.6, x: 200, y: 525, z: 2.1 }, { s: 44.8, x: 470, y: 520, z: 1.5 }],
    captions: [{ t: 0.3, e: 5.8, k: 'FILTER', h: 'Filter by name or description, the detail pane follows' }],
    marks: [{ type: 'spot', s: 41.1, e: 42.9, r: [61, 467, 257, 28] }, { type: 'box', s: 42.5, e: 44.3, r: [61, 528, 257, 58] }],
  },
  {
    pieces: [[78.8, 82.8, 2], [82.8, 86.2, 1]],
    cam: [{ t: 0, x: 545, y: 200, z: 1.38 }, { s: 82.6, x: 545, y: 200, z: 1.38 }, { s: 83.8, x: 550, y: 355, z: 1.1 }],
    captions: [{ t: 0.3, e: 6.3, k: 'SCAN', h: 'This repository’s own .agents folder: 8 skills' }],
    marks: [{ type: 'spot', s: 79.0, e: 82.7, r: [28, 167, 951, 28] }, { type: 'box', s: 83.4, e: 86.2, r: [22, 210, 192, 34] }],
    badge: true,
  },
  {
    pieces: [[95.3, 102.6, 1]],
    cam: [{ t: 0, x: 420, y: 420, z: 1.3 }, { t: 0.9, x: 195, y: 480, z: 1.95 }],
    captions: [{ t: 0.3, e: 7.0, k: 'GROUP', h: 'Group by shared words: the families in your skill names' }],
    marks: [{ type: 'spot', s: 96.0, e: 97.6, r: [58, 375, 232, 24] }, { type: 'pulse', s: 97.1, p: [73, 387] },
      { type: 'box', s: 98.0, e: 99.9, r: [62, 405, 80, 24] }, { type: 'box', s: 100.1, e: 102.3, r: [62, 591, 112, 24] }],
  },
  {
    pieces: [[119.7, 124.6, 1]],
    cam: [{ t: 0, x: 230, y: 520, z: 1.7 }, { t: 0.9, x: 195, y: 545, z: 2.15 }],
    captions: [{ t: 0.3, e: 4.8, k: 'GROUP', h: 'Fold a family away with one click' }],
    marks: [{ type: 'pulse', s: 120.85, p: [100, 603] }, { type: 'box', s: 121.1, e: 124.4, r: [62, 591, 112, 24] }],
  },
  {
    pieces: [[132.4, 138.4, 1]],
    cam: [{ t: 0, x: 420, y: 420, z: 1.35 }, { t: 0.8, x: 195, y: 400, z: 2.1 }, { s: 135.6, x: 195, y: 400, z: 2.1 }, { s: 136.9, x: 560, y: 420, z: 1.4 }],
    captions: [{ t: 0.3, e: 5.9, k: 'FILTER', h: 'Filter inside groups, the counts follow the matches' }],
    marks: [{ type: 'spot', s: 132.7, e: 134.3, r: [61, 341, 257, 28] }, { type: 'box', s: 134.3, e: 136.0, r: [62, 405, 112, 24] },
      { type: 'spot', s: 136.6, e: 138.4, r: [382, 255, 675, 440] }],
  },
];

for (const sc of SCENES) {
  let acc = 0;
  sc.map = sc.pieces.map(([a, b, sp]) => { const m = { a, b, sp, t0: acc }; acc += (b - a) / sp; return m; });
  sc.dur = acc;
  const local = s => { for (const m of sc.map) if (s <= m.b) return m.t0 + (s - m.a) / m.sp; return acc; };
  const res = o => ({ ...o, t: o.s !== undefined ? local(o.s) : o.t, e: o.e !== undefined && o.s !== undefined ? local(o.e) : o.e });
  sc.cam = sc.cam.map(res);
  sc.marks = sc.marks.map(res);
  sc.speedAt = t => { for (const m of sc.map) if (t < m.t0 + (m.b - m.a) / m.sp) return m.sp; return 1; };
}

function camAt(keys, t) {
  if (t <= keys[0].t) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t <= b.t) {
      const u = ease(clamp((t - a.t) / Math.max(1e-6, b.t - a.t)));
      return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), u)) };
    }
  }
  return keys[keys.length - 1];
}

const srcCanvas = createCanvas(BW, BH);
const sctx = srcCanvas.getContext('2d');

function screen(ctx, sc, t, frame) {
  sctx.putImageData(frame, 0, 0);
  const c = camAt(sc.cam, t);
  const S = S0 * c.z, tx = CX - c.x * S, ty = CY - c.y * S;
  ctx.save();
  ctx.setTransform(S, 0, 0, S, tx, ty);
  // card shadow + rounded clip
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 80;
  ctx.shadowOffsetY = 30;
  ctx.fillStyle = '#fff';
  rr(ctx, 0, 0, BW, BH, 14);
  ctx.fill();
  ctx.restore();
  ctx.save();
  rr(ctx, 0, 0, BW, BH, 14);
  ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(srcCanvas, 0, 0);
  // marks, in source coordinates
  for (const m of sc.marks) {
    if (m.type === 'pulse') {
      const d = t - m.t;
      if (d < 0 || d > 0.9) continue;
      for (const k of [0, 0.22]) {
        const u = clamp((d - k) / 0.6);
        if (u <= 0 || u >= 1) continue;
        ctx.strokeStyle = hexA(WARM, 1 - u);
        ctx.lineWidth = 4 / S;
        ctx.beginPath();
        ctx.arc(m.p[0], m.p[1], (8 + 38 * easeOut(u)) / S * 1.6, 0, 7);
        ctx.stroke();
      }
      ctx.fillStyle = hexA(WARM, 0.55 * (1 - clamp(d / 0.6)));
      ctx.beginPath();
      ctx.arc(m.p[0], m.p[1], 14 / S * 1.6, 0, 7);
      ctx.fill();
      continue;
    }
    const a = env(t, m.t, m.e, 0.35, 0.35);
    if (a <= 0) continue;
    const [x, y, w, h] = m.r, pad = 5;
    if (m.type === 'spot') {
      ctx.fillStyle = `rgba(8,10,30,${0.5 * a})`;
      ctx.beginPath();
      ctx.rect(0, 0, BW, BH);
      rr(ctx, x - pad, y - pad, w + pad * 2, h + pad * 2, 8, false);
      ctx.fill('evenodd');
    }
    const grow = 1 + 0.25 * (1 - easeOut(clamp((t - m.t) / 0.4)));
    const gx = x + w / 2, gy = y + h / 2, gw = (w + pad * 2) * grow, gh = (h + pad * 2) * (1 + (grow - 1) * 2);
    ctx.save();
    ctx.shadowColor = hexA(ACCENT, 0.9 * a);
    ctx.shadowBlur = 24;
    ctx.strokeStyle = hexA(m.type === 'spot' ? ACCENT : WARM, a);
    ctx.lineWidth = 4 / S;
    rr(ctx, gx - gw / 2, gy - gh / 2, gw, gh, 8);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  ctx.restore();

  // fast-forward badge
  if (sc.badge) {
    const sp = sc.speedAt(t), a = sp > 1 ? env(t, 0, sc.map[0].b > 0 ? (sc.map[0].b - sc.map[0].a) / sc.map[0].sp : 0, 0.25, 0.25) : 0;
    if (a > 0) chip(ctx, `▶▶  ${sp}×`, W - 150, 70, { size: 30, alpha: a, color: WARM });
  }
  // captions
  for (const cp of sc.captions) {
    const a = env(t, cp.t, cp.e, 0.45, 0.35);
    if (a <= 0) continue;
    const y = 985 + (1 - a) * 40;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = '700 44px Sans';
    const hw = ctx.measureText(cp.h).width;
    ctx.font = '800 22px Sans';
    ctx.letterSpacing = '4px';
    const kw = ctx.measureText(cp.k).width + 40;
    ctx.letterSpacing = '0px';
    const w = kw + hw + 90, x = CX - w / 2;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 40;
    ctx.fillStyle = 'rgba(12,15,40,0.9)';
    rr(ctx, x, y - 44, w, 88, 44);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    const g = ctx.createLinearGradient(x, 0, x + kw, 0);
    g.addColorStop(0, ACCENT);
    g.addColorStop(1, ACCENT2);
    ctx.fillStyle = g;
    rr(ctx, x + 18, y - 26, kw, 52, 26);
    ctx.fill();
    ctx.restore();
    text(ctx, cp.k, x + 18 + kw / 2 + 2, y + 1, { size: 22, weight: 800, alpha: a, spacing: 4 });
    text(ctx, cp.h, x + kw + 50, y + 2, { size: 44, weight: 700, align: 'left', alpha: a });
  }
  // watermark
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = 'rgba(12,15,40,0.85)';
  rr(ctx, 40, 34, 250, 56, 28);
  ctx.fill();
  ctx.restore();
  logo(ctx, 70, 62, 0.34);
  text(ctx, 'Skill Atlas', 100, 63, { size: 30, weight: 800, align: 'left', alpha: 0.9 });
}

// ---------- io ----------
function readFrames(a, b, sp) {
  const n = Math.round(((b - a) / sp) * FPS);
  const p = spawn(FFMPEG, ['-v', 'error', '-ss', String(a), '-t', String(b - a + 0.5), '-i', SRC,
    '-vf', `crop=${BW}:${BH}:0:0,setpts=(PTS-STARTPTS)/${sp},fps=${FPS}`, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']);
  const size = BW * BH * 4;
  // a queue of chunks with backpressure: concatenating into one growing buffer is quadratic
  const chunks = [];
  let queued = 0, ended = false, waiter = null;
  const wake = () => { if (waiter) { const w = waiter; waiter = null; w(); } };
  p.stdout.on('data', d => { chunks.push(d); queued += d.length; if (queued > size * 4) p.stdout.pause(); if (queued >= size) wake(); });
  p.stdout.on('end', () => { ended = true; wake(); });
  let last = null, i = 0;
  return {
    n,
    async next() {
      if (i++ >= n) return last;
      while (queued < size && !ended) { p.stdout.resume(); await new Promise(r => (waiter = r)); }
      if (queued >= size) {
        const out = new Uint8ClampedArray(size);
        let off = 0;
        while (off < size) {
          const c = chunks[0], take = Math.min(c.length, size - off);
          out.set(c.subarray(0, take), off);
          off += take;
          if (take === c.length) chunks.shift(); else chunks[0] = c.subarray(take);
        }
        queued -= size;
        last = out;
        if (queued < size * 2) p.stdout.resume();
      }
      if (i >= n) p.kill();
      return last;
    },
  };
}

const START = Date.now();
(async () => {
  const total = INTRO + SCENES.reduce((a, s) => a + s.dur, 0) + OUTRO;
  const enc = spawn(FFMPEG, ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });
  const canvas = createCanvas(W, H), ctx = canvas.getContext('2d');
  const prev = createCanvas(W, H), pctx = prev.getContext('2d');
  let T = 0, frames = 0, fadeLeft = 0;
  const XF = 0.45;
  const emit = async () => {
    if (fadeLeft > 0) { ctx.globalAlpha = ease(fadeLeft / XF); ctx.drawImage(prev, 0, 0); ctx.globalAlpha = 1; fadeLeft -= 1 / FPS; }
    // progress bar
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, ACCENT);
    g.addColorStop(1, WARM);
    ctx.fillStyle = g;
    ctx.fillRect(0, H - 6, W * (T / total), 6);
    const data = ctx.getImageData(0, 0, W, H).data;
    if (!enc.stdin.write(Buffer.from(data.buffer, data.byteOffset, data.byteLength))) await new Promise(r => enc.stdin.once('drain', r));
    T += 1 / FPS;
    frames++;
    if (process.env.DEBUG && frames % 30 === 0) process.stderr.write(`${frames} frames ${Date.now() - START} ms\n`);
  };
  const cut = () => { pctx.clearRect(0, 0, W, H); pctx.drawImage(canvas, 0, 0); fadeLeft = XF; };

  for (let f = 0; f < INTRO * FPS; f++) { background(ctx, T); intro(ctx, f / FPS); await emit(); }
  for (const [k, sc] of SCENES.entries()) {
    cut();
    let t = 0;
    for (const m of sc.map) {
      const rd = readFrames(m.a, m.b, m.sp);
      for (let f = 0; f < rd.n; f++) {
        const px = await rd.next();
        background(ctx, T);
        screen(ctx, sc, t, new ImageData(px, BW, BH));
        await emit();
        t += 1 / FPS;
      }
    }
    process.stderr.write(`scene ${k + 1}/${SCENES.length} done, ${frames} frames\n`);
  }
  cut();
  for (let f = 0; f < OUTRO * FPS; f++) { background(ctx, T); outro(ctx, f / FPS); await emit(); }
  enc.stdin.end();
  await new Promise(r => enc.on('close', r));
  process.stderr.write(`wrote ${OUT}: ${frames} frames, ${(frames / FPS).toFixed(1)} s\n`);
})();
