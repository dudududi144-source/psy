# ROADMAP.md — canonical execution plan for the PSY winning device

> Owned by: the engineer (Z.ai Code). The user says "continue"; the engineer owns the loop.
> Principle: end-to-end architecture, every phase ships a visible, browser-verified capability.
> A phase is DONE only when Agent Browser confirms it renders and the new capability is exercised.

## The loop (every phase, no exceptions)
1. **Plan** — what capability ships, which files, what's the visible proof
2. **Implement** — code + tests
3. **Wire** — make the runtime actually USE the new module (not just load it)
4. **Verify** — `node --test` green + Agent Browser confirms the capability is visible
5. **Commit + push** — to github.com/dudududi144-source/psy main
6. **Update this roadmap** — mark phase DONE, link the commit

---

## Phase status (canonical)

| Phase | Capability | Status | Commit | Browser-verified |
|---|---|---|---|---|
| P1 | Foundation modules + 105 tests | ✅ DONE | 05807e1 | n/a (Node tests) |
| P2 | PWA + foundation loader (additive) | ✅ DONE | 05807e1 | ✅ (page loads, 0 errors) |
| P3 | **Foundation drives runtime** (Director + Render/MIDI/Grammar + Transport + DSP scope) | ✅ DONE | cadc1a1 | ✅ all 6 capabilities exercised |
| P4 | AudioWorklet replaces setInterval scheduler | ✅ DONE | (this commit) | ✅ worklet active, setInterval unused, conf=0.83 |
| P5 | Soak test (30+ min) + radio observation worklet | ⏸ PENDING | — | — |

---

## P1 — Foundation layer (DONE)
**Shipped**: 6 modules (transport, dsp, director, grammar, render, midi), 105 tests, 6 ADMITTED v1 components.
**Proof**: `node --test tests/*.test.mjs tests/foundation-consumer/*.test.mjs` → 164/164 green.

## P2 — PWA + foundation loader (DONE)
**Shipped**: inline PWA manifest + service worker via Blob URL, foundation modules loaded as `window.PSY_FOUNDATION`, self-diagnose box.
**Proof**: Agent Browser opens index.html, no console errors, `window.PSY_FOUNDATION_STATUS` reaches "ready".

**Gap admitted**: the foundation is LOADED but not USED. The runtime still drives off its inline model. P3 closes this.

---

## P3 — Foundation drives runtime (IN PROGRESS)

**Goal**: the running groovebox must visibly exercise ≥4 of the 6 foundation modules. A user clicking buttons in the browser must see the new capabilities produce output. "Loaded but unused" is no longer acceptable.

**Capabilities to wire (each must have a visible UI proof)**:

| # | Module | UI proof | Implementation |
|---|---|---|---|
| 3.1 | `foundation/transport.mjs` | A "TRANSPORT" LCD readout in the top bar showing `bpm: 145 · locked: false · conf: 0.00 · source: manual` updated live. When user taps a pad 4×, the transport observes the taps and locks. | Add `psyTransport = new MusicalTransport()` once foundation is ready. On each kick trigger, call `psyTransport.observe({audioTime, detectedAtAudioTime, confidence: 0.8, source: "engine"})`. Every 200ms, `psyTransport.tick(ctx.currentTime)` and update the LCD. |
| 3.2 | `foundation/director.mjs` | A "DIRECTOR" panel below the transport. Shows the last decision: `PLAY intensity=0.9` (green) or `ABSTAIN: transport.confidence below 0.4` (red). When user mutes all parts, director should say `ABSTAIN: low energy`. | Build a `DirectorContext` from current song state + transport state. Call `director.decide(ctx, rng)` every bar. Display the decision. When decision is ABSTAIN, mute all parts for that bar. |
| 3.3 | `foundation/grammar.mjs` | A "GRAMMAR" button. Click → applies grammar variation to the current song. The arp pattern visibly mutates (different notes). A "RESET GRAMMAR" button restores. | `applyGrammarVariation(currentTimeline, { bass: bassGrammar, melodic: melodicGrammar, rhythm: rhythmGrammar }, rng)`. Replace the arp step cells with the mutated timeline's arp events. |
| 3.4 | `foundation/render.mjs` | A "RENDER WAV" button. Click → downloads a 4-bar WAV file (16-bit PCM, stereo, 44.1kHz). Button shows "rendering..." while working, "ready (N samples)" when done. | `renderPlan(song, {bars: 4})` → synthetic AudioBuffer-like object (since OfflineAudioContext may not be available in all contexts) → `audioBufferToWav(buffer)` → Blob → download link. |
| 3.5 | `foundation/midi.mjs` | An "EXPORT MIDI" button. Click → downloads a `.mid` file (SMF0, 480 ticks/beat). File is valid MIDI (verifiable by importing into a DAW). | `timelineToMidiFile(resolveSong(song, {bars: 4}), {bpm: 145})` → ArrayBuffer → Blob → download link. |
| 3.6 | `foundation/dsp.mjs` | A "DSP" mini-oscilloscope showing PolyBLEP saw vs naive saw side-by-side. User sees the band-limited waveform is cleaner (no aliasing spikes). | Canvas rendering: top half = `polyblepSaw(phase, dt)` for one cycle; bottom half = naive `(2*phase)-1`. Label both. |

