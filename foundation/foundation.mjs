// foundation/foundation.mjs — PSY musical foundation (P1)
// Pure, deterministic, zero dependencies. No DOM, no AudioContext, no wall-clock,
// no setInterval, no React, no radio/analyser state. Node ESM. Contract: FOUNDATION_MUSICAL_API.md.

export class FoundationError extends Error {
  constructor(msg) { super(msg); this.name = "FoundationError"; }
}

/* ---------------- PRNG (RULE 4 — canonical randomness) ---------------- */
export function mulberry32(seed) {
  if (!Number.isInteger(seed)) throw new FoundationError("seed must be an integer, got: " + seed);
  let a = seed >>> 0;
  return function rngNext() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function subSeed(parentSeed, label) {
  if (!Number.isInteger(parentSeed)) throw new FoundationError("parentSeed must be integer, got: " + parentSeed);
  if (typeof label !== "string" || label.length === 0) throw new FoundationError("label must be non-empty string");
  let h = (parentSeed >>> 0) ^ 0x9E3779B9;
  for (let i = 0; i < label.length; i++) {
    h = Math.imul(h ^ label.charCodeAt(i), 0x85EBCA6B);
    h = (h ^ (h >>> 13)) >>> 0;
  }
  h = Math.imul(h ^ (h >>> 16), 0x27D4EB2F);
  return (h ^ (h >>> 15)) >>> 0;
}
export function rngFor(parentSeed, label) { return mulberry32(subSeed(parentSeed, label)); }

/* ---------------- scales ---------------- */
export const SCALES = {
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
  doubleHarmonic: [0, 1, 4, 5, 7, 8, 11],
  minorPentatonic: [0, 3, 5, 7, 10],
};
export function scaleExtOf(scale) {
  if (!Array.isArray(scale) || scale.length === 0) throw new FoundationError("scale must be non-empty array");
  const out = [];
  for (let o = 0; o < 2; o++) for (let i = 0; i < scale.length; i++) out.push(scale[i] + 12 * o);
  out.push(24);
  return out;
}
export function degreeToSemitone(scaleIntervals, deg) {
  if (!Number.isInteger(deg)) throw new FoundationError("degree must be integer");
  const len = scaleIntervals.length;
  const oct = Math.floor(deg / len);
  const idx = ((deg % len) + len) % len;
  return scaleIntervals[idx] + 12 * oct;
}
export function stableDegreeIndices(scaleExt) {
  const out = [];
  for (let i = 0; i < scaleExt.length; i++) {
    const pc = ((scaleExt[i] % 12) + 12) % 12;
    if (pc === 0 || pc === 7) out.push(i);
  }
  return out;
}

/* ---------------- motif ---------------- */
export function validateMotif(motif) {
  if (!Array.isArray(motif)) throw new FoundationError("motif must be an array");
  if (motif.length === 0) throw new FoundationError("motif is empty");
  for (let i = 0; i < motif.length; i++) {
    const ev = motif[i];
    if (ev === null || typeof ev !== "object") throw new FoundationError("motif event " + i + " is not an object");
    if (!Number.isInteger(ev.deg)) throw new FoundationError("motif event " + i + ": deg must be integer");
    if (!Number.isInteger(ev.oct)) throw new FoundationError("motif event " + i + ": oct must be integer");
    if (!Number.isInteger(ev.dur) || ev.dur < 1) throw new FoundationError("motif event " + i + ": dur must be integer >= 1");
    if (typeof ev.accent !== "number" || ev.accent < 0 || ev.accent > 1) throw new FoundationError("motif event " + i + ": accent must be 0..1");
    if (typeof ev.rest !== "boolean") throw new FoundationError("motif event " + i + ": rest must be boolean");
  }
  return true;
}
function cloneMotif(motif) { return motif.map((ev) => ({ deg: ev.deg, oct: ev.oct, dur: ev.dur, accent: ev.accent, rest: ev.rest })); }
function motifTotalSteps(motif) { return motif.reduce((s, ev) => s + ev.dur, 0); }

/* ---------------- transforms (RULE 5 — pure, immutable, composable) ---------------- */
export const TRANSFORMS = {
  identity: (m) => cloneMotif(m),
  transposeDegree: (m, p) => {
    const n = p && Number.isInteger(p.n) ? p.n : (() => { throw new FoundationError("transposeDegree requires integer params.n"); })();
    return m.map((ev) => ev.rest ? { ...ev } : { ...ev, deg: ev.deg + n });
  },
  transposeOctave: (m, p) => {
    const n = p && Number.isInteger(p.n) ? p.n : (() => { throw new FoundationError("transposeOctave requires integer params.n"); })();
    return m.map((ev) => ev.rest ? { ...ev } : { ...ev, oct: ev.oct + n });
  },
  invert: (m) => {
    let pivotIdx = -1;
    for (let i = 0; i < m.length; i++) { if (!m[i].rest) { pivotIdx = i; break; } }
    if (pivotIdx === -1) return cloneMotif(m);
    const pivot = m[pivotIdx].deg;
    return m.map((ev) => ev.rest ? { ...ev } : { ...ev, deg: pivot - (ev.deg - pivot) });
  },
  retrograde: (m) => cloneMotif(m).reverse(),
  displace: (m, p) => {
    const steps = p && Number.isInteger(p.steps) ? p.steps : (() => { throw new FoundationError("displace requires integer params.steps"); })();
    const total = motifTotalSteps(m);
    if (total === 0) return cloneMotif(m);
    const shift = ((steps % total) + total) % total;
    if (shift === 0) return cloneMotif(m);
    const expanded = [];
    for (let i = 0; i < m.length; i++) for (let j = 0; j < m[i].dur; j++) expanded.push(j === 0 ? m[i] : null);
    const rotated = expanded.slice(expanded.length - shift).concat(expanded.slice(0, expanded.length - shift));
    let leadTies = 0;
    while (leadTies < rotated.length && rotated[leadTies] === null) leadTies++;
    const body = rotated.slice(leadTies);
    const wrap = rotated.slice(0, leadTies);
    const out = [];
    for (let i = 0; i < body.length; i++) {
      if (body[i] !== null) out.push({ deg: body[i].deg, oct: body[i].oct, dur: 1, accent: body[i].accent, rest: body[i].rest });
      else out[out.length - 1].dur += 1;
    }
    if (wrap.length > 0) {
      if (out.length === 0) out.push({ deg: 0, oct: 0, dur: wrap.length, accent: 0.3, rest: true });
      else out[out.length - 1].dur += wrap.length;
    }
    return out;
  },
  fragment: (m, p) => {
    if (!p || !Number.isInteger(p.start) || !Number.isInteger(p.len)) throw new FoundationError("fragment requires integer params.start/params.len");
    if (p.len < 1 || p.start < 0 || p.start >= m.length) throw new FoundationError("fragment out of range");
    const frag = m.slice(p.start, p.start + p.len).map((ev) => ({ ...ev }));
    if (frag.length === 0) throw new FoundationError("fragment produced empty motif");
    const repeats = Number.isInteger(p.repeats) && p.repeats >= 1 ? p.repeats : 1;
    let out = [];
    for (let r = 0; r < repeats; r++) out = out.concat(frag.map((ev) => ({ ...ev })));
    return out;
  },
  augment: (m) => m.map((ev) => ({ ...ev, dur: ev.dur * 2 })),
  diminish: (m) => m.map((ev) => ({ ...ev, dur: Math.max(1, Math.round(ev.dur / 2)) })),
};
export function applyTransform(motif, transform) {
  validateMotif(motif);
  if (!transform || typeof transform.op !== "string" || !TRANSFORMS[transform.op]) {
    throw new FoundationError("unknown transform: " + (transform && transform.op));
  }
  const out = TRANSFORMS[transform.op](motif, transform.params || {});
  validateMotif(out);
  return out;
}
export function applyTransformChain(motif, chain) {
  if (!Array.isArray(chain)) throw new FoundationError("chain must be array of transforms");
  return chain.reduce((m, t) => applyTransform(m, t), motif);
}

/* ---------------- song model ---------------- */
export const SECTION_TEMPLATE = [
  { name: "INTRO", bars: 32, themeKey: "transition", mode: "intro", bassStyle: "pedal", rootOffset: 0 },
  { name: "BUILD", bars: 16, themeKey: "transition", mode: "drop", bassStyle: "gallop", rootOffset: 0 },
  { name: "DROP", bars: 32, themeKey: "A", mode: "drop", bassStyle: "gallop", rootOffset: 0 },
  { name: "BREAK", bars: 32, themeKey: "B", mode: "break", bassStyle: "pedal", rootOffset: 0 },
  { name: "RISER", bars: 8, themeKey: "transition", mode: "riser", bassStyle: "offbeat", rootOffset: 0 },
  { name: "DROP2", bars: 32, themeKey: "A2", mode: "drop2", bassStyle: "gallop", rootOffset: 0 },
  { name: "OUTRO", bars: 24, themeKey: "transition", mode: "intro", bassStyle: "pedal", rootOffset: 0 },
];
export const SECTION_PARTS = {
  INTRO: ["kick", "bass", "pad"],
  BUILD: ["kick", "bass", "perc", "pad"],
  DROP: ["kick", "bass", "perc", "lead", "arp", "pad"],
  BREAK: ["lead", "pad"],
  RISER: ["kick", "bass", "perc"],
  DROP2: ["kick", "bass", "perc", "lead", "arp", "pad"],
  OUTRO: ["kick", "bass", "pad"],
};
const SECTION_MODES = { intro: "phrygian", drop: "phrygianDominant", break: "harmonicMinor", riser: "phrygian", drop2: "phrygianDominant" };
export const BASS_STYLES = ["gallop", "offbeat", "pumping", "pedal"];

export function buildTheme(seed, themeKey, rootMidi, scaleKey, opts = {}) {
  const rng = rngFor(seed, "theme:" + themeKey);
  const register = opts.register != null ? opts.register : 0;
  const emotional = !!opts.emotional;
  const cellLen = emotional ? 8 : 16;
  const strongSteps = cellLen === 16 ? [0, 8] : [0, 4];
  const degreePool = emotional ? [0, 2, 4, -3] : [0, 1, 2, 4, 5];
  const cell = [];
  let stepsUsed = 0;
  while (stepsUsed < cellLen) {
    const durRaw = emotional ? (rng() < 0.5 ? 4 : 2) : (rng() < 0.7 ? 1 : 2);
    const dur = Math.min(durRaw, cellLen - stepsUsed);
    const isStrong = strongSteps.indexOf(stepsUsed) !== -1;
    const deg = isStrong ? (rng() < 0.6 ? 0 : 4) : degreePool[Math.floor(rng() * degreePool.length)];
    const rest = !isStrong && rng() < (emotional ? 0.35 : 0.12);
    cell.push({ deg, oct: 0, dur, accent: isStrong ? 1 : (rng() < 0.3 ? 0.6 : 0.3), rest });
    stepsUsed += dur;
  }
  let seedCell = cell;
  if (opts.deriveFrom) seedCell = applyTransform(cell, { op: "transposeDegree", params: { n: 3 } });
  const phrasePlan = [
    { op: "identity" },
    { op: "displace", params: { steps: Math.floor(cellLen / 2) } },
    { op: "transposeDegree", params: { n: 2 } },
    { op: "invert" },
  ];
  return Object.freeze({ themeKey, rootMidi, scaleKey, register, cellLen, seedCell: deepFreeze(seedCell), phrasePlan: deepFreeze(phrasePlan) });
}
export function buildArpPhrase(seed) {
  const rng = rngFor(seed, "arp");
  const pool = [0, 1, 2, 4, 7];
  let ai = Math.floor(rng() * pool.length);
  let dir = 1;
  const arp = [];
  for (let s = 0; s < 16; s++) {
    if (rng() < 0.85) {
      arp.push(Object.freeze({ deg: pool[ai] }));
      ai += dir;
      if (ai >= pool.length) { ai = pool.length - 2; dir = -1; }
      if (ai < 0) { ai = 1; dir = 1; }
    } else arp.push(null);
  }
  return deepFreeze(arp);
}
export function buildFoundationSong(seed, opts = {}) {
  if (!Number.isInteger(seed)) throw new FoundationError("seed must be integer");
  const root = opts.root != null ? opts.root : 33;
  const bpm = opts.bpm != null ? opts.bpm : 145;
  const drop2RootOffset = rngFor(seed, "drop2mod")() < 0.5 ? 0 : 2;
  const sections = SECTION_TEMPLATE.map((s) => Object.freeze({
    name: s.name, bars: s.bars, themeKey: s.themeKey, mode: s.mode, bassStyle: s.bassStyle,
    rootOffset: s.name === "DROP2" ? drop2RootOffset : 0,
  }));
  let cursor = 0;
  const sectionStarts = sections.map((s) => { const st = cursor; cursor += s.bars; return st; });
  const themes = Object.freeze({
    A: buildTheme(seed, "A", root + 24, SECTION_MODES.drop),
    A2: buildTheme(seed, "A2", root + 24 + drop2RootOffset, SECTION_MODES.drop2, { deriveFrom: "A" }),
    B: buildTheme(seed, "B", root + 24, SECTION_MODES.break, { register: -12, emotional: true }),
    transition: buildTheme(seed, "transition", root + 24, SECTION_MODES.intro),
  });
  return deepFreeze({
    seed, root, bpm, styleScale: "phrygianDominant", modes: Object.freeze({ ...SECTION_MODES }),
    drop2RootOffset, themes, sections, sectionStarts, totalBars: cursor,
    arpPhrase: buildArpPhrase(seed),
  });
}
export function validateSong(song) {
  if (song === null || typeof song !== "object") throw new FoundationError("song must be object");
  if (!Number.isInteger(song.seed)) throw new FoundationError("song.seed must be integer");
  if (!Number.isInteger(song.root)) throw new FoundationError("song.root must be integer");
  if (!Array.isArray(song.sections) || song.sections.length === 0) throw new FoundationError("song.sections must be non-empty");
  let sum = 0;
  for (let i = 0; i < song.sections.length; i++) {
    const s = song.sections[i];
    if (typeof s.name !== "string") throw new FoundationError("section " + i + ": name");
    if (!Number.isInteger(s.bars) || s.bars < 1) throw new FoundationError("section " + i + ": bars must be int >= 1");
    if (typeof s.themeKey !== "string" || !song.themes || !song.themes[s.themeKey]) throw new FoundationError("section " + i + ": missing theme " + s.themeKey);
    if (BASS_STYLES.indexOf(s.bassStyle) === -1) throw new FoundationError("section " + i + ": unknown bassStyle " + s.bassStyle);
    sum += s.bars;
  }
  if (song.totalBars !== sum) throw new FoundationError("song.totalBars != sum(section.bars)");
  for (const key of Object.keys(song.themes)) {
    const th = song.themes[key];
    validateMotif(th.seedCell);
    if (!Array.isArray(th.phrasePlan)) throw new FoundationError("theme " + key + ": phrasePlan");
    for (const t of th.phrasePlan) if (!t || !TRANSFORMS[t.op]) throw new FoundationError("theme " + key + ": unknown plan op");
  }
  if (song.arpPhrase != null) {
    if (!Array.isArray(song.arpPhrase) || song.arpPhrase.length !== 16) throw new FoundationError("song.arpPhrase must be length 16");
    for (let i = 0; i < 16; i++) {
      const a = song.arpPhrase[i];
      if (a !== null && (!Number.isInteger(a.deg))) throw new FoundationError("arpPhrase[" + i + "] invalid");
    }
  }
  return true;
}
export function sectionAt(song, absBar) {
  if (!Number.isInteger(absBar)) throw new FoundationError("absBar must be integer");
  const bar = ((absBar % song.totalBars) + song.totalBars) % song.totalBars;
  let lo = 0, hi = song.sections.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (song.sectionStarts[mid] <= bar) lo = mid; else hi = mid - 1; }
  return { section: song.sections[lo], sectionIndex: lo, barInSection: bar - song.sectionStarts[lo], barInTrack: bar };
}

