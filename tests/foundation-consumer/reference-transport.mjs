// tests/foundation-consumer/reference-transport.mjs
// CONTRACT-ONLY reference implementation of the PSY MusicalTransport contract.
// This is NOT production code and NOT consumed by the product. It exists so the
// consumer contract tests have a concrete, deterministic, testable target that
// demonstrates the CONTRACT (PSY6_ARCHITECTURE.md sec 3-6 + TRANSPORT_CONTRACT_COMPARISON).
//
// Contract invariants this reference upholds:
//  - AudioContext time is the ONLY clock (all times are audio-time; no Date.now/performance.now)
//  - observe() is the ONLY write path (radio is an OBSERVER, never a scheduler)
//  - Transport state is exposed read-only (frozen snapshot); consumers cannot mutate it
//  - Beat/bar/phase are derived ONLY from the transport grid, never independently
//  - Confidence DECAYS over time (gap detection) and unlocks below threshold
//  - Predictions continue during gaps (transport keeps running on the model)
//  - No setInterval / no wall-clock anywhere in musical time

export class ReferenceTransport {
  constructor({ initialBpm = 120, confidenceDecayPerSec = 0.25, lockThreshold = 0.5 } = {}) {
    this._bpm = initialBpm;
    this._beatIndex = 0;
    this._phase = 0;              // 0..1 within beat
    this._lastBeatAudioTime = 0;  // audio time of last confirmed beat
    this._updatedAtAudioTime = 0;
    this._confidence = 0;
    this._locked = false;
    this._lockThreshold = lockThreshold;
    this._decayPerSec = confidenceDecayPerSec;
    this._observationCount = 0;
    this._initialized = false;
  }

  // ---- the ONLY write path (observer entry point) ----
  observe(obs) {
    if (!obs || typeof obs.audioTime !== "number") return;
    const conf = typeof obs.confidence === "number" ? obs.confidence : 0;
    if (conf <= 0) return; // zero-confidence observation is not a write
    const t = obs.audioTime;
    if (!this._initialized) {
      this._lastBeatAudioTime = t;
      this._updatedAtAudioTime = t;
      this._confidence = conf;
      this._observationCount = 1;
      this._initialized = true;
      this._maybeLock();
      return;
    }
    const interval = t - this._lastObsTimeSafe();
    if (interval > 0 && interval < 10) {
      const period = 60 / this._bpm;
      const periods = Math.max(1, Math.round(interval / period));
      const observedBpm = 60 / (interval / periods);
      if (observedBpm >= 40 && observedBpm <= 220) {
        this._bpm += (observedBpm - this._bpm) * 0.08; // tempo correction
      }
      const predicted = this._lastBeatAudioTime + periods * period;
      const phaseError = t - predicted;
      this._lastBeatAudioTime = predicted + phaseError * 0.3; // phase correction (no hard reset)
      this._beatIndex += periods;
    } else {
      this._lastBeatAudioTime = t;
      this._beatIndex += 1;
    }
    this._confidence = this._confidence * 0.85 + conf * 0.15;
    this._observationCount++;
    this._updatedAtAudioTime = t;
    this._maybeLock();
  }
  _lastObsTimeSafe() { return this._updatedAtAudioTime; }
  _maybeLock() {
    if (this._observationCount >= 8 && this._confidence > this._lockThreshold) this._locked = true;
  }

  // ---- read-only API (the ONLY thing a consumer may use) ----
  now() { throw new Error("transport.now() must be called with an injected audio clock by the product; transport holds no clock of its own"); }
  bpmAt(audioTime) { return this._bpm; }
  confidenceAt(audioTime) { return this._effectiveConfidenceAt(audioTime); }
  lockedAt(audioTime) { return this._lockedAtTime(audioTime); }

  gridAt(audioTime) {
    const period = 60 / this._bpm;
    const beatsSince = (audioTime - this._lastBeatAudioTime) / period;
    const phase = ((this._phase + beatsSince) % 1 + 1) % 1;
    const totalBeats = this._beatIndex + Math.floor(beatsSince);
    return Object.freeze({
      bpm: this._bpm,
      beatIndex: totalBeats,
      barIndex: Math.floor(totalBeats / 4),
      beatPhase: phase,
      barPhase: ((totalBeats % 4) + phase) / 4,
      lastBeatAudioTime: this._lastBeatAudioTime,
      nextBeatAudioTime: audioTime + (1 - phase) * period,
      phaseErrorMs: 0,
      confidence: this._effectiveConfidenceAt(audioTime),
      locked: this._lockedAtTime(audioTime),
      updatedAtAudioTime: this._updatedAtAudioTime,
      epoch: 0,
      predictionHorizonMs: 200,
    });
  }

  beatsUpTo(audioTime, horizonMs) {
    const period = 60 / this._bpm;
    const g = this.gridAt(audioTime);
    const out = [];
    let t = g.nextBeatAudioTime;
    const end = audioTime + horizonMs / 1000;
    while (t <= end) { out.push(t); t += period; }
    return out;
  }

  // Confidence DECAY over time (gap detection) — computed PURELY per query.
  // Reads NEVER mutate state: effective confidence is derived from the base
  // confidence at _updatedAtAudioTime and the elapsed audio time. observe()
  // remains the ONLY write path.
  _effectiveConfidenceAt(audioTime) {
    if (!this._initialized) return 0;
    const dt = Math.max(0, audioTime - this._updatedAtAudioTime);
    return Math.max(0, this._confidence - this._decayPerSec * dt);
  }
  _lockedAtTime(audioTime) {
    return this._initialized && this._locked &&
      this._effectiveConfidenceAt(audioTime) > this._lockThreshold;
  }
}

// The contract surface a PSY consumer is ALLOWED to touch.
export const TRANSPORT_CONSUMER_API = Object.freeze([
  "gridAt", "beatsUpTo", "bpmAt", "confidenceAt", "lockedAt",
]);
