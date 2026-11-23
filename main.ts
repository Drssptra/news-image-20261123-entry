// news-image-20261123 — Monday 23 November 2026 as one newspaper front page.
// Node 22, standard library only. No network, no randomness, fully deterministic:
// running it twice writes byte-identical PNGs. Output: 1024x1024 PNG at
// $MAKEFUN_OUTPUT_DIR/entry.png (default /output/entry.png).
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ------------------------------------------------------------ palette
type RGB = [number, number, number];
const PAPER: RGB = [246, 241, 228];
const PANEL: RGB = [255, 253, 247];
const INK: RGB = [24, 23, 20];
const RED: RGB = [178, 38, 38];
const BLUE: RGB = [29, 74, 118];
const SKY: RGB = [172, 210, 234];
const PALE: RGB = [212, 230, 240];
const SEA: RGB = [42, 106, 158];
const DEEP: RGB = [26, 70, 112];
const SAND: RGB = [232, 204, 148];
const LEAF: RGB = [72, 122, 72];
const HILL: RGB = [94, 138, 80];
const SUN: RGB = [238, 182, 42];
const FLAME: RGB = [224, 104, 30];
const FLAME2: RGB = [244, 174, 52];
const SMOKE: RGB = [126, 126, 120];
const GREY: RGB = [148, 144, 136];
const DARK: RGB = [94, 94, 90];
const WHITE: RGB = [255, 255, 255];
const BROWN: RGB = [144, 100, 64];
const CREAM: RGB = [237, 224, 196];
const GOLD: RGB = [214, 158, 40];

// ------------------------------------------------------------ canvas
class Page {
  readonly w: number;
  readonly h: number;
  private pxbuf: Uint8ClampedArray;
  constructor(w: number, h: number, bg: RGB) {
    this.w = w;
    this.h = h;
    this.pxbuf = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      this.pxbuf[i * 4] = bg[0];
      this.pxbuf[i * 4 + 1] = bg[1];
      this.pxbuf[i * 4 + 2] = bg[2];
      this.pxbuf[i * 4 + 3] = 255;
    }
  }
  dot(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.pxbuf[i] = c[0];
    this.pxbuf[i + 1] = c[1];
    this.pxbuf[i + 2] = c[2];
  }
  box(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(this.w, x + w);
    const y1 = Math.min(this.h, y + h);
    for (let yy = y0; yy < y1; yy++)
      for (let xx = x0; xx < x1; xx++) this.dot(xx, yy, c);
  }
  hline(x: number, y: number, len: number, c: RGB): void {
    for (let i = 0; i < len; i++) this.dot(x + i, y, c);
  }
  vline(x: number, y: number, len: number, c: RGB): void {
    for (let i = 0; i < len; i++) this.dot(x, y + i, c);
  }
  seg(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    // Bresenham line.
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.dot(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }
  spot(cx: number, cy: number, r: number, c: RGB): void {
    for (let dy = -r; dy <= r; dy++) {
      const dx = Math.floor(Math.sqrt(r * r - dy * dy));
      this.hline(cx - dx, cy + dy, dx * 2 + 1, c);
    }
  }
  circle(cx: number, cy: number, r: number, c: RGB): void {
    for (let a = 0; a < 360; a++) {
      const rad = (a * Math.PI) / 180;
      this.dot(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), c);
    }
  }
  arc(cx: number, cy: number, r: number, a0: number, a1: number, c: RGB): void {
    for (let a = a0; a <= a1; a++) {
      const rad = (a * Math.PI) / 180;
      this.dot(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), c);
    }
  }
  wedge(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
    // Filled triangle by scanline.
    const lo = Math.max(0, Math.min(y0, y1, y2));
    const hi = Math.min(this.h - 1, Math.max(y0, y1, y2));
    const edges: Array<[number, number, number, number]> = [
      [x0, y0, x1, y1],
      [x1, y1, x2, y2],
      [x2, y2, x0, y0],
    ];
    for (let y = lo; y <= hi; y++) {
      const xs: number[] = [];
      for (const [ax, ay, bx, by] of edges) {
        if ((ay <= y && by > y) || (by <= y && ay > y)) {
          xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
        }
      }
      if (xs.length >= 2) {
        const a = Math.floor(Math.min(xs[0], xs[1]));
        const b = Math.ceil(Math.max(xs[0], xs[1]));
        this.hline(a, y, b - a + 1, c);
      }
    }
  }
  border(x: number, y: number, w: number, h: number, c: RGB, t: number): void {
    this.box(x, y, w, t, c);
    this.box(x, y + h - t, w, t, c);
    this.box(x, y, t, h, c);
    this.box(x + w - t, y, t, h, c);
  }
  dump(): Uint8ClampedArray {
    return this.pxbuf;
  }
}

