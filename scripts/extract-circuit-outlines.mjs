#!/usr/bin/env node
/**
 * Builds `circuit-outlines.ts` — the stroke-only track shapes that drift behind
 * the app.
 *
 *   node scripts/extract-circuit-outlines.mjs
 *
 * Source SVGs come from Wikimedia Commons, but shipping them raw would drag in
 * labels, kerbs, sector colours and megabytes of metadata. Instead we parse the
 * path data, keep the large subpaths (the track, occasionally the pit lane),
 * simplify them, and normalise everything into a 100×100 box. The result is a
 * few kilobytes of plain polyline points that render as a single stroked path.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const TARGET = path.join(ROOT, 'frontend', 'src', 'app', 'core', 'config', 'circuit-outlines.ts');
const CACHE = path.join(os.tmpdir(), 'paddock-circuit-svg');

/** key → Commons filename. Sorted roughly by how recognisable the shape is. */
const CIRCUITS = {
  monaco: 'Circuit Monaco.svg',
  monza: 'Circuit Monza.svg',
  silverstone: 'Circuit Silverstone 2011.svg',
  spa: 'Spa-Francorchamps of Belgium.svg',
  suzuka: 'Suzuka circuit map--2005.svg',
  interlagos: 'Circuit Interlagos.svg',
  villeneuve: 'Circuit Gilles Villeneuve.svg',
  albert_park: 'Circuit Albert Park.svg',
  red_bull_ring: 'Circuit Red Bull Ring.svg',
  hockenheimring: 'Circuit Hockenheimring.svg',
  catalunya: 'Circuit Catalunya.svg',
  baku: 'Baku Formula One circuit map.svg',
  shanghai: 'Circuit Shanghai.svg',
  americas: 'Austin circuit.svg',
  sepang: 'Circuit Sepang.svg',
  hungaroring: 'Hungaroring.svg',
  marina_bay: 'Marina bay circuit.svg',
  zandvoort: 'Zandvoort.svg',
  jeddah: 'Jeddah Street Circuit 2021.svg',
  losail: 'Lusail International Circuit 2023.svg',
  imola: 'Imola 2009.svg',
  mugello: 'Mugello Racing Circuit track map.svg',
  portimao: 'Autódromo de Algarve.svg',
  paul_ricard: 'Paul Ricard.svg',
  nurburgring: 'Circuit Nürburgring-2013-GP.svg',
  istanbul: 'Circuit Istanbul.svg',
  valencia: 'Circuit Valencia.svg',
  sochi: 'Circuit Sochi.svg',
  yeongam: 'Korea international circuit.svg',
  buddh: 'Buddh International Circuit.svg',
  indianapolis: 'Indianapolis Road Course 2012.svg',
  mexico: 'Autódromo Hermanos Rodríguez.svg',
  las_vegas: '2023 Las Vegas street circuit.svg',
  miami: 'Hard Rock Stadium Circuit 2022.svg',
};

