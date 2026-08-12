# P1_MUSICAL_FOUNDATION_REALITY_REPORT.md (RULE 13)
Gate P1 complete on main. Evidence-backed; no untested claims.

## What was actually built (all committed + CI-green)
- foundation/foundation.mjs (28.4KB, pure ESM, zero deps): canonical PRNG (mulberry32/subSeed/rngFor),
  scales + degree resolution, Motif validation, Transform registry (identity/transposeDegree/
  transposeOctave/invert/retrograde/displace/fragment/augment/diminish — data-driven, composable,
  unknown-op errors), Song validation, sectionAt, product musical rules (bass styles, fills,
  pre-drop gate, energy curves as intent), resolvePhraseBar, **resolveSong(song) -> MusicalTimeline**
  (kick/bass/perc/lead/arp/pad events in beat coordinates, provenance on every event, frozen),
  **contextAt(song, beat) -> MusicalContext**, serializeTimeline/parseTimeline + replay identity.
- FOUNDATION_MUSICAL_API.md — canonical contract.
- audit-reports/P1_MUSICAL_FOUNDATION_FORENSIC_REVIEW.md — 17-question code-verified review.
- CI: .github/workflows/psy-tests.yml (main + m2-song, node 24) runs ALL suites.

## What was reused (not rewritten)
- M2 Song/Theme model (buildSong/buildTheme/resolveThemeBar/SECTION_TEMPLATE) — confirmed canonical
  by forensics, kept as-is; foundation extracts the same logic with identical sub-seed consumption
  (theme parity product<->foundation by construction).
- mulberry32/subSeed — adopted as canonical PRNG unchanged.
- transforms from M2 — formalized into the registry (behavior preserved; displace's mid-event
  wrap edge-case hardened).

## What was migrated (RULE 2)
- ARP moved into the canonical Song model: song.arpPhrase (buildArpPhrase(seed), sub-seed "arp",
  pool [0,1,2,4,7], deterministic). scheduleStep consumes song.arpPhrase; step editor edits it.
- Migration test proves: arpPhrase canonical + deterministic + DROP bar events == phrase gates.

## What was retired
- makePatterns() — deleted (brace-verified: 0 references remain).
- device.patterns / this.patterns — deleted (0 references remain).
- Single musical representation achieved: Song only. No parallel model created (RULE 2 verified).

## Test counts (CI run 31615445290, commit b96990ae2c07, ubuntu-latest node 24)
- Total: **59 pass / 0 fail**
  - tests/playground.test.mjs: 24 (M2 suite 22 + P1 ARP migration 2)
  - tests/foundation.test.mjs: 24 (RULE 9 A–T + adversarial + invariants + perf)
  - tests/foundation-consumer/*: 11 (consumer contract; reference transport reads fixed to be pure)

## Deterministic replay evidence
- Test P: resolve(song,{bars:48}) -> serialize -> parse -> re-resolve, 10 generations, byte-identical.
- Test J: same seed -> identical timeline (serialize equality).
- Test I: same seed -> identical song (deep equality), independent rng streams per (seed,label).
- Test Q: serialization round-trip preserves meaning; malformed versions rejected.
- Source-scan test (S/T): foundation contains no Math.random / Date.now / performance.now /
  setInterval / setTimeout / AudioContext / AudioWorklet / navigator (comments stripped before scan).

## Performance measurements (CI log, ubuntu-latest node 24)
- small (8 bars): 48 events / <1ms
- medium (176 bars, full song): 4,320 events / 8ms
- large (1,408 bars): 34,560 events / 87ms
- 2,000 transform chains (invert+retrograde+transpose): 14ms
No premature optimization applied; these are first-pass numbers.

## Known limitations
- arpPhrase is one 16-step phrase shared by DROP/DROP2 (same as pre-migration behavior; variation
  between drops comes only from drop2 root offset). Per-section arp variation = future work.
- Foundation is a reference implementation + contract; product index.html keeps its own inline copy
  of the model logic (single-file constraint). Shape parity is enforced by tests on both sides,
  not by shared code.
- resolveSong covers WHAT (musical intent in beat coordinates). Swing/latency/audio-time scheduling
  remain the product/psy4 side by design (WHEN/HOW boundary).
- Energy curves ship as musical intent; automationFromEnergy (audio-parameter mapping) stays in the
  product (audio concern).

## Deliberately NOT implemented (RULE 14 + gate scope)
- Composer, AI/MotifLearner, learning/memory (P3/P7), harmony progression model,
  AudioWorklet observation, radio integration, psy4 transport consumption, multi-device protocol.
  Integration into psy4 = separate gate.

## Boundary (RULE 11) — verified
- foundation/ imports NOTHING from psy4; no AudioContext/React/wall-clock/scheduler anywhere
  (source-scan tested). psy4 consumes MusicalEvent/MusicalTimeline later via the documented contract.