// ------------------------------------------------------------ 5x7 bitmap font
// Each glyph: 7 strings of 5 chars; "#" = ink, "." = blank.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", "..#..", ".#..."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  '"': [".#.#.", ".#.#.", ".....", ".....", ".....", ".....", "....."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...##.", "..#..", ".....", "..#.."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  ";": [".....", ".##..", ".##..", ".....", ".##..", "..#..", ".#..."],
  "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
  "/": ["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."],
  "%": ["##..#", "##.#.", "....#", "...#.", "..#..", ".#..#", "#..##"],
  $: ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  "+": [".....", "..#..", "..#..", ".###.", "..#..", "..#..", "....."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
  _: [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
  "*": [".....", "..#..", "#.#.#", ".###.", "#.#.#", "..#..", "....."],
  "[": [".###.", ".#...", ".#...", ".#...", ".#...", ".#...", ".###."],
  "]": [".###.", "...#.", "...#.", "...#.", "...#.", "...#.", ".###."],
  "#": [".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."],
  "@": [".###.", "#...#", "#.###", "#.#.#", "#.##.", "#....", ".###."],
  "<": ["...#.", "..#..", ".#...", "#....", ".#...", "..#..", "...#."],
  ">": [".#...", "..#..", "...#.", "....#", "...#.", "..#..", ".#..."],
  "|": ["..#..", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  "\\": ["#....", ".#...", ".#...", "..#..", "...#.", "...#.", "....#"],
  "^": ["..#..", ".#.#.", "#...#", ".....", ".....", ".....", "....."],
  "~": [".....", ".....", ".#..#", "#.##.", ".....", ".....", "....."],
  "`": [".#...", "..#..", ".....", ".....", ".....", ".....", "....."],
};
const BLANK_GLYPH = [".....", ".....", ".....", ".....", ".....", ".....", "....."];

function glyphRows(ch: string): string[] {
  return FONT[ch] ?? BLANK_GLYPH;
}

function measure(s: string, scale: number): number {
  return s.length === 0 ? 0 : s.length * 6 * scale - scale;
}

function putText(pg: Page, s: string, x: number, y: number, scale: number, c: RGB): void {
  const up = s.toUpperCase();
  for (let ci = 0; ci < up.length; ci++) {
    const rows = glyphRows(up[ci]);
    const ox = x + ci * 6 * scale;
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        const bit = rows[r][col];
        if (bit === "1" || bit === "#") {
          pg.box(ox + col * scale, y + r * scale, scale, scale, c);
        }
      }
    }
  }
}

function wrap(s: string, maxW: number, scale: number): string[] {
  const words = s.split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (measure(trial, scale) <= maxW || cur === "") cur = trial;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

function putPara(pg: Page, s: string, x: number, y: number, maxW: number, scale: number, c: RGB, lh: number): number {
  const lines = wrap(s, maxW, scale);
  for (let i = 0; i < lines.length; i++) putText(pg, lines[i], x, y + i * lh, scale, c);
  return y + lines.length * lh;
}

// ------------------------------------------------------------ PNG writer
const CRC_TAB: number[] = (() => {
  const tab: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tab.push(c >>> 0);
  }
  return tab;
})();