/* ---------------- product musical rules (pure, deterministic) ---------------- */
export const EnergyCurves = {
  rampUp: (bar, total) => bar / Math.max(1, total - 1),
  rampDown: (bar, total) => 1 - bar / Math.max(1, total - 1),
  sustainHigh: () => 0.85,
  undulateLow: (bar, total) => 0.25 + 0.15 * Math.sin((bar / total) * Math.PI * 2),
  wake: (bar, total) => Math.min(1, bar / (total * 0.8)) * 0.5,
};
const SECTION_ENERGY_CURVE = { INTRO: "wake", BUILD: "rampUp", DROP: "sustainHigh", BREAK: "undulateLow", RISER: "rampUp", DROP2: "sustainHigh", OUTRO: "rampDown" };
export function energyAt(sectionName, barInSection, sectionBars) {
  const curve = SECTION_ENERGY_CURVE[sectionName] || "sustainHigh";
  return EnergyCurves[curve](barInSection, sectionBars);
}
export function generateBassBar(styleKey, rootMidi, scaleIntervals, barIndex, rng) {
  const steps = new Array(16).fill(null);
  if (styleKey === "offbeat") {
    for (const s of [2, 6, 10, 14]) {
      const deg = (s === 14 && barIndex % 2 === 1) ? 4 : 0;
      steps[s] = Object.freeze({ midi: rootMidi + degreeToSemitone(scaleIntervals, deg), accent: 0.55 });
    }
    return steps;
  }
  if (styleKey === "pumping") { steps[0] = Object.freeze({ midi: rootMidi, accent: 0.7, sustain: 16 }); return steps; }
  if (styleKey === "pedal") { if (barIndex % 2 === 0) steps[0] = Object.freeze({ midi: rootMidi, accent: 0.4, sustain: 32 }); return steps; }
  // gallop: K-B-B-B off-beats, root-dominant + pickups
  for (let s = 0; s < 16; s++) {
    if (s % 4 === 0) continue;
    if (s === 15 && barIndex % 4 === 3) { steps[s] = Object.freeze({ midi: rootMidi + 12, accent: 0.8 }); continue; }
    let deg = 0;
    if ((s === 7 || s === 11) && barIndex % 2 === 1) deg = rng() < 0.5 ? 4 : 6;
    steps[s] = Object.freeze({ midi: rootMidi + degreeToSemitone(scaleIntervals, deg), accent: 0.6 });
  }
  return steps;
}
export function isSectionDownbeat(barInSection) { return barInSection === 0; }
export function isPreDropSilenceBar(nextSectionName, barInSection, sectionBars) {
  return barInSection === sectionBars - 1 && (nextSectionName === "DROP" || nextSectionName === "DROP2");
}
export function preDropGate(step) { return step < 12; }

