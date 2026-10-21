#!/usr/bin/env python3
"""Turn demo_raw.mp4 into a promo cut: title cards, camera moves, highlights, captions.

Requires ffmpeg on PATH and `pip install pillow numpy`.
Usage: python3 render_promo.py [demo_raw.mp4] [demo_promo.mp4]
"""
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "demo_raw.mp4")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "demo_promo.mp4")

W, H, FPS = 1920, 1080, 30
XFADE = 0.4

# Page viewport inside the recorded browser window (source pixels).
VX0, VY0, VX1, VY1 = 4, 88, 1096, 696
CW, CH = VX1 - VX0, VY1 - VY0

# Card that shows the app on screen.
CARD_W = 1400
CARD_H = round(CARD_W * CH / CW)
BAR_H = 40
CARD_X = (W - CARD_W) // 2
CARD_Y = 34

ACCENT = (139, 92, 246)
ACCENT2 = (34, 211, 238)
TEXT = (240, 242, 250)
MUTED = (170, 177, 204)

FONT_DIR = "/usr/share/fonts/opentype/inter"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
MONO_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
_fonts = {}


def font(name, size):
    key = (name, size)
    if key not in _fonts:
        path = name if name.startswith("/") else os.path.join(FONT_DIR, name)
        _fonts[key] = ImageFont.truetype(path, size)
    return _fonts[key]


def clamp01(x):
    return max(0.0, min(1.0, x))


def ease(x):
    x = clamp01(x)
    return 4 * x * x * x if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def ease_out(x):
    x = clamp01(x)
    return 1 - (1 - x) ** 3


def ease_back(x):
    x = clamp01(x)
    c1 = 1.70158
    c3 = c1 + 1
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


def lerp(a, b, t):
    return a + (b - a) * t


def fade(t, t0, t1, ramp=0.3):
    """1 inside [t0, t1], eased ramps of `ramp` seconds on both sides."""
    if t < t0 or t > t1:
        return 0.0
    return ease(min((t - t0) / ramp, (t1 - t) / ramp, 1.0))


# ---------------------------------------------------------------- background

def make_background():
    bw, bh = W + 400, H + 300
    y, x = np.mgrid[0:bh, 0:bw].astype(np.float32)
    base = np.zeros((bh, bw, 3), np.float32)
    top = np.array([10, 12, 26], np.float32)
    bottom = np.array([22, 14, 48], np.float32)
    base[:] = top + (bottom - top) * (y / bh)[..., None]
    for cx, cy, r, col, k in [
        (0.22, 0.25, 0.55, ACCENT, 0.42),
        (0.82, 0.75, 0.5, ACCENT2, 0.22),
        (0.65, 0.1, 0.35, (236, 72, 153), 0.16),
    ]:
        d = np.sqrt((x / bw - cx) ** 2 + ((y / bh - cy) * bh / bw) ** 2) / r
        a = np.clip(1 - d, 0, 1) ** 2 * k
        base += (np.array(col, np.float32) - base) * a[..., None]
    # faint dot grid
    grid = ((x % 48 < 2) & (y % 48 < 2)).astype(np.float32) * 0.06
    base += (255 - base) * grid[..., None]
    return Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))


BG = make_background()


def background(t):
    ox = 200 + 160 * math.sin(t * 0.11)
    oy = 150 + 110 * math.cos(t * 0.08)
    return BG.crop((int(ox), int(oy), int(ox) + W, int(oy) + H))


# ---------------------------------------------------------------- drawing helpers

def text_size(txt, f):
    l, t, r, b = f.getbbox(txt)
    return r - l, b - t


def draw_text(img, xy, txt, f, fill, alpha=1.0, anchor="la", tracking=0):
    if alpha <= 0:
        return
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    if tracking:
        x, y = xy
        total = sum(d.textlength(c, font=f) + tracking for c in txt) - tracking
        if anchor[0] == "m":
            x -= total / 2
        for c in txt:
            d.text((x, y), c, font=f, fill=fill + (int(255 * alpha),), anchor="l" + anchor[1])
            x += d.textlength(c, font=f) + tracking
    else:
        d.text(xy, txt, font=f, fill=fill + (int(255 * alpha),), anchor=anchor)
    img.alpha_composite(layer)