function crcOf(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TAB[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crcOf(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function toPNG(pg: Page): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  const buf = pg.dump();
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // no filter
    for (let x = 0; x < W; x++) {
      const src = (y * W + x) * 4;
      const dst = y * (1 + W * 3) + 1 + x * 3;
      raw[dst] = buf[src];
      raw[dst + 1] = buf[src + 1];
      raw[dst + 2] = buf[src + 2];
    }
  }
  // zlib deflate is deterministic for a fixed input and level.
  const packed = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // 8-bit
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", packed), pngChunk("IEND", Buffer.alloc(0))]);
}

// ------------------------------------------------------------ scenes
type Scene = (pg: Page, x: number, y: number, w: number, h: number) => void;

function waves(pg: Page, x: number, y: number, w: number, h: number, c: RGB, col: RGB): void {
  pg.box(x, y, w, h, c);
  for (let r = 0; r < 3; r++) {
    const wy = y + 5 + r * 8;
    for (let wx = x + 6 + (r % 2) * 14; wx < x + w - 18; wx += 28) pg.hline(wx, wy, 16, col);
  }
}

// Lead: Antalya coast with the rejected pact — a white document crossed out in red.
function scenePact(pg: Page, x: number, y: number, w: number, h: number): void {
  pg.box(x, y, w, h, SKY);
  pg.spot(x + w - 46, y + 36, 22, SUN);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    pg.seg(
      Math.round(x + w - 46 + 28 * Math.cos(a)),
      Math.round(y + 36 + 28 * Math.sin(a)),
      Math.round(x + w - 46 + 37 * Math.cos(a)),
      Math.round(y + 36 + 37 * Math.sin(a)),
      SUN,
    );
  }
  pg.wedge(x, y + h, x + Math.floor(w * 0.4), y + Math.floor(h * 0.42), x + Math.floor(w * 0.75), y + h, HILL);
  pg.wedge(x + Math.floor(w * 0.55), y + h, x + Math.floor(w * 0.82), y + Math.floor(h * 0.55), x + w, y + h, LEAF);
  const seaY = y + Math.floor(h * 0.74);
  waves(pg, x, seaY, w, y + h - seaY, SEA, WHITE);
  // the pact document, crossed out
  const dw = 150;
  const dh = 96;
  const dx = x + Math.floor((w - dw) / 2);
  const dy = y + 26;
  pg.box(dx, dy, dw, dh, WHITE);
  pg.border(dx, dy, dw, dh, INK, 2);
  putText(pg, "ANTALYA PACT", dx + 16, dy + 12, 1, INK);
  for (let i = 0; i < 3; i++) pg.hline(dx + 16, dy + 34 + i * 10, dw - 32 - i * 18, GREY);
  pg.seg(dx + 8, dy + 8, dx + dw - 8, dy + dh - 8, RED);
  pg.seg(dx + dw - 8, dy + 8, dx + 8, dy + dh - 8, RED);
  pg.seg(dx + 10, dy + 10, dx + dw - 10, dy + dh - 10, RED);
  pg.seg(dx + dw - 10, dy + 10, dx + 10, dy + dh - 10, RED);
  putText(pg, "NO DEAL", x + 12, y + h - 24, 2, RED);
}

// Benghazi: capsized corvette at the pier, smoke rising, a rescue boat nearby.
function sceneBenghazi(pg: Page, x: number, y: number, w: number, h: number): void {
  pg.box(x, y, w, h, PALE);
  pg.spot(x + w - 30, y + 20, 11, SUN);
  const seaY = y + Math.floor(h * 0.6);
  waves(pg, x, seaY, w, y + h - seaY, DEEP, WHITE);
  // pier
  pg.box(x, seaY - 8, Math.floor(w * 0.34), 8, BROWN);
  // capsized hull: only the bow sticks out of the water, tilted
  const bx = x + Math.floor(w * 0.52);
  pg.wedge(bx, seaY + 2, bx + 34, seaY - 22, bx + 52, seaY + 2, INK);
  pg.wedge(bx + 52, seaY + 2, bx + 96, seaY + 6, bx + 110, seaY + 12, DARK);
  pg.box(bx + 30, seaY - 26, 6, 12, INK);
  // smoke from the wreck
  pg.spot(bx + 44, seaY - 24, 6, SMOKE);
  pg.spot(bx + 56, seaY - 28, 7, SMOKE);
  pg.spot(bx + 70, seaY - 24, 5, SMOKE);
  // small rescue boat
  const rx = x + Math.floor(w * 0.1);
  pg.box(rx, seaY + 8, 34, 8, RED);
  pg.wedge(rx + 34, seaY + 8, rx + 44, seaY + 12, rx + 34, seaY + 16, RED);
  pg.box(rx + 8, seaY - 2, 12, 10, WHITE);
  pg.border(rx + 8, seaY - 2, 12, 10, INK, 1);
}

