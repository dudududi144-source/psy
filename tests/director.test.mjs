// tests/director.test.mjs — W4 MusicalDirector test suite (A–L)
import { test } from "node:test";
import assert from "node:assert/strict";
import * as F from "../foundation/foundation.mjs";
import {
  createDirectorContext,
  deriveDirectorContext,
  MusicalDirector
} from "../foundation/director.mjs";

const deepEqualJson = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));
// Deterministic "no-exploration" rng: always returns 0.99 (>0.05 explorationRate).
const noExpRng = () => 0.99;

function ctxWith(overrides) {
  const base = {
    transport: { locked: true, confidence: 0.9, bpm: 145 },
    musical: { energy: 0.8, density: 0.5, tension: 0.5, targetTension: 0.7 },
    history: { lastBarDense: false, barsSinceRest: 0, phraseIndex: 0 }
  };
  return createDirectorContext(Object.assign({}, base, overrides));
}

/* A: high-confidence + high-energy -> action="play", intensity ≈ 0.9 */
test("A: high-confidence + high-energy -> action=play, intensity ≈ 0.9", () => {
  const d = new MusicalDirector();
  const ctx = ctxWith({
    transport: { locked: true, confidence: 1.0, bpm: 145 },
    musical: { energy: 0.8, density: 0.5, tension: 0.5, targetTension: 0.7 }
  });
  const dec = d.decide(ctx, noExpRng);
  assert.equal(dec.action, "play");
  assert.ok(Math.abs(dec.intensity - 0.9) < 1e-9, "intensity=" + dec.intensity);
});

/* B: low transport.confidence -> abstain, reason contains "transport.confidence" */
test("B: low transport.confidence -> abstain w/ reason", () => {
  const d = new MusicalDirector();
  const ctx = ctxWith({
    transport: { locked: true, confidence: 0.2, bpm: 145 }
  });
  const dec = d.decide(ctx, noExpRng);
  assert.equal(dec.action, "abstain");
  assert.ok(dec.reason.includes("transport.confidence"), "reason=" + dec.reason);
});

/* C: transport.locked=false -> abstain, reason contains "locked" */
test("C: transport.locked=false -> abstain w/ reason", () => {
  const d = new MusicalDirector();
  const ctx = ctxWith({
    transport: { locked: false, confidence: 0.9, bpm: 145 }
  });
  const dec = d.decide(ctx, noExpRng);
  assert.equal(dec.action, "abstain");
  assert.ok(dec.reason.includes("locked"), "reason=" + dec.reason);
});

/* D: low energy + barsSinceRest > 4 -> abstain, reason contains "energy" */
test("D: low energy + barsSinceRest > 4 -> abstain w/ reason", () => {
  const d = new MusicalDirector();
  const ctx = ctxWith({
    musical: { energy: 0.1, density: 0.5, tension: 0.5, targetTension: 0.7 },
    history: { lastBarDense: false, barsSinceRest: 5, phraseIndex: 0 }
  });
  const dec = d.decide(ctx, noExpRng);
  assert.equal(dec.action, "abstain");
  assert.ok(dec.reason.includes("energy"), "reason=" + dec.reason);
});

/* E: dense previous bar + density > 0.7 -> abstain, reason contains "dense" */
test("E: dense previous bar + density > 0.7 -> abstain w/ reason", () => {
  const d = new MusicalDirector();
  const ctx = ctxWith({
    musical: { energy: 0.5, density: 0.8, tension: 0.5, targetTension: 0.7 },
    history: { lastBarDense: true, barsSinceRest: 0, phraseIndex: 0 }
  });
  const dec = d.decide(ctx, noExpRng);
  assert.equal(dec.action, "abstain");
  assert.ok(dec.reason.includes("dense"), "reason=" + dec.reason);
});

/* F: rewardPrediction < threshold -> abstain, reason contains "rewardPrediction" */
test("F: rewardPrediction < threshold -> abstain w/ reason", () => {
  const d = new MusicalDirector({ abstainThreshold: 0.6 }); // RP=0.5 < 0.6
  const ctx = ctxWith({
    transport: { locked: true, confidence: 0.9, bpm: 145 },
    musical: { energy: 0.5, density: 0.5, tension: 0.5, targetTension: 0.7 },
    history: { lastBarDense: false, barsSinceRest: 0, phraseIndex: 0 }
  });
  const dec = d.decide(ctx, noExpRng);
  assert.equal(dec.action, "abstain");
  assert.ok(dec.reason.includes("rewardPrediction"), "reason=" + dec.reason);
});

