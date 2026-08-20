// tests/dsp.test.mjs — W2 (dsp.mjs) tests: A..AD letter-prefixed.
// Style follows tests/foundation.test.mjs (node:test + node:assert/strict,
// A..T letter-prefixed names, deterministic, no Math.random in test bodies
// except for fixed-seed references).
import { test } from "node:test";
import assert from "node:assert/strict";
import { FoundationError } from "../foundation/foundation.mjs";
import {
  polyblepSaw,
  polyblepSquare,
  polyblepTriangle,
  polyblepPulse,
  phaseIncrement,
  ZdfSvf,
  FmOscillator,
  WAVETABLE_NAMES,
  buildWavetable,
  wavetableInterpolate,
  Adsr,
  pitchGlide,
  tanhSaturation,
  softClip,
  hardClip,
  mtof,
  ftom,
  dbToGain,
  gainToDb,
} from "../foundation/dsp.mjs";

const SR = 44100;

/* ---------- helpers ---------- */
// Magnitude at a specific frequency via direct DFT (Goertzel-style).
// Returns amplitude (peak), not power. ~Accurate even when N is not a
// whole number of periods, with small leakage error.
function magnitudeAt(samples, sampleRate, freqHz) {
  const N = samples.length;
  const omega = 2 * Math.PI * freqHz / sampleRate;
  let re = 0;
  let im = 0;
  for (let i = 0; i < N; i++) {
    re += samples[i] * Math.cos(omega * i);
    im -= samples[i] * Math.sin(omega * i);
  }
  return Math.sqrt(re * re + im * im) * 2 / N;
}

/* ===================== PolyBLEP oscillators (A–F) ===================== */

/* A: polyblepSaw — DC offset ~0 over 1000 samples (|mean| < 0.05) */
test("A: polyblepSaw — DC offset |mean| < 0.05 over 1000 samples", () => {
  const freq = 220;
  const dt = phaseIncrement(freq, SR);
  let sum = 0;
  const N = 1000;
  for (let i = 0; i < N; i++) {
    const phase = (i * dt) % 1;
    sum += polyblepSaw(phase, dt);
  }
  const mean = sum / N;
  assert.ok(Math.abs(mean) < 0.05, `mean ${mean} should be |x| < 0.05`);
});

/* B: polyblepSaw — peak amplitude <= 1.05 */
test("B: polyblepSaw — peak amplitude <= 1.05", () => {
  const freq = 220;
  const dt = phaseIncrement(freq, SR);
  let peak = 0;
  for (let i = 0; i < SR; i++) {
    const phase = (i * dt) % 1;
    const v = polyblepSaw(phase, dt);
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  assert.ok(peak <= 1.05, `peak ${peak} should be <= 1.05`);
});

/* C: polyblepSquare — mean over a full cycle ~= 0 (50% duty) */
test("C: polyblepSquare — mean over integer cycles ~= 0", () => {
  const freq = 100; // 441 samples per cycle at 44100 SR
  const dt = phaseIncrement(freq, SR);
  const cyclesPerWindow = 10;
  const N = cyclesPerWindow * Math.round(SR / freq);
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const phase = (i * dt) % 1;
    sum += polyblepSquare(phase, dt);
  }
  const mean = sum / N;
  assert.ok(Math.abs(mean) < 0.01, `mean ${mean} should be |x| < 0.01`);
});

/* D: polyblepSquare — odd harmonics present, even harmonics suppressed */
test("D: polyblepSquare — even harmonic < fundamental/5", () => {
  const freq = 100;
  const dt = phaseIncrement(freq, SR);
  const N = 4096;
  const samples = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const phase = (i * dt) % 1;
    samples[i] = polyblepSquare(phase, dt);
  }
  const mag1 = magnitudeAt(samples, SR, 100);   // fundamental
  const mag2 = magnitudeAt(samples, SR, 200);   // 2nd harmonic
  const mag3 = magnitudeAt(samples, SR, 300);   // 3rd harmonic
  assert.ok(mag1 > 0.5, `fundamental mag ${mag1} should be > 0.5`);
  assert.ok(mag3 > 0.05, `3rd harmonic mag ${mag3} should be > 0.05`);
  assert.ok(mag2 < mag1 / 5, `2nd harmonic mag ${mag2} should be < mag1/5 = ${mag1 / 5}`);
});

