# PRODUCT_ROADMAP.md — PSY: from demo to commercial product

> End-to-end engineering + commercial plan. Each phase ships a verified capability.

## The current state (honest assessment)

**PSY RADIO** (radio.html) is a working generative radio prototype, but it has 3 blocking
issues for commercial use:

1. **Performance**: uses `ScriptProcessorNode` (deprecated, runs on main thread). Causes
   audio glitches when UI updates, and high latency on parameter changes. The user
   reported "עמוס" (overloaded) and "לייטנסי" (latency) — both are direct consequences.
2. **Production gap**: can only record 60s of audio. No way to export a full track, stems,
   or a project file. A musician can't USE this to make music they can release.
3. **Commercial gap**: no save/load, no shareable URLs, no presets, no licensing story.

## The commercial product vision

**PSY STUDIO** — a generative psytrance production studio that runs in the browser.
Three customer journeys:

| Customer | What they get | Price tier |
|---|---|---|
| **Listener** | Open the URL, infinite generative psytrance radio. Free. | Free |
| **Producer** | Generate a track, export WAV + MIDI + project, use in DAW. | $9 one-time / $3/mo |
| **Studio** | Render full-length stems, custom sound design, API access. | $29/mo |

## End-to-end architecture

```
┌─────────────────────────────────────────────────────────────┐
│  BROWSER (single HTML file, no build)                       │
│                                                             │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │  UI (main thread)│    │ AudioWorklet (audio thread)     │ │
│  │  - now playing   │◄───►│  PsyStudioProcessor           │ │
│  │  - controls       │    │  ───────────────────────────── │ │
│  │  - export menu    │    │  - DSP: PolyBLEP+ZDF+FM        │ │
│  │  - presets        │    │  - Voices: kick/bass/lead/pad │ │
│  │  - visualizer     │    │  - Scheduler (sample-accurate)│ │
│  └────────┬─────────┘    │  - Director (PLAY/ABSTAIN/bar) │ │
│           │              │  - Grammar (learn+evolve)      │ │
│           │              │  - Master: EQ→comp→limiter     │ │
│           │              └─────────────┬───────────────────┘ │
│           ▼                            ▼                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Production layer (main thread)                        │ │
│  │  - OfflineAudioContext render (full track / stems)     │ │
│  │  - WAV encoder (foundation/render.mjs)                  │ │
│  │  - MIDI file encoder (foundation/midi.mjs)             │ │
│  │  - Project file (.psy.json)                            │ │
│  │  - Shareable URL (state in #hash)                      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Phase plan

| Phase | Capability | Commercial value | Status |
|---|---|---|---|
| **S1** | AudioWorklet migration — all DSP moves to audio thread | Fixes overload + latency | ✅ DONE | |
| **S2** | Export full track (1/5/10/30 min WAV) | Producer renders release-ready track | ✅ DONE | |
| **S3** | Export stems (kick/bass/lead/pad/master) | Producer remixes in DAW | ✅ DONE | |
| **S4** | Export MIDI + project file (.psy.json) | Producer reloads + edits in DAW | ✅ DONE | |
| **S5** | Master chain: EQ + comp + limiter (LUFS -14) | Release-quality loudness | ✅ DONE | |
| **S6** | Presets (4 slots) + save/load | Repeatable workflows | ✅ DONE | |
| **S7** | Shareable URLs (state in #hash) | Viral distribution | ✅ DONE | |
| **S8** | PWA installable + mobile-optimized | Native-like UX | ✅ DONE | |

## S1 — AudioWorklet migration (THE critical fix)

**Why critical**: `ScriptProcessorNode.onaudioprocess` runs on the main thread. Every UI
update competes with audio rendering → glitches + latency. `AudioWorkletProcessor.process()`
runs on a dedicated audio thread — NEVER blocked by UI.

**What moves into the worklet** (all inline — self-contained, no imports):
- DSP: `mulberry32`, `polyblepSaw`, `polyblepSquare`, `ZdfSvf`, `tanhSaturation`
- Voices: kick, bass (PolyBLEP→ZDF), lead (PolyBLEP→ZDF→FM), pad (3 detuned PolyBLEP→ZDF)
- Scheduler: per-sample bar/step triggering (sample-accurate)
- Director: per-bar PLAY/ABSTAIN decision (inline)
- Grammar: bass transition counter + melodic interval histogram (inline)
- Master chain: tanh saturation → compressor (4:1) → limiter (hard clip 0.95)

**What stays on main thread**:
- UI rendering (visualizer, now-playing, controls)
- Parameter changes (send `setParams` message to worklet)
- Export (OfflineAudioContext + same worklet code for offline render)
- Foundation modules (only for export: render.mjs WAV encoder, midi.mjs SMF0 encoder)

**Message protocol**:
- Main → worklet: `{type:"setParams", params:{bpm,energy,mood,...}}`
- Main → worklet: `{type:"setSeed", seed}`
- Worklet → main: `{type:"metrics", barIndex, section, bpm, directorAction}` (~10Hz)

**Acceptance**:
- [ ] Audio plays with NO main-thread blocking (drag knob → no glitch)
- [ ] `AudioContext.state === "running"`
- [ ] 0 console errors

## S2-S4 — Production (export capabilities)

**Full track WAV**: OfflineAudioContext + same worklet → render N minutes → audioBufferToWav.
Deterministic per (seed, params).

**Stems**: 5 separate offline renders (kick/bass/lead/pad/master).

**MIDI**: foundation/midi.mjs `timelineToMidiFile(timeline, {bpm, ticksPerBeat:480})` → SMF0 .mid.

**Project** (.psy.json): full state — seed, params, grammar state, preset name.

## S5 — Master chain (release-quality)

Inline in worklet:
- EQ: high-shelf +3dB @ 8kHz, low-cut @ 30Hz
- Compressor: 4:1, attack 5ms, release 50ms, threshold -18dB, makeup +6dB
- Limiter: lookahead 1 sample, ceiling -0.3dB (LUFS ≈ -14)

## S6-S7 — Presets + shareable URLs

- 4 preset slots (A/B/C/D) in localStorage
- Shareable URL: `#s=12345&b=144&m=fullon&e=0.6` → state encoded in hash

## S8 — PWA + mobile

- Inline PWA manifest, installable, mobile-optimized UI

## What this roadmap is NOT

- Not a rebuild of the foundation modules (frozen at ADMITTED v1)
- Not a server-side product (S1-S8 are 100% browser-based, single HTML file)
- Not a replacement of radio.html (radio.html = free listener tier; studio.html = producer tier)