/* G: after abstention (barsSinceRest resets to 0), next decide -> play */
test("G: after abstention, barsSinceRest=0 -> play", () => {
  const d = new MusicalDirector();
  // First: low energy + barsSinceRest=5 -> abstain (rule #3).
  const before = ctxWith({
    musical: { energy: 0.1, density: 0.5, tension: 0.5, targetTension: 0.7 },
    history: { lastBarDense: false, barsSinceRest: 5, phraseIndex: 0 }
  });
  const decBefore = d.decide(before, noExpRng);
  assert.equal(decBefore.action, "abstain");
  // Caller resets barsSinceRest to 0 after abstention.
  const after = ctxWith({
    musical: { energy: 0.1, density: 0.5, tension: 0.5, targetTension: 0.7 },
    history: { lastBarDense: false, barsSinceRest: 0, phraseIndex: 0 }
  });
  const decAfter = d.decide(after, noExpRng);
  assert.equal(decAfter.action, "play");
});

/* H: EMA convergence — after 10 updateReward(0.9) calls, RP ≈ 0.9 (within 0.05) */
test("H: EMA convergence after 10 updateReward(0.9) calls", () => {
  const d = new MusicalDirector({ abstainThreshold: 0.3, explorationRate: 0.0, rewardAlpha: 0.3 });
  for (let i = 0; i < 10; i++) d.updateReward(0.9);
  const rp = d.rewardPrediction;
  assert.ok(Math.abs(rp - 0.9) < 0.05, "RP=" + rp + " should be within 0.05 of 0.9");
});

/* I: determinism — same ctx + same rng -> same decision (no Math.random) */
test("I: determinism — same ctx + same rng -> identical decisions", () => {
  const d = new MusicalDirector();
  const ctx = ctxWith({});
  const dec1 = d.decide(ctx, F.mulberry32(12345));
  const dec2 = d.decide(ctx, F.mulberry32(12345));
  deepEqualJson(dec1, dec2);
});

/* J: exploration — rng returns 0.01 (< 0.05) -> decision inverted */
test("J: exploration — rng=0.01 inverts decision", () => {
  const d = new MusicalDirector({ explorationRate: 0.05 });
  const ctx = ctxWith({}); // would normally be "play"
  const baseDec = d.decide(ctx, noExpRng);
  assert.equal(baseDec.action, "play");
  // With rng=0.01 < 0.05, exploration triggers -> inverted to "abstain".
  const exploreRng = () => 0.01;
  const expDec = d.decide(ctx, exploreRng);
  assert.equal(expDec.action, "abstain");
  assert.equal(expDec.explored, true);
});

/* K: createDirectorContext validates inputs (throws FoundationError on missing transport.locked) */
test("K: createDirectorContext validates inputs", () => {
  assert.throws(() => createDirectorContext({
    transport: { confidence: 0.9, bpm: 145 }, // missing locked
    musical: { energy: 0.5, density: 0.5, tension: 0.5, targetTension: 0.7 },
    history: { lastBarDense: false, barsSinceRest: 0, phraseIndex: 0 }
  }), F.FoundationError);
  assert.throws(() => createDirectorContext({
    transport: { locked: true, confidence: 1.5, bpm: 145 }, // confidence > 1
    musical: { energy: 0.5, density: 0.5, tension: 0.5, targetTension: 0.7 },
    history: { lastBarDense: false, barsSinceRest: 0, phraseIndex: 0 }
  }), F.FoundationError);
  assert.throws(() => createDirectorContext({
    transport: { locked: "yes", confidence: 0.5, bpm: 145 },
    musical: { energy: 0.5, density: 0.5, tension: 0.5, targetTension: 0.7 },
    history: { lastBarDense: false, barsSinceRest: 0, phraseIndex: 0 }
  }), F.FoundationError);
  // Frozen check.
  const ctx = ctxWith({});
  assert.ok(Object.isFrozen(ctx));
  assert.ok(Object.isFrozen(ctx.transport));
  assert.ok(Object.isFrozen(ctx.musical));
  assert.ok(Object.isFrozen(ctx.history));
});

/* L: deriveDirectorContext extracts energy/density from song + timeline */
test("L: deriveDirectorContext extracts energy/density", () => {
  const song = F.buildFoundationSong(42);
  const timeline = F.resolveSong(song, { bars: 8 });
  const transportState = { locked: true, confidence: 0.9, bpm: 145 };
  const history = { lastBarDense: false, barsSinceRest: 0, phraseIndex: 0 };
  const ctx = deriveDirectorContext(song, timeline, transportState, history);
  assert.ok(typeof ctx.musical.energy === "number");
  assert.ok(ctx.musical.energy >= 0 && ctx.musical.energy <= 1, "energy in [0,1]: " + ctx.musical.energy);
  assert.ok(typeof ctx.musical.density === "number");
  assert.ok(ctx.musical.density >= 0 && ctx.musical.density <= 1, "density in [0,1]: " + ctx.musical.density);
  assert.ok(typeof ctx.musical.tension === "number");
  assert.equal(ctx.transport.locked, true);
  assert.equal(ctx.transport.confidence, 0.9);
  assert.equal(ctx.transport.bpm, 145);
  assert.ok(Object.isFrozen(ctx));
  // Should produce a valid decision.
  const d = new MusicalDirector();
  const dec = d.decide(ctx, noExpRng);
  assert.ok(dec.action === "play" || dec.action === "abstain");
});
