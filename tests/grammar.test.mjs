// tests/grammar.test.mjs — W5 grammar + applyGrammarVariation test suite (A–L)
import { test } from "node:test";
import assert from "node:assert/strict";
import * as F from "../foundation/foundation.mjs";
import {
  BassGrammar,
  MelodicGrammar,
  RhythmGrammar,
  applyGrammarVariation
} from "../foundation/grammar.mjs";

const deepEqualJson = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));

/* A: BassGrammar — observe 100 biased transitions -> next() respects observed distribution */
test("A: BassGrammar — biased observations -> biased next()", () => {
  const g = new BassGrammar(7);
  for (let i = 0; i < 100; i++) g.observe(0, 5); // heavily biased 0->5
  const rng = F.mulberry32(99);
  const counts = new Array(12).fill(0);
  for (let i = 0; i < 1000; i++) {
    const r = g.next(0, rng);
    counts[r.degree] += 1;
  }
  // degree 5 should dominate (>= 800/1000).
  assert.ok(counts[5] >= 800, "degree 5 count=" + counts[5] + " should dominate");
  // Sanity: row 0 sum is 100, others 0.
  const m = g.matrix;
  let row0Sum = 0;
  for (let j = 0; j < 12; j++) row0Sum += m[0][j];
  assert.equal(row0Sum, 100);
});

/* B: BassGrammar — serialize/deserialize round-trip byte-identical */
test("B: BassGrammar — serialize/deserialize round-trip byte-identical", () => {
  const g = new BassGrammar(42);
  g.observe(0, 1); g.observe(0, 1); g.observe(0, 5);
  g.observe(3, 7); g.observe(3, 9);
  g.observe(11, 0);
  const data = g.serialize();
  const g2 = BassGrammar.deserialize(data);
  deepEqualJson(g2.serialize(), data);
  deepEqualJson(g2.matrix, g.matrix);
});

/* C: BassGrammar — matrix stays row-stochastic after observation (row sums > 0 only where observed) */
test("C: BassGrammar — row sums > 0 only where observed", () => {
  const g = new BassGrammar(1);
  g.observe(0, 1);
  g.observe(1, 2);
  const m = g.matrix;
  const rowSums = m.map((row) => row.reduce((s, x) => s + x, 0));
  assert.equal(rowSums[0], 1);
  assert.equal(rowSums[1], 1);
  for (let i = 2; i < 12; i++) assert.equal(rowSums[i], 0, "row " + i + " should be 0");
});

/* D: MelodicGrammar — same seed -> same histogram (after same observation sequence) */
test("D: MelodicGrammar — same seed + same observations -> same histogram", () => {
  const g1 = new MelodicGrammar(7);
  const g2 = new MelodicGrammar(7);
  for (let i = 0; i < 30; i++) {
    g1.observe(((i * 3) % 25) - 12);
    g2.observe(((i * 3) % 25) - 12);
  }
  deepEqualJson(g1.histogram, g2.histogram);
});

/* E: MelodicGrammar — empty observations -> next returns 0 (no NaN, no crash) */
test("E: MelodicGrammar — empty observations -> next returns interval 0", () => {
  const g = new MelodicGrammar(3);
  const rng = F.mulberry32(1);
  const r = g.next(rng);
  assert.equal(r.interval, 0);
  assert.ok(Number.isFinite(r.interval));
  assert.ok(Array.isArray(r.provenance.histogram));
  assert.equal(r.provenance.histogram.length, 25);
});

/* F: RhythmGrammar — kick-onset converges to observed rate within 50 bars (step 0 always kick) */
test("F: RhythmGrammar — 50 kicks at step 0 -> onsetProb[0] > 0.7", () => {
  const g = new RhythmGrammar(11);
  for (let i = 0; i < 50; i++) g.observe(0, true);
  const probs = g.onsetProb;
  assert.ok(probs[0] > 0.7, "onsetProb[0]=" + probs[0] + " should be > 0.7");
  // Other steps stay at 0.5 (no observations).
  for (let s = 1; s < 16; s++) assert.ok(Math.abs(probs[s] - 0.5) < 1e-9, "step " + s + " should stay 0.5");
});

/* G: RhythmGrammar — 0 kicks at step 5 -> next never produces kick at step 5 */
test("G: RhythmGrammar — 0 kicks at step 5 -> next never produces kick at step 5", () => {
  const g = new RhythmGrammar(13);
  for (let i = 0; i < 50; i++) g.observe(5, false);
  const probs = g.onsetProb;
  assert.ok(probs[5] < 0.05, "onsetProb[5]=" + probs[5] + " should be < 0.05");
  // Use a deterministic rng returning 0.5 (well above onsetProb[5]).
  const rng = () => 0.5;
  for (let trial = 0; trial < 100; trial++) {
    const r = g.next(rng);
    assert.equal(r.steps[5], false, "trial " + trial + ": step 5 must never be kick");
  }
});