// Banten factory fire: three-storey block, flames on the roof, smoke, a ladder.
function sceneFire(pg: Page, x: number, y: number, w: number, h: number): void {
  pg.box(x, y, w, h, PALE);
  const ground = y + Math.floor(h * 0.78);
  pg.box(x, ground, w, y + h - ground, SAND);
  const bx = x + Math.floor(w * 0.3);
  const bw = Math.floor(w * 0.44);
  const by = y + Math.floor(h * 0.26);
  const bh = ground - by;
  pg.box(bx, by, bw, bh, CREAM);
  pg.border(bx, by, bw, bh, INK, 1);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      pg.box(bx + 6 + c * 20, by + 6 + r * 9, 10, 6, BLUE);
    }
  }
  // flames licking the roof
  pg.wedge(bx + 10, by, bx + 24, by - 10, bx + 38, by, FLAME);
  pg.wedge(bx + 34, by, bx + 48, by - 8, bx + 62, by, FLAME2);
  pg.wedge(bx + 58, by, bx + 70, by - 12, bx + 84, by, FLAME);
  // small smoke puffs at roof level
  pg.spot(bx + 26, by - 6, 4, SMOKE);
  pg.spot(bx + 52, by - 8, 5, SMOKE);
  pg.spot(bx + 76, by - 6, 4, SMOKE);
  // ladder against the wall
  const lx = bx + bw + 10;
  pg.seg(lx, ground, lx + 12, by + 4, RED);
  pg.seg(lx + 6, ground, lx + 18, by + 4, RED);
  for (let i = 1; i <= 4; i++) {
    const ly = ground - i * 8;
    pg.hline(lx + 1 + i, ly, 6, RED);
  }
  putText(pg, "CIKANDE, BANTEN", x + 8, y + 6, 1, INK);
}

// Seoul exam hall: rows of desks, a phone with a red ban circle.
function sceneExam(pg: Page, x: number, y: number, w: number, h: number): void {
  pg.box(x, y, w, h, WHITE);
  pg.box(x, y, w, 10, BLUE);
  putText(pg, "CSAT EXAM HALL", x + 8, y + 2, 1, WHITE);
  const deskY = y + Math.floor(h * 0.42);
  for (let r = 0; r < 2; r++) {
    const dy = deskY + r * 16;
    for (let c = 0; c < 3; c++) {
      const dx = x + 14 + c * 58;
      pg.box(dx, dy, 44, 6, BROWN);
      pg.box(dx + 6, dy - 6, 32, 6, WHITE);
      pg.border(dx + 6, dy - 6, 32, 6, INK, 1);
    }
  }
  // a phone, banned
  const px = x + w - 62;
  const py = y + h - 34;
  pg.box(px, py, 22, 14, INK);
  pg.box(px + 3, py + 2, 16, 10, SKY);
  pg.circle(px + 11, py + 7, 12, RED);
  pg.seg(px + 2, py + 16, px + 20, py - 2, RED);
  pg.seg(px + 20, py + 16, px + 2, py - 2, RED);
  putText(pg, "NO AI", px - 46, py + 2, 1, RED);
}

