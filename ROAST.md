# ROAST.md — Sharp critical review of the `psy` repo

> Grounded in actual code reads, not README claims. Method mirrors `CROSS_REPO_AUDIT.md`:
> "Names are NOT trusted; wiring is verified by import graph." Every claim below cites a file
> and line range. This document is the *evidence* half of `PSY_WINNING_DEVICE.md` (the *plan*).

Scope: the mainline `psy` repo (single-file `index.html` + `foundation/`) examined against
all 12 sibling repos in the PSY family (`psy-foundation`, `psy-sampler`, `psysynth`,
`PsySynthPro`, `psydrum`, `psy5`, `psystar`, `PSY6-ULTIMATE`, `psy3-clean`, `psy4`,
`psy4new`, `psysampler`).

---

## 0. The one-line verdict

The architecture documents are more sophisticated than the product. Someone spent real
effort writing what SHOULD be — but the WHAT never shipped. The foundation layer is
excellent and unused. The runtime is stuck in 2015.

---

## 1. You write beautiful architecture — then ignore it

`PSY6_ARCHITECTURE.md` describes:
- a 5-layer architecture (Radio → Analysis → MusicalState → Director → Composer/Arranger/Effects → Transport → Devices → Output)
- a latency model with 5 sources (HTMLMediaElement buffering, decoder, MediaElementSource, analysis window, worklet quanta)
- 3 distinct times (observedBeatTime, estimatedBeatTime, predictedBeatTime)
- a transport API with `phaseErrorMs`, `confidence`, `locked`, `predictionHorizonMs`
- 10 deterministic test streams A–J with specific acceptance criteria (P95 phase error < 10ms on stream A)

It is brilliant. **Then none of it was built.**

`FOUNDATION_VERSION.md` admits it itself: *"NOTHING promoted yet."* The registry shows 6
components, all in status `CANDIDATE`, `PLANNED`, `NOT ADMITTED`, or `TO BUILD`. Zero in
status `ADMITTED`. You spent more time writing the contract than implementing it.

---

## 2. The foundation is dead — it does not run

`foundation/foundation.mjs` (28.4KB, pure ESM, zero deps) contains:
- canonical PRNG (`mulberry32` / `subSeed` / `rngFor`)
- `validateSong`, `validateMotif`, `validateTransform`
- `applyTransform` / `applyTransformChain` with the full registry
- `resolveSong(song) → MusicalTimeline` (kick/bass/perc/lead/arp/pad events in beat coords)
- `contextAt(song, beat) → MusicalContext`
- `serializeTimeline` / `parseTimeline` with byte-identical replay identity (10 generations, tested)

Beautiful. **And then `index.html` has its own inline copy of all of that model logic.**

The runtime does not import the foundation. The foundation is documentation-as-code — a
contract with yourself that you do not honor. You pay double maintenance: every model
change requires two updates, and the only thing that enforces parity is a test suite.

`P1_MUSICAL_FOUNDATION_REALITY_REPORT.md` admits it: *"Foundation is a reference
implementation + contract; product index.html keeps its own inline copy of the model logic
(single-file constraint). Shape parity is enforced by tests on both sides, not by shared
code."*

The "single-file constraint" is treated as a religious rule. ES modules + a Blob URL shim
would let `index.html` consume `./foundation/foundation.mjs` directly while remaining a
single deployable HTML file. The constraint is self-imposed and self-defeating.

---

## 3. Your scheduler is from 2015

`index.html:885`:
```js
this.timerId = setInterval(function(){ self.scheduler(); }, 25);
```

`index.html:894`:
```js
while(this.nextNoteTime < this.ctx.currentTime + 0.14){
```

