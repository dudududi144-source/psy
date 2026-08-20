// foundation/grammar.mjs — 3 grammar classes with provenance (W5)
// BassGrammar (12x12 transition matrix), MelodicGrammar (interval histogram),
// RhythmGrammar (16-step kick-onset Beta). Pure, deterministic per (seed, label).
// applyGrammarVariation: pure variation layer over resolveSong — original untouched,
// mutated events carry provenance.grammar = { name, op, source }.
// Inspired by: PSY6-ULTIMATE (3 grammar classes). Advanced over PSY6-ULTIMATE because
// (a) provenance-enforced (RULE 7), (b) deterministic per (seed, label), (c) testable,
// (d) variation layer (preserves canonical song model, doesn't replace it).

import { FoundationError, mulberry32, subSeed, rngFor, deepFreeze } from "./foundation.mjs";

const NUM_DEGREES = 12;
const INTERVAL_MIN = -12;
const INTERVAL_MAX = 12;
const NUM_INTERVALS = (INTERVAL_MAX - INTERVAL_MIN) + 1; // 25
const NUM_STEPS = 16;

function requireSeed(seed) {
  if (!Number.isInteger(seed)) {
    throw new FoundationError("seed must be integer, got: " + seed);
  }
}

function requireRng(rng) {
  if (typeof rng !== "function") {
    throw new FoundationError("rng must be function");
  }
}

// Sample an index from a weights array (proportional sampling).
// Returns -1 if sum is 0 (caller handles).
function sampleWeighted(weights, rng) {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    if (typeof weights[i] !== "number" || !Number.isFinite(weights[i]) || weights[i] < 0) {
      throw new FoundationError("weights[" + i + "] must be non-negative finite number");
    }
    sum += weights[i];
  }
  if (sum <= 0) return -1;
  let r = rng() * sum;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function freezeNumberArray(arr) {
  const copy = arr.slice();
  for (let i = 0; i < copy.length; i++) {
    if (typeof copy[i] !== "number" || !Number.isFinite(copy[i])) {
      copy[i] = 0;
    }
  }
  return Object.freeze(copy);
}

function frozenMatrixCopy(m) {
  const out = new Array(m.length);
  for (let i = 0; i < m.length; i++) out[i] = freezeNumberArray(m[i]);
  return Object.freeze(out);
}

/* ---------------- BassGrammar ---------------- */
// 12x12 transition matrix: matrix[from][to] = count of observed transitions.
// Initialized to 0 (uniform behavior: no observations -> return currentDegree).
export class BassGrammar {
  constructor(seed) {
    requireSeed(seed);
    this._seed = seed >>> 0;
    this._matrix = new Array(NUM_DEGREES);
    for (let i = 0; i < NUM_DEGREES; i++) {
      this._matrix[i] = new Array(NUM_DEGREES).fill(0);
    }
  }

  observe(fromDegree, toDegree) {
    if (!Number.isInteger(fromDegree) || fromDegree < 0 || fromDegree >= NUM_DEGREES) {
      throw new FoundationError("fromDegree must be integer in [0,11]");
    }
    if (!Number.isInteger(toDegree) || toDegree < 0 || toDegree >= NUM_DEGREES) {
      throw new FoundationError("toDegree must be integer in [0,11]");
    }
    this._matrix[fromDegree][toDegree] += 1;
  }

  next(currentDegree, rng) {
    if (!Number.isInteger(currentDegree) || currentDegree < 0 || currentDegree >= NUM_DEGREES) {
      throw new FoundationError("currentDegree must be integer in [0,11]");
    }
    requireRng(rng);
    const row = this._matrix[currentDegree];
    let rowSum = 0;
    for (let i = 0; i < NUM_DEGREES; i++) rowSum += row[i];

    // Normalized distribution (uniform if no observations).
    const probs = new Array(NUM_DEGREES);
    if (rowSum <= 0) {
      for (let i = 0; i < NUM_DEGREES; i++) probs[i] = 1 / NUM_DEGREES;
    } else {
      for (let i = 0; i < NUM_DEGREES; i++) probs[i] = row[i] / rowSum;
    }

    let degree;
    if (rowSum <= 0) {
      degree = currentDegree; // no observations -> no change
    } else {
      const idx = sampleWeighted(row, rng);
      degree = idx === -1 ? currentDegree : idx;
    }

    return Object.freeze({
      degree: degree,
      provenance: Object.freeze({
        matrix: freezeNumberArray(probs),
        rowSum: rowSum
      })
    });
  }

  serialize() {
    return {
      kind: "BassGrammar",
      seed: this._seed,
      matrix: this._matrix.map((row) => row.slice())
    };
  }