/* E: polyblepTriangle — peak amplitude <= 1.05 */
test("E: polyblepTriangle — peak amplitude <= 1.05", () => {
  const freq = 110;
  const dt = phaseIncrement(freq, SR);
  let peak = 0;
  for (let i = 0; i < SR; i++) {
    const phase = (i * dt) % 1;
    const v = polyblepTriangle(phase, dt);
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  assert.ok(peak <= 1.05, `peak ${peak} should be <= 1.05`);
});

/* F: polyblepPulse — duty=0.25 produces pulse with mean ~= -0.5 (25% HIGH) */
test("F: polyblepPulse — duty=0.25 has mean ~= -0.5 (25% HIGH, 75% LOW)", () => {
  const freq = 100;
  const dt = phaseIncrement(freq, SR);
  const N = SR; // 1 second
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const phase = (i * dt) % 1;
    sum += polyblepPulse(phase, dt, 0.25);
  }
  const mean = sum / N;
  assert.ok(mean < 0, `mean ${mean} should be < 0 for duty=0.25 (25% HIGH)`);
  assert.ok(Math.abs(mean - (-0.5)) < 0.05, `mean ${mean} should be ~= -0.5`);
});

/* ===================== ZDF SVF (G–J) ===================== */

/* G: ZdfSvf — unity gain at DC: low -> 1.0 after 100 samples */
test("G: ZdfSvf — unity gain at DC (input=1, low converges to ~1)", () => {
  const svf = new ZdfSvf(SR);
  let last = 0;
  for (let i = 0; i < 200; i++) {
    const r = svf.process(1.0, 1000, 0);
    last = r.low;
  }
  assert.ok(Math.abs(last - 1.0) < 0.01, `low ${last} should be ~= 1.0`);
});

/* H: ZdfSvf — -3 dB at cutoff: amplitude ~= 0.707 at cutoff frequency */
test("H: ZdfSvf — -3 dB at cutoff (low-pass gain ~= 0.707 at fc)", () => {
  const fc = 1000;
  const svf = new ZdfSvf(SR);
  // Fill filter with sine at fc to settle transient state.
  const N = 2000;
  const samples = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const input = Math.sin(2 * Math.PI * fc * i / SR);
    const r = svf.process(input, fc, 0);
    samples[i] = r.low;
  }
  // Measure amplitude of last half (settled).
  const tailStart = Math.floor(N / 2);
  let peak = 0;
  for (let i = tailStart; i < N; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) peak = a;
  }
  // Expected gain at cutoff ~= 0.707 (Butterworth at resonance=0).
  assert.ok(Math.abs(peak - 0.707) < 0.1, `peak ${peak} should be ~= 0.707 (within 10%)`);
});

/* I: ZdfSvf — monotonic rolloff: low at 0.5*fc > low at 2*fc */
test("I: ZdfSvf — monotonic rolloff (low at 0.5*fc > low at 2*fc)", () => {
  const fc = 1000;
  function measureAt(testFreq) {
    const svf = new ZdfSvf(SR);
    const N = 2000;
    let peak = 0;
    for (let i = 0; i < N; i++) {
      const input = Math.sin(2 * Math.PI * testFreq * i / SR);
      const r = svf.process(input, fc, 0);
      if (i >= N / 2) {
        const a = Math.abs(r.low);
        if (a > peak) peak = a;
      }
    }
    return peak;
  }
  const below = measureAt(0.5 * fc);
  const above = measureAt(2 * fc);
  assert.ok(below > above, `low at 0.5*fc (${below}) should be > low at 2*fc (${above})`);
});

