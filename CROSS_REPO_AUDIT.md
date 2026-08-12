# CROSS-REPO FORENSIC AUDIT (Phase 0.5)

Scope: psy, psy3-clean, psy4, psy5 (+ forge / PromptForge / nova noted as out-of-scope, non-audio).
Method: GitHub Trees + Contents API + code-search + actual file reads. Names are NOT trusted; wiring is verified by import graph.

## Repo inventory

| repo | size | what it actually is | audio? |
|---|---|---|---|
| psy (main) | 109KB | PSY-6 GROOVEBOX single-file app. Now **v4.0-m2-song** (M2 merged, 22/22 tests green). | YES — mainline |
| psy3-clean | 697KB | "PSY6 MAX" single-file, version string **3.0.0-m1-fullon** (= pre-M2 psy). Clean base. | YES — superseded |
| psy4 | 115MB | "PSY LIVE — radio-following" Next.js app + a huge `src/lib/studio/engine/` library + `skills/` design templates. | YES — research line |
| psy5 | 33KB | "PSY6 STANDALONE GROOVEBOX — POOLED ENGINE", single-file, uses a Web Worker. | YES — pooled experiment |
| forge | 31KB | CI/CD platform | no |
| PromptForge | 82KB | AI dev tool | no |
| nova | 48MB | unknown | unverified |

## psy4 — the important one (claimed PLL / Director / Worklet)

### Entry point & runtime
- Entry: Next.js `src/app/page.tsx`.
- page.tsx imports ONLY `PsyLive` from `@/lib/psyLive`. So the LIVE runtime = `PsyLive` class in `src/lib/psyLive.ts`.
- `PsyLive` uses: `setInterval` scheduler (lookahead + schedule-ahead), `AudioContext.currentTime` for note timing, `HTMLAudioElement` + `MediaElementAudioSourceNode` for radio, two `AnalyserNode`s (engine + radio).
- **`PsyLive` does NOT call `audioWorklet.addModule`.** No `new Worker`. Everything runs on the main thread.

### Subsystem verdicts (verified by import graph, not by name)

| subsystem | file | wired into runtime? | tests? | verdict | why |
|---|---|---|---|---|---|
| BeatPLL | src/lib/beatPLL.ts | YES (imported by psyLive) | NONE | **PORT** | Real PLL, AudioContext time, confidence, lock, octave/half-tempo correction. BUT: no phase-error metric, no gap recovery, no unlock, gains hardcoded, confidence only from detector. Good foundation, needs hardening. |
| phaseSync | src/lib/phaseSync.ts | NO | NONE | **RETIRE** | 9 bytes — empty stub. Do not port. |
| phraseSync | src/lib/phraseSync.ts | NO | NONE | **RETIRE** | 9 bytes — empty stub. Do not port. |
| melodyObserver | src/lib/melodyObserver.ts | YES (psyLive) | NONE | PORT-candidate / UNVERIFIED | Observes melody into occupancy. Needs verification it produces stable observations. |
| learning | src/lib/learning.ts | YES (psyLive) | NONE | PORT-candidate / UNVERIFIED | localStorage-based learning. Check it actually changes decisions. |
| patternMutator | src/lib/patternMutator.ts | YES (psyLive) | NONE | PORT-candidate | Mutates patterns every 8 bars. |
| soundBank | src/lib/soundBank.ts | YES (psyLive) | NONE | PORT-candidate | 142+ presets. |
| musicalDirector | studio/engine/musicalDirector.ts (80KB) | NO | NONE | **REWRITE** | Not imported by psyLive/page. Dead library. Concept may be worth re-designing, do NOT port blindly. |
| musicAnalyzer | studio/engine/musicAnalyzer.ts (39KB) | NO | NONE | REWRITE | Not wired. |
| styleClassifier | studio/engine/styleClassifier.ts (21KB) | NO | NONE | REWRITE | Not wired. |
| vocabularyLearner | studio/engine/vocabularyLearner.ts (24KB) | NO | NONE | REWRITE | Not wired. |
| workletEngine | studio/engine/workletEngine.ts (30KB) | NO | NONE | REWRITE | Not wired; psyLive is main-thread. |
| psy4EngineV2 | studio/engine/psy4EngineV2.ts (262KB) | NO | NONE | **RETIRE** | Massive monolith, not wired, no tests. Do not port. |
| schedulerWorker | studio/engine/schedulerWorker.ts | NO | NONE | REWRITE | psyLive uses setInterval, not this worker. |
| public/worklets/psy4-dsp.js, psy4-engine.js | public/worklets/* | NO (no addModule call) | NONE | REWRITE | Built worklets exist but are never loaded by psyLive. |
| forensic/* | studio/engine/forensic/* | via API routes only | NONE | IGNORE (offline tooling) | Used by `/api/forensic/*` server routes, not the live audio path. |

### psy4 timing model (verified)
- Musical clock: `setInterval` + accumulated `nextNoteTime` from `ctx.currentTime` (same pattern as psy mainline).
- Beat detection: `detect()` runs on `setInterval(200ms)`, main-thread polling (NOT AudioWorklet).
- **confidence = `min(1, radioBands.low * 2)`** — this is LOW-BAND ENERGY, not detection confidence. The PLL is fed a fake confidence. This is a real bug to fix in P1.
- Style switching uses `Date.now()` (wall clock) — must move to audio time.

### Global finding: NO audio tests anywhere
- psy4: only unrelated `skills/aminer-deep-search` python tests.
- psy3-clean / psy5: no test files.
- psy: only `tests/playground.test.mjs` (added in this work, now 22 tests).
- => There is NO deterministic timing test anywhere in the family. P2 must create the first one.

## psy5 — pooled engine
- Single-file, uses `new Worker` (1) + `setInterval` (3) + `AudioContext`.
- Separate pooled-voice experiment. Not the mainline. Verdict: **IGNORE** for P1; mine ideas only if needed.

## psy3-clean
- "PSY6 MAX", version 3.0.0-m1-fullon = pre-M2 psy. Superseded by psy main (now v4.0). Verdict: **IGNORE** (reference only).

## Dead/duplicate summary
- Two empty stubs named `phaseSync`/`phraseSync` exist — names lie; content is empty. Do not trust names.
- The entire `studio/engine/` tree (musicalDirector, musicAnalyzer, styleClassifier, vocabularyLearner, workletEngine, psy4EngineV2, schedulerWorker, worklets) is NOT wired into any live runtime and has ZERO tests. This is a large body of unverified code. Per the "do not port blindly" rule: default = REWRITE/RETIRE, only PORT after proof.
- The ONLY verified-wired, real, worth-porting component today is **BeatPLL** (with hardening).