  static deserialize(data) {
    if (data === null || typeof data !== "object") {
      throw new FoundationError("data must be object");
    }
    if (data.kind !== "BassGrammar") {
      throw new FoundationError("data.kind must be 'BassGrammar', got: " + data.kind);
    }
    requireSeed(data.seed);
    if (!Array.isArray(data.matrix) || data.matrix.length !== NUM_DEGREES) {
      throw new FoundationError("data.matrix must be 12x12 array");
    }
    const g = new BassGrammar(data.seed);
    for (let i = 0; i < NUM_DEGREES; i++) {
      if (!Array.isArray(data.matrix[i]) || data.matrix[i].length !== NUM_DEGREES) {
        throw new FoundationError("data.matrix[" + i + "] must be length 12");
      }
      for (let j = 0; j < NUM_DEGREES; j++) {
        const v = data.matrix[i][j];
        if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
          throw new FoundationError("data.matrix[" + i + "][" + j + "] must be non-negative number");
        }
        g._matrix[i][j] = v;
      }
    }
    return g;
  }

  get matrix() { return frozenMatrixCopy(this._matrix); }
}

/* ---------------- MelodicGrammar ---------------- */
// 25-bucket interval histogram (intervals -12..+12). Initialized to 0.
export class MelodicGrammar {
  constructor(seed) {
    requireSeed(seed);
    this._seed = seed >>> 0;
    this._histogram = new Array(NUM_INTERVALS).fill(0);
  }

  observe(interval) {
    if (!Number.isInteger(interval) || interval < INTERVAL_MIN || interval > INTERVAL_MAX) {
      throw new FoundationError("interval must be integer in [-12,12], got: " + interval);
    }
    this._histogram[interval - INTERVAL_MIN] += 1;
  }

  next(rng) {
    requireRng(rng);
    let sum = 0;
    for (let i = 0; i < NUM_INTERVALS; i++) sum += this._histogram[i];

    let interval;
    if (sum <= 0) {
      interval = 0; // no observations -> no interval
    } else {
      const idx = sampleWeighted(this._histogram, rng);
      interval = idx === -1 ? 0 : (idx + INTERVAL_MIN);
    }

    return Object.freeze({
      interval: interval,
      provenance: Object.freeze({
        histogram: freezeNumberArray(this._histogram)
      })
    });
  }

  serialize() {
    return {
      kind: "MelodicGrammar",
      seed: this._seed,
      histogram: this._histogram.slice()
    };
  }

  static deserialize(data) {
    if (data === null || typeof data !== "object") {
      throw new FoundationError("data must be object");
    }
    if (data.kind !== "MelodicGrammar") {
      throw new FoundationError("data.kind must be 'MelodicGrammar', got: " + data.kind);
    }
    requireSeed(data.seed);
    if (!Array.isArray(data.histogram) || data.histogram.length !== NUM_INTERVALS) {
      throw new FoundationError("data.histogram must be length 25");
    }
    const g = new MelodicGrammar(data.seed);
    for (let i = 0; i < NUM_INTERVALS; i++) {
      const v = data.histogram[i];
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
        throw new FoundationError("data.histogram[" + i + "] must be non-negative number");
      }
      g._histogram[i] = v;
    }
    return g;
  }

  get histogram() { return freezeNumberArray(this._histogram); }
}

/* ---------------- RhythmGrammar ---------------- */
// 16-step kick-onset. Bayesian: Beta(1,1) prior, observe(step, hasKick) updates
// to Beta(1+kickCount, 1+noKickCount). Mean = (1+k)/(2+k+n). Initialized to 0.5.
export class RhythmGrammar {
  constructor(seed) {
    requireSeed(seed);
    this._seed = seed >>> 0;
    this._kickCount = new Array(NUM_STEPS).fill(0);
    this._noKickCount = new Array(NUM_STEPS).fill(0);
  }

  observe(step, hasKick) {
    if (!Number.isInteger(step) || step < 0 || step >= NUM_STEPS) {
      throw new FoundationError("step must be integer in [0,15]");
    }
    if (typeof hasKick !== "boolean") {
      throw new FoundationError("hasKick must be boolean");
    }
    if (hasKick) this._kickCount[step] += 1;
    else this._noKickCount[step] += 1;
  }

  next(rng) {
    requireRng(rng);
    const steps = new Array(NUM_STEPS);
    const probs = new Array(NUM_STEPS);
    for (let s = 0; s < NUM_STEPS; s++) {
      const alpha = 1 + this._kickCount[s];
      const beta = 1 + this._noKickCount[s];
      const p = alpha / (alpha + beta);
      probs[s] = p;
      // Bernoulli sample: kick if rng() < p.
      steps[s] = rng() < p;
    }
    return Object.freeze({
      steps: Object.freeze(steps),
      provenance: Object.freeze({
        onsetProb: freezeNumberArray(probs)
      })
    });
  }

  serialize() {
    return {
      kind: "RhythmGrammar",
      seed: this._seed,
      kickCount: this._kickCount.slice(),
      noKickCount: this._noKickCount.slice()
    };
  }