/* ---------------- theme resolution ---------------- */
export function resolvePhraseBar(theme, barInSection, scalesTable) {
  if (!theme) throw new FoundationError("theme required");
  const phraseIdx = ((barInSection % theme.phrasePlan.length) + theme.phrasePlan.length) % theme.phrasePlan.length;
  const step = theme.phrasePlan[phraseIdx];
  const motif = applyTransform(theme.seedCell, step);
  const scale = scalesTable[theme.scaleKey];
  if (!scale) throw new FoundationError("unknown scaleKey: " + theme.scaleKey);
  return motif.map((ev) => ev.rest ? Object.freeze({ rest: true }) : Object.freeze({
    rest: false, midi: theme.rootMidi + theme.register + degreeToSemitone(scale, ev.deg) + 12 * ev.oct,
    accent: ev.accent, dur: ev.dur,
  }));
}

/* ---------------- resolver (RULE 3): Song -> MusicalTimeline ----------------
   Consumes per-bar rng in documented order: (1) bass pickups via generateBassBar,
   (2) perc draws per step (ghost shaker -> openhat -> fill snare). No other
   randomness. Output is fully determined by (song, params). */
const VOICES = ["kick", "perc", "bass", "lead", "arp", "pad"];
const DUR_BEATS = { kick: 0.25, clap: 0.1, shaker: 0.03, oh: 0.5, snare: 0.3, bass: 0.2, lead: 0.24, arp: 0.12, pad: 7.6 };
const VOICE_VELOCITY = { kick: 1.0, clap: 0.5, shaker: 0.35, oh: 0.4, snare: 0.5, bass: 0.6, arp: 0.4, pad: 0.3 };