/* J: ZdfSvf — resonance self-oscillates at resonance=0.95 (ring-out > 0.001) */
test("J: ZdfSvf — resonance=0.95 rings out > 0.001 after 100 samples of silence", () => {
  const svf = new ZdfSvf(SR);
  // Kick with an impulse at sample 0.
  svf.process(1.0, 1000, 0.95);
  // Then feed silence; check the filter is still ringing after 100 samples.
  let lastOut = 0;
  for (let i = 0; i < 100; i++) {
    const r = svf.process(0.0, 1000, 0.95);
    lastOut = r.low;
  }
  assert.ok(Math.abs(lastOut) > 0.001, `output ${lastOut} should be > 0.001 (ring-out)`);
});

/* ===================== FM (K–L) ===================== */

/* K: FmOscillator — modIndex=0 = pure sine */
test("K: FmOscillator — modIndex=0 produces pure sine", () => {
  const fm = new FmOscillator(SR);
  let maxErr = 0;
  const N = 1000;
  for (let i = 0; i < N; i++) {
    const out = fm.process(100, 2, 0);
    const expected = Math.sin(2 * Math.PI * 100 * i / SR);
    const err = Math.abs(out - expected);
    if (err > maxErr) maxErr = err;
  }
  assert.ok(maxErr < 0.001, `maxErr ${maxErr} should be < 0.001`);
});

/* L: FmOscillator — modIndex>0 produces sidebands at carrier +/- ratio*carrier */
test("L: FmOscillator — sideband at carrier+ratio*carrier > 0.01", () => {
  const carrier = 100;
  const ratio = 2;
  const fm = new FmOscillator(SR);
  const N = 4096;
  const samples = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    samples[i] = fm.process(carrier, ratio, 1.0);
  }
  // Sideband at carrier + ratio*carrier = 100 + 200 = 300 Hz
  const mag300 = magnitudeAt(samples, SR, carrier + carrier * ratio);
  const mag100 = magnitudeAt(samples, SR, carrier);
  assert.ok(mag100 > 0.1, `carrier mag ${mag100} should be > 0.1`);
  assert.ok(mag300 > 0.01, `sideband mag ${mag300} at 300 Hz should be > 0.01`);
});

/* ===================== Wavetable (M–S) ===================== */

/* M: buildWavetable("saw") — length 2048, peak <= 1.05, DC |mean| < 0.05 */
test("M: buildWavetable('saw') — length, peak, DC", () => {
  const t = buildWavetable("saw");
  assert.equal(t.length, 2048);
  let peak = 0;
  let sum = 0;
  for (let i = 0; i < t.length; i++) {
    const a = Math.abs(t[i]);
    if (a > peak) peak = a;
    sum += t[i];
  }
  assert.ok(peak <= 1.05, `peak ${peak} should be <= 1.05`);
  assert.ok(Math.abs(sum / t.length) < 0.05, `mean ${sum / t.length} should be |x| < 0.05`);
});

/* N: buildWavetable("square") — mean over first half > 0, second half < 0 */
test("N: buildWavetable('square') — first-half mean > 0, second-half mean < 0", () => {
  const t = buildWavetable("square");
  const half = t.length / 2;
  let sumFirst = 0;
  let sumSecond = 0;
  for (let i = 0; i < half; i++) sumFirst += t[i];
  for (let i = half; i < t.length; i++) sumSecond += t[i];
  const meanFirst = sumFirst / half;
  const meanSecond = sumSecond / half;
  assert.ok(meanFirst > 0, `first-half mean ${meanFirst} should be > 0`);
  assert.ok(meanSecond < 0, `second-half mean ${meanSecond} should be < 0`);
});

/* O: buildWavetable("sine") — equals Math.sin exactly */
test("O: buildWavetable('sine') — equals Math.sin(2*pi*i/size)", () => {
  const t = buildWavetable("sine");
  let maxErr = 0;
  for (let i = 0; i < t.length; i++) {
    const expected = Math.sin(2 * Math.PI * i / t.length);
    const err = Math.abs(t[i] - expected);
    if (err > maxErr) maxErr = err;
  }
  assert.ok(maxErr < 1e-6, `maxErr ${maxErr} should be < 1e-6`);
});

