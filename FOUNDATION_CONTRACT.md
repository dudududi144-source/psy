# FOUNDATION_CONTRACT.md
Boundary contract between PSY4 (Foundation Lab / Systems Factory) and PSY (canonical product).

Status: PROPOSED-AGREED at foundation gate. Nothing in this document adds runtime code.
Grounding: every ownership claim below is justified by verified code facts from
CROSS_REPO_AUDIT.md and FOUNDATION_CONSUMER_FREEZE.md, not by names or intent.

## Roles
- psy4 = laboratory / reusable infrastructure / verification factory. NOT a product.
- psy  = canonical musical product (PSY-6 groovebox mainline, single-file runtime, v4.0-m2-song).
- Repositories are NOT merged. psy becomes the first CONSUMER of verified foundation
  components produced by psy4.

## PSY4 MAY PROVIDE (foundation candidates, subject to FOUNDATION_VERSION.md gates)
- MusicalTransport (estimator + transport contract implementation)
- BeatPLL / beat estimation primitives (psy4 BeatPLL R1 is the starting candidate)
- RadioStateGate (observation gating/quality; to be built, contract-first)
- MelodyObserver (only after verified observation contract + tests)
- deterministic timing utilities (synthetic beat streams, phase-error metrics)
- DSP primitives (filters, envelopes, analysis windows)
- deterministic PRNG (must be built + tested; psy4 currently uses Math.random in places)
- pattern transformation primitives (transpose/invert/retrograde/displace/fragment/scaleDuration)
- forensic test harnesses (psy4 forensic offline renderer / quality score, after extraction)
- voice pooling primitives ONLY if eventually verified
- future Worklet-based observation primitives ONLY after the deterministic observation
  contract exists and is tested (see Worklet policy below)

## PSY4 MUST NOT PROVIDE
- product UI
- product-specific song arrangement (SECTION_TEMPLATE belongs to psy)
- product-specific presets / sound banks
- product-specific groovebox behavior (K-B-B-B gallop, fills, drops are psy behavior)
- product-specific branding
- product scheduler ownership (psy owns integration of scheduling)
- product state ownership (song model, themes, arrangement, UI state live in psy)
- duplicate musical engines (psy4EngineV2 and any "engine" class are NOT foundation)

## PSY OWNS
- product runtime (single-file index.html)
- song model (buildSong), themes (buildTheme/resolveThemeBar), sections (SECTION_TEMPLATE)
- arrangement decisions and energy automation
- musical composition plans (future composer lives in psy, consumes foundation)
- UI (transport UI, timeline, step editor, pads, feedback)
- product scheduler integration (psy decides WHEN to ask transport; psy schedules audio)
- product-level state (mutes, knobs, variation seed, section position)
- user interaction and feedback collection

## Justification from actual code (not assumptions)
- psy4 live runtime = PsyLive (page.tsx imports only psyLive). studio/engine/* (82KB
  musicalDirector, 262KB psy4EngineV2, analyzers, classifiers, learners, worklet code)
  is NOT imported by any live path and has ZERO tests -> NOT foundation material as-is.
- psy4 BeatPLL (beatPLL.ts, R1) IS wired into PsyLive, operates on AudioContext time,
  has a clean class API (update/getClock/predictBeats/reset) -> foundation CANDIDATE,
  but it has ZERO tests and lacks gap/unlock/latency semantics -> not consumable yet.
- psy mainline (verified freeze) owns buildSong/themes/SECTION_TEMPLATE/UI/scheduler.
  Everything listed under "PSY OWNS" exists in psy's index.html today.
- phaseSync.ts / phraseSync.ts in psy4 are 9-byte empty stubs -> names lie; ARCHIVE.

## Admission rule (mirrors FOUNDATION_VERSION.md)
VERIFIED + GENERIC + TESTED = candidate foundation component.
CLAIMED + UNTESTED = NOT foundation.
DEAD CODE = NOT foundation.
Nothing is ported merely because it exists.

## Timing rule (invariant, enforced by consumer contract tests)
Observation Clock -> Musical Transport -> Local Scheduler.
- Radio is an OBSERVER. It produces timestamped observations in AudioContext time.
- Transport is the MUSICAL TIME MODEL. Sole owner of bpm/beat/bar/phase.
- Scheduler schedules AudioContext events from transport predictions.
NEVER: Radio -> scheduler directly.
NEVER: setInterval -> musical time (timers wake; they are not clocks).
NEVER: Date.now()/performance.now() -> musical position.

## Worklet policy (this gate)
- DO NOT port WorkletEngine (psy4 has no production worklet path — verified).
- DO NOT create a fake Worklet.
- DO NOT claim radio observation is solved (it is not; confidence semantics conflict).
- Future pipeline: audio input -> AudioWorklet observation -> timestamped observations
  -> BeatPLL/estimator -> MusicalTransport -> product scheduler.
- Only the layer whose contract is verified gets implemented. Next layer: deterministic
  observation/estimator contract + tests A-J (PSY6_ARCHITECTURE.md section 6).

## ARP / M2 migration contract (Step 7 result)
Verified state: buildSong is canonical; makePatterns still exists; device.patterns still
generated (constructor + variate); ARP reads this.patterns.arp[absStep%16].
Classification: MIGRATION_REQUIRED.
Migration contract (executed in P1, NOT in this gate):
1. Add arp phrase generation to the song model (theme-derived per section; reuses the
   existing transform primitives; deterministic per song seed).
2. Point scheduler ARP reads at the song model.
3. Update the 22-test suite: replace arp-pattern expectations with song-model assertions;
   add arp determinism + per-section variation tests. Tests must be green BEFORE deletion.
4. ONLY THEN delete makePatterns and device.patterns.
5. No deletion to make architecture look clean. Migration must be proven at every step.

## SECURITY (gate rule — applies to BOTH repos)
- PSY4 and PSY must NEVER exchange credentials as part of foundation integration.
- No credentials in code, docs, reports, commit messages, or remote URLs.
- No GitHub tokens embedded in remote URLs anywhere in either repo.
- Foundation integration exchanges only: versioned APIs, tests, and documentation.
- Open incident: leaked credential file (turso.txt: turso/cloudflare/github/supabase)
  from a chat session. Status: ROTATION REQUIRED. Tracked separately from this contract.
- Reports must never print secrets.

## Gate stop condition
This gate adds ONLY: architecture documents, contracts, matrices, deterministic contract
tests, documentation, audit reports. It adds NOTHING to any runtime. P1 implementation
(transport code, worklet, radio, new PLL, new scheduler, product refactor, AI, learning,
multi-device, new musical engines) is NOT started until this contract gate is green and
both repos agree on the contract.