export function deepFreeze(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  Object.freeze(obj);
  if (Array.isArray(obj)) for (const x of obj) deepFreeze(x);
  else for (const k of Object.keys(obj)) { const v = obj[k]; if (v !== null && typeof v === "object" && !Object.isFrozen(v)) deepFreeze(v); }
  return obj;
}

function makeEvent(voice, bar, step, seq, beat, fields) {
  return Object.freeze({
    id: voice + ":" + bar + ":" + step + ":" + seq,
    voice: voice,
    beat: beat,
    durationBeats: fields.durationBeats,
    midi: fields.midi !== undefined ? fields.midi : null,
    pitchClass: fields.midi !== null && fields.midi !== undefined ? ((fields.midi % 12) + 12) % 12 : null,
    velocity: fields.velocity,
    accent: fields.accent !== undefined ? fields.accent : 0,
    bar: bar,
    step: step,
    section: Object.freeze({ name: fields.sectionName, index: fields.sectionIndex }),
    phrase: fields.phrase ? Object.freeze({ index: fields.phrase.index, op: fields.phrase.op }) : null,
    motifTheme: fields.motifTheme || null,
    provenance: Object.freeze({ songSeed: fields.songSeed, label: fields.label, op: fields.op || null }),
    meta: Object.freeze(fields.meta || {}),
  });
}