/* P: buildWavetable("noise") — length 2048, peak in [-1, 1], DC |mean| < 0.1 */
test("P: buildWavetable('noise') — length, peak, DC", () => {
  const t = buildWavetable("noise");
  assert.equal(t.length, 2048);
  let peak = 0;
  let sum = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] > 1 || t[i] < -1) {
      assert.fail(`noise sample ${i} = ${t[i]} out of [-1, 1]`);
    }
    const a = Math.abs(t[i]);
    if (a > peak) peak = a;
    sum += t[i];
  }
  assert.ok(peak > 0.5, `peak ${peak} should be > 0.5 (noise should actually contain noise)`);
  assert.ok(Math.abs(sum / t.length) < 0.1, `mean ${sum / t.length} should be |x| < 0.1`);
});

/* Q: buildWavetable("psy1") — byte-identical across two calls */
test("Q: buildWavetable('psy1') — byte-identical across calls", () => {
  const a = buildWavetable("psy1");
  const b = buildWavetable("psy1");
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i], b[i], `mismatch at ${i}: ${a[i]} vs ${b[i]}`);
  }
});

/* R: wavetableInterpolate — phase=0 -> table[0], phase=0.5 -> table[size/2] */
test("R: wavetableInterpolate — phase=0 -> table[0], phase=0.5 -> table[size/2]", () => {
  const t = buildWavetable("sine");
  const size = t.length;
  const r0 = wavetableInterpolate(t, 0);
  const rHalf = wavetableInterpolate(t, 0.5);
  assert.ok(Math.abs(r0 - t[0]) < 1e-6, `r0 ${r0} should ~= t[0] ${t[0]}`);
  assert.ok(Math.abs(rHalf - t[size / 2]) < 1e-6, `rHalf ${rHalf} should ~= t[${size / 2}] ${t[size / 2]}`);
});

/* S: wavetableInterpolate — linear interp between adjacent samples */
test("S: wavetableInterpolate — linear interp halfway between samples 0 and 1", () => {
  const t = buildWavetable("sine");
  const size = t.length;
  // phase = 0.5 / size -> position 0.5 -> exactly between t[0] and t[1]
  const phase = 0.5 / size;
  const result = wavetableInterpolate(t, phase);
  const expected = (t[0] + t[1]) / 2;
  assert.ok(Math.abs(result - expected) < 1e-6, `result ${result} should ~= avg ${(t[0] + t[1]) / 2}`);
});

/* ===================== Adsr (T–W) ===================== */

/* T: Adsr — attack reaches peak in `attack` seconds */
test("T: Adsr — attack reaches peak in `attack` seconds", () => {
  const adsr = new Adsr(SR);
  adsr.set({ attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.1, peak: 1 });
  // Process `attack` seconds (0.1 * SR samples).
  let last = 0;
  const attackSamples = Math.round(0.1 * SR);
  for (let i = 0; i < attackSamples; i++) last = adsr.process(true);
  // At end of attack, output ~= peak (within 5%).
  assert.ok(Math.abs(last - 1.0) < 0.05, `output ${last} should be ~= peak 1.0 (within 5%)`);
});

/* U: Adsr — sustain holds (output at attack+decay+0.5 ~= sustain) */
test("U: Adsr — sustain holds at sustain level", () => {
  const adsr = new Adsr(SR);
  adsr.set({ attack: 0.05, decay: 0.1, sustain: 0.7, release: 0.1, peak: 1 });
  const attackSamples = Math.round(0.05 * SR);
  const decaySamples = Math.round(0.1 * SR);
  const sustainHoldSamples = Math.round(0.5 * SR);
  let last = 0;
  for (let i = 0; i < attackSamples + decaySamples + sustainHoldSamples; i++) {
    last = adsr.process(true);
  }
  assert.ok(Math.abs(last - 0.7) < 0.05, `output ${last} should be ~= sustain 0.7 (within 5%)`);
});

/* V: Adsr — release decays to < 0.001 after `release` seconds */
test("V: Adsr — release decays to < 0.001 after release seconds", () => {
  const adsr = new Adsr(SR);
  adsr.set({ attack: 0.01, decay: 0.05, sustain: 0.7, release: 0.1, peak: 1 });
  // Trigger gate for a bit.
  const gateSamples = Math.round((0.01 + 0.05 + 0.5) * SR);
  for (let i = 0; i < gateSamples; i++) adsr.process(true);
  // Release gate and process `release` seconds.
  const releaseSamples = Math.round(0.1 * SR);
  let last = 0;
  for (let i = 0; i < releaseSamples; i++) last = adsr.process(false);
  assert.ok(Math.abs(last) < 0.001, `output ${last} should be < 0.001 after release`);
});

