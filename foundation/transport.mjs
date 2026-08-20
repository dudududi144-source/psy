// foundation/transport.mjs — MusicalTransport (PLL with gap recovery, confidence decay, octave-fold)
// Implements PSY6_ARCHITECTURE.md section 5 transport contract.
// Pure, deterministic, zero deps. No AudioContext, no setInterval, no Date.now, no Math.random.
// The clock is INJECTED — tick(audioTime) takes the audio time as parameter.

import { FoundationError, mulberry32 } from "./foundation.mjs";

/* ---------------- synthetic beat stream generator (for deterministic tests) ---------------- */
// spec: { bpm, durationSec, jitterMs=0, driftBpm=0, dropoutRate=0, falseRate=0,
//         gapStartSec=-1, gapDurationSec=0, seed, octaveAmbiguity=null,
//         sampleRate=100 (ticks per second) }
// returns: () => BeatObservation | null
export function makeBeatStream(spec) {
  if (!spec || typeof spec !== "object") throw new FoundationError("stream spec required");
  if (typeof spec.bpm !== "number" || spec.bpm <= 0) throw new FoundationError("stream.bpm must be > 0");
  const sampleRate = spec.sampleRate || 100; // ticks per second
  const dt = 1 / sampleRate;
  const rng = mulberry32(Number.isInteger(spec.seed) ? spec.seed : 1);

  // gaussian helper (Box-Muller, seeded)
  function gauss() {
    const u = Math.max(1e-9, rng());
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  const startBpm = spec.bpm;
  const endBpm = spec.bpm + (spec.driftBpm || 0);
  const beatIntervalStart = 60 / startBpm;
  const totalTicks = Math.floor(spec.durationSec * sampleRate);
  let tickIdx = 0;
  let nextBeatTime = beatIntervalStart; // first beat at t=beatInterval (skip 0)
  const falseOnsets = []; // pre-generated false beats

  // pre-generate false onsets
  if ((spec.falseRate || 0) > 0) {
    const totalBeats = Math.floor(spec.durationSec / beatIntervalStart);
    const numFalse = Math.floor(totalBeats * spec.falseRate);
    for (let i = 0; i < numFalse; i++) {
      falseOnsets.push(rng() * spec.durationSec);
    }
  }
  let falseIdx = 0;

  return function nextObservation() {
    while (tickIdx < totalTicks) {
      const t = tickIdx * dt;
      tickIdx++;

      // gap window
      if (spec.gapStartSec !== undefined && spec.gapStartSec >= 0 &&
          t >= spec.gapStartSec && t < spec.gapStartSec + (spec.gapDurationSec || 0)) {
        continue; // skip emitting beats during the gap
      }

      // current bpm (linear drift)
      const progress = t / spec.durationSec;
      const currentBpm = startBpm + (endBpm - startBpm) * progress;
      const currentInterval = 60 / currentBpm;

      // check if we should emit a beat at this t
      if (t >= nextBeatTime) {
        // dropout
        if ((spec.dropoutRate || 0) > 0 && rng() < spec.dropoutRate) {
          nextBeatTime += currentInterval;
          continue;
        }
        // jitter
        const jitterSec = (spec.jitterMs || 0) * 0.001 * gauss();
        const observedTime = Math.max(0, t + jitterSec);
        nextBeatTime += currentInterval;

        // octave ambiguity: emit at half/double tempo
        let conf = 0.9; // real onset strength (high for clean synthetic streams)
        if (spec.octaveAmbiguity === "half") {
          // skip every other beat — simulates 75 BPM stream when target is 150
          if (Math.floor((t / currentInterval) * 2) % 2 === 0) {
            return { audioTime: observedTime, detectedAtAudioTime: observedTime, confidence: conf, source: "radio" };
          }
          continue;
        }
        if (spec.octaveAmbiguity === "double") {
          // emit an extra beat halfway between — simulates 300 BPM stream when target is 150
          const obs = { audioTime: observedTime, detectedAtAudioTime: observedTime, confidence: conf, source: "radio" };
          // also emit the halfway beat
          if (falseIdx < 1000) falseOnsets.push(observedTime + currentInterval / 2);
          return obs;
        }
        return { audioTime: observedTime, detectedAtAudioTime: observedTime, confidence: conf, source: "radio" };
      }
    }
    // emit any remaining false onsets
    while (falseIdx < falseOnsets.length) {
      const ft = falseOnsets[falseIdx++];
      if (ft < spec.durationSec) {
        return { audioTime: ft, detectedAtAudioTime: ft, confidence: 0.5, source: "radio" };
      }
    }
    return null;
  };
}

/* ---------------- MusicalTransport ---------------- */
export class MusicalTransport {
  constructor(opts) {
    opts = opts || {};
    this._sampleRate = opts.sampleRate || 44100;
    this._bpm = opts.initialBpm || 120;
    this._lookbackSeconds = opts.lookbackSeconds || 10;

    // state
    this._locked = false;
    this._confidence = 0;
    this._tempoConfidence = 0;
    this._phaseErrorMs = 0;
    this._lastObsTime = -1;          // detectedAtAudioTime of last observation received
    this._lastObservedBeatTime = -1; // estimated time of last OBSERVED beat (latency-corrected)
    this._lastBeatAudioTime = 0;     // estimated time of last PREDICTED/CONFIRMED beat (advanced by tick)
    this._predictedNextBeatTime = 0; // predicted next beat
    this._beatIndex = 0;
    this._barIndex = 0;
    this._updatedAtAudioTime = 0;
    this._lastTickTime = 0;

    // PLL state
    this._bpmHypotheses = [this._bpm, this._bpm * 2, this._bpm / 2]; // current, double, half
    this._hypothesisConsistency = [0, 0, 0]; // seconds of consistency
    this._lastObservedInterval = null;

    // lock hysteresis
    this._lockVotes = [];   // timestamps of high-confidence observations in last 1s
    this._unlockVotes = [];  // timestamps of low-confidence observations in last 0.5s

    // observation history (for octave evaluation)
    this._recentIntervals = [];

    this._tickCount = 0;
  }

  /* ---------- observation entry ---------- */
  observe(o) {
    if (!o || typeof o !== "object") throw new FoundationError("observation required");
    if (typeof o.audioTime !== "number" || !Number.isFinite(o.audioTime)) throw new FoundationError("observation.audioTime must be finite number");
    if (typeof o.detectedAtAudioTime !== "number") o.detectedAtAudioTime = o.audioTime;
    if (typeof o.confidence !== "number") o.confidence = 0.5;
    o.confidence = Math.max(0, Math.min(1, o.confidence));

    // latency correction: estimatedBeatTime = observed - (detected - observed)
    // for synthetic tests detected == observed so no correction
    const latency = Math.max(0, o.detectedAtAudioTime - o.audioTime);
    const estimatedBeatTime = o.audioTime - latency;

    // update confidence
    this._confidence = Math.max(this._confidence, o.confidence);
    this._lastObsTime = o.detectedAtAudioTime;

    // compute observed interval if we have a prior OBSERVED beat
    // (use _lastObservedBeatTime, NOT _lastBeatAudioTime which is advanced by tick())
    if (this._lastObservedBeatTime >= 0) {
      let observedInterval = estimatedBeatTime - this._lastObservedBeatTime;
      if (observedInterval > 0.01 && observedInterval < 5.0) { // sane interval
        this._lastObservedInterval = observedInterval;
        this._recentIntervals.push(observedInterval);
        if (this._recentIntervals.length > 16) this._recentIntervals.shift();

        const observedBpm = 60 / observedInterval;
        // octave-fold evaluation
        this._evaluateOctaveFold(observedBpm, observedInterval);

        // tempo correction (no jump, alpha=0.05 — slow but stable against jitter)
        const currentInterval = 60 / this._bpm;
        // only correct if within reasonable range (not octave error)
        const ratio = observedInterval / currentInterval;
        if (ratio > 0.7 && ratio < 1.4) {
          const targetBpm = 60 / observedInterval;
          this._bpm = this._bpm + 0.05 * (targetBpm - this._bpm);
        }

        // phase correction (no hard jump).
        // Compare observed beat to the NEAREST predicted beat (either the last confirmed beat
        // or the next predicted beat). tick() may have advanced _lastBeatAudioTime past the
        // observation time, so we must pick the closer reference.
        const beatDur = 60 / this._bpm;
        const lastBeat = this._lastBeatAudioTime;
        const nextBeat = this._predictedNextBeatTime > 0 ? this._predictedNextBeatTime : lastBeat + beatDur;
        // which is the observation closer to?
        const distLast = Math.abs(estimatedBeatTime - lastBeat);
        const distNext = Math.abs(estimatedBeatTime - nextBeat);
        const refBeatTime = (distLast <= distNext) ? lastBeat : nextBeat;
        const phaseError = estimatedBeatTime - refBeatTime;
        // alpha depends on bar position — full at bar edges, gentle mid-bar
        const atBarEdge = (this._beatIndex % 4 === 0);
        const alpha = atBarEdge ? 0.1 : 0.02;
        // apply correction to the reference beat
        if (refBeatTime === lastBeat) {
          this._lastBeatAudioTime = lastBeat + alpha * phaseError;
        } else {
          // observation is for the next beat — accept it as the new last beat
          this._lastBeatAudioTime = nextBeat + alpha * phaseError;
          this._beatIndex++;
          this._barIndex = Math.floor(this._beatIndex / 4);
        }
        this._predictedNextBeatTime = this._lastBeatAudioTime + (60 / this._bpm);

        // phaseErrorMs EMA
        const errMs = Math.abs(phaseError) * 1000;
        this._phaseErrorMs = this._phaseErrorMs === 0 ? errMs : (0.8 * this._phaseErrorMs + 0.2 * errMs);
      }
      // always update _lastObservedBeatTime to this observation (so next interval is correct)
      this._lastObservedBeatTime = estimatedBeatTime;
    } else {
      // first observation — initialize
      this._lastObservedBeatTime = estimatedBeatTime;
      this._lastBeatAudioTime = estimatedBeatTime;
      this._predictedNextBeatTime = estimatedBeatTime + (60 / this._bpm);
    }

    // update lock votes
    const now = o.detectedAtAudioTime;
    if (o.confidence > 0.7) {
      this._lockVotes.push(now);
    }
    if (o.confidence < 0.3) {
      this._unlockVotes.push(now);
    }
    // prune votes older than 1s (lock) and 0.5s (unlock)
    this._lockVotes = this._lockVotes.filter(t => now - t < 1.0);
    this._unlockVotes = this._unlockVotes.filter(t => now - t < 0.5);

    // lock hysteresis — 2 high-confidence observations in 1s window is enough to lock
    // (beats at 75 BPM come every 0.8s = ~1.25/sec; at 150 BPM every 0.4s = 2.5/sec)
    if (!this._locked && this._lockVotes.length >= 2) {
      this._locked = true;
    }
    if (this._locked && this._unlockVotes.length >= 3) {
      this._locked = false;
    }

    this._tempoConfidence = Math.min(1, this._confidence * (this._recentIntervals.length > 4 ? 1.0 : 0.5));
  }

  _evaluateOctaveFold(observedBpm, observedInterval) {
    // compute consistency for each hypothesis
    const intervals = [60 / this._bpm, 60 / (this._bpm * 2), 60 / (this._bpm / 2)];
    let bestIdx = 0;
    let bestErr = Infinity;
    for (let i = 0; i < 3; i++) {
      const err = Math.abs(observedInterval - intervals[i]) / intervals[i];
      if (err < bestErr) { bestErr = err; bestIdx = i; }
    }
    // increment consistency for the best match
    for (let i = 0; i < 3; i++) {
      if (i === bestIdx) this._hypothesisConsistency[i] += 0.2;
      else this._hypothesisConsistency[i] = Math.max(0, this._hypothesisConsistency[i] - 0.05);
    }
    // switch only after 2 seconds of consistency (10 ticks at 0.2 each)
    // cap bpm to a sane musical range (30-400) to prevent runaway octave-fold
    if (this._hypothesisConsistency[bestIdx] >= 2.0 && bestIdx !== 0) {
      const newBpm = bestIdx === 1 ? this._bpm * 2 : this._bpm / 2;
      if (newBpm >= 30 && newBpm <= 400) {
        this._bpm = newBpm;
        // re-anchor after octave switch so phase prediction aligns with the new bpm
        if (this._lastObservedBeatTime >= 0) {
          this._lastBeatAudioTime = this._lastObservedBeatTime;
          this._predictedNextBeatTime = this._lastObservedBeatTime + (60 / this._bpm);
        }
        this._hypothesisConsistency = [0, 0, 0];
        this._bpmHypotheses = [this._bpm, this._bpm * 2, this._bpm / 2];
      } else {
        // out of range — reset consistency to prevent repeated attempts
        this._hypothesisConsistency = [0, 0, 0];
      }
    }
  }

  /* ---------- advance internal model ---------- */
  tick(audioTime) {
    if (typeof audioTime !== "number" || !Number.isFinite(audioTime)) throw new FoundationError("audioTime must be finite number");
    this._lastTickTime = audioTime;
    this._updatedAtAudioTime = audioTime;
    this._tickCount++;

    // confidence decay based on time-since-last-observation (NOT time-since-last-tick).
    // this way, observe(t) + tick(t) leaves confidence at full.
    if (this._lastObsTime >= 0) {
      const dtSinceObs = audioTime - this._lastObsTime;
      if (dtSinceObs > 0) {
        this._confidence = this._confidence * Math.exp(-dtSinceObs / 3.0);
      }
      // unlock after 2s gap
      if (dtSinceObs > 2.0) {
        this._locked = false;
      }
    }

    // advance beat index if we passed the predicted next beat
    while (this._predictedNextBeatTime > 0 && audioTime >= this._predictedNextBeatTime) {
      this._beatIndex++;
      this._barIndex = Math.floor(this._beatIndex / 4);
      this._lastBeatAudioTime = this._predictedNextBeatTime;
      this._predictedNextBeatTime = this._lastBeatAudioTime + (60 / this._bpm);
    }
  }

  /* ---------- queries ---------- */
  gridAt(audioTime) {
    const beatDur = 60 / this._bpm;
    const elapsed = audioTime - this._lastBeatAudioTime;
    const beatPhase = Math.max(0, Math.min(1, elapsed / beatDur));
    const beatIndex = this._beatIndex;
    const barIndex = Math.floor(beatIndex / 4);
    const barPhase = (beatPhase + (beatIndex % 4)) / 4;
    return Object.freeze({ beatIndex, barIndex, beatPhase, barPhase });
  }

  beatsUpTo(audioTime, horizonMs) {
    const result = [];
    const horizon = audioTime + horizonMs / 1000;
    let next = this._predictedNextBeatTime;
    const beatDur = 60 / this._bpm;
    while (next <= horizon && result.length < 1000) {
      if (next >= audioTime) result.push(next);
      next += beatDur;
    }
    return Object.freeze(result);
  }

  /* ---------- state getters ---------- */
  get bpm() { return this._bpm; }
  get tempoConfidence() { return this._tempoConfidence; }
  get beatIndex() { return this._beatIndex; }
  get barIndex() { return this._barIndex; }
  get beatPhase() {
    const beatDur = 60 / this._bpm;
    const elapsed = this._updatedAtAudioTime - this._lastBeatAudioTime;
    return Math.max(0, Math.min(1, elapsed / beatDur));
  }
  get barPhase() {
    return (this.beatPhase + (this._beatIndex % 4)) / 4;
  }
  get lastBeatAudioTime() { return this._lastBeatAudioTime; }
  get nextBeatAudioTime() { return this._predictedNextBeatTime; }
  get phaseErrorMs() { return this._phaseErrorMs; }
  get confidence() { return this._confidence; }
  get locked() { return this._locked; }
  get updatedAtAudioTime() { return this._updatedAtAudioTime; }

  reset(reason) {
    this._locked = false;
    this._confidence = 0;
    this._tempoConfidence = 0;
    this._phaseErrorMs = 0;
    this._lastObsTime = -1;
    this._lastObservedBeatTime = -1;
    this._lastBeatAudioTime = 0;
    this._predictedNextBeatTime = 0;
    this._beatIndex = 0;
    this._barIndex = 0;
    this._lockVotes = [];
    this._unlockVotes = [];
    this._recentIntervals = [];
    this._hypothesisConsistency = [0, 0, 0];
    this._lastObservedInterval = null;
    this._resetReason = reason || "manual";
  }
}

/* ---------------- test helpers ---------------- */
export function p95(arr) {
  if (arr.length === 0) return Infinity;
  const sorted = arr.slice().sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.95);
  return sorted[Math.min(idx, sorted.length - 1)];
}