export function resolveSong(song, params = {}) {
  validateSong(song);
  const bars = params.bars != null ? params.bars : song.totalBars;
  if (!Number.isInteger(bars) || bars < 0) throw new FoundationError("params.bars must be integer >= 0");
  const events = [];
  const arpScaleExt = scaleExtOf(SCALES[song.styleScale] || SCALES.phrygianDominant);
  for (let bar = 0; bar < bars; bar++) {
    const info = sectionAt(song, bar);
    const sec = info.section;
    const barInSec = info.barInSection;
    const parts = SECTION_PARTS[sec.name] || [];
    const barRng = rngFor(song.seed, "bar:" + info.barInTrack);
    const scaleInt = SCALES[song.modes[sec.mode]];
    const bassRoot = song.root + (sec.rootOffset || 0);
    const bassBar = generateBassBar(sec.bassStyle, bassRoot, scaleInt, barInSec, barRng);
    const nextSec = song.sections[(info.sectionIndex + 1) % song.sections.length];
    const preDropSilence = isPreDropSilenceBar(nextSec.name, barInSec, sec.bars);
    const theme = sec.themeKey ? song.themes[sec.themeKey] : null;
    const leadBar = (theme && parts.indexOf("lead") !== -1) ? resolvePhraseBar(theme, barInSec, SCALES) : null;
    const phraseIdx = theme ? ((barInSec % theme.phrasePlan.length) + theme.phrasePlan.length) % theme.phrasePlan.length : null;
    const planOp = theme ? theme.phrasePlan[phraseIdx].op : null;
    const hasPerc = parts.indexOf("perc") !== -1 && sec.name !== "BREAK";
    const fillWindow = hasPerc && (sec.name === "BUILD" || sec.name === "RISER" || sec.name === "INTRO");
    const energy = energyAt(sec.name, barInSec, sec.bars);
    const noteDensityMul = 0.4 + energy * 0.8;

    for (let step = 0; step < 16; step++) {
      const beat = bar * 4 + step / 4;
      const gated = preDropSilence && !preDropGate(step);
      let seq = 0;
      /* kick */
      if (parts.indexOf("kick") !== -1 && step % 4 === 0 && !gated) {
        events.push(makeEvent("kick", bar, step, seq++, beat, {
          durationBeats: DUR_BEATS.kick, midi: null, velocity: VOICE_VELOCITY.kick, accent: 1,
          sectionName: sec.name, sectionIndex: info.sectionIndex, songSeed: song.seed, label: "grid:kick" }));
      }
      /* perc (product draw order: ghost shaker -> openhat -> fill snare) */
      if (hasPerc && !gated) {
        if ((step === 4 || step === 12) && energy > 0.3) {
          events.push(makeEvent("perc", bar, step, seq++, beat, {
            durationBeats: DUR_BEATS.clap, midi: null, velocity: VOICE_VELOCITY.clap, accent: 0.8,
            sectionName: sec.name, sectionIndex: info.sectionIndex, songSeed: song.seed, label: "grid:perc", meta: { type: "clap" } }));
        } else if (step % 4 === 2) {
          events.push(makeEvent("perc", bar, step, seq++, beat, {
            durationBeats: DUR_BEATS.shaker, midi: null, velocity: VOICE_VELOCITY.shaker, accent: 0.3,
            sectionName: sec.name, sectionIndex: info.sectionIndex, songSeed: song.seed, label: "grid:perc", meta: { type: "shaker" } }));
        } else if (step % 2 === 1 && barRng() < 0.25 * noteDensityMul) {
          events.push(makeEvent("perc", bar, step, seq++, beat, {
            durationBeats: DUR_BEATS.shaker, midi: null, velocity: VOICE_VELOCITY.shaker * 0.7, accent: 0.2,
            sectionName: sec.name, sectionIndex: info.sectionIndex, songSeed: song.seed, label: "grid:perc", meta: { type: "shaker", ghost: true } }));
        }
        if (step === 14 && barInSec % 2 === 1 && barRng() < 0.5) {
          events.push(makeEvent("perc", bar, step, seq++, beat, {
            durationBeats: DUR_BEATS.oh, midi: null, velocity: VOICE_VELOCITY.oh, accent: 0.5,
            sectionName: sec.name, sectionIndex: info.sectionIndex, songSeed: song.seed, label: "grid:perc", meta: { type: "oh" } }));
        }
      }
      if (fillWindow) {
        const barsLeft = sec.bars - 1 - barInSec;
        if (barsLeft <= 1) {
          const fillProgress = 1 - (barsLeft * 16 + (15 - step)) / 32;
          if (barRng() < 0.2 + 0.6 * fillProgress) {
            events.push(makeEvent("perc", bar, step, seq++, beat, {
              durationBeats: DUR_BEATS.snare, midi: null, velocity: 0.3 + 0.5 * fillProgress, accent: 0.6,
              sectionName: sec.name, sectionIndex: info.sectionIndex, songSeed: song.seed, label: "grid:perc", meta: { type: "snare", fill: true } }));
          }
        }
      }
      /* bass */
      const be = bassBar[step];
      if (be && parts.indexOf("bass") !== -1 && !gated) {
        events.push(makeEvent("bass", bar, step, seq++, beat, {
          durationBeats: be.sustain ? be.sustain / 4 : DUR_BEATS.bass, midi: be.midi, velocity: VOICE_VELOCITY.bass, accent: be.accent,
          sectionName: sec.name, sectionIndex: info.sectionIndex, songSeed: song.seed, label: "grid:bass" }));
      }
      /* lead */
      if (leadBar) {
        const ev = leadBar[step];
        if (ev && !ev.rest) {
          events.push(makeEvent("lead", bar, step, seq++, beat, {
            durationBeats: DUR_BEATS.lead * Math.min(ev.dur, 2), midi: ev.midi, velocity: ev.accent, accent: ev.accent,
            sectionName: sec.name, sectionIndex: info.sectionIndex, songSeed: song.seed,
            label: "theme:" + sec.themeKey, op: planOp, motifTheme: sec.themeKey,
            phrase: { index: phraseIdx, op: planOp } }));
        }
      }
      /* arp (canonical arpPhrase — RULE 2 migration target) */
      if (parts.indexOf("arp") !== -1 && song.arpPhrase) {
        const an = song.arpPhrase[step];
        if (an && !gated) {
          const midi = song.root + 24 + degreeToSemitone(arpScaleExt, an.deg);
          events.push(makeEvent("arp", bar, step, seq++, beat, {
            durationBeats: DUR_BEATS.arp, midi: midi, velocity: VOICE_VELOCITY.arp, accent: step % 4 === 0 ? 0.6 : 0.3,
            sectionName: sec.name, sectionIndex: info.sectionIndex, songSeed: song.seed, label: "arp" }));
        }
      }
      /* pad drone */
      if (parts.indexOf("pad") !== -1 && step === 0 && barInSec % 2 === 0) {
        const offs = [0, 7, 12];
        for (let ci = 0; ci < offs.length; ci++) {
          events.push(makeEvent("pad", bar, step, seq++, beat, {
            durationBeats: DUR_BEATS.pad, midi: bassRoot + 12 + offs[ci], velocity: VOICE_VELOCITY.pad, accent: 0.2,
            sectionName: sec.name, sectionIndex: info.sectionIndex, songSeed: song.seed, label: "grid:pad", meta: { chordIndex: ci } }));
        }
      }
    }
  }
  return deepFreeze({
    version: "1.0", songSeed: song.seed, params: Object.freeze({ bars: bars }),
    lengthBeats: bars * 4, eventCount: events.length, events: events,
  });
}