// New Delhi: an arch monument with the flags of Nepal and India.
function sceneDelhi(pg: Page, x: number, y: number, w: number, h: number): void {
  pg.box(x, y, w, h, SKY);
  pg.spot(x + 34, y + 16, 8, SUN);
  const ground = y + Math.floor(h * 0.8);
  pg.box(x, ground, w, y + h - ground, LEAF);
  // arch monument: two pillars, a top slab, a small flag on top
  const ax = x + Math.floor(w * 0.32);
  const aw = Math.floor(w * 0.36);
  const ay = y + Math.floor(h * 0.18);
  pg.box(ax, ay + 26, 10, ground - ay - 26, BROWN);
  pg.box(ax + aw - 10, ay + 26, 10, ground - ay - 26, BROWN);
  pg.box(ax, ay, aw, 26, BROWN);
  pg.box(ax + Math.floor(aw / 2) - 8, ay + 26, 16, ground - ay - 26, CREAM);
  pg.vline(ax + Math.floor(aw / 2), ay - 10, 10, INK);
  pg.box(ax + Math.floor(aw / 2), ay - 10, 16, 6, RED);
  // two flag poles: Nepal (crimson) and India (saffron-white-green)
  const fx1 = x + 16;
  const fx2 = x + w - 16;
  pg.vline(fx1, y + 10, ground - y - 10, INK);
  pg.vline(fx2, y + 10, ground - y - 10, INK);
  pg.box(fx1, y + 10, 22, 6, RED);
  pg.box(fx1, y + 16, 22, 6, WHITE);
  pg.box(fx1, y + 22, 22, 6, RED);
  pg.box(fx2, y + 10, 22, 5, [255, 153, 51]);
  pg.box(fx2, y + 15, 22, 5, WHITE);
  pg.box(fx2, y + 20, 22, 5, [19, 136, 8]);
}

// Baltic tow: a tug pulling the damaged Sparta II, water cannons spraying.
function sceneTow(pg: Page, x: number, y: number, w: number, h: number): void {
  pg.box(x, y, w, h, PALE);
  pg.spot(x + w - 28, y + 18, 10, SUN);
  const seaY = y + Math.floor(h * 0.58);
  waves(pg, x, seaY, w, y + h - seaY, SEA, WHITE);
  // tug on the left
  const tx = x + 12;
  pg.box(tx, seaY - 6, 46, 10, RED);
  pg.wedge(tx + 46, seaY - 6, tx + 58, seaY - 1, tx + 46, seaY + 4, RED);
  pg.box(tx + 10, seaY - 18, 16, 12, WHITE);
  pg.border(tx + 10, seaY - 18, 16, 12, INK, 1);
  // tow line to the big ship
  const sx = x + Math.floor(w * 0.42);
  pg.seg(tx + 58, seaY - 2, sx, seaY - 8, INK);
  // the damaged cargo ship
  pg.box(sx, seaY - 10, Math.floor(w * 0.5), 14, INK);
  pg.wedge(sx + Math.floor(w * 0.5), seaY - 10, sx + Math.floor(w * 0.56), seaY - 3, sx + Math.floor(w * 0.5), seaY + 4, INK);
  pg.box(sx + 10, seaY - 24, 22, 14, BLUE);
  pg.box(sx + 36, seaY - 24, 22, 14, SUN);
  pg.box(sx + 62, seaY - 24, 22, 14, RED);
  // spray from a water cannon
  for (let i = 0; i < 5; i++) {
    pg.spot(sx + 8 + i * 4, seaY - 26 - i, 2, WHITE);
  }
  pg.spot(sx + 30, seaY - 28, 4, SMOKE);
}

// ------------------------------------------------------------ page layout
interface Story {
  kicker: string;
  headline: string;
  body: string;
  scene: Scene;
}

function storyPanel(pg: Page, x: number, y: number, w: number, h: number, s: Story): void {
  pg.box(x, y, w, h, PANEL);
  pg.border(x, y, w, h, INK, 2);
  putText(pg, s.kicker, x + 14, y + 14, 1, RED);
  const head = wrap(s.headline, w - 28, 2);
  let cy = y + 34;
  for (let i = 0; i < head.length; i++) putText(pg, head[i], x + 14, cy + i * 16, 2, INK);
  cy += head.length * 16 + 8;
  const sceneH = 64;
  const sceneY = y + h - sceneH - 12;
  putPara(pg, s.body, x + 14, cy, w - 28, 1, INK, 10);
  pg.border(x + 12, sceneY, w - 24, sceneH, INK, 1);
  s.scene(pg, x + 13, sceneY + 1, w - 26, sceneH - 2);
}

