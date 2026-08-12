// tests/foundation-consumer/contract.test.mjs
// FOUNDATION CONSUMER CONTRACT TESTS. Contract-only — NO production code integrated.
// Run with: node --test tests/
//
// These tests prove PSY can consume a foundation Transport WITHOUT owning the clock,
// and they encode the invariants that any future PSY consumer MUST satisfy:
//   - PSY does NOT create a second musical clock
//   - PSY does NOT modify Transport state directly
//   - PSY does NOT derive beat independently
//   - PSY does NOT derive bar independently
//   - PSY does NOT schedule based on radio timestamps directly
//
// They run against a deterministic ReferenceTransport + reference consumer harness.
// When PSY's real consumer is integrated (P1), these same tests run against it and
// MUST stay green. A violating consumer makes them fail.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ReferenceTransport, TRANSPORT_CONSUMER_API } from "./reference-transport.mjs";
import { scheduleFromTransport, detectConsumerViolations } from "./consumer-harness.mjs";

// Feed a clean 120 BPM beat stream so the reference transport locks.
function feedCleanStream(tr, { bpm = 120, beats = 16, start = 1.0 } = {}) {
  const period = 60 / bpm;
  for (let i = 0; i < beats; i++) {
    tr.observe({ audioTime: start + i * period, confidence: 0.9 });
  }
  return start + beats * period; // audio time just after the last beat
}

test("transport grid is deterministic: same observations -> same grid", () => {
  const a = new ReferenceTransport();
  const b = new ReferenceTransport();
  const tA = feedCleanStream(a);
  const tB = feedCleanStream(b);
  const ga = a.gridAt(tA);
  const gb = b.gridAt(tB);
  assert.equal(ga.bpm, gb.bpm);
  assert.equal(ga.beatIndex, gb.beatIndex);
  assert.equal(ga.barIndex, gb.barIndex);
  assert.equal(ga.beatPhase, gb.beatPhase);
});

test("transport grid is monotonic: beats advance with audio time", () => {
  const tr = new ReferenceTransport();
  const end = feedCleanStream(tr);
  const g1 = tr.gridAt(end);
  const g2 = tr.gridAt(end + 0.5);
  assert.ok(g2.beatIndex >= g1.beatIndex, "beatIndex must not go backwards");
  assert.ok(g2.nextBeatAudioTime > g1.nextBeatAudioTime || g2.beatIndex > g1.beatIndex);
});

test("transport snapshot is immutable: consumers cannot modify Transport state", () => {
  const tr = new ReferenceTransport();
  const end = feedCleanStream(tr);
  const snap = tr.gridAt(end);
  assert.ok(Object.isFrozen(snap), "gridAt() must return a frozen (read-only) snapshot");
  assert.throws(() => { "use strict"; snap.bpm = 999; }, TypeError, "mutating snapshot must throw");
  assert.throws(() => { "use strict"; snap.beatIndex = 0; }, TypeError);
});

test("observe() is the ONLY write path; reading never advances locked state", () => {
  const tr = new ReferenceTransport();
  const end = feedCleanStream(tr);
  const g1 = tr.gridAt(end);
  // repeated reads must not change the model (reads are not observations)
  tr.gridAt(end + 0.01); tr.gridAt(end + 0.02); tr.beatsUpTo(end, 200);
  const g2 = tr.gridAt(end);
  assert.equal(g1.beatIndex, g2.beatIndex, "reads must not advance beatIndex");
  assert.ok(tr.lockedAt(end), "transport should be locked after a clean stream");
});

test("confidence DECAYS over a gap and unlocks (transport keeps predicting)", () => {
  const tr = new ReferenceTransport();
  const end = feedCleanStream(tr);
  assert.ok(tr.lockedAt(end), "locked during stream");
  const lockedDuring = tr.lockedAt(end);
  const lockedAfterGap = tr.lockedAt(end + 3.0); // 3s of radio silence
  assert.equal(lockedDuring, true);
  assert.equal(lockedAfterGap, false, "must unlock after confidence decays over a gap");
  // prediction still continues during the gap (model keeps running)
  const beats = tr.beatsUpTo(end + 3.0, 200);
  assert.ok(Array.isArray(beats), "beatsUpTo must still return predictions during a gap");
});

test("consumer derives beats ONLY from the transport (no independent derivation)", () => {
  const tr = new ReferenceTransport();
  const end = feedCleanStream(tr);
  const events = scheduleFromTransport(tr, end, 200);
  const transportBeats = tr.beatsUpTo(end, 200);
  // every scheduled beat must be exactly a transport beat (subset, same values)
  for (const ev of events) {
    assert.ok(transportBeats.includes(ev.audioTime), "scheduled beat must come from transport");
  }
  assert.equal(events.length, transportBeats.length, "consumer must not add or drop beats");
});

test("consumer is pure: same transport+audioTime -> identical schedule", () => {
  const tr = new ReferenceTransport();
  const end = feedCleanStream(tr);
  const e1 = scheduleFromTransport(tr, end, 200);
  const e2 = scheduleFromTransport(tr, end, 200);
  assert.deepEqual(e1.map(e => e.audioTime), e2.map(e => e.audioTime));
});

test("consumer does NOT receive radio observations (radio is an OBSERVER, not a scheduler input)", () => {
  // The consumer signature is (transport, audioTime, horizonMs). It has NO observation
  // parameter. Assert the reference consumer source never references observation times.
  const src = scheduleFromTransport.toString();
  assert.ok(!/observedBeatTime|radioTimestamp|observation\.time|obs\.time/.test(src),
    "consumer must never reference radio/observation timestamps");
});

test("consumer has NO independent musical clock (no wall clock, no timers)", () => {
  const src = scheduleFromTransport.toString();
  const violations = detectConsumerViolations(src);
  assert.deepEqual(violations, [], "reference consumer must have zero timing violations");
});

test("a VIOLATING consumer is detected (contract enforcement)", () => {
  // Deliberately BAD consumers — the detector MUST flag each one.
  const badWall = "function c(){ const t = Date.now(); return t; }";
  const badTimer = "function c(){ setInterval(step, 25); }";
  const badRadio = "function c(o){ scheduleAt(o.observedBeatTime); }";
  assert.ok(detectConsumerViolations(badWall).length > 0, "wall-clock consumer must be flagged");
  assert.ok(detectConsumerViolations(badTimer).length > 0, "timer-clock consumer must be flagged");
  assert.ok(detectConsumerViolations(badRadio).length > 0, "radio-timestamp consumer must be flagged");
});

test("consumer API surface is the read-only contract surface", () => {
  const tr = new ReferenceTransport();
  for (const method of TRANSPORT_CONSUMER_API) {
    assert.equal(typeof tr[method], "function", `transport must expose read API ${method}`);
  }
  // The consumer API must NOT include observe (write path is not consumer-facing).
  assert.ok(!TRANSPORT_CONSUMER_API.includes("observe"), "observe() must not be consumer-facing");
});