/* ---------------- MusicalContext (RULE 6 — owns no timing) ---------------- */
export function contextAt(song, beat) {
  validateSong(song);
  if (typeof beat !== "number" || !Number.isFinite(beat)) throw new FoundationError("beat must be finite number");
  if (beat < 0) throw new FoundationError("beat must be >= 0");
  const totalBeats = song.totalBars * 4;
  const b = totalBeats > 0 ? beat % totalBeats : 0;
  const bar = Math.floor(b / 4);
  const info = sectionAt(song, bar);
  const theme = song.themes[info.section.themeKey] || null;
  const phraseIndex = theme ? ((info.barInSection % theme.phrasePlan.length) + theme.phrasePlan.length) % theme.phrasePlan.length : null;
  const planOp = theme ? theme.phrasePlan[phraseIndex].op : null;
  const scaleName = song.modes[info.section.mode];
  return deepFreeze({
    beat: b, bar: bar, step: Math.floor((b % 1) * 4 + 1e-9),
    barInSection: info.barInSection, barInTrack: info.barInTrack,
    section: { name: info.section.name, index: info.sectionIndex },
    phraseIndex: phraseIndex, planOp: planOp,
    key: song.root, mode: info.section.mode, scaleName: scaleName, scale: SCALES[scaleName],
  });
}