/* H: applyGrammarVariation — original timeline unchanged (deep equal before/after) */
test("H: applyGrammarVariation — original timeline unchanged", () => {
  const song = F.buildFoundationSong(42);
  const timeline = F.resolveSong(song, { bars: 64 });
  const beforeJson = JSON.stringify(timeline);
  const bass = new BassGrammar(1);
  bass.observe(0, 5);
  const melodic = new MelodicGrammar(1);
  melodic.observe(3);
  const rhythm = new RhythmGrammar(1);
  rhythm.observe(0, true);
  const out = applyGrammarVariation(timeline, { bass, melodic, rhythm }, F.mulberry32(7));
  assert.equal(out.eventCount > 0, true);
  // Original timeline reference is untouched.
  const afterJson = JSON.stringify(timeline);
  assert.equal(afterJson, beforeJson);
  // Original events are still frozen.
  for (const ev of timeline.events) assert.ok(Object.isFrozen(ev));
});

/* I: applyGrammarVariation — mutated events carry provenance.grammar = { name, op, source } */
test("I: applyGrammarVariation — mutated events carry provenance.grammar", () => {
  const song = F.buildFoundationSong(42);
  const timeline = F.resolveSong(song, { bars: 64 });
  const bass = new BassGrammar(2);
  bass.observe(0, 5); bass.observe(5, 0);
  const melodic = new MelodicGrammar(2);
  melodic.observe(2); melodic.observe(-2);
  const rhythm = new RhythmGrammar(2);
  rhythm.observe(0, true); rhythm.observe(4, true);
  const out = applyGrammarVariation(timeline, { bass, melodic, rhythm }, F.mulberry32(99));
  // Find mutated events (bass, lead, arp, kick) and verify provenance.grammar.
  const voicesSeen = new Set();
  for (const ev of out.events) {
    if (ev.voice === "bass" || ev.voice === "lead" || ev.voice === "arp" || ev.voice === "kick") {
      assert.ok(ev.provenance && ev.provenance.grammar, ev.voice + " event missing grammar provenance: " + JSON.stringify(ev.provenance));
      const g = ev.provenance.grammar;
      assert.ok(typeof g.name === "string" && g.name.length > 0);
      assert.ok(typeof g.op === "string" && g.op.length > 0);
      assert.equal(g.source, "variation");
      voicesSeen.add(ev.voice + ":" + g.name);
    }
  }
  // At least one bass event should have BassGrammar provenance.
  assert.ok(voicesSeen.has("bass:BassGrammar"), "expected bass event with BassGrammar provenance; got " + [...voicesSeen].join(", "));
});

/* J: applyGrammarVariation — deterministic per (timeline, grammars, seed) */
test("J: applyGrammarVariation — deterministic (same rng seed -> byte-identical)", () => {
  const song = F.buildFoundationSong(42);
  const timeline = F.resolveSong(song, { bars: 64 });
  const bass = new BassGrammar(3);
  bass.observe(0, 5); bass.observe(5, 7);
  const melodic = new MelodicGrammar(3);
  melodic.observe(3); melodic.observe(-3);
  const rhythm = new RhythmGrammar(3);
  rhythm.observe(0, true); rhythm.observe(8, true);
  const out1 = applyGrammarVariation(timeline, { bass, melodic, rhythm }, F.mulberry32(42));
  const out2 = applyGrammarVariation(timeline, { bass, melodic, rhythm }, F.mulberry32(42));
  deepEqualJson(out1, out2);
});

/* K: BassGrammar — 12x12 matrix dimension correct */
test("K: BassGrammar — 12x12 matrix dimension", () => {
  const g = new BassGrammar(1);
  const m = g.matrix;
  assert.equal(m.length, 12);
  for (let i = 0; i < 12; i++) {
    assert.equal(m[i].length, 12, "row " + i + " length");
    for (let j = 0; j < 12; j++) assert.equal(m[i][j], 0);
  }
  // Frozen.
  assert.ok(Object.isFrozen(m));
  for (let i = 0; i < 12; i++) assert.ok(Object.isFrozen(m[i]));
});

/* L: RhythmGrammar — 16 steps (onsetProb.length === 16) */
test("L: RhythmGrammar — onsetProb has 16 steps", () => {
  const g = new RhythmGrammar(1);
  const probs = g.onsetProb;
  assert.equal(probs.length, 16);
  assert.ok(Object.isFrozen(probs));
  for (let s = 0; s < 16; s++) assert.equal(probs[s], 0.5);
  // next() returns 16-step array.
  const r = g.next(F.mulberry32(1));
  assert.equal(r.steps.length, 16);
  assert.ok(Object.isFrozen(r.steps));
});
