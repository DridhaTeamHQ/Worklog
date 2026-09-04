/**
 * Draws the app icons — a periwinkle ground with the pale-yellow asterisk mark — as
 * PNGs, with nothing but Node's zlib. Run once: `node scripts/make-icons.js`.
 *
 *   assets/images/icon.png                     1024×1024  iOS / generic
 *   assets/images/android-icon-foreground.png  1024×1024  adaptive foreground (transparent)
 *   assets/images/android-icon-monochrome.png  1024×1024  adaptive monochrome (white)
 *   assets/images/splash-icon.png              512×512    splash mark (transparent)
 *   assets/images/favicon.png                  64×64
 *   assets/images/notification-icon.png        96×96      Android status-bar glyph (white)
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '..', 'assets', 'images');

const HERO = [0x5b, 0x7f, 0xe8];
const HERO_DEEP = [0x4a, 0x6b, 0xd6];
const ACCENT = [0xf5, 0xf0, 0xa8];
const INK = [0x3e, 0x3a, 0x0e];
const WHITE = [0xff, 0xff, 0xff];

const crcTable = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function png(width, height, paint) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = paint(x + 0.5, y + 0.5);
      const i = y * (width * 4 + 1) + 1 + x * 4;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Signed distance to a rounded rectangle centred at the origin. */
const roundedRect = (px, py, hw, hh, r) => {
  const dx = Math.abs(px) - hw + r;
  const dy = Math.abs(py) - hh + r;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
};

/** Six-armed asterisk with rounded arm ends, as a signed distance. */
function asterisk(px, py, size) {
  let d = Infinity;
  const armLen = size * 0.42;
  const armW = size * 0.13;
  for (let k = 0; k < 3; k += 1) {
    const a = (Math.PI / 3) * k + Math.PI / 6;
    const cos = Math.cos(a); const sin = Math.sin(a);
    const rx = px * cos + py * sin;
    const ry = -px * sin + py * cos;
    d = Math.min(d, roundedRect(rx, ry, armLen, armW / 2, armW / 2));
  }
  return d;
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const cover = (dist, aa = 1.2) => Math.max(0, Math.min(1, 0.5 - dist / aa));

/** The full icon: gradient ground, a soft ring, the yellow disc and the ink asterisk. */
function iconPainter(size, { ground = true, monochrome = false, transparentGround = false } = {}) {
  const c = size / 2;
  return (x, y) => {
    const px = x - c; const py = y - c;
    let color = transparentGround ? [0, 0, 0] : mix(HERO, HERO_DEEP, (x + y) / (2 * size));
    let alpha = transparentGround ? 0 : 255;

    if (ground && !transparentGround) {
      // A faint orbit ring, like the hero art.
      const ring = Math.abs(Math.hypot(px * 0.75, py * 1.15) - size * 0.38);
      const ringCover = cover(ring - size * 0.004, 1.5) * 0.28;
      color = mix(color, WHITE, ringCover);
    }

    if (monochrome) {
      const a = cover(asterisk(px, py, size * 0.62));
      return [255, 255, 255, Math.round(a * 255)];
    }

    const disc = Math.hypot(px, py) - size * 0.30;
    const discCover = cover(disc);
    if (discCover > 0) { color = mix(color, ACCENT, discCover); alpha = Math.max(alpha, Math.round(discCover * 255)); }
    const star = cover(asterisk(px, py, size * 0.36));
    if (star > 0) { color = mix(color, INK, star); alpha = Math.max(alpha, Math.round(star * 255)); }
    return [...color, alpha];
  };
}

fs.mkdirSync(out, { recursive: true });
const write = (name, buf) => { fs.writeFileSync(path.join(out, name), buf); console.log(`wrote ${name} (${buf.length} bytes)`); };

write('icon.png', png(1024, 1024, iconPainter(1024)));
write('android-icon-foreground.png', png(1024, 1024, (x, y) => {
  // Adaptive icons are masked to the inner ~66%, so the mark is drawn smaller.
  const s = 1024; const c = s / 2; const px = (x - c) * 1.45; const py = (y - c) * 1.45;
  return iconPainter(s, { transparentGround: true })(px + c, py + c);
}));
write('android-icon-monochrome.png', png(1024, 1024, (x, y) => {
  const s = 1024; const c = s / 2; const px = (x - c) * 1.45; const py = (y - c) * 1.45;
  return iconPainter(s, { monochrome: true })(px + c, py + c);
}));
write('splash-icon.png', png(512, 512, iconPainter(512, { transparentGround: true })));
write('favicon.png', png(64, 64, iconPainter(64)));
write('notification-icon.png', png(96, 96, iconPainter(96, { monochrome: true })));