def rounded_mask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius, fill=255)
    return m


def shadow(size, radius, blur, opacity):
    pad = blur * 3
    s = Image.new("RGBA", (size[0] + 2 * pad, size[1] + 2 * pad), (0, 0, 0, 0))
    ImageDraw.Draw(s).rounded_rectangle(
        (pad, pad, pad + size[0], pad + size[1]), radius, fill=(0, 0, 0, int(255 * opacity)))
    return s.filter(ImageFilter.GaussianBlur(blur)), pad


def chip(img, x, y, label, f, alpha, fill=(255, 255, 255), text_fill=TEXT, pad=(22, 12), anchor="l"):
    if alpha <= 0:
        return 0
    tw = text_size(label, f)[0]
    ascent, descent = f.getmetrics()
    w, h = tw + 2 * pad[0], ascent + descent + 2 * pad[1]
    if anchor == "m":
        x -= w / 2
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle((x, y, x + w, y + h), h / 2, fill=fill + (int(28 * alpha),),
                        outline=fill + (int(70 * alpha),), width=2)
    d.text((x + w / 2, y + h / 2), label, font=f, fill=text_fill + (int(255 * alpha),), anchor="mm")
    img.alpha_composite(layer)
    return w


# ---------------------------------------------------------------- card chrome

CARD_MASK = rounded_mask((CARD_W, CARD_H + BAR_H), 18)
CARD_SHADOW, CARD_SHADOW_PAD = shadow((CARD_W, CARD_H + BAR_H), 18, 28, 0.6)


def card_bar():
    bar = Image.new("RGBA", (CARD_W, BAR_H), (28, 31, 44, 255))
    d = ImageDraw.Draw(bar)
    for i, col in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        cx = 24 + i * 22
        d.ellipse((cx - 6, BAR_H / 2 - 6, cx + 6, BAR_H / 2 + 6), fill=col)
    pw = 360
    d.rounded_rectangle(((CARD_W - pw) / 2, 8, (CARD_W + pw) / 2, BAR_H - 8), 12, fill=(44, 48, 64))
    d.text((CARD_W / 2, BAR_H / 2), "localhost:4173", font=font("Inter-Medium.otf", 16),
           fill=(190, 196, 220), anchor="mm")
    return bar


CARD_BAR = card_bar()


# ---------------------------------------------------------------- video scenes

def S(x, y):
    """Source screen pixel -> page content pixel."""
    return x - VX0, y - VY0


def R(x0, y0, x1, y1):
    return (x0 - VX0, y0 - VY0, x1 - VX0, y1 - VY0)


FULL = (CW / 2, CH / 2, 1.0)


def cam(x, y, z):
    cx, cy = S(x, y)
    return (cx, cy, z)