  static deserialize(data) {
    if (data === null || typeof data !== "object") {
      throw new FoundationError("data must be object");
    }
    if (data.kind !== "RhythmGrammar") {
      throw new FoundationError("data.kind must be 'RhythmGrammar', got: " + data.kind);
    }
    requireSeed(data.seed);
    if (!Array.isArray(data.kickCount) || data.kickCount.length !== NUM_STEPS) {
      throw new FoundationError("data.kickCount must be length 16");
    }
    if (!Array.isArray(data.noKickCount) || data.noKickCount.length !== NUM_STEPS) {
      throw new FoundationError("data.noKickCount must be length 16");
    }
    const g = new RhythmGrammar(data.seed);
    for (let s = 0; s < NUM_STEPS; s++) {
      const k = data.kickCount[s];
      const n = data.noKickCount[s];
      if (typeof k !== "number" || !Number.isFinite(k) || k < 0) {
        throw new FoundationError("data.kickCount[" + s + "] must be non-negative number");
      }
      if (typeof n !== "number" || !Number.isFinite(n) || n < 0) {
        throw new FoundationError("data.noKickCount[" + s + "] must be non-negative number");
      }
      g._kickCount[s] = k;
      g._noKickCount[s] = n;
    }
    return g;
  }

  get onsetProb() {
    const probs = new Array(NUM_STEPS);
    for (let s = 0; s < NUM_STEPS; s++) {
      const alpha = 1 + this._kickCount[s];
      const beta = 1 + this._noKickCount[s];
      probs[s] = alpha / (alpha + beta);
    }
    return freezeNumberArray(probs);
  }
}

/* ---------------- applyGrammarVariation ---------------- */
// Pure variation layer. Takes a resolved MusicalTimeline, applies grammar mutations,
// returns a NEW frozen timeline. Original is untouched.
//   bass events  -> BassGrammar.next (new degree -> new midi)
//   lead/arp     -> MelodicGrammar.next (interval added to midi)
//   kick events  -> RhythmGrammar.next (sampled 16-step pattern per bar; kick kept if
//                  sampled step is true, dropped otherwise)
// Mutated events carry provenance.grammar = { name, op, source: "variation" }.
export function applyGrammarVariation(timeline, grammars, rng) {
  if (timeline === null || typeof timeline !== "object" || !Array.isArray(timeline.events)) {
    throw new FoundationError("timeline must be MusicalTimeline (with .events array)");
  }
  if (grammars === null || typeof grammars !== "object" || Array.isArray(grammars)) {
    throw new FoundationError("grammars must be object");
  }
  requireRng(rng);

  // Cache RhythmGrammar pattern per bar (one next() call per bar).
  const rhythmPatternByBar = new Map();

  const newEvents = [];
  for (let i = 0; i < timeline.events.length; i++) {
    const ev = timeline.events[i];
    if (ev === null || typeof ev !== "object") {
      throw new FoundationError("event " + i + " must be object");
    }

    if (ev.voice === "bass" && grammars.bass && typeof ev.midi === "number") {
      const currentDegree = ((ev.midi % NUM_DEGREES) + NUM_DEGREES) % NUM_DEGREES;
      const result = grammars.bass.next(currentDegree, rng);
      const delta = result.degree - currentDegree;
      const newMidi = ev.midi + delta;
      const newPitchClass = ((newMidi % NUM_DEGREES) + NUM_DEGREES) % NUM_DEGREES;
      const newProvenance = Object.assign({}, ev.provenance, {
        grammar: Object.freeze({ name: "BassGrammar", op: "next", source: "variation" })
      });
      newEvents.push(Object.assign({}, ev, {
        midi: newMidi,
        pitchClass: newPitchClass,
        provenance: newProvenance
      }));
      continue;
    }

    if ((ev.voice === "lead" || ev.voice === "arp") && grammars.melodic && typeof ev.midi === "number") {
      const result = grammars.melodic.next(rng);
      const newMidi = ev.midi + result.interval;
      const newPitchClass = ((newMidi % NUM_DEGREES) + NUM_DEGREES) % NUM_DEGREES;
      const newProvenance = Object.assign({}, ev.provenance, {
        grammar: Object.freeze({ name: "MelodicGrammar", op: "next", source: "variation" })
      });
      newEvents.push(Object.assign({}, ev, {
        midi: newMidi,
        pitchClass: newPitchClass,
        provenance: newProvenance
      }));
      continue;
    }

    if (ev.voice === "kick" && grammars.rhythm && Number.isInteger(ev.bar) && Number.isInteger(ev.step)) {
      let pattern = rhythmPatternByBar.get(ev.bar);
      if (pattern === undefined) {
        const r = grammars.rhythm.next(rng);
        pattern = r.steps;
        rhythmPatternByBar.set(ev.bar, pattern);
      }
      const stepIdx = ((ev.step % NUM_STEPS) + NUM_STEPS) % NUM_STEPS;
      if (pattern[stepIdx] === true) {
        // Keep the kick with new provenance.
        const newProvenance = Object.assign({}, ev.provenance, {
          grammar: Object.freeze({ name: "RhythmGrammar", op: "sample", source: "variation" })
        });
        newEvents.push(Object.assign({}, ev, { provenance: newProvenance }));
      }
      // else: drop the event entirely.
      continue;
    }

    // No grammar applies — keep the original event reference (it's frozen).
    newEvents.push(ev);
  }

  return deepFreeze({
    version: timeline.version,
    songSeed: timeline.songSeed,
    params: timeline.params,
    lengthBeats: timeline.lengthBeats,
    eventCount: newEvents.length,
    events: newEvents
  });
}