/* W: Adsr — reset() returns to IDLE state, output=0 */
test("W: Adsr — reset() returns to IDLE state with output=0", () => {
  const adsr = new Adsr(SR);
  adsr.set({ attack: 0.01, decay: 0.05, sustain: 0.7, release: 0.1, peak: 1 });
  // Trigger and partially advance.
  for (let i = 0; i < 100; i++) adsr.process(true);
  adsr.reset();
  // After reset, state is IDLE and value is 0; gate=false should produce 0.
  const out = adsr.process(false);
  assert.equal(adsr.state, "IDLE");
  assert.equal(adsr.value, 0);
  assert.equal(out, 0);
});

/* ===================== Bit-identity (X–Y) ===================== */

/* X: ZdfSvf — bit-identical output for identical input (100 calls, fresh state) */
test("X: ZdfSvf — bit-identical for 100 fresh instances with same input sequence", () => {
  const N = 100;
  // Generate a fixed input sequence (deterministic, no Math.random).
  const inputs = new Float32Array(N);
  const cutoffs = new Float32Array(N);
  const resonances = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    inputs[i] = Math.sin(2 * Math.PI * 440 * i / SR);
    cutoffs[i] = 200 + 800 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 1 * i / SR));
    resonances[i] = 0.3 + 0.4 * (0.5 + 0.5 * Math.cos(2 * Math.PI * 0.7 * i / SR));
  }
  const out1 = [];
  const out2 = [];
  {
    const svf = new ZdfSvf(SR);
    for (let i = 0; i < N; i++) out1.push(svf.process(inputs[i], cutoffs[i], resonances[i]).low);
  }
  {
    const svf = new ZdfSvf(SR);
    for (let i = 0; i < N; i++) out2.push(svf.process(inputs[i], cutoffs[i], resonances[i]).low);
  }
  for (let i = 0; i < N; i++) {
    assert.equal(out1[i], out2[i], `mismatch at sample ${i}: ${out1[i]} vs ${out2[i]}`);
  }
});

/* Y: FmOscillator — bit-identical output for identical input (100 calls) */
test("Y: FmOscillator — bit-identical for 100 fresh instances with same input sequence", () => {
  const N = 100;
  const carrierFreqs = new Float32Array(N);
  const ratios = new Float32Array(N);
  const indices = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    carrierFreqs[i] = 110 + 50 * Math.sin(i * 0.13);
    ratios[i] = 1 + (i % 4) * 0.5;
    indices[i] = 0.5 + 0.5 * Math.cos(i * 0.07);
  }
  const out1 = [];
  const out2 = [];
  {
    const fm = new FmOscillator(SR);
    for (let i = 0; i < N; i++) out1.push(fm.process(carrierFreqs[i], ratios[i], indices[i]));
  }
  {
    const fm = new FmOscillator(SR);
    for (let i = 0; i < N; i++) out2.push(fm.process(carrierFreqs[i], ratios[i], indices[i]));
  }
  for (let i = 0; i < N; i++) {
    assert.equal(out1[i], out2[i], `mismatch at sample ${i}: ${out1[i]} vs ${out2[i]}`);
  }
});

/* ===================== Utility (Z–AD) ===================== */

/* Z: mtof/ftom — A4=440 Hz and 12-note round-trip */
test("Z: mtof(69) === 440, ftom(440) === 69, round-trip 12 notes", () => {
  assert.ok(Math.abs(mtof(69) - 440) < 1e-3, `mtof(69) = ${mtof(69)} should be ~= 440`);
  assert.ok(Math.abs(ftom(440) - 69) < 1e-3, `ftom(440) = ${ftom(440)} should be ~= 69`);
  // 12 MIDI notes spanning the audible range.
  const notes = [0, 12, 24, 36, 48, 57, 60, 64, 69, 72, 81, 96, 108, 127];
  for (const m of notes) {
    const f = mtof(m);
    const m2 = ftom(f);
    assert.ok(Math.abs(m - m2) < 1e-6, `round-trip midi ${m} -> freq ${f} -> midi ${m2} should be identity`);
  }
});

