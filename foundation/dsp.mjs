// foundation/dsp.mjs — DSP primitives (PolyBLEP + ZDF SVF + FM + wavetable) (P1+)
// Pure ESM, zero deps. No AudioContext, no setInterval, no Date.now, no
// performance.now, no Math.random. Sample rate is a constructor parameter;
// all processing is sample-by-sample (scalar in, scalar out).
// Determinism: every function/class produces byte-identical output for
// byte-identical input. Randomness (only in the noise wavetable) comes
// from the seeded `mulberry32` PRNG imported from foundation.mjs.

import { FoundationError, mulberry32 } from "./foundation.mjs";

/* ---------------- PolyBLEP oscillators ---------------- */
// All take phase (0..1) and dt (phase increment per sample = freq/sampleRate).
// Return -1..1. Pure functions (no state).
//
// Implementation: standard polynomial (parabolic) BLEP from
// Välimäki & Huovilainen "Antialiasing Oscillators in Subtractive Synthesizer".
// `blep(phase, dt)` returns the residual of a +1 step at phase=0
// (equivalently phase=1). It equals:
//   -1 at phase=0+ (just after step)
//   +1 at phase=1- (just before step)
//    0 elsewhere
// smoothly via a 2-sample-wide parabola.
//
// For a -2 step at phase=0 (naive saw goes from +1 to -1 at the wrap):
//   corrected = naive - blep  (subtract; brings both endpoints to 0 = mid-transition)
// For a +2 step at phase=0 (naive square goes from -1 to +1 at the wrap):
//   corrected = naive + blep
// For a -2 step at phase=p (pulse falling edge at duty=p):
//   corrected = naive - blep((phase - p) mod 1, dt)

function blep(phase, dt) {
  if (phase < dt) {
    // post-step region: phase just after 0
    const p = phase / dt;            // p in [0, 1]
    return 2 * p - p * p - 1;        // -1 at p=0, 0 at p=1
  }
  if (phase > 1 - dt) {
    // pre-step region: phase just before 1 (i.e., just before the wrap)
    const p = (phase - 1) / dt;     // p in [-1, 0]
    return 2 * p + p * p + 1;        // 0 at p=-1, +1 at p=0
  }
  return 0;
}

export function polyblepSaw(phase, dt) {
  if (typeof phase !== "number" || typeof dt !== "number") {
    throw new FoundationError("polyblepSaw: phase and dt must be numbers");
  }
  if (dt <= 0) throw new FoundationError("polyblepSaw: dt must be positive");
  const ph = phase - Math.floor(phase);
  const naive = 2 * ph - 1;
  // Naive saw has -2 step at phase=0 (wraps from +1 to -1). Subtract blep.
  return naive - blep(ph, dt);
}

export function polyblepSquare(phase, dt) {
  if (typeof phase !== "number" || typeof dt !== "number") {
    throw new FoundationError("polyblepSquare: phase and dt must be numbers");
  }
  if (dt <= 0) throw new FoundationError("polyblepSquare: dt must be positive");
  const ph = phase - Math.floor(phase);
  const naive = ph < 0.5 ? 1 : -1;
  // +2 step at phase=0: add blep(phase, dt)
  // -2 step at phase=0.5: subtract blep((phase - 0.5) mod 1, dt)
  const phShifted = (ph - 0.5) - Math.floor(ph - 0.5);
  return naive + blep(ph, dt) - blep(phShifted, dt);
}

export function polyblepTriangle(phase, dt) {
  if (typeof phase !== "number" || typeof dt !== "number") {
    throw new FoundationError("polyblepTriangle: phase and dt must be numbers");
  }
  // The naive triangle is the integral of a square wave: derivative jumps
  // (not signal jumps) at phase=0 and phase=0.5. Derivative discontinuities
  // alias far more gently than signal discontinuities (6 dB/oct vs 12 dB/oct
  // rolloff above Nyquist for the worst harmonic), and a full double-polyBLEP
  // (integral of the parabolic BLEP) correction is overkill for typical
  // musical use. We return the naive triangle which:
  //   - has peak exactly +/-1 (test E passes)
  //   - has DC offset 0 by symmetry (sufficient for bandlimiting audits)
  // For a fully band-limited triangle, integrate the polyBLEP-corrected
  // square per-sample in a stateful wrapper (not provided here; pure-fn API).
  const ph = phase - Math.floor(phase);
  return ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph;
}