function main(): void {
  const pg = new Page(W, H, PAPER);

  // ---- masthead
  pg.box(20, 20, W - 40, 3, INK);
  const title = "THE MONDAY GLOBE";
  putText(pg, title, Math.floor((W - measure(title, 6)) / 2), 34, 6, INK);
  const dateLine = "Monday 23 November 2026";
  putText(pg, dateLine, Math.floor((W - measure(dateLine, 2)) / 2), 92, 2, RED);
  pg.box(20, 118, W - 40, 3, INK);
  pg.box(20, 126, W - 40, 1, INK);

  // ---- lead story: COP31 collapses
  const lx = 20;
  const ly = 140;
  const lw = W - 40;
  const lh = 300;
  pg.box(lx, ly, lw, lh, PANEL);
  pg.border(lx, ly, lw, lh, INK, 2);
  putText(pg, "CLIMATE SUMMIT - ANTALYA", lx + 16, ly + 16, 1, RED);
  putText(pg, "COP31 COLLAPSES IN ANTALYA", lx + 16, ly + 38, 3, INK);
  putPara(
    pg,
    "After two weeks of talks - the longest COP ever - nearly 200 countries rejected the Antalya Pact on Sunday. The draft never mentioned fossil fuels. The EU walked out. UN chief Guterres called it deeply disappointing.",
    lx + 16,
    ly + 76,
    560,
    2,
    INK,
    19,
  );
  const sx = lx + 612;
  const sy = ly + 66;
  const sw = lw - 612 - 16;
  const sh = lh - 66 - 16;
  pg.border(sx, sy, sw, sh, INK, 1);
  scenePact(pg, sx + 1, sy + 1, sw - 2, sh - 2);
  putText(pg, "FIRST MAJOR BREAKDOWN SINCE COP15 IN 2009", lx + 16, ly + lh - 30, 1, BLUE);

  // ---- middle row: Benghazi + Banten
  const rowA = 456;
  const rowAH = 244;
  storyPanel(pg, 20, rowA, 484, rowAH, {
    kicker: "BENGHAZI, LIBYA",
    headline: "DRONE BOAT SINKS RUSSIAN WARSHIP",
    body: "A suspected drone boat blew up aboard the Russian corvette Merkury at the Benghazi naval base on Sunday. Satellite images show it mostly capsized. Ten Russians and Libyans were hurt. A Maltese-flagged ship was also hit.",
    scene: sceneBenghazi,
  });
  storyPanel(pg, 520, rowA, 484, rowAH, {
    kicker: "BANTEN, INDONESIA",
    headline: "CANDY FACTORY FIRE: 24 BODY BAGS",
    body: "Rescuers recovered 24 body bags from the burned PT Fonusa Agung Mulia candy factory by Sunday evening. At least three are confirmed dead and dozens are missing. The search resumes at 7 a.m. Monday.",
    scene: sceneFire,
  });

  // ---- bottom row: Seoul, New Delhi, Baltic
  const rowB = 716;
  const rowBH = 288;
  const bw = 317;
  storyPanel(pg, 20, rowB, bw, rowBH, {
    kicker: "SEOUL",
    headline: "MINISTER QUITS OVER AI EXAM CHEAT",
    body: "Education Minister Choi Kyo-jin resigned Sunday after last-minute anti-AI cheating rules sowed confusion before the CSAT college exam. Officials caught 111 suspected cheating cases with electronic devices.",
    scene: sceneExam,
  });
  storyPanel(pg, 353, rowB, bw, rowBH, {
    kicker: "NEW DELHI",
    headline: "NEPAL PM MEETS MODI IN DELHI",
    body: "Nepal PM Balendra Shah holds delegation talks with PM Modi on Monday, his first bilateral trip abroad since taking office in March. The two sides will sign deals on energy, health and education.",
    scene: sceneDelhi,
  });
  storyPanel(pg, 686, rowB, bw, rowBH, {
    kicker: "BALTIC SEA",
    headline: "SPARTA II TOWED OUT OF FINLAND",
    body: "A Russian rescue ship began towing the drone-struck cargo ship Sparta II out of Finnish waters on Sunday. Flames are out, but containers are still hot. All 16 crew were evacuated.",
    scene: sceneTow,
  });

  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "entry.png"), toPNG(pg));
}

main();