/* AA: dbToGain/gainToDb — 0 dB = 1, -6 dB ~= 0.501, round-trips */
test("AA: dbToGain(0) === 1, dbToGain(-6) ~= 0.501, gainToDb round-trips", () => {
  assert.equal(dbToGain(0), 1);
  const g6 = dbToGain(-6);
  assert.ok(Math.abs(g6 - 0.501) < 0.005, `dbToGain(-6) = ${g6} should be ~= 0.501`);
  // Round-trip for several gains.
  const dbs = [-12, -6, -3, 0, 3, 6, 12];
  for (const db of dbs) {
    const g = dbToGain(db);
    const db2 = gainToDb(g);
    assert.ok(Math.abs(db - db2) < 1e-6, `round-trip db ${db} -> gain ${g} -> db ${db2}`);
  }
});

/* AB: tanhSaturation — passthrough at drive=0, saturation at drive=1 */
test("AB: tanhSaturation — (0,1)=0, (1,0)=1, (1,1)<1", () => {
  assert.equal(tanhSaturation(0, 1), 0);
  assert.equal(tanhSaturation(1, 0), 1);
  const s = tanhSaturation(1, 1);
  assert.ok(s < 1, `tanhSaturation(1,1) = ${s} should be < 1`);
  assert.ok(s > 0, `tanhSaturation(1,1) = ${s} should be > 0`);
});

/* AC: hardClip — boundary behavior */
test("AC: hardClip — clamp to [-1, 1]", () => {
  assert.equal(hardClip(1.5), 1);
  assert.equal(hardClip(-1.5), -1);
  assert.equal(hardClip(0.5), 0.5);
  assert.equal(hardClip(-0.5), -0.5);
  assert.equal(hardClip(1), 1);
  assert.equal(hardClip(-1), -1);
  assert.equal(hardClip(0), 0);
});

/* AD: softClip — cubic soft clip */
test("AD: softClip — cubic, |output| < |input| for |x|<sqrt(3), passes 0", () => {
  assert.equal(softClip(0), 0);
  assert.ok(softClip(1) < 1, `softClip(1) = ${softClip(1)} should be < 1`);
  assert.ok(softClip(-1) > -1, `softClip(-1) = ${softClip(-1)} should be > -1`);
  assert.ok(softClip(1) > 0, `softClip(1) = ${softClip(1)} should be > 0`);
});

/* ===================== Extra tests (AE–AH) ===================== */

/* AE: phaseIncrement — freq/sampleRate */
test("AE: phaseIncrement — freq/sampleRate", () => {
  assert.equal(phaseIncrement(100, 44100), 100 / 44100);
  assert.equal(phaseIncrement(1000, 48000), 1000 / 48000);
  assert.throws(() => phaseIncrement(100, 0), FoundationError);
  assert.throws(() => phaseIncrement("a", 44100), FoundationError);
});

/* AF: pitchGlide — boundary behavior and monotonic glide */
test("AF: pitchGlide — endpoints and monotonicity", () => {
  // t=0 -> fromFreq
  assert.ok(Math.abs(pitchGlide(100, 200, 0, 0.1) - 100) < 1e-6);
  // t -> infinity -> toFreq (use t=50*tau for ~ exp(-50) -> 0)
  assert.ok(Math.abs(pitchGlide(100, 200, 50, 1) - 200) < 1e-3);
  // Monotonic: each step moves from fromFreq toward toFreq
  let prev = pitchGlide(100, 200, 0, 0.05);
  let monotonic = true;
  for (let i = 1; i < 20; i++) {
    const cur = pitchGlide(100, 200, i * 0.01, 0.05);
    if (cur < prev) monotonic = false;
    prev = cur;
  }
  assert.ok(monotonic, "pitchGlide should be monotonically increasing from fromFreq to toFreq");
  // tau=0 -> immediate jump to toFreq
  assert.equal(pitchGlide(100, 200, 0.5, 0), 200);
});

