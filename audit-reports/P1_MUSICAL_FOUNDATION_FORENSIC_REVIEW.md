# P1_MUSICAL_FOUNDATION_FORENSIC_REVIEW.md
Gate: P1 — canonical musical model + deterministic timeline.
Method: GitHub Contents API re-fetch of main (HEAD a8c39d35d225) + marker grep of index.html
(blob 3bfa1b106897, 58,871B, version marker 4.0.0-m2-song) + cross-check against
CROSS_REPO_AUDIT.md, PSY6_ARCHITECTURE.md, FOUNDATION_CONTRACT.md, FOUNDATION_VERSION.md,
FOUNDATION_CONSUMER_FREEZE.md, TRANSPORT_CONTRACT_COMPARISON.md.
Architecture docs were NOT assumed correct; every claim below verified against code markers.

## Verified inventory (index.html @ main)
Present (marker grep): buildSong, sectionAt, makePatterns, subSeed, rngFor, mulberry32,
stableDegrees, transposeDegree, invert, retrograde, displace, fragment, scaleDuration,
resolveThemeBar, buildTheme, buildTransitionTheme, generateBassBar, applyFill,
isPreDropSilenceBar, preDropGate, isSectionDownbeat, EnergyCurves, automationFromEnergy,
SECTION_PARTS, SECTION_TEMPLATE, SCALES, STYLE, degreeToSemitone, cloneEv.
Counts: Math.random x1 (makeNoiseBuffer — noise timbre only), Date.now x1 (trackEvent
telemetry), setInterval x1 (scheduler wake), AudioContext x5 (runtime audio only).
No SECTIONS/afHz/advanceBar/applySection (M1 removed — verified gone).

## Answers to the 17 questions

### 1. Current canonical Song representation
buildSong(seed, opts) -> song { seed, root(33), bpm, modes{}, drop2RootOffset,
themes{A,A2,B,transition}, sections[7], sectionStarts[], totalBars=176 }.
theme = { themeKey, rootMidi, scaleKey, register, cellLen, seedCell, phrasePlan[4] }.
seedCell (motif) = [{deg, oct, dur, accent, rest}] in scale-degree space, dur in 16th steps.
phrasePlan ops observed in code: identity, displace, transposeDegree, invert.
This IS the de-facto canonical representation today.

### 2. What is runtime-connected
scheduleStep consumes: sectionAt, resolveThemeBar (lead), generateBassBar (bass),
inline perc rules (clap/shaker/oh + fills + pre-drop gate), patterns.arp (ARP only),
pad hardcoded [root+12,+19,+24]. onBar consumes sections for gains + energy automation.
Timeline UI + seekToBar consume sectionStarts. So song -> scheduler IS wired for
kick/bass/perc/lead/pad. ARP is the ONE part still outside the song model.

### 3. What is library-only (defined, never called by any phrasePlan)
retrograde, fragment, scaleDuration (augment/diminish ops exist in resolveThemeBar switch
but no plan uses them), transposeOctave. These are unverified-by-usage library code.

### 4. What is duplicated
makePatterns() + device.patterns (kick/bass/perc/lead/arp/pad flat patterns) duplicates
buildSong. Live consumption: ONLY patterns.arp. patterns.kick/bass/perc/lead/pad are
generated but NEVER read (dead). generateBassBar replaced flat bass; perc is inline rules.

### 5. Single source of truth (decision)
buildSong/Song model. makePatterns + device.patterns RETIRE after ARP migration (RULE 2).

### 6. Where musical time enters the model
It does NOT. Song is clock-free: bars/steps are integers; themes resolve by barInSection.
Time enters only at scheduleStep (absStep) in the product scheduler. This is correct and
must be preserved: foundation events live in beat coordinates, never audio time.

### 7. Random/non-deterministic behavior
All musical randomness flows through rngFor(seed, label) = mulberry32(subSeed(seed,label))
with stable labels: "theme:A","theme:A2","theme:B","theme:transition","drop2mod","bar:N".
Math.random occurs ONLY in makeNoiseBuffer (audio noise timbre — not musical content).
Date.now ONLY in trackEvent (telemetry). No wall-clock in any musical decision. Verified.