class Clip:
    """A stretch of the raw recording with a camera path, highlights and a caption."""

    def __init__(self, start, end, step, title, sub, cams, highlights=(), clicks=()):
        self.start, self.end = start, end
        self.duration = end - start
        self.step, self.title, self.sub = step, title, sub
        self.cams = cams  # [(src_time, (cx, cy, zoom))]
        self.highlights = highlights  # [(src_t0, src_t1, rect)]
        self.clicks = clicks  # [(src_t, (x, y))] in content px
        self.frames = None

    def load(self):
        if self.frames is not None:
            return
        cmd = ["ffmpeg", "-v", "error", "-ss", f"{self.start:.3f}", "-t", f"{self.duration + 0.2:.3f}",
               "-i", SRC, "-vf", f"crop={CW}:{CH}:{VX0}:{VY0}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
        raw = subprocess.run(cmd, check=True, capture_output=True).stdout
        n = len(raw) // (CW * CH * 3)
        arr = np.frombuffer(raw, np.uint8)[: n * CW * CH * 3].reshape(n, CH, CW, 3)
        self.frames = [Image.fromarray(a) for a in arr]
        self.src_fps = n / (self.duration + 0.2)

    def unload(self):
        self.frames = None

    def camera(self, st):
        ks = self.cams
        if st <= ks[0][0]:
            c = ks[0][1]
        elif st >= ks[-1][0]:
            c = ks[-1][1]
        else:
            for (t0, c0), (t1, c1) in zip(ks, ks[1:]):
                if t0 <= st <= t1:
                    k = ease((st - t0) / (t1 - t0)) if t1 > t0 else 1
                    # interpolate zoom in log space so the move feels even
                    z = math.exp(lerp(math.log(c0[2]), math.log(c1[2]), k))
                    c = (lerp(c0[0], c1[0], k), lerp(c0[1], c1[1], k), z)
                    break
        cx, cy, z = c
        vw, vh = CW / z, CH / z
        x0 = min(max(cx - vw / 2, 0), CW - vw)
        y0 = min(max(cy - vh / 2, 0), CH - vh)
        return x0, y0, vw, vh

    def render(self, t):
        self.load()
        st = self.start + t
        idx = min(int(t * self.src_fps), len(self.frames) - 1)
        x0, y0, vw, vh = self.camera(st)
        sc = CARD_W / vw

        def to_card(px, py):
            return (px - x0) * sc, (py - y0) * sc

        view = self.frames[idx].resize((CARD_W, CARD_H), Image.LANCZOS, box=(x0, y0, x0 + vw, y0 + vh))
        if sc > 1.15:
            view = view.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
        view = view.convert("RGBA")

        # spotlight: dim everything except the active highlights
        active = [(fade(st, a, b, 0.35), r) for a, b, r in self.highlights]
        active = [(a, r) for a, r in active if a > 0]
        if active:
            dim = max(a for a, _ in active)
            mask = Image.new("L", view.size, int(90 * dim))
            md = ImageDraw.Draw(mask)
            rings = Image.new("RGBA", view.size, (0, 0, 0, 0))
            rd = ImageDraw.Draw(rings)
            for a, r in active:
                grow = 10 + 6 * (1 - a)
                bx0, by0 = to_card(r[0], r[1])
                bx1, by1 = to_card(r[2], r[3])
                box = (bx0 - grow, by0 - grow, bx1 + grow, by1 + grow)
                md.rounded_rectangle(box, 14, fill=int(90 * dim * (1 - a)))
                rd.rounded_rectangle(box, 14, outline=ACCENT + (int(255 * a),), width=4)
            mask = mask.filter(ImageFilter.GaussianBlur(6))
            view.paste(Image.new("RGBA", view.size, (8, 6, 24, 255)), (0, 0), mask)
            glow = rings.filter(ImageFilter.GaussianBlur(10))
            view.alpha_composite(glow)
            view.alpha_composite(glow)
            view.alpha_composite(rings)

        # click ripples
        for ct, (px, py) in self.clicks:
            k = (st - ct) / 0.7
            if 0 <= k <= 1:
                cx, cy = to_card(px, py)
                layer = Image.new("RGBA", view.size, (0, 0, 0, 0))
                d = ImageDraw.Draw(layer)
                rr = 12 + 60 * ease_out(k)
                a = int(230 * (1 - k))
                d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), outline=ACCENT2 + (a,), width=5)
                d.ellipse((cx - 14, cy - 14, cx + 14, cy + 14), fill=ACCENT2 + (int(a * 0.5),))
                view.alpha_composite(layer)

        card = Image.new("RGBA", (CARD_W, CARD_H + BAR_H))
        card.paste(CARD_BAR, (0, 0))
        card.paste(view, (0, BAR_H))
        card.putalpha(CARD_MASK)

        frame = background(GLOBAL_T[0]).convert("RGBA")
        frame.alpha_composite(CARD_SHADOW, (CARD_X - CARD_SHADOW_PAD, CARD_Y - CARD_SHADOW_PAD + 12))
        frame.alpha_composite(card, (CARD_X, CARD_Y))
        self.caption(frame, t)
        return frame

    def caption(self, frame, t):
        a = ease_out((t - 0.15) / 0.5) * (1 - ease(clamp01((t - (self.duration - 0.35)) / 0.35)))
        dy = 18 * (1 - ease_out((t - 0.15) / 0.5))
        y = CARD_Y + CARD_H + BAR_H + 34 + dy
        x = CARD_X + 4
        tf = font("Inter-Bold.otf", 46)
        sf = font("Inter-Regular.otf", 28)
        nf = font("Inter-Bold.otf", 22)
        # step badge
        layer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        d.rounded_rectangle((x, y + 6, x + 58, y + 46), 12, fill=ACCENT + (int(255 * a),))
        d.text((x + 29, y + 26), self.step, font=nf, fill=(255, 255, 255, int(255 * a)), anchor="mm")
        d.text((x + 80, y + 26), self.title, font=tf, fill=TEXT + (int(255 * a),), anchor="lm")
        tw = d.textlength(self.title, font=tf)
        d.text((x + 80 + tw + 28, y + 30), self.sub, font=sf, fill=MUTED + (int(255 * a),), anchor="lm")
        frame.alpha_composite(layer)