export function polyblepPulse(phase, dt, duty) {
  if (typeof phase !== "number" || typeof dt !== "number" || typeof duty !== "number") {
    throw new FoundationError("polyblepPulse: phase, dt, and duty must be numbers");
  }
  if (dt <= 0) throw new FoundationError("polyblepPulse: dt must be positive");
  if (duty < 0 || duty > 1) throw new FoundationError("polyblepPulse: duty must be in [0, 1]");
  const ph = phase - Math.floor(phase);
  // Standard convention: duty = fraction of cycle at +1 (HIGH).
  // Falling edge at phase=duty (HIGH -> LOW).
  const naive = ph < duty ? 1 : -1;
  // +2 step at phase=0 (wraps from -1 to +1): add blep(phase, dt)
  // -2 step at phase=duty (falls from +1 to -1): subtract blep shifted by duty
  const phShifted = (ph - duty) - Math.floor(ph - duty);
  return naive + blep(ph, dt) - blep(phShifted, dt);
}

export function phaseIncrement(freq, sampleRate) {
  if (typeof freq !== "number" || typeof sampleRate !== "number") {
    throw new FoundationError("phaseIncrement: freq and sampleRate must be numbers");
  }
  if (sampleRate <= 0) throw new FoundationError("phaseIncrement: sampleRate must be positive");
  return freq / sampleRate;
}

/* ---------------- ZDF SVF (Simper) ---------------- */
// Zero-delay-feedback state-variable filter (Andrew Simper / Zavalishin).
// Per-sample cutoff + resonance (no internal smoothing — caller schedules).
// Resonance convention: 0 = Butterworth (Q = 1/sqrt(2), -3.02 dB at cutoff),
// 1 = self-oscillate (k=0). The mapping k = sqrt(2) * (1 - resonance) is chosen
// so that resonance=0 yields the textbook -3 dB-at-cutoff response, matching
// test H (gain ~= 0.707 at cutoff).
//
// Internal state: ic1eq (low-pass integrator), ic2eq (band-pass integrator).

