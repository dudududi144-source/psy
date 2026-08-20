// foundation/director.mjs — MusicalDirector with DO-NOTHING abstention (W4)
// Pure decision function: given transport/musical/history context, returns either
// {action:"play"} or {action:"abstain"}. No AudioContext, no wall-clock, no Math.random.
// Includes a contextual-bandit reward tracker (EMA) for the abstention threshold.
// Inspired by: psy5 (contextual bandit with abstainThreshold). Advanced over psystar
// (autopilot but no abstention) and PSY6-ULTIMATE (CandidateGenerator always picks).

import {
  FoundationError,
  mulberry32,
  subSeed,
  rngFor,
  sectionAt,
  energyAt,
} from "./foundation.mjs";

const DEFAULT_RNG_SEED = 0xC0FFEE >>> 0;

function clamp01(x) {
  if (typeof x !== "number" || !Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function requireNumber01(v, label) {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new FoundationError(label + " must be finite number");
  }
  if (v < 0 || v > 1) {
    throw new FoundationError(label + " must be in [0,1], got " + v);
  }
}

function requirePositiveNumber(v, label) {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
    throw new FoundationError(label + " must be positive finite number");
  }
}

function requireNonNegInt(v, label) {
  if (!Number.isInteger(v) || v < 0) {
    throw new FoundationError(label + " must be integer >= 0");
  }
}

/* ---------------- DirectorContext (RULE 1 — frozen, validated) ---------------- */
// spec: {
//   transport: { locked, confidence, bpm },
//   musical:   { energy, density, tension, targetTension },
//   history:   { lastBarDense, barsSinceRest, phraseIndex },
//   reward?:   { lastActionReward }
// }
export function createDirectorContext(spec) {
  if (spec === null || typeof spec !== "object" || Array.isArray(spec)) {
    throw new FoundationError("spec must be object");
  }
  const { transport, musical, history, reward } = spec;

  if (transport === null || typeof transport !== "object" || Array.isArray(transport)) {
    throw new FoundationError("spec.transport must be object");
  }
  if (typeof transport.locked !== "boolean") {
    throw new FoundationError("spec.transport.locked must be boolean");
  }
  requireNumber01(transport.confidence, "spec.transport.confidence");
  requirePositiveNumber(transport.bpm, "spec.transport.bpm");

  if (musical === null || typeof musical !== "object" || Array.isArray(musical)) {
    throw new FoundationError("spec.musical must be object");
  }
  requireNumber01(musical.energy, "spec.musical.energy");
  requireNumber01(musical.density, "spec.musical.density");
  requireNumber01(musical.tension, "spec.musical.tension");
  requireNumber01(musical.targetTension, "spec.musical.targetTension");

  if (history === null || typeof history !== "object" || Array.isArray(history)) {
    throw new FoundationError("spec.history must be object");
  }
  if (typeof history.lastBarDense !== "boolean") {
    throw new FoundationError("spec.history.lastBarDense must be boolean");
  }
  requireNonNegInt(history.barsSinceRest, "spec.history.barsSinceRest");
  requireNonNegInt(history.phraseIndex, "spec.history.phraseIndex");

  let rewardFrozen = null;
  if (reward != null) {
    if (reward === null || typeof reward !== "object" || Array.isArray(reward)) {
      throw new FoundationError("spec.reward must be object");
    }
    requireNumber01(reward.lastActionReward, "spec.reward.lastActionReward");
    rewardFrozen = Object.freeze({ lastActionReward: reward.lastActionReward });
  }

  return Object.freeze({
    transport: Object.freeze({
      locked: transport.locked,
      confidence: transport.confidence,
      bpm: transport.bpm
    }),
    musical: Object.freeze({
      energy: musical.energy,
      density: musical.density,
      tension: musical.tension,
      targetTension: musical.targetTension
    }),
    history: Object.freeze({
      lastBarDense: history.lastBarDense,
      barsSinceRest: history.barsSinceRest,
      phraseIndex: history.phraseIndex
    }),
    reward: rewardFrozen
  });
}

/* ---------------- deriveDirectorContext ---------------- */
// Extract a DirectorContext from a resolved MusicalTimeline + transport state.
// energy: energyAt(section, barInSection, bars) for the most recent bar with events.
// density: events in most recent bar / 16 (clamped to [0,1]).
// tension: synthetic 0.3 + 0.4*energy (proxy).
// targetTension: fixed 0.7.
export function deriveDirectorContext(song, timeline, transportState, history) {
  if (song === null || typeof song !== "object") {
    throw new FoundationError("song must be object");
  }
  if (timeline === null || typeof timeline !== "object" || !Array.isArray(timeline.events)) {
    throw new FoundationError("timeline must be MusicalTimeline (with .events array)");
  }
  if (transportState === null || typeof transportState !== "object" || Array.isArray(transportState)) {
    throw new FoundationError("transportState must be object");
  }
  if (typeof transportState.locked !== "boolean") {
    throw new FoundationError("transportState.locked must be boolean");
  }
  requireNumber01(transportState.confidence, "transportState.confidence");
  requirePositiveNumber(transportState.bpm, "transportState.bpm");
  if (history === null || typeof history !== "object" || Array.isArray(history)) {
    throw new FoundationError("history must be object");
  }
  if (typeof history.lastBarDense !== "boolean") {
    throw new FoundationError("history.lastBarDense must be boolean");
  }
  requireNonNegInt(history.barsSinceRest, "history.barsSinceRest");
  requireNonNegInt(history.phraseIndex, "history.phraseIndex");

  // Find the most recent bar with events (timeline events are sorted by beat/bar).
  let lastBar = 0;
  for (let i = 0; i < timeline.events.length; i++) {
    const b = timeline.events[i].bar;
    if (typeof b === "number" && b > lastBar) lastBar = b;
  }

  // Count events in that bar.
  let eventsInBar = 0;
  for (let i = 0; i < timeline.events.length; i++) {
    if (timeline.events[i].bar === lastBar) eventsInBar++;
  }

  // Section + energy from song.
  let energy = 0.5;
  try {
    const info = sectionAt(song, lastBar);
    energy = energyAt(info.section.name, info.barInSection, info.section.bars);
  } catch (_e) {
    energy = 0.5;
  }
  energy = clamp01(energy);

  const density = clamp01(eventsInBar / 16);
  const tension = clamp01(0.3 + energy * 0.4);
  const targetTension = 0.7;

  return createDirectorContext({
    transport: {
      locked: transportState.locked,
      confidence: transportState.confidence,
      bpm: transportState.bpm
    },
    musical: { energy, density, tension, targetTension },
    history: {
      lastBarDense: history.lastBarDense,
      barsSinceRest: history.barsSinceRest,
      phraseIndex: history.phraseIndex
    }
  });
}