GLOBAL_T = [0.0]

CLIPS = [
    Clip(28.6, 34.6, "01", "Point it at a repository", "a GitHub URL or a local directory",
         [(28.6, cam(330, 181, 1.7)), (31.6, cam(330, 181, 1.7)), (32.9, FULL)],
         [(29.0, 31.6, R(28, 167, 979, 195)), (32.6, 34.6, R(28, 213, 205, 241))]),
    Clip(40.6, 45.6, "02", "Filter by name or description", "the rendered SKILL.md follows",
         [(40.6, FULL), (41.5, cam(370, 530, 1.5))],
         [(41.3, 42.6, R(61, 467, 333, 494)), (42.6, 45.6, R(61, 526, 333, 603)),
          (43.2, 45.6, R(400, 530, 600, 565))]),
    Clip(80.9, 85.0, "03", "Every SKILL.md in one list", "copies folded into one skill",
         [(80.9, cam(330, 200, 1.7)), (82.6, cam(330, 200, 1.7)), (83.7, FULL)],
         [(81.0, 82.7, R(28, 167, 979, 195)), (83.4, 85.0, R(28, 213, 213, 241))]),
    Clip(95.9, 101.6, "04", "Group by shared words", "skill families surface on their own",
         [(95.9, FULL), (96.8, cam(330, 470, 1.6))],
         [(96.6, 97.4, R(58, 374, 282, 400)),
          (97.6, 101.6, R(62, 405, 320, 430)), (97.6, 101.6, R(62, 591, 320, 616))],
         [(97.1, S(72, 387))]),
    Clip(119.6, 123.8, "05", "Fold a family away", "one click, the count stays",
         [(119.6, cam(330, 500, 1.6))],
         [(121.1, 123.8, R(62, 591, 320, 616))],
         [(120.95, S(118, 603))]),
    Clip(131.6, 137.4, "06", "Filter inside the groups", "counts follow the matches",
         [(131.6, cam(330, 450, 1.6)), (134.4, cam(330, 450, 1.6)), (135.6, cam(489, 440, 1.15))],
         [(132.2, 133.9, R(61, 341, 333, 368)), (133.9, 137.4, R(58, 405, 335, 510))]),
]


# ---------------------------------------------------------------- title cards