/* AG: ZdfSvf.reset() — clears state */
test("AG: ZdfSvf.reset() — clears internal state", () => {
  const svf = new ZdfSvf(SR);
  for (let i = 0; i < 100; i++) svf.process(Math.sin(i * 0.01), 1000, 0.3);
  assert.notEqual(svf.ic1eq, 0);
  assert.notEqual(svf.ic2eq, 0);
  svf.reset();
  assert.equal(svf.ic1eq, 0);
  assert.equal(svf.ic2eq, 0);
});

/* AH: buildWavetable — unknown name throws FoundationError */
test("AH: buildWavetable — unknown name throws FoundationError", () => {
  assert.throws(() => buildWavetable("unknown"), FoundationError);
  assert.throws(() => buildWavetable("saw", -1), FoundationError);
  assert.throws(() => buildWavetable("saw", 0), FoundationError);
  assert.doesNotThrow(() => buildWavetable("saw", 1024));
});

/* AI: FmOscillator.reset() — clears phase */
test("AI: FmOscillator.reset() — clears phase to 0", () => {
  const fm = new FmOscillator(SR);
  for (let i = 0; i < 100; i++) fm.process(220, 2, 1);
  assert.notEqual(fm.phase, 0);
  fm.reset();
  assert.equal(fm.phase, 0);
  // First sample after reset uses phase=0; output for modIndex=0 = sin(0) = 0.
  const out = fm.process(100, 2, 0);
  assert.equal(out, 0);
});

/* AJ: WAVETABLE_NAMES — exports expected list */
test("AJ: WAVETABLE_NAMES — exports expected list of names", () => {
  assert.deepEqual(WAVETABLE_NAMES, ["saw", "square", "triangle", "sine", "noise", "psy1"]);
  // All names build successfully.
  for (const n of WAVETABLE_NAMES) {
    const t = buildWavetable(n, 256);
    assert.equal(t.length, 256);
    assert.ok(t instanceof Float32Array);
  }
});

/* AK: polyblepSquare at duty=0.5 matches polyblepPulse at duty=0.5 */
test("AK: polyblepSquare(phase, dt) === polyblepPulse(phase, dt, 0.5)", () => {
  const dt = 0.01;
  let maxDiff = 0;
  for (let i = 0; i < 1000; i++) {
    const phase = i / 1000;
    const a = polyblepSquare(phase, dt);
    const b = polyblepPulse(phase, dt, 0.5);
    const d = Math.abs(a - b);
    if (d > maxDiff) maxDiff = d;
  }
  assert.ok(maxDiff < 1e-9, `max diff ${maxDiff} should be ~0 (square is pulse with duty=0.5)`);
});

/* AL: ZdfSvf — high-pass output rejects DC */
test("AL: ZdfSvf — high-pass output rejects DC (converges to 0)", () => {
  const svf = new ZdfSvf(SR);
  let last = 1;
  for (let i = 0; i < 500; i++) {
    const r = svf.process(1.0, 1000, 0);
    last = r.high;
  }
  assert.ok(Math.abs(last) < 0.05, `high ${last} should be ~= 0 for DC input`);
});

/* AM: tanhSaturation — continuous at drive=0 boundary */
test("AM: tanhSaturation — limit as drive -> 0+ equals x", () => {
  // For very small drive, tanh(x*drive)/drive -> x.
  const x = 0.7;
  const tiny = 1e-8;
  const out = tanhSaturation(x, tiny);
  assert.ok(Math.abs(out - x) < 1e-3, `tanhSaturation(0.7, 1e-8) = ${out} should be ~= 0.7`);
});

/* AN: wavetableInterpolate — wraps at phase=1.0 (returns table[0]) */
test("AN: wavetableInterpolate — phase=1.0 wraps to table[0]", () => {
  const t = buildWavetable("saw");
  const r = wavetableInterpolate(t, 1.0);
  assert.ok(Math.abs(r - t[0]) < 1e-6, `phase=1.0 -> ${r}, expected ~= table[0] = ${t[0]}`);
});