const NAMES = {
  monaco: 'Monaco',
  monza: 'Monza',
  silverstone: 'Silverstone',
  spa: 'Spa-Francorchamps',
  suzuka: 'Suzuka',
  interlagos: 'Interlagos',
  villeneuve: 'Montreal',
  albert_park: 'Melbourne',
  red_bull_ring: 'Spielberg',
  hockenheimring: 'Hockenheim',
  catalunya: 'Barcelona',
  baku: 'Baku',
  shanghai: 'Shanghai',
  americas: 'Austin',
  sepang: 'Sepang',
  hungaroring: 'Hungaroring',
  marina_bay: 'Singapore',
  zandvoort: 'Zandvoort',
  jeddah: 'Jeddah',
  losail: 'Lusail',
  imola: 'Imola',
  mugello: 'Mugello',
  portimao: 'Portimão',
  paul_ricard: 'Paul Ricard',
  nurburgring: 'Nürburgring',
  istanbul: 'Istanbul',
  valencia: 'Valencia',
  sochi: 'Sochi',
  yeongam: 'Yeongam',
  buddh: 'Buddh',
  indianapolis: 'Indianapolis',
  mexico: 'Mexico City',
  las_vegas: 'Las Vegas',
  miami: 'Miami',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// SVG path parsing → polyline points
// ---------------------------------------------------------------------------
const NUMBER = /-?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi;
const ARG_COUNT = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

function commands(pathData) {
  const out = [];
  const re = /([astvzqmhlcASTVZQMHLC])|(-?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?)/gi;
  let current = null;
  let match;
  while ((match = re.exec(pathData))) {
    if (match[1]) {
      current = { cmd: match[1], args: [] };
      out.push(current);
    } else if (current) {
      current.args.push(Number(match[2]));
    }
  }
  return out;
}

const bezier = (p0, p1, p2, p3, t) => {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
};

function pathToPolyline(d, steps = 8) {
  const segments = [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let prevCtrl = null;
  let points = [];

  const push = (px, py) => {
    const last = points[points.length - 1];
    if (!last || Math.abs(last[0] - px) > 1e-4 || Math.abs(last[1] - py) > 1e-4) points.push([px, py]);
  };

  const flush = () => {
    if (points.length > 1) segments.push(points);
    points = [[x, y]];
  };

  for (const { cmd, args } of commands(d)) {
    const lower = cmd.toLowerCase();
    const relative = cmd === lower;
    const count = ARG_COUNT[lower];

    if (lower === 'z') {
      if (points.length > 1) {
        push(startX, startY);
        segments.push(points);
      }
      points = [];
      x = startX;
      y = startY;
      prevCtrl = null;
      continue;
    }

    if (count === 0 || args.length < count) continue;

    for (let i = 0; i + count - 1 < args.length; i += count) {
      const a = args.slice(i, i + count);
      const ax = (v) => (relative ? x + v : v);
      const ay = (v) => (relative ? y + v : v);

      if (lower === 'm') {
        if (points.length > 1) segments.push(points);
        x = ax(a[0]);
        y = ay(a[1]);
        startX = x;
        startY = y;
        points = [[x, y]];
        // Subsequent pairs in the same M command are implicit line-tos.
        for (let j = i + count; j + 1 < args.length; j += 2) {
          x = relative ? x + args[j] : args[j];
          y = relative ? y + args[j + 1] : args[j + 1];
          push(x, y);
        }
        i = args.length;
        prevCtrl = null;
        continue;
      }

      if (lower === 'l' || lower === 'h' || lower === 'v') {
        const nx = lower === 'h' ? ax(a[0]) : lower === 'v' ? x : ax(a[0]);
        const ny = lower === 'v' ? ay(a[0]) : lower === 'h' ? y : ay(a[1]);
        x = nx;
        y = ny;
        push(x, y);
        prevCtrl = null;
        continue;
      }

      if (lower === 'c' || lower === 's' || lower === 'q' || lower === 't') {
        let c1;
        let c2;
        let end;
        if (lower === 'c') {
          c1 = [ax(a[0]), ay(a[1])];
          c2 = [ax(a[2]), ay(a[3])];
          end = [ax(a[4]), ay(a[5])];
        } else if (lower === 's') {
          c1 = prevCtrl ? [2 * x - prevCtrl[0], 2 * y - prevCtrl[1]] : [x, y];
          c2 = [ax(a[0]), ay(a[1])];
          end = [ax(a[2]), ay(a[3])];
        } else if (lower === 'q') {
          const q = [ax(a[0]), ay(a[1])];
          c1 = q;
          c2 = q;
          end = [ax(a[2]), ay(a[3])];
        } else {
          const q = prevCtrl ? [2 * x - prevCtrl[0], 2 * y - prevCtrl[1]] : [x, y];
          c1 = q;
          c2 = q;
          end = [ax(a[0]), ay(a[1])];
        }
        for (let s = 1; s <= steps; s += 1) {
          const t = s / steps;
          push(bezier(x, c1[0], c2[0], end[0], t), bezier(y, c1[1], c2[1], end[1], t));
        }
        prevCtrl = lower === 'c' || lower === 's' ? c2 : c1;
        x = end[0];
        y = end[1];
        continue;
      }

      if (lower === 'a') {
        const end = [ax(a[5]), ay(a[6])];
        for (let s = 1; s <= steps; s += 1) {
          const t = s / steps;
          push(x + (end[0] - x) * t, y + (end[1] - y) * t);
        }
        x = end[0];
        y = end[1];
        prevCtrl = null;
      }
    }
  }

  if (points.length > 1) segments.push(points);
  return segments;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------
function bounds(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

const diagonal = (b) => Math.hypot(b.w, b.h);

/**
 * Some Commons maps park the drawing on a full-bleed background rectangle.
 * It is the widest thing in the file, so without this the "largest shape"
 * heuristic picks a plain box instead of the circuit. A real track never
 * closes on four axis-aligned edges, so reject anything that does.
 */
function isFrame(points) {
  if (points.length > 5) return false;
  const b = bounds(points);
  if (b.w <= 0 || b.h <= 0) return false;
  const tolerance = Math.max(b.w, b.h) * 0.02;
  return points.every(
    ([x, y]) =>
      Math.abs(x - b.minX) <= tolerance ||
      Math.abs(x - b.maxX) <= tolerance ||
      Math.abs(y - b.minY) <= tolerance ||
      Math.abs(y - b.maxY) <= tolerance,
  );
}

/** Ramer–Douglas–Peucker, in the 0–100 output space. */
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const sqTolerance = tolerance * tolerance;
  const sqSegDist = (p, a, b) => {
    let x = a[0];
    let y = a[1];
    let dx = b[0] - x;
    let dy = b[1] - y;
    if (dx !== 0 || dy !== 0) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = b[0];
        y = b[1];
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }
    dx = p[0] - x;
    dy = p[1] - y;
    return dx * dx + dy * dy;
  };

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];

  while (stack.length) {
    const [first, last] = stack.pop();
    let maxDist = 0;
    let index = -1;
    for (let i = first + 1; i < last; i += 1) {
      const dist = sqSegDist(points[i], points[first], points[last]);
      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }
    if (maxDist > sqTolerance && index !== -1) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

// ---------------------------------------------------------------------------
// Build one outline
// ---------------------------------------------------------------------------
function buildOutline(svgText) {
  const segments = [];

  for (const match of svgText.matchAll(/<path[^>]*?\sd="([^"]+)"/g)) {
    segments.push(...pathToPolyline(match[1]));
  }
  for (const match of svgText.matchAll(/<(?:polyline|polygon)[^>]*?\spoints="([^"]+)"/g)) {
    const nums = (match[1].match(NUMBER) ?? []).map(Number);
    const points = [];
    for (let i = 0; i + 1 < nums.length; i += 2) points.push([nums[i], nums[i + 1]]);
    if (points.length > 1) segments.push(points);
  }

  if (!segments.length) return null;

  const scored = segments
    .filter((points) => !isFrame(points))
    .map((points) => ({ points, bounds: bounds(points) }));
  if (!scored.length) return null;
  const largest = Math.max(...scored.map((s) => diagonal(s.bounds)));
  if (!Number.isFinite(largest) || largest === 0) return null;

  // The track is made of the big subpaths; labels, corner numbers and arrows
  // are small. Keep anything within 45% of the largest shape.
  const kept = scored.filter((s) => diagonal(s.bounds) >= largest * 0.45 && s.points.length >= 8);
  const chosen = kept.length ? kept : [scored.sort((a, b) => diagonal(b.bounds) - diagonal(a.bounds))[0]];

  const box = bounds(chosen.flatMap((s) => s.points));
  const size = Math.max(box.w, box.h) || 1;
  const offsetX = (size - box.w) / 2;
  const offsetY = (size - box.h) / 2;

  const parts = [];
  for (const segment of chosen) {
    const mapped = segment.points.map(([x, y]) => [
      ((x - box.minX + offsetX) / size) * 100,
      ((y - box.minY + offsetY) / size) * 100,
    ]);
    const thinned = simplify(mapped, 0.22);
    if (thinned.length < 2) continue;
    parts.push(
      thinned
        .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
        .join(''),
    );
  }

  return parts.length ? parts.join('') : null;
}

// ---------------------------------------------------------------------------
// Source files
// ---------------------------------------------------------------------------
const HEADERS = { 'user-agent': 'PaddockF1/1.0 (student project)' };

/** Commons' FilePath endpoint intermittently 404s; resolve the upload URL directly. */
async function resolveFileUrl(file) {
  const params = new URLSearchParams({
    action: 'query',
    titles: `File:${file}`,
    prop: 'imageinfo',
    iiprop: 'url',
    format: 'json',
  });

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
        headers: HEADERS,
      });
      if (response.status === 429) {
        await sleep(4_000 * attempt);
        continue;
      }
      if (!response.ok) return null;
      const data = await response.json();
      const page = Object.values(data.query?.pages ?? {})[0];
      return page?.imageinfo?.[0]?.url ?? null;
    } catch {
      await sleep(1_500 * attempt);
    }
  }
  return null;
}