class Intro:
    duration = 4.2

    def render(self, t):
        f = background(GLOBAL_T[0]).convert("RGBA")
        cx, cy = W / 2, H / 2 - 40
        # logo mark: a 3x3 constellation of skill dots
        a = ease_out(t / 0.6)
        s = 0.7 + 0.3 * ease_back(t / 0.7)
        layer = Image.new("RGBA", f.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        size = 120 * s
        lx, ly = cx, cy - 170
        d.rounded_rectangle((lx - size / 2, ly - size / 2, lx + size / 2, ly + size / 2), 30 * s,
                            fill=ACCENT + (int(255 * a),))
        pts = [(-1, -1), (0, -1), (1, -1), (-1, 0), (0, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
        for i, (px, py) in enumerate(pts):
            k = ease_back((t - 0.3 - i * 0.05) / 0.4)
            r = 9 * s * k if i != 4 else 13 * s * k
            ox, oy = lx + px * 30 * s, ly + py * 30 * s
            if r > 0:
                col = (255, 255, 255) if i != 4 else ACCENT2
                d.ellipse((ox - r, oy - r, ox + r, oy + r), fill=col + (int(255 * a),))
        f.alpha_composite(layer)

        k1 = ease_out((t - 0.5) / 0.7)
        draw_text(f, (cx, cy + 30 * (1 - k1)), "Skill Atlas", font("InterDisplay-Bold.otf", 150), TEXT,
                  k1, anchor="mm")
        k2 = ease_out((t - 1.1) / 0.7)
        draw_text(f, (cx, cy + 115 + 20 * (1 - k2)), "See every agent skill your repository already has.",
                  font("Inter-Regular.otf", 44), MUTED, k2, anchor="mm")
        k3 = ease_out((t - 1.7) / 0.6)
        # accent underline sweep
        lw = 520 * ease((t - 1.4) / 0.8)
        if lw > 1:
            g = Image.new("RGBA", f.size, (0, 0, 0, 0))
            ImageDraw.Draw(g).rounded_rectangle((cx - lw / 2, cy + 175, cx + lw / 2, cy + 181), 3,
                                                fill=ACCENT2 + (int(220 * k3 + 35),))
            f.alpha_composite(g)
        return f


class Hook:
    duration = 4.6

    def render(self, t):
        f = background(GLOBAL_T[0]).convert("RGBA")
        cx = W / 2
        k1 = ease_out(t / 0.6)
        draw_text(f, (cx, 330 + 20 * (1 - k1)), "Your agent skills are everywhere.",
                  font("InterDisplay-Bold.otf", 84), TEXT, k1, anchor="mm")
        labels = [".agents/skills", ".claude/skills", ".github/skills", "agent folders"]
        cf = font(MONO_BOLD, 34)
        widths = [text_size(lb, cf)[0] + 44 for lb in labels]
        gap = 28
        x = cx - (sum(widths) + gap * (len(labels) - 1)) / 2
        for i, lb in enumerate(labels):
            k = ease_back((t - 0.6 - i * 0.18) / 0.45)
            a = clamp01((t - 0.6 - i * 0.18) / 0.25)
            yy = 470 + 40 * (1 - k)
            chip(f, x, yy, lb, cf, a, fill=ACCENT2 if i % 2 else ACCENT)
            x += widths[i] + gap
        k3 = ease_out((t - 1.7) / 0.6)
        draw_text(f, (cx, 650 + 16 * (1 - k3)),
                  "Copied between them, and nobody knows what the repository already holds.",
                  font("Inter-Regular.otf", 40), MUTED, k3, anchor="mm")
        k4 = ease_out((t - 2.6) / 0.6)
        draw_text(f, (cx, 760 + 16 * (1 - k4)), "Skill Atlas finds them all.",
                  font("Inter-SemiBold.otf", 48), ACCENT2, k4, anchor="mm")
        return f


class Outro:
    duration = 7.5

    def render(self, t):
        f = background(GLOBAL_T[0]).convert("RGBA")
        cx = W / 2
        k1 = ease_out(t / 0.6)
        draw_text(f, (cx, 170 + 20 * (1 - k1)), "Skill Atlas", font("InterDisplay-Bold.otf", 110), TEXT, k1,
                  anchor="mm")
        labels = ["No clone", "Nothing stored", "Sanitized SKILL.md", "Same scan in your terminal",
                  "GET /api/scan"]
        cf = font("Inter-SemiBold.otf", 28)
        widths = [text_size(lb, cf)[0] + 44 for lb in labels]
        gap = 18
        x = cx - (sum(widths) + gap * (len(labels) - 1)) / 2
        for i, lb in enumerate(labels):
            k = ease_back((t - 0.4 - i * 0.12) / 0.45)
            a = clamp01((t - 0.4 - i * 0.12) / 0.25)
            chip(f, x, 270 + 30 * (1 - k), lb, cf, a, fill=ACCENT2 if i % 2 else ACCENT)
            x += widths[i] + gap

        # terminal
        ta = ease_out((t - 1.0) / 0.5)
        tw_, th_ = 980, 300
        tx, ty = cx - tw_ / 2, 390 + 30 * (1 - ta)
        if ta > 0:
            sh, pad = shadow((tw_, th_), 16, 22, 0.55 * ta)
            f.alpha_composite(sh, (int(tx - pad), int(ty - pad + 10)))
            layer = Image.new("RGBA", f.size, (0, 0, 0, 0))
            d = ImageDraw.Draw(layer)
            d.rounded_rectangle((tx, ty, tx + tw_, ty + th_), 16, fill=(14, 16, 28, int(245 * ta)),
                                outline=(255, 255, 255, int(40 * ta)), width=2)
            for i, col in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
                ccx = tx + 26 + i * 22
                d.ellipse((ccx - 6, ty + 20, ccx + 6, ty + 32), fill=col + (int(255 * ta),))
            f.alpha_composite(layer)
            mf = font(MONO, 34)
            lines = [("$ ", "npm ci && npm run build", 1.4), ("$ ", "./skill-atlas web", 2.6),
                     ("", "Skill Atlas at http://localhost:4173", 3.5)]
            for i, (prompt, cmd, t0) in enumerate(lines):
                yy = ty + 80 + i * 66
                if t < t0:
                    continue
                n = len(cmd) if not prompt else int(clamp01((t - t0) / (0.035 * len(cmd))) * len(cmd))
                a = 1.0 if prompt else ease_out((t - t0) / 0.3)
                if prompt:
                    draw_text(f, (tx + 40, yy), prompt, mf, ACCENT2, ta)
                    draw_text(f, (tx + 40 + 42, yy), cmd[:n], mf, TEXT, ta)
                else:
                    draw_text(f, (tx + 40, yy), cmd, mf, (134, 239, 172), a * ta)
        k4 = ease_out((t - 4.2) / 0.6)
        draw_text(f, (cx, 800 + 16 * (1 - k4)), "Grab it from the repository",
                  font("InterDisplay-Bold.otf", 64), TEXT, k4, anchor="mm")
        k5 = ease_out((t - 4.6) / 0.6)
        draw_text(f, (cx, 880 + 16 * (1 - k5)), "and see your skills in one page today.",
                  font("Inter-Regular.otf", 40), MUTED, k5, anchor="mm")
        # fade to black at the very end
        out = ease(clamp01((t - (self.duration - 0.6)) / 0.6))
        if out > 0:
            f.alpha_composite(Image.new("RGBA", f.size, (0, 0, 0, int(255 * out))))
        return f


# ---------------------------------------------------------------- timeline

def main():
    scenes = [Intro(), Hook(), *CLIPS, Outro()]
    starts, t = [], 0.0
    for i, sc in enumerate(scenes):
        starts.append(t)
        t += sc.duration - (XFADE if i < len(scenes) - 1 else 0)
    total = t
    nframes = int(round(total * FPS))
    print(f"{len(scenes)} scenes, {total:.1f}s, {nframes} frames", flush=True)

    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
         "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "18",
         "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUT],
        stdin=subprocess.PIPE)

    for n in range(nframes):
        gt = n / FPS
        GLOBAL_T[0] = gt
        live = [(i, gt - starts[i]) for i, sc in enumerate(scenes)
                if starts[i] <= gt < starts[i] + sc.duration]
        frame = None
        for i, lt in live:
            img = scenes[i].render(lt).convert("RGB")
            if frame is None:
                frame = img
            else:  # crossfade into the next scene
                frame = Image.blend(frame, img, ease(lt / XFADE))
        for i, sc in enumerate(scenes):  # free decoded clips once they are done
            if isinstance(sc, Clip) and gt > starts[i] + sc.duration:
                sc.unload()
        enc.stdin.write(frame.tobytes())
        if n % 150 == 0:
            print(f"  frame {n}/{nframes}", flush=True)
    enc.stdin.close()
    enc.wait()
    print("wrote", OUT)


if __name__ == "__main__":
    main()