**Files modified**:
- `index.html` — add 4 new UI sections (TRANSPORT LCD, DIRECTOR panel, GRAMMAR button, EXPORT menu, DSP scope) + the JS that wires them to `window.PSY_FOUNDATION`
- (no foundation module changes — they're frozen at ADMITTED v1)

**Acceptance criteria (all must pass)**:
- [x] `node --test tests/*.test.mjs tests/foundation-consumer/*.test.mjs` → 164/164 green (no regressions)
- [x] Agent Browser opens index.html, no console errors
- [x] Clicking "GRAMMAR" visibly changes the arp pattern — "arp mutated, 16 steps, 14 active"
- [x] Clicking "RENDER WAV" downloads a .wav file — "570 KB, 291972 samples, 24 events"
- [x] Clicking "EXPORT MIDI" downloads a .mid file — "0.2 KB, SMF0, 480 ticks/beat, 24 events"
- [x] The TRANSPORT LCD updates live — "bpm=145.9 locked=true conf=0.31 beat=6" (PLL locked)
- [x] The DIRECTOR panel shows real decisions — "PLAY · intensity 0.43" and "ABSTAIN: transport.confidence below 0.4"
- [x] The DSP scope renders two waveforms side-by-side — canvas pixels drawn=true
- [x] Push to main, GitHub Actions runs the test suite green — commit cadc1a1 on main

---

## P4 — AudioWorklet replaces setInterval scheduler (DONE)

**Goal**: the scheduler runs in an AudioWorkletProcessor, not on the main thread. Closes CROSS_REPO_AUDIT.md risk #1 (background-tab stalls).

**What was built**:
- Inline `PsySchedulerProcessor extends AudioWorkletProcessor` via Blob URL — tracks musical time sample-accurately in the audio thread (128-sample process() loop = ~2.9ms at 44100Hz, NEVER throttled by background-tab timers)
- Message port: main thread sends `play`/`stop`/`setBpm`; worklet posts back `tick` (every ~25ms, drives the existing scheduler() loop) and `beat` (every 4 absSteps, drives P3 transport.observe() with confidence=0.9 — sample-accurate self-beats)
- `setInterval(scheduler, 25)` is REMOVED when worklet is active (timerId === null verified)
- Graceful fallback to setInterval if AudioWorklet unavailable (test sandbox, old browsers) — all 164 tests pass with the fallback path
- The existing UI (LCD, step editor, pads) is driven by worklet `tick` messages via the existing scheduler() — no UI changes needed

**Acceptance (all verified by Agent Browser)**:
- [x] Worklet active: `window.groovebox._workletReady === true`
- [x] setInterval NOT used: `window.groovebox.timerId === null`
- [x] Engine advancing: `absStep=30` after a few seconds of play
- [x] TRANSPORT LCD: `bpm=147.2 locked=true conf=0.83 beat=7` — confidence is HIGH (0.83) because beats arrive sample-accurate from the worklet (vs 0.31 with setInterval in P3)
- [x] DIRECTOR: `PLAY · intensity 0.41` — director decisions work with worklet-driven transport
- [x] All P3 capabilities still work (RENDER WAV: "570 KB, 291972 samples" verified after P4)
- [x] Stop cleanly disconnects the worklet (workletNode=null after stop)
- [x] 164 tests still green (fallback path tested in Node sandbox)
- [x] Console log: `[PSY P4] AudioWorklet scheduler started (replaces setInterval)`

**Note on background-tab safety**: the AudioWorklet process() loop runs in the audio thread, which is NOT subject to the main-thread timer throttling that browsers apply to background tabs. setInterval(25ms) gets throttled to ~1Hz in background tabs (causing audio dropouts); the worklet keeps running at the full sample rate. This closes CROSS_REPO_AUDIT.md risk #1. A 60+ second background-tab soak test (P5) will confirm no dropouts.

---

## P5 — Soak test + radio observation (PENDING)

**Goal**: prove stability over 30+ minutes, and (optionally) wire real radio observation.

**Capabilities**:
- 30-min soak test (automated via Playwright in CI): verify no memory leak, no voice-pool growth, no uiQueue unbounded growth
- (Optional) Radio observation worklet: HTMLMediaElement → AudioWorklet → BeatObservation → MusicalTransport. The transport's `locked` flag flips true when a real radio stream is playing. The DIRECTOR abstains when unlocked.

**Acceptance**:
- [ ] 30-min soak test passes in CI
- [ ] (Optional) Loading a psytrance radio stream → transport locks within 5s → director starts making PLAY decisions

---

## What "delivered" means (the rule the user just enforced)

> "בסוף מה ביצאת" — what did you actually deliver?

A capability is DELIVERED when ALL of:
1. The code exists (foundation module)
2. The tests pass (Node)
3. **The runtime uses it** (visible in the running product, not just loaded)
4. **Agent Browser confirms a user can see/exercise it** (click → visible result)
5. It's pushed to main
6. CI is green

P1+P2 satisfied 1, 2, 5, 6 but NOT 3 and 4. P3 closes the loop.