export function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// Drive a transport with a beat stream for `durationSec` at `tickRate` Hz.
// Returns { phaseErrors: number[], lockTimes: number[], finalBpm, lockedAtEnd }
export function driveTransport(transport, stream, durationSec, tickRate) {
  tickRate = tickRate || 50; // 50 Hz = 20ms steps
  const dt = 1 / tickRate;
  const phaseErrors = [];
  let firstLockTime = null;
  let unlockCount = 0;
  let lastLocked = false;
  let pendingObs = null;
  for (let i = 0; i < durationSec * tickRate; i++) {
    const t = i * dt;
    transport.tick(t);
    // pull observations whose audioTime <= t
    if (pendingObs && pendingObs.audioTime <= t) {
      transport.observe(pendingObs);
      pendingObs = null;
    }
    if (!pendingObs) {
      // advance stream until we get an observation with audioTime > t (or null)
      let attempts = 0;
      while (attempts < 10) {
        const obs = stream();
        if (obs === null) break;
        if (obs.audioTime <= t) {
          transport.observe(obs);
        } else {
          pendingObs = obs;
          break;
        }
        attempts++;
      }
    }
    if (transport.locked && firstLockTime === null) firstLockTime = t;
    if (transport.locked !== lastLocked) {
      if (!transport.locked) unlockCount++;
      lastLocked = transport.locked;
    }
    if (transport.locked && transport.phaseErrorMs > 0) {
      phaseErrors.push(transport.phaseErrorMs);
    }
  }
  return {
    phaseErrors,
    firstLockTime,
    unlockCount,
    finalBpm: transport.bpm,
    lockedAtEnd: transport.locked,
    confidence: transport.confidence
  };
}
