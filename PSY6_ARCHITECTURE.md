# PSY6_ARCHITECTURE.md (Phase 2 — architectural decisions BEFORE P1 code)

Status: DECIDED. P1 (MusicalTransport) starts only after this document is committed.
Principle: Build less. Connect better. Measure everything. One source of truth. One musical clock. No fake intelligence.

## 1. Target architecture (validated against actual code, not aspiration)

~~~
                RADIO (HTMLAudioElement stream)
                      |
                      v
              AUDIO ANALYSIS (AudioWorklet — later, not yet)
                      |
           +----------+-----------+
           v                      v
      BEAT/PHASE             MUSIC ANALYSIS
      (onset/kick)           (key/energy/style/occupancy)
           |                      |
           +----------+-----------+
                      v
                MUSICAL STATE  (single read-mostly store)
                      |
                      v
              MUSICAL DIRECTOR (policy: when to play / abstain)
                      |
          +-----------+-----------+
          v           v           v
       COMPOSER    ARRANGER    EFFECTS
       (8-bar      (section    (send levels,
        plans)      plan)       automation)
          +-----------+-----------+
                      v
                  TRANSPORT  <- THE musical clock (single)
                      |
        +-------------+-------------+
        v             v             v
      DRUMS          SYNTH         SAMPLER   (independent devices,
        |             |             |         local rendering,
        +-------------+-------------+         shared transport)
                      v
                 AUDIO OUTPUT
~~~

Critical deviation from today's code: radio is an OBSERVATION SOURCE, never a scheduler.
No component other than the Scheduler touches AudioContext event timing.

## 2. Ownership (no two owners for the same state)

| state | sole owner | writers | readers |
|---|---|---|---|
| audio clock | AudioContext (browser) | browser | everyone (read-only) |
| beat observations | RadioInput/Analysis | analysis only | Transport only |
| bpm / beat / bar / phase / lock | **Transport** | Transport only | everyone (read-only) |
| musical state (key/scale/energy/style/section/occupancy/opportunity) | MusicalState | analysis pipeline only | read-only |
| arrangement plan | Arranger | Arranger | Composer, Scheduler, UI |
| 8-bar composition plans | Composer | Composer | Arranger, Scheduler |
| audio-time scheduling | **Scheduler** | Scheduler only | - |
| rendering (voices/FX per device) | each device | device itself | - |
| learning memory | MemoryStore | learning update only | Composer/Director (read) |

Rules: Composer never schedules audio. Director never writes transport. Devices never read raw
observations. Anything that needs "when is the next beat?" asks Transport.

## 3. The critical question: Transport before or after Analyzer?
Answer: NEITHER ordering — they are different layers with different clocks.

~~~
AudioContext.currentTime          (the ONLY clock)
   |
   v
observation timestamps            (tagged with AudioContext time at detection)
   |
   v
beat estimator / PLL              (pure, deterministic, testable WITHOUT audio)
   |
   v
MusicalTransport                  (locked grid + prediction)
   |
   v
local scheduler                   ("what should be scheduled for audio time T?")
   |
   v
Web Audio scheduling              (osc.start(t), etc.)
~~~

- setInterval may WAKE the scheduler. It is NEVER the musical clock.
- The scheduler only asks: "what must be scheduled for audio time T?" and schedules ahead.
- The estimator is pure math over observations -> deterministic unit-testable with synthetic streams, no AudioContext needed.

## 4. Radio latency (critical — do not ignore)
"beat detected at AudioContext.currentTime" is NOT "beat happened in the radio now". Latency sources:
1. HTMLMediaElement network buffering (variable, ~1-10s, changes over time)
2. decoder latency
3. MediaElementSource (provides no timestamps)
4. analysis window latency (fftSize/2 samples)
5. worklet block alignment (128-sample quanta)

Therefore Transport keeps THREE distinct times:
- observedBeatTime — measured, latency-contaminated
- estimatedBeatTime — latency-corrected estimate of when the beat actually occurred
- predictedBeatTime — future prediction used for scheduling

Latency handling:
- estimate total latency at startup via self-calibration (cross-correlate engine's own known
  scheduled events with analysis observations);
- track drift slowly; never hard-jump; re-anchor only at safe musical boundaries (bar edges);
- if latency estimate confidence drops, degrade to prediction-only (transport keeps running).

## 5. Phase model + Transport API (proposal)

~~~ts
interface BeatObservation {
  audioTime: number;           // observed beat time (AudioContext domain)
  detectedAtAudioTime: number; // when detector produced it (latency bookkeeping)
  confidence: number;          // REAL detection confidence (NOT band energy!)
  source: "radio" | "engine" | "manual";
}

interface MusicalTransport {
  bpm: number;
  tempoConfidence: number;

  beatIndex: number;
  barIndex: number;