/* ---------------- serialization / replay (RULE 8) ---------------- */
export function validateTimelineShape(tl) {
  if (tl === null || typeof tl !== "object") throw new FoundationError("timeline must be object");
  if (tl.version !== "1.0") throw new FoundationError("unsupported timeline version: " + tl.version);
  if (!Array.isArray(tl.events)) throw new FoundationError("timeline.events must be array");
  const seen = new Set();
  let lastBeat = -1;
  for (let i = 0; i < tl.events.length; i++) {
    const ev = tl.events[i];
    if (typeof ev.id !== "string") throw new FoundationError("event " + i + ": id");
    if (seen.has(ev.id)) throw new FoundationError("duplicate event id: " + ev.id);
    seen.add(ev.id);
    if (VOICES.indexOf(ev.voice) === -1) throw new FoundationError("event " + i + ": unknown voice " + ev.voice);
    if (!(typeof ev.beat === "number" && ev.beat >= 0)) throw new FoundationError("event " + i + ": beat");
    if (ev.beat < lastBeat - 1e-9) throw new FoundationError("events not ordered by beat at index " + i);
    lastBeat = ev.beat;
    if (!(typeof ev.durationBeats === "number" && ev.durationBeats >= 0)) throw new FoundationError("event " + i + ": durationBeats >= 0");
    if (!ev.provenance || !Number.isInteger(ev.provenance.songSeed)) throw new FoundationError("event " + i + ": provenance");
  }
  return true;
}
export function serializeTimeline(timeline) {
  validateTimelineShape(timeline);
  return JSON.stringify(timeline);
}
export function parseTimeline(json) {
  const tl = JSON.parse(json);
  validateTimelineShape(tl);
  return deepFreeze(tl);
}