async function loadSvg(key, file) {
  const cached = path.join(CACHE, `${key}.svg`);
  try {
    const text = await readFile(cached, 'utf8');
    if (text.includes('<svg') || text.includes('<path')) return text;
  } catch {
    /* not cached yet */
  }

  const url = await resolveFileUrl(file);
  if (!url) return null;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(url, { headers: HEADERS });
      if (response.status === 429) {
        await sleep(4_000 * attempt);
        continue;
      }
      if (!response.ok) return null;
      const text = await response.text();
      if (!text.includes('<svg') && !text.includes('<path')) return null;
      await mkdir(CACHE, { recursive: true });
      await writeFile(cached, text, 'utf8');
      return text;
    } catch {
      await sleep(1_500 * attempt);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const outlines = [];

for (const [key, file] of Object.entries(CIRCUITS)) {
  const svgText = await loadSvg(key, file);

  if (!svgText) {
    console.warn(`  ! ${key}: could not download ${file}`);
    continue;
  }

  const outline = buildOutline(svgText);
  if (!outline) {
    console.warn(`  ! ${key}: no usable path in ${file}`);
    continue;
  }

  outlines.push({ key, name: NAMES[key] ?? key, d: outline });
  console.log(`  ok  ${key.padEnd(14)} ${String(outline.length).padStart(6)} chars`);
  await sleep(800);
}

const body = outlines
  .map(
    (o) =>
      `  {\n    id: ${JSON.stringify(o.key)},\n    label: ${JSON.stringify(o.name)},\n    d: ${JSON.stringify(o.d)},\n  },`,
  )
  .join('\n');

const fileContents = `/**
 * Generated by \`npm run outlines:build\`. Do not edit by hand.
 *
 * Stroke-only circuit shapes traced from Wikimedia Commons SVGs and normalised
 * into a 100×100 box. They are decorative only: the background layer renders
 * each one as a single path with no fill.
 */
export interface CircuitOutline {
  id: string;
  label: string;
  /** Polyline path data in a 0 0 100 100 viewBox. */
  d: string;
}

export const CIRCUIT_OUTLINES: CircuitOutline[] = [
${body}
];
`;

await writeFile(TARGET, fileContents, 'utf8');
console.log(`\nWrote ${outlines.length} outlines to ${path.relative(ROOT, TARGET)}`);