  beatPhase: number;   // 0..1 within beat
  barPhase: number;    // 0..1 within bar (4 beats)

  lastBeatAudioTime: number;    // estimated time of last confirmed beat
  nextBeatAudioTime: number;    // predicted next beat (AudioContext time)

  phaseErrorMs: number;         // smoothed |observed - predicted|
  confidence: number;           // combined lock quality 0..1
  locked: boolean;

  updatedAtAudioTime: number;
  predictionHorizonMs: number;

  observe(o: BeatObservation): void;            // only entry point for observations
  now(): number;                                // AudioContext.currentTime
  gridAt(audioTime: number): GridPoint;         // beat/bar/phase at any audio time
  beatsUpTo(audioTime: number, horizonMs: number): number[]; // predicted beat times
  reset(reason: string): void;                  // only at safe boundaries
}
~~~

Requirements carried from audit (beatPLL.ts review):
- keep: phase correction (no reset), tempo correction (no jump), octave-error candidates, lock hysteresis
- MUST add: phaseErrorMs metric, confidence DECAY over time (gap detection), unlock,
  prediction continuation during gaps, re-anchor only at bar boundaries,
  REAL detection confidence (onset strength), NOT low-band energy (psy4's current hack).

## 6. Deterministic timing test design (P2 — BEFORE estimator code is trusted)

Synthetic streams (deterministic seeds; estimator sees ONLY the observation stream):
- A: 150 BPM perfect
- B: 150 BPM + jitter (+-15ms gaussian)
- C: 150 -> 151 BPM drift
- D: 150 -> 148 BPM drift
- E: missing beats (~5% random dropouts)
- F: false beats (~5% extra onsets)
- G: half-time ambiguity (75 vs 150)
- H: double-time ambiguity (150 vs 300)
- I: 500ms gap
- J: 2s gap

Metrics (per stream, per seed — never aggregated away):
- mean / median / P95 phase error (ms)
- lock time (to confidence > 0.8)
- unlock detection time (after stream stops/degrades)
- relock time (after gap)
- false-lock rate (locked to wrong octave/half-tempo)

Initial target: **P95 phase error < 10ms on stream A (clean 150 BPM)**.
Anti-overfit rule: report spread across 5+ seeds per stream; a change must improve the
distribution, not one seed. No tuning constants to a single stream.

Sequence (strict): (1) deterministic estimator -> (2) tests A-J green -> (3) transport contract
frozen -> (4) ONLY THEN AudioWorklet integration -> (5) ONLY THEN real radio.

## 7. Canonical pattern model (resolves M2 debt)
Current debt: makePatterns() still exists on main; device.patterns generated; ARP still
reads patterns.arp while everything else is song-driven.
DECISION: the M2 Song/Theme model (buildSong) is the ONE canonical musical representation.
Migration (P1 prerequisite, small and explicit):
1. move ARP generation into the song model (theme-based arp phrase per section)
2. delete makePatterns + device.patterns; step-editor edits the song's arp phrase only
3. tests updated (the 22-test suite already covers everything else)
Do NOT solve by quick deletion — migrate ARP first, keep tests green at every step.

## 8. Learning (P3/P7 — NOT now)
No neural network. First step later: structured memory
context -> observation -> action -> outcome -> reward (episodes), context buckets + nearest-neighbor
+ EMA reward + small exploration rate. Attribution per role (not whole-episode credit).
Not built in P1.

## 9. Remaining risks (open)
1. psy4 BeatPLL confidence hack (low-band energy as confidence) — must not be ported as-is.
2. setInterval scheduler + 0.14s lookahead -> background-tab stalls (audit risk #1).
3. M2 canonical-pattern debt (this doc section 7) — must close before/with P1.
4. Radio latency uncalibrated — no component measures it yet (section 4).
5. No unlock/gap handling in any existing PLL code.
6. uiQueue unbounded growth while playing in background tabs.
7. localStorage psy6_feedback unbounded (psy6_events is capped).
8. No soak test (30-120min) — memory/voice/event-queue growth unmeasured (Phase 27).
9. Leaked credentials in workspace (turso.txt) — ROTATE ALL (turso/cloudflare/github/supabase).
10. GitHub Actions node20 deprecation (runs forced to node24; bump action versions).

## 10. P1 entry checklist
- [x] CROSS_REPO_AUDIT.md committed (d0df6010)
- [x] PSY6_ARCHITECTURE.md committed (this file)
- [x] M2 tests green (22/22, run 31565505860)
- [x] merge decision: MERGED (main = 5cb45e2d, tag v4.0-m2-song)
- [x] canonical pattern migration (section 7) — DONE (commit 4205c5b2, ARP in Song model, makePatterns retired, 59/59 green)
- [ ] then: deterministic estimator + tests A-J (section 6) — before any worklet/radio code
