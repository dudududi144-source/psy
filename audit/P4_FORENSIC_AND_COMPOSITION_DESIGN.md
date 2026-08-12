# P4 - FORENSIC VERDICT + COMPOSITION REBUILD DESIGN

## RULE 0 - Baseline (verified)
- HEAD main: 2ff677936d12 ("feat(P2): foundation/music/planner.mjs")
- CI: psy-tests + pages = success at HEAD
- foundation/: foundation.mjs, music/{context,memory,motif,planner,policy}.mjs
- NO foundation/learning/ exists. NO audit/ dir. NO committed 64-bar reality report.
  => The "P3 64-bar reality test" was never actually executed and committed. That itself is a finding.

## RULE 1 - What can the foundation ACTUALLY decide today?
Given (seed + song + style + BPM + key + scale + N bars):
- It CAN: pick a motif from a theme-derived pool, choose a bass MODE at random, lay a
  tension/density curve, emit lead/bass/drum events per bar.
- It CANNOT: decide a form with purpose, plan harmony before melody, make bass follow a
  chord, plan a cadence, decide who stays silent, or plan return/reprise.

## DATA FLOW (actual today) with ownership

    INPUT (seed,song,style,bpm,key,scale,N)
      -> MUSICAL STATE   : createMusicalContext   (knows position/pressure; NOT harmony goals)
      -> COMPOSITION     : developSong            (flat; picks motif via cursor + policy action)
      -> HARMONY         : NONE REAL              (chordDegrees copied from context default [0,4]; decorative)
      -> GROOVE          : planDrumBar(density rng) (no kick/backbeat grammar; not composition-owned)
      -> BASS            : planBassBar(random MODE) (does NOT know the chord)
      -> MELODY          : expandMotifToBar(pool)  (does NOT know chord or phrase target)
      -> ARRANGEMENT     : none (no role plan, no abstention)
      -> MUSICAL EVENTS  : bars[] emitted directly from generators

Conflicts: bass MODE is random per bar and independent of harmony; melody motif chosen by
cursor independent of harmony and of what the previous phrase did. Harmony is downstream
decor, not upstream cause.

## RULE 3 - Honest P3 answers (from reading planner.mjs, not from numbers)
1.  Motifs recur meaningfully? NO - pool reuse via cursor, no identity tracking (A, A-prime, A-double-prime, B).
2.  Transformations retain identity? Partially (transforms exist) but selection not identity-driven.
3.  Phrase knows previous? NO (relation string stored, not used).
4.  Phrase knows where it goes (cadence target)? NO.
5.  Cadence exists? NO.
6.  Harmony before melody? NO (harmony is decorative).
7.  Groove part of composition? NO (density rng).
8.  Bass depends on harmony? NO (random MODE).
9.  Melody depends on harmony+phrase? NO.
10. Sections musically different? Only via tension/density numbers, same material pool.
11. Return/reprise? NO real reprise.
12. Intentional repetition? Only cursor reuse.
13. Intentional silence? NO.
14. Climax/release? Only as numbers, not constraining.
15. A recognizable musical idea across 64 bars? NO - diversity, not composition.

## VERDICT
The current foundation is a FLAT seeded generator wearing hierarchical names. Per RULE 15,
it must be REBUILT around a true hierarchical CompositionPlan, not layered over.

## REBUILD: target hierarchy (RULE 2, 4, 5)

    SongForm (sections, purpose, energy/tension/density arcs, return+transition points)
      -> SectionPlan (role, length, purpose)
        -> PhrasePlan (role, relation-to-previous, motif identity, harmonic context,
                       cadence target, development strategy, register, rest strategy)
          -> HarmonyPlan (chord progression, harmonic rhythm, functional role, chord tones,
                          tension tones, cadence, next-chord expectation)   <-- BEFORE melody
          -> GroovePlan (kick grammar, backbeat, hat grammar, syncopation, swing, fills,
                         groove density, phrase-ending behavior)
          -> InstrumentRolePlan (FOUNDATION/BASS/HARMONY/MOTIF/LEAD/COUNTER/TEXTURE/TRANSITION,
                                 including WHO STAYS SILENT)
      -> CompositionPlan (form + sections + phrases + harmony + groove + activeMotif +
                          motifHistory + instrumentRoles + tension/energy/density + cadenceTargets)
        -> arrangement -> voices -> MusicalEvent[]

Style = grammar (groove family, harmonic vocabulary, bass behavior, melodic behavior,
phrase behavior, register, syncopation, cadence, arrangement, variation limits, energy response).
Motif memory = RECOGNIZE -> REUSE -> DEVELOP -> CONTRAST -> RETURN (A, A-prime, A-double-prime, B, B-prime, A-return).
Learning must change future decisions (observation -> feature -> weight -> decision), not just count.

## CONSUMER CONTRACT (RULE 13)
psy-foundation owns WHAT (intent/form/harmony/groove/motif/phrase/arrangement/musical events).
psy4 owns WHEN (transport/scheduling/AudioContext/radio/runtime/playback).
psy4 must never have to invent composition to consume the foundation.