/* ---------------- MusicalDirector ---------------- */
// Stateful: tracks EMA reward prediction (initial 0.5, alpha 0.1 default).
// Stateless across decide() calls except for rewardPrediction.
export class MusicalDirector {
  constructor(opts = {}) {
    if (opts === null || typeof opts !== "object" || Array.isArray(opts)) {
      throw new FoundationError("opts must be object");
    }
    const abstainThreshold = opts.abstainThreshold != null ? opts.abstainThreshold : 0.3;
    const explorationRate = opts.explorationRate != null ? opts.explorationRate : 0.05;
    const rewardAlpha = opts.rewardAlpha != null ? opts.rewardAlpha : 0.1;
    requireNumber01(abstainThreshold, "abstainThreshold");
    requireNumber01(explorationRate, "explorationRate");
    if (typeof rewardAlpha !== "number" || !Number.isFinite(rewardAlpha) || rewardAlpha <= 0 || rewardAlpha > 1) {
      throw new FoundationError("rewardAlpha must be in (0,1]");
    }
    this._abstainThreshold = abstainThreshold;
    this._explorationRate = explorationRate;
    this._rewardAlpha = rewardAlpha;
    this._rewardPrediction = 0.5;
  }

  // Pure decision function — given ctx, returns DirectorDecision.
  // rng is optional; default is a mulberry32-seeded rng (deterministic per call).
  // No Math.random anywhere.
  decide(ctx, rng) {
    if (ctx === null || typeof ctx !== "object" || Array.isArray(ctx)) {
      throw new FoundationError("ctx must be DirectorContext");
    }
    if (!ctx.transport || typeof ctx.transport.locked !== "boolean") {
      throw new FoundationError("ctx.transport.locked must be boolean");
    }
    if (typeof ctx.transport.confidence !== "number") {
      throw new FoundationError("ctx.transport.confidence must be number");
    }
    if (!ctx.musical || typeof ctx.musical.energy !== "number") {
      throw new FoundationError("ctx.musical.energy must be number");
    }
    if (typeof ctx.musical.density !== "number") {
      throw new FoundationError("ctx.musical.density must be number");
    }
    if (!ctx.history || typeof ctx.history.barsSinceRest !== "number") {
      throw new FoundationError("ctx.history.barsSinceRest must be number");
    }
    if (typeof ctx.history.lastBarDense !== "boolean") {
      throw new FoundationError("ctx.history.lastBarDense must be boolean");
    }

    const r = typeof rng === "function" ? rng : mulberry32(DEFAULT_RNG_SEED);

    // Base abstention rule: first match wins.
    let action;
    let reason;
    if (ctx.transport.confidence < 0.4) {
      action = "abstain";
      reason = "transport.confidence below 0.4";
    } else if (ctx.transport.locked === false) {
      action = "abstain";
      reason = "transport not locked";
    } else if (ctx.musical.energy < 0.2 && ctx.history.barsSinceRest > 4) {
      action = "abstain";
      reason = "low energy + barsSinceRest > 4";
    } else if (ctx.history.lastBarDense && ctx.musical.density > 0.7) {
      action = "abstain";
      reason = "dense previous bar";
    } else if (this._rewardPrediction < this._abstainThreshold) {
      action = "abstain";
      reason = "rewardPrediction < threshold";
    } else {
      action = "play";
      reason = "play";
    }

    // Exploration: with probability explorationRate, invert the decision.
    // Single rng draw per decide() for determinism.
    const roll = r();
    let explored = false;
    if (roll < this._explorationRate) {
      explored = true;
      action = action === "play" ? "abstain" : "play";
      reason = "exploration inverted (" + reason + ")";
    }

    const intensity = clamp01(ctx.musical.energy * 0.5 + ctx.transport.confidence * 0.5);

    return Object.freeze({
      action: action,
      reason: reason,
      intensity: intensity,
      rewardPrediction: this._rewardPrediction,
      explored: explored
    });
  }

  // EMA update of reward prediction (called after observing actual outcome).
  // rewardPrediction += alpha * (actual - rewardPrediction)
  updateReward(actualReward) {
    requireNumber01(actualReward, "actualReward");
    this._rewardPrediction = this._rewardPrediction + this._rewardAlpha * (actualReward - this._rewardPrediction);
  }

  get rewardPrediction() { return this._rewardPrediction; }
  get abstainThreshold() { return this._abstainThreshold; }
  get explorationRate() { return this._explorationRate; }
  get rewardAlpha() { return this._rewardAlpha; }
}