`setInterval(scheduler, 25)` with 0.06s start delay and 0.14s lookahead window. Your own
`CROSS_REPO_AUDIT.md` flags this as **risk #1**: "setInterval scheduler + 0.14s lookahead
→ background-tab stalls (audit risk #1)."

This is the same scheduler PSY6-ULTIMATE, psystar, and psy3-clean use. The whole family
is stuck in the same setInterval boat. **PsySynthPro already proved a real AudioWorklet fits
in 18KB of vanilla JS** (`psysynth-worklet.js`, `SynthProcessor extends AudioWorkletProcessor`
with ZDF state vars ic1eq/ic2eq). You are still on the main thread.

---

## 4. You have no real DSP. None.

`P1_MUSICAL_FOUNDATION_FORENSIC_REVIEW.md` line 15–17, the marker grep counts:
> Counts: Math.random x1 (makeNoiseBuffer — noise timbre only), Date.now x1 (trackEvent
> telemetry), setInterval x1 (scheduler wake), AudioContext x5 (runtime audio only).

Zero PolyBLEP. Zero ZDF. Zero wavetable. Zero FM modulation. Your bass is `OscillatorNode`
+ `BiquadFilter`. Your kick is an osc with a pitch envelope. Your "shaper" is a WaveShaperNode
with a tanh curve (`index.html:846-855`).

Meanwhile, **PsySynthPro** (your smaller sibling) runs:
- PolyBLEP saw/square/pulse
- ZDF SVF (Simper) with ic1eq/ic2eq state variables
- 6-operator FM (DX7-style instantaneous-frequency)
- 5 wavetable recipes
- per-note pitch bend (MPE)
- 16-voice pool with oldest-note stealing
- sample-accurate event queue in the worklet

When your title says *"Professional Psytrance Workstation"* — PsySynthPro is snickering.

---

## 5. Beat detection = zero. Truly zero.

You wrote 145 lines in `PSY6_ARCHITECTURE.md` section 4 about radio latency (5 sources),
3 distinct times (observed/estimated/predicted), self-calibration via cross-correlation,
drift tracking, re-anchor at bar edges, degradation to prediction-only.

Then in the actual product: `bpm = 120 + v*45` from a knob (`index.html:859`). That's it.

- No PLL
- No onset detection
- No confidence
- No octave-fold correction
- No gap recovery

**psy4 already tried — and faked it.** `CROSS_REPO_AUDIT.md` line 50: *"confidence =
`min(1, radioBands.low * 2)` — this is LOW-BAND ENERGY, not detection confidence. The PLL is
fed a fake confidence. This is a real bug to fix in P1."*

**psy5 built the real thing** — `TransportClock` + `BeatEstimator` + `PhaseCorrector` +
`ConfidenceTracker`, 250 tests, *"perfect-150 median phase error 0.01ms, P95 3.7ms"* per
its README. You don't need to invent — you need to consume. And per `FOUNDATION_VERSION.md`,
nothing is admitted yet.

---

## 6. Your "learning" is `seed++`

`index.html:923-932`:
```js
Groovebox.prototype.variate = function(auto){
  this.seed = (this.seed + 0x9E3779B9) >>> 0;
  this.song = buildSong(this.seed);
  this.variation++;
  // ...
};
```

Click → new seed → rebuild song. That's your learning.

- **PSY6-ULTIMATE** learns 3 grammars *while you play*: BassGrammar (12×12 transition
  matrix), MelodicGrammar (interval histogram), RhythmGrammar (kick-onset). 15 Grammar
  refs in its index.html.
- **psystar** syncs state P2P over WebRTC.
- **psy5** has a contextual bandit with `abstainThreshold` — it can choose DO NOTHING.

You increment a constant.

---

## 7. Your test suite is the smallest in the family

Per `P1_MUSICAL_FOUNDATION_REALITY_REPORT.md`: **59 tests** (playground 24 + foundation 24 +
foundation-consumer 11).

| repo | tests |
|---|---|
| psy-foundation | 729 |
| psy-sampler | 653 (167k expects) |
| psy5 | 250 |
| psysynth | 124 |
| psystar | 71 files |
| **psy (you)** | **59** |

You are the founder, and you have the smallest test suite. And the most important contract
of all — deterministic timing tests A–J — **does not exist in any repo in the family.**
`PSY6_ARCHITECTURE.md` section 6 specifies 10 streams (A=perfect 150, B=jitter, C/D=drift,
E=missing beats, F=false beats, G/H=octave ambiguity, I/J=gaps) × 5 seeds = 50 test cases,
with metrics: P95 phase error < 10ms on stream A, lock time, unlock detection, relock time,
false-lock rate.

Nobody has built this. It's the cheapest gap to close and the most expensive to ignore.

---

## 8. Every "modern" capability — missing

| capability | psy | psy3-clean | PSY6-ULTIMATE | psystar | PsySynthPro | psy-sampler | psy-foundation |
|---|---|---|---|---|---|---|---|
| PWA / service worker | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| MIDI in | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| MIDI clock out (24ppq) | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| MIDI file export | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Offline WAV render | ❌ | ❌ | ✅ mono | ✅ master | ❌ | ✅ 28× RT | ❌ |
| Stem export per device | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ drums/music/atmos | ❌ |
| Song arrangement editor | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Arrangement-level undo | ❌ | ❌ | ❌ | pattern only | ❌ | ❌ | ❌ |
| Provenance-enforced samples | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| DO-NOTHING abstention | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Soak test 30–120min | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AudioWorklet in live path | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | library only |
| Real PLL | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | library only (mid-migration) |

You have none of these. Your audit (`CROSS_REPO_AUDIT.md` risk #1, #8) admits the soak-test
gap and the background-tab stall — both still open.

And the license hole: `psy4` README self-discloses *"previous `public/samples/real/`
directory of commercial hardware rips was removed in Phase 0 — documented license
violation."* `psy` itself has `soundBank.js` (576 lines, 44KB) loading whatever it's given.
No provenance gate. The same hole.

---

## 9. You have credentials that leaked in a chat session

`PSY6_ARCHITECTURE.md` section 9.9:
> 9. Leaked credentials in workspace (turso.txt) — ROTATE ALL (turso/cloudflare/github/supabase).

This is listed as an open risk for **months**. This is not just a bug — this is an
unresolved security incident. `FOUNDATION_CONTRACT.md` line 101 reiterates:
> Open incident: leaked credential file (turso.txt: turso/cloudflare/github/supabase)
> from a chat session. Status: ROTATION REQUIRED.

Status: still required. Still not done.

---

## 10. The most painful contradiction

Your own architecture document says:
> Principle: Build less. Connect better. Measure everything. One source of truth. One
> musical clock. No fake intelligence.

Then in practice:
- **Build less** → you built a 28.4KB foundation AND duplicated it inline in index.html.
- **Connect better** → the foundation is not connected to the runtime.
- **Measure everything** → you measured once in CI. No soak test. No A–J streams.
- **One source of truth** → you have two (foundation.mjs + inline copy in index.html).
- **One musical clock** → you have zero clocks. `setInterval` is not a clock (your own
  `PSY6_ARCHITECTURE.md` section 3 says so: "setInterval may WAKE the scheduler. It is
  NEVER the musical clock.").
- **No fake intelligence** → fair, you have no intelligence at all (real or fake).

You are preaching to yourself and not listening.

---

## What this roast is NOT

This is not hate. The foundation code is genuinely well-designed — pure, deterministic,
frozen, with provenance and replay identity. The architecture documents are correct in
every particular. The forensic audit (`P1_MUSICAL_FOUNDATION_FORENSIC_REVIEW.md`) is
unusually honest — most projects don't have a 17-question self-interrogation committed to
git. The CI is real. The 59 tests pass.

The problem is **execution gap**, not vision gap. You designed the right thing and then
stopped. The `psy` repo is a beautiful blueprint for a house that was never built — and
the family has 12 siblings each building one wall of that house separately.

The plan in `PSY_WINNING_DEVICE.md` closes the execution gap. It does not redesign — it
**delivers** the design you already wrote, and adds the capabilities the siblings each hold
a piece of.
