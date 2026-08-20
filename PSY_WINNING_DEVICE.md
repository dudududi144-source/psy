# PSY_WINNING_DEVICE.md — The canonical plan to make `psy` the winning device of the family

> Companion to `ROAST.md` (the evidence). This is the **plan**: what to add, where each
> capability comes from in the family, why it elevates `psy` above all 12 siblings, and
> the exact file layout for execution.
>
> Principle (carried from `PSY6_ARCHITECTURE.md`): Build less. Connect better. Measure
> everything. One source of truth. One musical clock. No fake intelligence.
> **This plan delivers on that principle — which the current repo does not.**

---

## 0. Strategic direction

`psy` is the mainline — the original groovebox, the canonical song model, the foundation
contract. It is also the most behind. The 12 siblings each hold one piece of what `psy`
should be:

| sibling | holds the piece |
|---|---|
| PsySynthPro | real per-sample AudioWorklet + PolyBLEP + ZDF + FM + wavetable |
| psy-foundation | DSP primitive library (13 packages, 729 tests) + JUCE VST |
| psydrum | drum device: choke groups + zero-alloc voice pool + velocity-to-timbre |
| psy-sampler | sampler with provenance enforcement + 653 tests + MIDI round-trip |
| psy5 | real PLL: TransportClock + BeatEstimator + PhaseCorrector + ConfidenceTracker + DO-NOTHING bandit |
| PSY6-ULTIMATE | 3 grammar classes that learn while you play |
| psystar | DMT-grade UI + P2P WebRTC + Hebrew RTL + 71 test files |
| psy3-clean | real PWA with service-worker precache |
| psy4 | the radio-following research lab (mostly dead code, but BeatPLL is a candidate) |

**The plan**: add to `psy` the capabilities each sibling holds — but implemented canonically
(pure ESM in `foundation/`, single-file in `index.html` only where browser binary is required),
with provenance, determinism, and tests. **Not a copy — a complement.** Each new module is
*more advanced* than its sibling inspiration because it inherits the `psy` foundation
contract (RULE 7 provenance, RULE 8 replay identity, RULE 11 no-psy4-dependency).

After execution, `psy` becomes the **only single-file groovebox in the family** with: a
real AudioWorklet + PolyBLEP/ZDF DSP + real PLL with abstention + grammar learning with
provenance + offline stem export + MIDI clock + PWA + deterministic timing tests A–J. **No
sibling combines all of these.**

---

## 1. Capability matrix — what `psy` will have after this plan

