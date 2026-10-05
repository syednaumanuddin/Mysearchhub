/**
 * Zero-dependency PNG icon generator.
 *
 * Writes a rounded-square badge with a magnifier glyph at the four sizes the
 * manifest references. Everything is done by hand: IHDR/IDAT/IEND chunks, a
 * manually tabulated CRC32, and `node:zlib` for the deflate stream. Run once
 * (`npm run icons`); the output PNGs are committed.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
const SIZES = [16, 32, 48, 128];
const SUPERSAMPLE = 4;

/** Design space is a 128x128 grid; every size is a scaled render of it. */
const DESIGN = 128;
const PRIMARY = [0x63, 0x66, 0xf1];
const WHITE = [0xff, 0xff, 0xff];

const RECT_INSET = 4;
const RECT_RADIUS = 28;
const GLYPH_CENTER = [57, 55];
const GLYPH_RING_RADIUS = 24;
const GLYPH_STROKE = 11;
const GLYPH_HANDLE_ANGLE = Math.PI / 4;
const GLYPH_HANDLE_LENGTH = 27;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function sdRoundedRect(px, py, half, radius) {
  const qx = Math.abs(px) - (half - radius);
  const qy = Math.abs(py) - (half - radius);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - radius;
}

function sdSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const lengthSq = abx * abx + aby * aby;
  const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, (apx * abx + apy * aby) / lengthSq));
  return Math.hypot(apx - abx * t, apy - aby * t);
}

function isBadge(designX, designY) {
  const half = DESIGN / 2 - RECT_INSET;
  return sdRoundedRect(designX - DESIGN / 2, designY - DESIGN / 2, half, RECT_RADIUS) <= 0;
}

function isGlyph(designX, designY) {
  const [cx, cy] = GLYPH_CENTER;
  const halfStroke = GLYPH_STROKE / 2;
  const ringDistance = Math.abs(Math.hypot(designX - cx, designY - cy) - GLYPH_RING_RADIUS);
  if (ringDistance <= halfStroke) return true;
  const hx = cx + Math.cos(GLYPH_HANDLE_ANGLE) * GLYPH_RING_RADIUS;
  const hy = cy + Math.sin(GLYPH_HANDLE_ANGLE) * GLYPH_RING_RADIUS;
  const ex = hx + Math.cos(GLYPH_HANDLE_ANGLE) * GLYPH_HANDLE_LENGTH;
  const ey = hy + Math.sin(GLYPH_HANDLE_ANGLE) * GLYPH_HANDLE_LENGTH;
  return sdSegment(designX, designY, hx, hy, ex, ey) <= halfStroke;
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const scale = DESIGN / size;
  const step = 1 / SUPERSAMPLE;
  const samples = SUPERSAMPLE * SUPERSAMPLE;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let badge = 0;
      let glyph = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const designX = (x + (sx + 0.5) * step) * scale;
          const designY = (y + (sy + 0.5) * step) * scale;
          if (isBadge(designX, designY)) badge += 1;
          if (isGlyph(designX, designY)) glyph += 1;
        }
      }
      const alpha = badge / samples;
      const glyphAlpha = Math.min(glyph / samples, badge / samples);
      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const base = PRIMARY[channel] ?? 0;
        const ink = WHITE[channel] ?? 0;
        rgba[offset + channel] = Math.round(base + (ink - base) * glyphAlpha);
      }
      rgba[offset + 3] = Math.round(alpha * 255);
    }
  }

  return encodePng(size, size, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = join(OUT_DIR, `icon${size}.png`);
  writeFileSync(file, renderIcon(size));
  console.log(`wrote ${file}`);
}