### 8. Same Song + seed -> same result?
YES for the model: buildSong(seed) identical across calls (tested in M2 suite),
resolveThemeBar(theme, bar) pure, generateBassBar(style,root,scale,barIndex,rng) pure.
Caveat: scheduleStep mixes song + product rules + swing; full musical determinism holds
given (song, seed, bpm, swing) — but no single resolver reproduces it today. P1 builds it.

### 9. Motif representation
Array of events {deg:int (scale degree, can index across octaves via SCALE_EXT),
oct:int, dur:int (16th steps), accent:0..1, rest:bool}. Rests carry no midi (contract
enforced by M2 test "rests carry no midi"). Degree-space => mode-swappable.

### 10. Transformation representation
Ad-hoc pure FUNCTIONS today (transposeDegree/invert/retrograde/displace/fragment/
scaleDuration) + phrasePlan references them by string op name. NOT data-driven, no
registry, no unknown-op handling, no compose/chain, no provenance. P1 formalizes.

### 11. Harmony / key / mode
root=33 constant; SCALES{naturalMinor,harmonicMinor,phrygian,phrygianDominant,
doubleHarmonic,minorPentatonic}; per-section mode via buildSong.modes map
(intro:phrygian, drop:phrygianDominant, break:harmonicMinor, riser:phrygian,
drop2:phrygianDominant). degreeToSemitone resolves degree->semitone per scale.
No chord/harmony model beyond hardcoded pad drone [0,7,12] offsets. Harmony = drone+mode.

### 12. Sections/phrases -> musical time mapping
sections[].bars + sectionStarts[] -> absolute bar offsets; sectionAt(song, absBar) ->
{section, sectionIndex, barInSection, barInTrack}. Phrase position = barInSection %
phrasePlan.length (4-bar phrase cycle). No sub-bar phrase model. Beat = bar*4 + step/4.

### 13. What can be preserved (extract as-is into foundation)
mulberry32/subSeed/rngFor (canonical PRNG); SCALES/degreeToSemitone/stableDegrees/cloneEv;
transposeDegree/invert/retrograde/displace/fragment/scaleDuration (as pure transform lib);
buildTheme/resolveThemeBar resolution approach; SECTION_TEMPLATE + sectionAt; generateBassBar;
applyFill/isPreDropSilenceBar/preDropGate/isSectionDownbeat; EnergyCurves (as intent data).

### 14. What must be rewritten
Transforms: functions -> data-driven registry ({op, params}) + compose + unknown-op error.
Resolution: mixed inline logic in scheduleStep -> single pure resolver Song -> Event[].
Missing entirely: provenance, serialization, replay harness, event immutability convention.

### 15. What must be retired
makePatterns + device.patterns (AFTER ARP migration — RULE 2). M1 leftovers already gone.
Library-only transforms are NOT retired — they become foundation transforms (now tested).

### 16. Clean boundary psy <-> psy4
Per FOUNDATION_CONTRACT (verified doc): psy (this repo) owns song model, arrangement,
product scheduler integration. psy4 provides primitives only after 8-gate admission
(FOUNDATION_VERSION registry: NOTHING promoted yet). P1 foundation/ lives INSIDE psy and
imports NOTHING from psy4 (no Transport/AudioContext/React/worklet). The boundary object
exposed for future psy4 consumption: MusicalEvent / MusicalTimeline (pure JSON-able data).

### 17. Smallest high-value P1 deliverable
foundation/foundation.mjs (pure, zero deps, node-runnable): canonical PRNG + transform
registry + song validation + deterministic resolver resolveSong(song) -> MusicalTimeline
(kick/bass/perc/lead/arp/pad events in beat coordinates, provenance on every event) +
MusicalContext resolver + JSON round-trip + replay identity. THEN ARP migration in
index.html (RULE 2), then CI on main, then reality report. No composer, no AI, no audio.

## STOP-check
Architecture IS clear (verified against code, docs consistent with code). Proceeding to RULE 1.