| # | capability | inspired by | canonical implementation in `psy` | advancement over sibling |
|---|---|---|---|---|
| W1 | MusicalTransport (real PLL) | psy5 (TransportClock+4 components, 250 tests) + psy4 BeatPLL (with documented bug) | `foundation/transport.mjs` — PLL with octave-fold, gap recovery, confidence decay, phaseErrorMs, 3 times (observed/estimated/predicted). **Real confidence from onset strength, not low-band energy.** + tests A–J × 5 seeds = 50 cases | confidence is real (psy4's is fake); psy-native (psy5 is a separate monorepo); consumed by runtime (psy5 is library-only) |
| W2 | DSP primitives | PsySynthPro (PolyBLEP+ZDF+FM+wavetable) + psy-foundation packages/dsp | `foundation/dsp.mjs` — PolyBLEP saw/square/triangle/pulse, ZDF SVF (Simper), 4-op FM, wavetable builder. **Pure functions, no AudioContext, bit-identical per seed.** | pure (PsySynthPro's are inside a worklet class); psy-native (psy-foundation is a 729-test monorepo); foundation-grade (PsySynthPro has 0 tests) |
| W3 | AudioWorklet in live path | PsySynthPro (worklet 18KB) + psy-foundation (13-voice worklet) | Inline worklet via Blob URL in `index.html`. Replaces `setInterval(25ms)` scheduler. | first single-file groovebox with a worklet (PSY6-ULTIMATE, psystar, psy3-clean all main-thread); closes CROSS_REPO_AUDIT risk #1 |
| W4 | MusicalDirector with DO-NOTHING | psy5 (contextual bandit with abstainThreshold) | `foundation/director.mjs` — director that returns empty action list when best reward < threshold / radio unlocked to wrong octave / energy low / previous bar dense | first principled abstention (psystar has autopilot but no abstention; PSY6-ULTIMATE's CandidateGenerator always picks) |
| W5 | Grammar learning with provenance | PSY6-ULTIMATE (3 grammar classes) | `foundation/grammar.mjs` — BassGrammar 12×12 + MelodicGrammar interval histogram + RhythmGrammar. **As variation layer over resolveSong, not replacement. Every mutation carries provenance (songSeed + grammarName + op).** Deterministic per (seed, label). | provenance-enforced (PSY6-ULTIMATE's are ad-hoc); deterministic (PSY6-ULTIMATE's use Math.random); testable (PSY6-ULTIMATE has 0 tests) |
| W6 | Offline render + stem export | psy-sampler (28× real-time, byte-identical per seed) | `foundation/render.mjs` — renderSong(song, bars) via OfflineAudioContext + same schedule-ahead loop. renderStems(song, bars) returns per-device WAV. **byte-identical replay per seed (RULE 8).** | first per-device stem export through master chain (psy-sampler does drums/music/atmos only); first byte-identical-per-seed render in psy |
| W7 | MIDI in + clock out + file export | psystar (24ppq clock) + PSY6-ULTIMATE (480 ticks/beat) | `foundation/midi.mjs` — Web MIDI API input + 24ppq MIDI clock out + MIDI file export (480 ticks/beat, Tempo meta, End of track). | first MIDI clock out in psy (psystar has it; you don't); combines 24ppq clock with M2 song determinism |
| W8 | PWA + service worker + self-diagnose | psy3-clean (precache) + PsySynthPro (REPAIR button) | Inline PWA manifest + SW via Blob URL. **Self-diagnosing: if worklet fails to load, red diagnostic box + REPAIR button unregisters SW + clears caches + reloads.** | first self-diagnosing PWA groovebox (PsySynthPro has it but is a synth-only device) |
| W9 | Director consumes foundation (closes roast #2) | (the contradiction itself) | `index.html` stops keeping inline copy of model logic. `import { resolveSong, contextAt } from './foundation/foundation.mjs'` via Blob URL shim. **Foundation stops being dead code.** | one source of truth (today there are two) |
| W10 | Tests A–J + 100+ new tests | (family-wide gap — nobody has it) | `tests/transport.test.mjs` (50), `tests/dsp.test.mjs` (20), `tests/director.test.mjs` (10), `tests/grammar.test.mjs` (10), `tests/render.test.mjs` (10). **psy: 59 → 160+ tests.** | first deterministic timing tests A–J in the family (closes PSY6_ARCHITECTURE.md section 6 gap) |
| W11 | FOUNDATION_VERSION registry: promotion | (the contradiction itself) | Update registry from "NOTHING promoted yet" to 6 components in ADMITTED v1 status. **The contract is honored.** | first time anything is promoted (today: zero) |

**Result**: `psy` becomes the only single-file groovebox that combines all of: worklet +
PolyBLEP/ZDF + real PLL with abstention + grammar learning with provenance + offline stem
export + MIDI clock + PWA + tests A–J. **No sibling combines all of these.**

---

## 2. File layout (what gets added/modified)

```
psy/
├── ROAST.md                              ← NEW (this roast, committed)
├── PSY_WINNING_DEVICE.md                ← NEW (this plan, committed)
├── WINNING_DEVICE_ROADMAP.md            ← NEW (what was done vs what remains)
├── FOUNDATION_VERSION.md                ← MODIFIED (registry: 6 components ADMITTED v1)
│
├── foundation/
│   ├── foundation.mjs                   ← existing (untouched — pure data layer)
│   ├── transport.mjs                    ← NEW (W1: MusicalTransport, PLL)
│   ├── dsp.mjs                           ← NEW (W2: PolyBLEP + ZDF + FM + wavetable)
│   ├── director.mjs                      ← NEW (W4: MusicalDirector with abstention)
│   ├── grammar.mjs                       ← NEW (W5: 3 grammar classes, provenance)
│   ├── render.mjs                        ← NEW (W6: offline render + stem export)
│   ├── midi.mjs                          ← NEW (W7: Web MIDI + clock + file export)
│   ├── music/
│   │   ├── context.mjs                   ← existing (untouched)
│   │   ├── motif.mjs                     ← existing (untouched)
│   │   ├── memory.mjs                     ← existing (untouched)
│   │   ├── planner.mjs                   ← existing (untouched)
│   │   └── policy.mjs                    ← existing (untouched)
│   └── composition/
│       └── form.mjs                      ← existing (untouched)
│
├── tests/
│   ├── playground.test.mjs              ← existing (24 tests, untouched)
│   ├── foundation.test.mjs               ← existing (24 tests, untouched)
│   ├── foundation-consumer/              ← existing (11 tests, untouched)
│   ├── transport.test.mjs                ← NEW (W10: 50 tests — streams A–J × 5 seeds)
│   ├── dsp.test.mjs                      ← NEW (W10: 20 tests — bit-identity per seed)
│   ├── director.test.mjs                 ← NEW (W10: 10 tests — abstention cases)
│   ├── grammar.test.mjs                  ← NEW (W10: 10 tests — determinism + provenance)
│   └── render.test.mjs                   ← NEW (W10: 10 tests — byte-identity per seed)
│
└── index.html                            ← MODIFIED (W3, W7, W8, W9):
                                            + inline AudioWorklet via Blob URL
                                            + import foundation modules via Blob URL shim
                                            + PWA manifest + SW via Blob URL
                                            + self-diagnose box
                                            + MIDI clock out wiring
                                            (existing groovebox UI preserved)
```

---

## 3. Module specifications (contract-level)

### W1 — `foundation/transport.mjs` (MusicalTransport)

Implements `PSY6_ARCHITECTURE.md` section 5 transport contract.

```ts
// Public API (pure, deterministic, no AudioContext — clock injected)
export class MusicalTransport {
  constructor(opts: { sampleRate: number, initialBpm?: number });
  // observation entry — only entry point for beat observations
  observe(o: BeatObservation): void;
  // advance internal model by dt seconds (called by scheduler wake)
  tick(audioTime: number): void;
  // queries (all pure reads)
  now(): number;
  gridAt(audioTime: number): GridPoint;
  beatsUpTo(audioTime: number, horizonMs: number): number[];
  // state
  readonly bpm: number;
  readonly tempoConfidence: number;
  readonly beatIndex: number;
  readonly barIndex: number;
  readonly beatPhase: number;       // 0..1 within beat
  readonly barPhase: number;        // 0..1 within bar (4 beats)
  readonly lastBeatAudioTime: number;
  readonly nextBeatAudioTime: number;
  readonly phaseErrorMs: number;
  readonly confidence: number;
  readonly locked: boolean;
  // recovery
  reset(reason: string): void;
}

interface BeatObservation {
  audioTime: number;           // observed beat time (AudioContext domain)
  detectedAtAudioTime: number; // when detector produced it (latency bookkeeping)
  confidence: number;          // REAL detection confidence (onset strength), NOT band energy
  source: "radio" | "engine" | "manual";
}
```

**Internal model**: PLL with phase correction (no reset), tempo correction (no jump),
octave-error candidates, lock hysteresis. Confidence DECAY over time (gap detection).
Prediction continuation during gaps. Re-anchor only at bar boundaries.

**Deterministic tests A–J** (`tests/transport.test.mjs`, 50 cases):
- Stream A: 150 BPM perfect × 5 seeds → assert P95 phase error < 10ms, lock time < 2s
- Stream B: 150 BPM ± 15ms gaussian jitter × 5 seeds → assert P95 < 15ms
- Stream C: 150 → 151 BPM drift × 5 seeds → assert tracks within 50ms after 30s
- Stream D: 150 → 148 BPM drift × 5 seeds → assert tracks within 50ms after 30s
- Stream E: 5% missing beats × 5 seeds → assert no false unlock, prediction continues
- Stream F: 5% false beats × 5 seeds → assert no false lock to wrong tempo
- Stream G: half-time ambiguity (75 vs 150) × 5 seeds → assert locks to 150 (octave-fold)
- Stream H: double-time ambiguity (150 vs 300) × 5 seeds → assert locks to 150
- Stream I: 500ms gap × 5 seeds → assert unlock detection < 1s, relock < 2s
- Stream J: 2s gap × 5 seeds → assert unlock detection < 1s, relock < 3s

Anti-overfit rule: report spread across 5 seeds per stream; a change must improve the
distribution, not one seed.

**Inspired by**: psy5 `TransportClock` + `BeatEstimator` + `PhaseCorrector` + `ConfidenceTracker`
(250 tests, "perfect-150 median phase error 0.01ms, P95 3.7ms"). Avoids psy4 BeatPLL's
documented bug (`confidence = min(1, radioBands.low * 2)` is low-band energy, not detection
confidence — `CROSS_REPO_AUDIT.md` line 50).

---

### W2 — `foundation/dsp.mjs` (DSP primitives)

Pure functions, no AudioContext, bit-identical per seed.

```ts
// PolyBLEP oscillators (band-limited via polyphase blep correction)
export function polyblepSaw(phase: number, t: number): number;      // -1..1
export function polyblepSquare(phase: number, t: number): number;    // -1..1
export function polyblepTriangle(phase: number, t: number): number;  // -1..1
export function polyblepPulse(phase: number, t: number, duty: number): number;

// ZDF SVF (Simper) — state variables ic1eq, ic2eq
export class ZdfSvf {
  constructor(sampleRate: number);
  process(input: number, cutoff: number, resonance: number): { low, band, high, notch };
}

// 4-operator FM (DX7-style instantaneous-frequency)
export class FmOscillator {
  constructor(sampleRate: number);
  process(carrierFreq: number, modulatorRatio: number, modIndex: number): number;
}

// Wavetable builder + interpolator
export function buildWavetable(name: "saw"|"square"|"triangle"|"sine"|"noise"|"psy1", size?: number): Float32Array;
export function wavetableInterpolate(table: Float32Array, phase: number): number;

// Envelopes (linear ADSR + exponential pitch glide)
export class Adsr { set(d: {a,d,s,r, peak}); process(gate: boolean): number; }
export function pitchGlide(from: number, to: number, t: number, tau: number): number;

// Saturation
export function tanhSaturation(x: number, drive: number): number;
export function softClip(x: number): number;
export function hardClip(x: number): number;
```

**Tests** (`tests/dsp.test.mjs`, 20 cases):
- PolyBLEP saw: assert DC ~0, no aliasing above Nyquist/2 (FFT peak check)
- PolyBLEP square: assert 50% duty cycle, odd harmonics only
- ZDF SVF: assert unity gain at DC, -3dB at cutoff, monotonic rolloff
- ZDF SVF: assert resonance self-oscillates at Q=20
- FM: assert sidebands at carrierFreq ± n*modulatorRatio*carrierFreq
- Wavetable: assert buildWavetable("saw") == polyblepSaw at integer phases
- Adsr: assert linear segments, sustain holds, release decays to <0.001
- bit-identity: process(input, params) === process(input, params) for 1000 calls

**Inspired by**: PsySynthPro `psysynth-worklet.js` (PolyBLEP + ZDF ic1eq/ic2eq + 6-op FM + 5
wavetables) + psy-foundation `packages/dsp` (PolyBlepOsc + MoogLadder + BiquadFilter RBJ +
SchroederReverb). Pure-function form (PsySynthPro's are inside a class) and psy-native
(psy-foundation is a 729-test monorepo with mid-migration transport).

---

### W4 — `foundation/director.mjs` (MusicalDirector with abstention)

```ts
export interface DirectorContext {
  transport: { locked: boolean, confidence: number, bpm: number };
  musical: { energy: number, density: number, tension: number, targetTension: number };
  history: { lastBarDense: boolean, barsSinceRest: number, phraseIndex: number };
  reward?: { lastActionReward: number };
}

export interface DirectorDecision {
  action: "play" | "abstain";
  reason: string;             // explainability (RULE 7)
  intensity: number;         // 0..1 — multiplier on event velocities
  rewardPrediction: number;  // 0..1 — what the director expects
}

export class MusicalDirector {
  constructor(opts: { abstainThreshold: number, explorationRate: number });
  decide(ctx: DirectorContext): DirectorDecision;
  updateReward(actualReward: number): void;  // EMA update
}
```

**Abstention rule** (the new capability):
- `action = "abstain"` when any of:
  - `transport.confidence < 0.4` (radio unlocked to wrong octave)
  - `transport.locked === false` (no beat lock)
  - `musical.energy < 0.2 && barsSinceRest > 4` (low energy + played too long)
  - `history.lastBarDense && musical.density > 0.7` (previous bar was dense + density target high)
  - `rewardPrediction < abstainThreshold` (bandit says DO NOTHING)

**Tests** (`tests/director.test.mjs`, 10 cases):
- High-confidence + high-energy → action="play", intensity=0.9
- Low confidence → action="abstain", reason contains "transport.confidence"
- Unlocked → action="abstain", reason contains "transport.locked"
- Low energy + barsSinceRest > 4 → action="abstain", reason contains "energy"
- Dense previous bar → action="abstain", reason contains "dense"
- Reward prediction < threshold → action="abstain", reason contains "rewardPrediction"
- After abstention, barsSinceRest resets → action="play"
- EMA update: after 10 rewards of 0.9, rewardPrediction converges to ~0.9
- Determinism: same context → same decision (no Math.random in decide())
- Exploration: 5% exploration rate triggers occasional non-greedy plays

**Inspired by**: psy5 contextual bandit with `abstainThreshold` ("DO NOTHING chosen when
best reward < threshold"). Advanced over psystar (autopilot but no abstention) and
PSY6-ULTIMATE (CandidateGenerator always picks).

---

### W5 — `foundation/grammar.mjs` (3 grammar classes with provenance)

```ts
export class BassGrammar {
  constructor(seed: number);
  // 12×12 interval transition matrix, learned from observations
  observe(fromDegree: number, toDegree: number): void;
  // returns next degree given current, with provenance
  next(currentDegree: number, rng: () => number): { degree: number, provenance: { matrix: number[], rowSum: number } };
  serialize(): object;
}

export class MelodicGrammar {
  constructor(seed: number);
  // interval histogram
  observe(interval: number): void;
  next(rng: () => number): { interval: number, provenance: { histogram: number[] } };
}

export class RhythmGrammar {
  constructor(seed: number);
  // kick-onset pattern, learned from observations
  observe(step: number, hasKick: boolean): void;
  next(rng: () => number): { steps: boolean[], provenance: { onsetProb: number[] } };
}

// Variation layer: takes a resolved timeline + applies grammar mutations with provenance
export function applyGrammarVariation(
  timeline: MusicalTimeline,
  grammars: { bass?: BassGrammar, melodic?: MelodicGrammar, rhythm?: RhythmGrammar },
  rng: () => number
): MusicalTimeline;  // returns NEW timeline, original untouched; mutated events carry
                     // provenance.grammar = { name, op, source }
```

**Tests** (`tests/grammar.test.mjs`, 10 cases):
- BassGrammar: observe 100 transitions → next() respects observed distribution (chi-square < 0.05)
- BassGrammar: serialize/deserialize round-trip byte-identical
- MelodicGrammar: same seed → same histogram
- RhythmGrammar: kick-onset probability converges to observed rate within 50 bars
- applyGrammarVariation: original timeline unchanged (immutability)
- applyGrammarVariation: mutated events carry provenance.grammar
- applyGrammarVariation: deterministic per (timeline, grammars, seed)
- BassGrammar: 12×12 matrix stays row-stochastic after observation
- MelodicGrammar: empty observations → uniform distribution (no NaN)
- RhythmGrammar: 0 kicks observed → never produces kick (avoids division by zero)

**Inspired by**: PSY6-ULTIMATE (3 grammar classes, 15 Grammar refs in index.html). Advanced
over PSY6-ULTIMATE because: (a) provenance-enforced (RULE 7), (b) deterministic per
(seed, label), (c) testable (PSY6-ULTIMATE has 0 tests), (d) variation layer (preserves
canonical song model, doesn't replace it).

---

### W6 — `foundation/render.mjs` (offline render + stem export)

```ts
// Uses OfflineAudioContext + the same schedule-ahead loop the live engine uses,
// just with no setInterval and no UI rAF. byte-identical per seed.
export async function renderSong(
  song: Song,
  opts: { bars?: number, sampleRate?: number, channels?: 1|2 }
): Promise<AudioBuffer>;

// Per-device stems through the master chain
export async function renderStems(
  song: Song,
  opts: { bars?: number, sampleRate?: number }
): Promise<{ kick: AudioBuffer, bass: AudioBuffer, perc: AudioBuffer, lead: AudioBuffer, arp: AudioBuffer, pad: AudioBuffer, master: AudioBuffer }>;

// WAV file encoder (16-bit PCM, 44.1kHz, stereo)
export function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer;
```

**Tests** (`tests/render.test.mjs`, 10 cases):
- renderSong: same (song, opts) → byte-identical AudioBuffer (10 calls)
- renderSong: 8 bars → event count matches resolveSong
- renderStems: 6 stems produced, each non-empty
- renderStems: master stem ≈ sum of device stems (within ±1%)
- audioBufferToWav: 44-byte header + data chunk, RIFF format
- audioBufferToWav: 16-bit, stereo, 44.1kHz
- renderSong: 176 bars (full song) → completes in < 1s offline
- renderSong: 1408 bars (10× song) → completes in < 10s offline
- renderSong: sample rate 48000 → buffer.sampleRate === 48000
- renderSong: channels=1 → mono buffer

**Inspired by**: psy-sampler (28× real-time, byte-identical per seed, offline WAV export).
Advanced over psy-sampler because: (a) per-device stems through master chain (psy-sampler
does drums/music/atmos only), (b) M2 song determinism (byte-identical replay per RULE 8),
(c) psy-native (psy-sampler is a 653-test Next.js app).

---

### W7 — `foundation/midi.mjs` (Web MIDI + clock + file export)

```ts
// Web MIDI API input
export async function openMidiInput(onMessage: (msg: MidiMessage) => void): Promise<void>;
export async function listMidiInputs(): Promise<MidiInput[]>;

// 24ppq MIDI clock out (sync external hardware)
export class MidiClockOut {
  constructor(output: MidiOutput);
  start(): void;   // sends 0xFA (Start) + 0xF8 (Clock) stream
  stop(): void;    // sends 0xFC (Stop)
  continue(): void; // sends 0xFB (Continue)
  tick(audioTime: number): void;  // schedule next 0xF8 at audioTime
}

// MIDI file export (480 ticks/beat, Tempo meta, End of track)
export function timelineToMidiFile(
  timeline: MusicalTimeline,
  opts: { ticksPerBeat?: number, bpm: number }
): ArrayBuffer;  // Standard MIDI File format 0
```

**Tests** (in `tests/render.test.mjs` as part of W10, 5 MIDI cases):
- timelineToMidiFile: header chunk "MThd" + track chunk "MTrk"
- timelineToMidiFile: format 0, 1 track, 480 ticks/beat
- timelineToMidiFile: Tempo meta event present
- timelineToMidiFile: End of track meta present
- timelineToMidiFile: event count matches timeline.eventCount

**Inspired by**: psystar (24ppq MIDI clock + Start/Stop transport) + PSY6-ULTIMATE (MIDI
file export with 480 ticks/beat, Tempo meta, End of track). Advanced over both because:
(a) M2 song determinism (byte-identical replay per seed), (b) psy-native, (c) combines
24ppq clock + file export in one module.

---

### W8 — PWA + service worker + self-diagnose (inline in `index.html`)

- Inline PWA manifest via Blob URL (name, icons, theme_color, display:standalone)
- Inline service worker via Blob URL: cache-first for the single HTML file + soundBank.js
- Self-diagnose: if `audioWorklet.addModule` fails, show red diagnostic box + REPAIR button
  (unregisters SW + clears caches + reloads)

**Inspired by**: psy3-clean (real service-worker precache, installable PWA) + PsySynthPro
(self-diagnosing: if panel fails to build, red diagnostic box + REPAIR). Advanced over both
because: (a) inline via Blob URL (no separate manifest.json / sw.js files — preserves
single-file constraint), (b) self-diagnosing the worklet (not just the UI).

---

### W9 — `index.html` consumes `foundation/` (closes roast #2)

Replace the inline copy of model logic with:
```js
// At top of <script>:
const foundationUrl = URL.createObjectURL(new Blob([
  await (await fetch('./foundation/foundation.mjs')).text()
], { type: 'text/javascript' }));
const { resolveSong, contextAt, serializeTimeline } = await import(foundationUrl);
```

Or, for true single-file distribution, inline the foundation as a string and Blob-URL it.

**Result**: one source of truth. The foundation stops being dead code. The "single-file
constraint" is honored (still one HTML file deploys) without duplicating the model.

---

### W11 — `FOUNDATION_VERSION.md` registry promotion

```
| component        | version | source                           | status    | notes                                          |
|------------------|---------|----------------------------------|-----------|------------------------------------------------|
| transport        | v1      | foundation/transport.mjs         | ADMITTED  | tests A–J × 5 seeds green; gap/unlock/decay ok |
| dsp              | v1      | foundation/dsp.mjs               | ADMITTED  | 20 tests green; bit-identity per seed           |
| director         | v1      | foundation/director.mjs          | ADMITTED  | 10 tests green; abstention cases proven        |
| grammar          | v1      | foundation/grammar.mjs           | ADMITTED  | 10 tests green; provenance + determinism       |
| render           | v1      | foundation/render.mjs            | ADMITTED  | 10 tests green; byte-identity per seed         |
| midi             | v1      | foundation/midi.mjs              | ADMITTED  | 5 tests green; SMF format 0 valid              |
| beat-observer    | (none)  | not built                        | PLANNED   | observation contract first; no worklet yet     |
| pitch-observer   | (none)  | not built                        | NOT ADMITTED | zero tests; observation contract missing    |
| forensic-harness | (none)  | not built                        | CANDIDATE | extraction + tests                             |
```

First time anything is promoted. The contract is honored.

---

## 4. What this plan does NOT do (deliberate scope boundaries)

- **Does not port psy4's BeatPLL** — documented bug (fake confidence). The transport is
  built fresh in `psy` per `PSY6_ARCHITECTURE.md` section 5.
- **Does not port psy4's radio path** — verified broken (HTMLMediaElement buffering 1–10s,
  MediaElementSource provides no timestamps). Radio observation is a separate gate.
- **Does not build a VST** — that's `psy-foundation`'s scope (JUCE/C++). `psy` is a
  single-file browser product.
- **Does not add P2P sync** — that's `psystar`'s scope (WebRTC). Documented as future work.
- **Does not add the AudioWorklet for radio analysis** — only for synthesis. Radio
  observation worklet is a separate gate (per `FOUNDATION_CONTRACT.md` Worklet policy).
- **Does not delete the existing 59 tests** — they stay green. New tests are additive.
- **Does not break the single-file constraint** — `index.html` remains a single deployable
  HTML file. Foundation modules are loaded via Blob URL shim (still works file:// and https://).

---

## 5. Acceptance criteria (definition of done)

- [ ] `ROAST.md` committed (this evidence)
- [ ] `PSY_WINNING_DEVICE.md` committed (this plan)
- [ ] `foundation/transport.mjs` + `tests/transport.test.mjs` — 50 tests green
- [ ] `foundation/dsp.mjs` + `tests/dsp.test.mjs` — 20 tests green
- [ ] `foundation/director.mjs` + `tests/director.test.mjs` — 10 tests green
- [ ] `foundation/grammar.mjs` + `tests/grammar.test.mjs` — 10 tests green
- [ ] `foundation/render.mjs` + `tests/render.test.mjs` — 10 tests green (incl. 5 MIDI cases)
- [ ] `FOUNDATION_VERSION.md` registry updated: 6 components ADMITTED v1
- [ ] Existing 59 tests still green (no regressions)
- [ ] `WINNING_DEVICE_ROADMAP.md` documents what was done vs what remains (W3, W7, W8, W9
  may be partial — they require browser testing which is out of scope for this code-drop)
- [ ] CI workflow `.github/workflows/psy-tests.yml` runs all new test files
- [ ] Total tests: 59 → 160+ (target 159+)

---

## 6. The pitch (one paragraph)

After this plan, `psy` stops being the elegant blueprint that never shipped and becomes the
**canonical realization** of the architecture you already wrote. It is the only single-file
groovebox in the family that combines a real AudioWorklet, PolyBLEP/ZDF DSP, a real PLL
with abstention, grammar learning with provenance, offline stem export, MIDI clock, PWA,
and deterministic timing tests A–J. Every capability is implemented canonically in the
`foundation/` layer (pure ESM, deterministic, testable) and consumed by the runtime —
closing the "foundation is dead code" contradiction. The 12 siblings each hold one piece;
`psy` becomes the device that **integrates** them, in the form the architecture documents
always intended.
