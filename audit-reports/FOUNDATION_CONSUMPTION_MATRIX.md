# FOUNDATION_CONSUMPTION_MATRIX.md
Every candidate subsystem, classified. Evidence from CROSS_REPO_AUDIT.md (import-graph
verified) and FOUNDATION_CONSUMER_FREEZE.md. Action classes:
PORT_TO_FOUNDATION / CONSUME_AS_IS / ADAPTER_REQUIRED / REBUILD / KEEP_PRODUCT_LOCAL / ARCHIVE.
Admission bar: VERIFIED + GENERIC + TESTED = candidate. CLAIMED + UNTESTED = NOT foundation.
DEAD CODE = NOT foundation. Nothing is ported merely because it exists.

## psy4 subsystems

| subsystem | source | current status | reusable API? | tests | consumer | action |
|---|---|---|---|---|---|---|
| BeatPLL (R1) | psy4 src/lib/beatPLL.ts | wired in PsyLive; AudioContext-time; clean class API (update/getClock/getPhase/predictBeats/reset); confidence gate 0.45; gains 0.3/0.08; [60,200] guard; 2-candidate octave resolution | YES | NONE | none yet | ADAPTER_REQUIRED -> then PORT_TO_FOUNDATION as transport v1 candidate. Blockers: zero tests; no gap/unlock/confidence-decay; phaseError not exposed; latency model absent. Must pass PSY6_ARCHITECTURE tests A-J + consumer contract tests first. |
| phaseSync | psy4 src/lib/phaseSync.ts | 9-byte EMPTY STUB | NO | NONE | none | ARCHIVE (name lies; no content) |
| phraseSync | psy4 src/lib/phraseSync.ts | 9-byte EMPTY STUB | NO | NONE | none | ARCHIVE (name lies; no content) |
| MelodyObserver | psy4 src/lib/melodyObserver.ts | wired in PsyLive (observe() called with analyser data + occupancy) | partial | NONE | psy4 only | ADAPTER_REQUIRED. NOT foundation until observation contract + deterministic tests exist. |
| learning.ts | psy4 src/lib/learning.ts | wired; localStorage-based episodes/compositions | partial | NONE | psy4 only | KEEP_PRODUCT_LOCAL (psy4-side experiment). Foundation learning is P7, contract-first; nothing ported now. |
| patternMutator | psy4 src/lib/patternMutator.ts | wired (8-bar mutation in PsyLive) | partial | NONE | psy4 only | ADAPTER_REQUIRED. Psy already owns verified transforms (M2 suite). psy4 copy adds nothing today. NOT foundation until proven better + tested. |
| soundBank (142 presets) | psy4 src/lib/soundBank.ts | wired in PsyLive | NO (product presets) | NONE | psy4 | KEEP_PRODUCT_LOCAL. Product-specific presets MUST NOT be foundation (contract). |
| musicalDirector (82KB) | studio/engine/musicalDirector.ts | NOT imported by any live path | NO | NONE | none | REBUILD (concept only). Do NOT port. Product director belongs to psy, contract-first. |
| psy4EngineV2 (262KB) | studio/engine/psy4EngineV2.ts | NOT wired | NO | NONE | none | ARCHIVE. Duplicate engine — contract forbids duplicate musical engines. |
| musicAnalyzer | studio/engine/musicAnalyzer.ts | NOT wired | NO | NONE | none | REBUILD candidate (analysis layer needed later, contract-first, tests-first). |
| styleClassifier | studio/engine/styleClassifier.ts | NOT wired | NO | NONE | none | REBUILD candidate (much later; unverified ML). NOT foundation. |
| vocabularyLearner | studio/engine/vocabularyLearner.ts | NOT wired | NO | NONE | none | REBUILD candidate (P6/P7 scope). NOT foundation now. |
| workletEngine + public/worklets/* | studio/engine/workletEngine.ts, public/worklets/psy4-*.js | files exist; NO addModule call anywhere in live runtime | NO | NONE | none | ARCHIVE. DO NOT port (gate rule: no worklet until observation contract verified). |
| schedulerWorker | studio/engine/schedulerWorker.ts | NOT wired (PsyLive uses main-thread setInterval) | NO | NONE | none | ARCHIVE. Product scheduler ownership stays in psy; timing invariant forbids setInterval clocks anyway. |
| harmonyEngine / melodyEngine / flowEngine / layerEngine / callResponseEngine | studio/engine/* | NOT wired | NO | NONE | none | ARCHIVE. Unverified parallel engines; contract forbids duplicates. |
| effectsRack / sendEffects / multibandCompressor | studio/engine/* | NOT wired | NO | NONE | none | REBUILD candidates (FX utilities may become foundation DSP later, tests-first). |
| forensic/* (offlineRenderer, audioAnalyzer, qualityScore, worlds, ...) | studio/engine/forensic/* | wired ONLY via server API routes (/api/forensic/*), not audio runtime | partial | NONE | psy4 server | PORT_TO_FOUNDATION candidate as "forensic test harness" AFTER extraction + tests. Not consumed by psy runtime. |
| reference/* (referenceListener, trainingLoop, worldDNA, ...) | studio/engine/reference/* | wired ONLY via /api/reference/* routes | partial | NONE | psy4 server | KEEP_PRODUCT_LOCAL (psy4 training tooling). NOT foundation. |
| examples/websocket/server.ts | psy4 examples | demo | NO | NONE | none | ARCHIVE. Network sync is P10+, contract-first; this demo is not a contract. |
| PRNG | psy4 uses Math.random in places; psy uses inline mulberry32 | no shared module | NO | NONE | - | REBUILD: build+test a deterministic PRNG foundation primitive before any learning/observation work. |

## psy (product) internals — product-local by contract

| item | status | action |
|---|---|---|
| buildSong / themes / SECTION_TEMPLATE / arranger | verified M2, 22/22 tests | KEEP_PRODUCT_LOCAL |
| scheduler (scheduleStep/onBar) + voices + FX chain | verified M2 | KEEP_PRODUCT_LOCAL (product scheduler integration) |
| makePatterns + device.patterns + ARP read | duplicate representation (verified) | MIGRATION_REQUIRED (FOUNDATION_CONTRACT.md "ARP / M2 migration contract") |
| tests/playground.test.mjs (22 tests) | green on m2 head | KEEP_PRODUCT_LOCAL (product suite; foundation gets its own contract tests) |
| soundBank.js in psy repo | NOT imported by index.html (verified) | KEEP_PRODUCT_LOCAL (dead in runtime today; product decision, not foundation) |

## Other repos

| repo | status | action |
|---|---|---|
| psy3-clean ("PSY6 MAX", 3.0.0-m1-fullon) | superseded pre-M2 line | ARCHIVE (reference only; no porting) |
| psy5 (pooled engine + Worker) | separate experiment | ARCHIVE (ideas mine only; pooled primitives re-proven from scratch if ever needed) |
| forge / PromptForge / nova | not audio | IGNORE (out of scope) |

## Explicitly REJECTED as foundation (this gate)
psy4EngineV2, phaseSync, phraseSync, workletEngine + worklets, schedulerWorker,
harmonyEngine, melodyEngine, flowEngine, layerEngine, callResponseEngine,
musicalDirector (as code), styleClassifier, vocabularyLearner, soundBank (both repos),
websocket example. Reasons: dead code / untested / product-specific / duplicate engine /
contract-forbidden, per the classes above.
