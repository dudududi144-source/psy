# TRANSPORT_CONTRACT_COMPARISON.md
Product-side contract: PSY6_ARCHITECTURE.md (sections 3-6).
Foundation candidate: psy4 `BeatPLL` (src/lib/beatPLL.ts, "REALITY REPAIR R1" version),
read in full at the foundation gate (7,568 bytes; wired into PsyLive; all times AudioContext time).
Method: field-by-field comparison of CONTRACT vs IMPLEMENTATION. No repository is modified.
Classes: COMPATIBLE / ADAPTER_REQUIRED / CONTRACT_CONFLICT / UNPROVEN.
UNPROVEN = code exists and looks right, but no test proves it. UNPROVEN is NOT "compatible".

## BeatPLL R1 verified API surface (from source)
- update(obs: {time, confidence}) — rejects conf < 0.45; interval from lastObsTime
  (bug-1/5 fix); two-candidate periods resolution (bug-2 fix); [60,200] BPM guard (bug-3 fix);
  beatTime = predicted + phaseError * phaseGain (bug-4 fix); confidence EMA 0.85/0.15;
  lock after 8 observations AND confidence > 0.5.
- getBpm(), getConfidence(), isLocked(), getPhase(now), predictNextBeat(),
  predictBeats(now, horizon=0.2), getClock(now) -> BeatClock, reset().
- BeatClock: {bpm, lastBeatTime, nextBeatTime, phase, beatIndex, barIndex, confidence, locked}.
- Constants: phaseGain 0.3, tempoGain 0.08, minBpm 60, maxBpm 200.
- NO unit tests exist for this class anywhere in psy4 (verified).

## Field-by-field comparison

| contract item | BeatPLL R1 | class | notes |
|---|---|---|---|
| bpm | getBpm(); smoothed via tempoGain 0.08 | COMPATIBLE (UNPROVEN) | semantics match; zero tests |
| beatTime / lastBeatAudioTime | BeatClock.lastBeatTime | COMPATIBLE | naming adapter only |
| nextBeatAudioTime | BeatClock.nextBeatTime | COMPATIBLE | naming adapter only |
| beatIndex | BeatClock.beatIndex (+= periodsElapsed) | COMPATIBLE | handles missing-beat intervals |
| barIndex | BeatClock.barIndex = floor(beatIndex/4) | COMPATIBLE | assumes 4/4 (psy is 4/4; document assumption) |
| beatPhase | getPhase(now) / BeatClock.phase | COMPATIBLE | naming adapter only |
| barPhase | MISSING | ADAPTER_REQUIRED | derivable: ((beatIndex % 4) + phase) / 4 |
| epoch | MISSING | ADAPTER_REQUIRED | contract wants lock-session identity; reset() exists but has no epoch counter |
| phaseErrorMs | computed internally (phaseError = obs.time - predicted) but NOT exposed | ADAPTER_REQUIRED | must expose smoothed ms metric |
| confidence | exists (EMA of observation confidence) | CONTRACT_CONFLICT | (a) no decay over time -> no gap detection; (b) psy4 detector feeds min(1, lowBandEnergy*2), which is NOT detection confidence. Conflict is at the observation-source boundary; PLL math itself is fine |
| locked | exists; LATCHES forever (no unlock path) | CONTRACT_CONFLICT | contract requires unlock + degradation to prediction-only on gaps |
| prediction horizon | predictBeats(now, horizon) | COMPATIBLE | signature adapter to beatsUpTo(audioTime, horizonMs) |
| observe() | update({time, confidence}) | COMPATIBLE + ADAPTER_REQUIRED | rename; confidence gate 0.45 is hardcoded -> parameterize |
| gridAt() | getClock(now) | COMPATIBLE | naming adapter only |
| seek | only reset() (destructive, any time) | CONTRACT_CONFLICT | contract: re-anchor ONLY at safe musical boundaries; no seek semantics |
| pause / resume | MISSING | CONTRACT_CONFLICT | needs design: pause = stop consuming observations; resume = re-anchor at boundary |
| tempo changes | tempoGain smoothing; [60,200] guard | COMPATIBLE (UNPROVEN) | code exists; no drift tests (streams C/D) |
| radio loss / gaps | none: confidence only updates on observations, never decays; locked never clears | CONTRACT_CONFLICT | contract requires confidence decay, unlock, prediction continuation, relock (streams I/J) |
| half-time ambiguity | two-candidate periods resolution (floor/floor+1, tie -> faster tempo) | UNPROVEN | addresses missing beats; half-time rejection untested (stream G required) |
| double-time ambiguity | same mechanism | UNPROVEN | stream H required |
| latency model | ABSENT: observations treated as beat times; no observed/estimated/predicted separation; no calibration | CONTRACT_CONFLICT | contract requires three distinct times + latency calibration; belongs to observer layer + transport adapter |

## Verdict
Transport is NOT READY to become a shared foundation API.
- Compatible core: grid model (beat/bar/phase indices), prediction API, smoothed tempo.
- Blocking conflicts: confidence semantics + decay/unlock, phaseError exposure, epoch,
  seek/pause/resume at boundaries, latency model separation.
- Everything above is also UNPROVEN (zero tests in psy4).
Ready condition (both sides must agree): adapter semantics frozen in this document +
PSY6_ARCHITECTURE tests A-J green against the adapted implementation + consumer contract
tests green in psy. Until then: NOT foundation, no porting, no consumption.

## What this gate does with the result
Nothing is changed in either repository. psy4 BeatPLL stays where it is (wired in PsyLive).
PSY keeps its own scheduler. The comparison is input to P1 scoping only.