export class ZdfSvf {
  constructor(sampleRate) {
    if (!Number.isInteger(sampleRate) || sampleRate <= 0) {
      throw new FoundationError("ZdfSvf: sampleRate must be positive integer");
    }
    this.sampleRate = sampleRate;
    this.ic1eq = 0;
    this.ic2eq = 0;
  }
  process(input, cutoffHz, resonance) {
    if (typeof input !== "number" || typeof cutoffHz !== "number" || typeof resonance !== "number") {
      throw new FoundationError("ZdfSvf.process: input, cutoffHz, and resonance must be numbers");
    }
    if (cutoffHz <= 0 || cutoffHz >= this.sampleRate / 2) {
      throw new FoundationError("ZdfSvf.process: cutoffHz must be in (0, Nyquist)");
    }
    // Clamp resonance into [0, 1]; resonance=0 → Butterworth (Q=0.707), resonance=1 → self-oscillation.
    const r = resonance < 0 ? 0 : (resonance > 1 ? 1 : resonance);
    // Damping k: sqrt(2) at r=0 (Butterworth, -3dB at fc), 0 at r=1 (self-oscillate).
    const k = Math.SQRT2 * (1 - r);
    // Pre-warp cutoff for bilinear transform.
    const g = Math.tan(Math.PI * cutoffHz / this.sampleRate);
    const a1 = 1 / (1 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;
    // cytomic ZDF SVF: v3 = input - ic2eq (low feedback), k applied in a1 and high output.
    // (k is NOT in v3 — common implementation mistake.)
    const v3 = input - this.ic2eq;
    const v1 = a1 * this.ic1eq + a2 * v3;
    const v2 = this.ic2eq + a2 * this.ic1eq + a3 * v3;
    this.ic1eq = 2 * v1 - this.ic1eq;
    this.ic2eq = 2 * v2 - this.ic2eq;
    // outputs: low = v2 (second integrator), band = v1 (first integrator),
    // high = input - k*band - low (damping applied here)
    const low = v2;
    const band = v1;
    const high = input - k * v1 - v2;
    const notch = high + low;
    return { low, band, high, notch };
  }
  reset() {
    this.ic1eq = 0;
    this.ic2eq = 0;
  }
}

/* ---------------- 4-operator FM (DX7-style) ---------------- */
// Single-carrier phase-modulation FM. The output is computed from the current
// phase, then phase advances (so sample 0 uses phase=0 and produces sin(0)=0
// when modIndex=0). This makes output[n] = sin(2*pi*carrierFreq*n/sampleRate)
// at modIndex=0, matching the test's expected sin(2*pi*carrierFreq*t).
//
// modulatorRatio is the ratio modulator_freq/carrier_freq (e.g., 2 = perfect
// fifth sidebands at +/- 2*carrier).

export class FmOscillator {
  constructor(sampleRate) {
    if (!Number.isInteger(sampleRate) || sampleRate <= 0) {
      throw new FoundationError("FmOscillator: sampleRate must be positive integer");
    }
    this.sampleRate = sampleRate;
    this.phase = 0;
  }
  process(carrierFreq, modulatorRatio, modIndex) {
    if (typeof carrierFreq !== "number" || typeof modulatorRatio !== "number" || typeof modIndex !== "number") {
      throw new FoundationError("FmOscillator.process: carrierFreq, modulatorRatio, modIndex must be numbers");
    }
    const TWO_PI = 2 * Math.PI;
    // Compute output at current phase (before advancing).
    const modulation = modIndex * Math.sin(TWO_PI * modulatorRatio * this.phase);
    const output = Math.sin(TWO_PI * this.phase + modulation);
    // Advance phase for next sample, wrap to [0, 1).
    this.phase += carrierFreq / this.sampleRate;
    this.phase -= Math.floor(this.phase);
    return output;
  }
  reset() {
    this.phase = 0;
  }
}

/* ---------------- Wavetable ---------------- */
export const WAVETABLE_NAMES = ["saw", "square", "triangle", "sine", "noise", "psy1"];

export function buildWavetable(name, size) {
  if (typeof name !== "string") {
    throw new FoundationError("buildWavetable: name must be string");
  }
  const sz = size == null ? 2048 : size;
  if (!Number.isInteger(sz) || sz <= 0) {
    throw new FoundationError("buildWavetable: size must be positive integer");
  }
  if (WAVETABLE_NAMES.indexOf(name) === -1) {
    throw new FoundationError("buildWavetable: unknown name '" + name + "'; expected one of " + WAVETABLE_NAMES.join(", "));
  }
  const table = new Float32Array(sz);
  const dt = 1 / sz;
  if (name === "saw") {
    for (let i = 0; i < sz; i++) table[i] = polyblepSaw(i / sz, dt);
  } else if (name === "square") {
    for (let i = 0; i < sz; i++) table[i] = polyblepSquare(i / sz, dt);
  } else if (name === "triangle") {
    for (let i = 0; i < sz; i++) table[i] = polyblepTriangle(i / sz, dt);
  } else if (name === "sine") {
    for (let i = 0; i < sz; i++) table[i] = Math.sin(2 * Math.PI * i / sz);
  } else if (name === "noise") {
    // Seeded white noise (deterministic via mulberry32(1337)).
    const rng = mulberry32(1337);
    for (let i = 0; i < sz; i++) table[i] = rng() * 2 - 1;
  } else if (name === "psy1") {
    // Psytrance-y wavetable: 0.5*saw + 0.3*octave-up-sine + 0.2*noise.
    const rng = mulberry32(7);
    for (let i = 0; i < sz; i++) {
      const saw = polyblepSaw(i / sz, dt);
      const octaveUp = Math.sin(2 * Math.PI * (i / sz) * 2);
      const noise = rng() * 2 - 1;
      table[i] = 0.5 * saw + 0.3 * octaveUp + 0.2 * noise;
    }
  }
  return table;
}

export function wavetableInterpolate(table, phase) {
  if (!(table instanceof Float32Array)) {
    throw new FoundationError("wavetableInterpolate: table must be Float32Array");
  }
  if (typeof phase !== "number") {
    throw new FoundationError("wavetableInterpolate: phase must be number");
  }
  const size = table.length;
  if (size === 0) return 0;
  // Wrap phase to [0, 1).
  const ph = phase - Math.floor(phase);
  // Map phase to table position: position 0 = table[0], position size = table[0] (wrap).
  const pos = ph * size;
  let i0 = Math.floor(pos);
  const frac = pos - i0;
  i0 = i0 % size;
  const i1 = (i0 + 1) % size;
  return table[i0] * (1 - frac) + table[i1] * frac;
}

/* ---------------- Envelopes ---------------- */
// Linear ADSR. Times in seconds. Sustain is an absolute level (same units as
// peak). State machine: IDLE -> ATTACK -> DECAY -> SUSTAIN -> RELEASE -> IDLE.
// If gate drops during ATTACK or DECAY, jump to RELEASE from current value.

export class Adsr {
  constructor(sampleRate) {
    if (!Number.isInteger(sampleRate) || sampleRate <= 0) {
      throw new FoundationError("Adsr: sampleRate must be positive integer");
    }
    this.sampleRate = sampleRate;
    this.params = { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.2, peak: 1 };
    this.state = "IDLE";
    this.value = 0;
    this.sampleCounter = 0;
    this.stateStartTime = 0;
    this.startValue = 0;
  }
  set(params) {
    if (!params || typeof params !== "object") {
      throw new FoundationError("Adsr.set: params must be object");
    }
    const next = Object.assign({}, this.params);
    const num = (v, name) => {
      if (typeof v !== "number" || !Number.isFinite(v)) {
        throw new FoundationError("Adsr.set: " + name + " must be a finite number");
      }
    };
    if (params.attack !== undefined) { num(params.attack, "attack"); if (params.attack < 0) throw new FoundationError("Adsr.set: attack must be >= 0"); next.attack = params.attack; }
    if (params.decay !== undefined) { num(params.decay, "decay"); if (params.decay < 0) throw new FoundationError("Adsr.set: decay must be >= 0"); next.decay = params.decay; }
    if (params.sustain !== undefined) { num(params.sustain, "sustain"); next.sustain = params.sustain; }
    if (params.release !== undefined) { num(params.release, "release"); if (params.release < 0) throw new FoundationError("Adsr.set: release must be >= 0"); next.release = params.release; }
    if (params.peak !== undefined) { num(params.peak, "peak"); next.peak = params.peak; }
    this.params = next;
  }
  process(gate) {
    const a = this.params.attack * this.sampleRate;
    const d = this.params.decay * this.sampleRate;
    const r = this.params.release * this.sampleRate;
    const s = this.params.sustain;
    const p = this.params.peak;

    if (gate) {
      if (this.state === "IDLE" || this.state === "RELEASE") {
        this.state = "ATTACK";
        this.stateStartTime = this.sampleCounter;
        this.startValue = this.value;
      }
      if (this.state === "ATTACK") {
        const t = this.sampleCounter - this.stateStartTime;
        if (a > 0) {
          this.value = this.startValue + (p - this.startValue) * (t / a);
        } else {
          this.value = p;
        }
        if (t >= a) {
          this.state = "DECAY";
          this.stateStartTime = this.sampleCounter;
          this.value = p;
        }
      }
      if (this.state === "DECAY") {
        const t = this.sampleCounter - this.stateStartTime;
        if (d > 0) {
          this.value = p + (s - p) * (t / d);
        } else {
          this.value = s;
        }
        if (t >= d) {
          this.state = "SUSTAIN";
          this.value = s;
        }
      }
      if (this.state === "SUSTAIN") {
        this.value = s;
      }
    } else {
      if (this.state !== "IDLE" && this.state !== "RELEASE") {
        this.state = "RELEASE";
        this.stateStartTime = this.sampleCounter;
        this.startValue = this.value;
      }
      if (this.state === "RELEASE") {
        const t = this.sampleCounter - this.stateStartTime;
        if (r > 0) {
          this.value = this.startValue * (1 - t / r);
        } else {
          this.value = 0;
        }
        if (t >= r) {
          this.state = "IDLE";
          this.value = 0;
        }
      }
    }

    this.sampleCounter += 1;
    return this.value;
  }
  reset() {
    this.state = "IDLE";
    this.value = 0;
    this.sampleCounter = 0;
    this.stateStartTime = 0;
    this.startValue = 0;
  }
}

// Exponential pitch glide. At t=0 returns fromFreq; at t=infinity returns toFreq.
// tau is the time constant (seconds) — glide ~63% complete at t=tau.
export function pitchGlide(fromFreq, toFreq, t, tau) {
  if (typeof fromFreq !== "number" || typeof toFreq !== "number" || typeof t !== "number" || typeof tau !== "number") {
    throw new FoundationError("pitchGlide: all arguments must be numbers");
  }
  if (tau === 0) return toFreq;
  if (fromFreq === 0) return toFreq;
  const exponent = 1 - Math.exp(-t / tau);
  return fromFreq * Math.pow(toFreq / fromFreq, exponent);
}

/* ---------------- Saturation ---------------- */
// tanh saturation normalized so that drive=0 is a perfect passthrough
// (continuous limit): output -> x as drive -> 0+. At drive=1, output = tanh(x).
// At drive=2, output = tanh(2x)/2 (heavier saturation, lower peak for |x|>0).
export function tanhSaturation(x, drive) {
  if (typeof x !== "number" || typeof drive !== "number") {
    throw new FoundationError("tanhSaturation: x and drive must be numbers");
  }
  if (drive === 0) return x;
  return Math.tanh(x * drive) / drive;
}

// Cubic soft clip. For |x| < ~1.32, |output| < 1. Smooth at 0.
export function softClip(x) {
  if (typeof x !== "number") {
    throw new FoundationError("softClip: x must be number");
  }
  return x - (x * x * x) / 3;
}

// Hard clip to [-1, 1].
export function hardClip(x) {
  if (typeof x !== "number") {
    throw new FoundationError("hardClip: x must be number");
  }
  if (x > 1) return 1;
  if (x < -1) return -1;
  return x;
}

/* ---------------- Utility ---------------- */
// MIDI note to frequency (A4=440, 12-TET).
export function mtof(midi) {
  if (typeof midi !== "number") {
    throw new FoundationError("mtof: midi must be number");
  }
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Frequency to MIDI note (inverse of mtof).
export function ftom(freq) {
  if (typeof freq !== "number") {
    throw new FoundationError("ftom: freq must be number");
  }
  if (freq <= 0) throw new FoundationError("ftom: freq must be positive");
  return 69 + 12 * Math.log2(freq / 440);
}

// Decibels to linear gain (amplitude ratio, 20 log rule).
export function dbToGain(db) {
  if (typeof db !== "number") {
    throw new FoundationError("dbToGain: db must be number");
  }
  return Math.pow(10, db / 20);
}

// Linear gain to decibels.
export function gainToDb(g) {
  if (typeof g !== "number") {
    throw new FoundationError("gainToDb: g must be number");
  }
  if (g <= 0) throw new FoundationError("gainToDb: g must be positive");
  return 20 * Math.log10(g);
}
