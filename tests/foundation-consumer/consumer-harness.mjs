// tests/foundation-consumer/consumer-harness.mjs
// Reference PSY CONSUMER of a foundation Transport. CONTRACT-ONLY. Not production.
//
// What this reference consumer demonstrates (and what the contract REQUIRES of PSY):
//  - PSY does NOT own a musical clock. The ONLY time source is the injected audioTime
//    (an AudioContext.currentTime value provided by the product at schedule time).
//  - PSY does NOT use Date.now / performance.now / new Date for musical position.
//  - PSY does NOT use setInterval/setTimeout as a musical clock (timers only WAKE).
//  - PSY does NOT derive beat/bar independently. The ONLY beat source is
//    transport.beatsUpTo / transport.gridAt.
//  - PSY does NOT schedule from radio timestamps. Observations go INTO transport.observe()
//    (owned by the observer layer); the consumer never sees raw observations.
//
// The consumer is a PURE function of (transport, audioTime, horizonMs). Same transport
// state + same audioTime => identical schedule. No hidden state, no timers, no wall clock.

export function scheduleFromTransport(transport, audioTime, horizonMs) {
  // The transport is the single source of musical time. The consumer only READS it.
  const grid = transport.gridAt(audioTime);
  const beats = transport.beatsUpTo(audioTime, horizonMs);
  const events = [];
  for (const beatAudioTime of beats) {
    // The consumer does NOT decide WHEN the beat is — the transport already did.
    events.push({ type: "beat", audioTime: beatAudioTime });
  }
  // Bar-level decisions also come from the transport grid, never derived locally.
  events.barIndex = grid.barIndex;
  events.beatPhase = grid.beatPhase;
  return events;
}

// Structural detector: flags consumers that violate the timing invariant.
// This is a contract linter. A future PSY consumer must produce ZERO violations.
export function detectConsumerViolations(consumerSource) {
  const violations = [];
  if (/Date\.now|new Date|performance\.now/.test(consumerSource)) {
    violations.push("wall-clock (Date.now/performance.now) used for musical time");
  }
  if (/setInterval|setTimeout/.test(consumerSource)) {
    violations.push("timer (setInterval/setTimeout) used as a musical clock");
  }
  // Radio timestamps must not drive scheduling. Observations belong to observe().
  if (/observedBeatTime|radioTimestamp|observation\.time|obs\.time/.test(consumerSource)) {
    violations.push("radio/observation timestamp used for scheduling");
  }
  return violations;
}
