# FOUNDATION_MUSICAL_API.md — canonical musical contract (P1)

Status: AGREED by forensic review (audit-reports/P1_MUSICAL_FOUNDATION_FORENSIC_REVIEW.md).
Scope: psy repo only. Imports NOTHING from psy4 (RULE 11). No AudioContext, no React,
no wall-clock, no setInterval, no scheduler state, no radio state — pure data + pure functions.

## Boundary in one line
psy-foundation decides WHAT happens (musical intent, beat coordinates).
psy4 (later) decides WHEN (transport) and HOW (rendering). The boundary object is
MusicalEvent / MusicalTimeline: JSON-able, immutable, deterministic.

## Canonical object set (minimum set — RULE 1)
Song, Motif, Transform, MusicalEvent, MusicalTimeline, MusicalContext.
(Phrase is NOT an object — it is an index+op over a theme's phrasePlan, carried in
event provenance. Section is data inside Song, not a standalone class.)

## Song (canonical, validated, frozen on construction by foundation)
{
  seed: int, root: int(midi), bpm: number, styleScale: scaleName,
  modes: { sectionModeKey -> scaleName }, drop2RootOffset: 0|2,
  sections: [ { name, bars:int>0, themeKey, mode, bassStyle, rootOffset } ],
  sectionStarts: [int], totalBars: int,
  themes: { themeKey -> Theme }, arpPhrase: [16] (null | {deg:int})
}
Theme: { themeKey, rootMidi, scaleKey, register, cellLen, seedCell: Motif, phrasePlan: [Transform] }
validateSong(song) throws FoundationError on malformed shape. Foundation-built songs are
deep-frozen. (Product index.html keeps its own builder — single-file constraint; shape
identity enforced by contract tests on both sides.)

## Motif (degree space)
[ { deg:int, oct:int, dur:int>=1, accent:0..1, rest:bool } ]
Rests carry no pitch (no midi on render — enforced by test).
validateMotif throws on malformed events (non-integer deg/oct/dur, dur<1, accent out of
range, non-boolean rest, empty array).

## Transform (data-driven, registry, composable)
Transform = { op: string, params?: object }
Registry ops: identity, transposeDegree{n}, transposeOctave{n}, invert, retrograde,
displace{steps}, fragment{start,len,repeats}, augment, diminish.
applyTransform(motif, t): pure, returns NEW motif (input never mutated);
unknown op -> FoundationError("unknown transform: <op>").
applyTransformChain(motif, [t1,t2,...]) = left fold.
Invariants (tested): invert(invert(m)) == m; retrograde(retrograde(m)) == m;
all transforms preserve total duration except augment/diminish (by definition);
fragment output length == len*repeats events; all outputs pass validateMotif.

## MusicalEvent (musical intent — NEVER audio)
{
  id: "voice:bar:step:seq",          // deterministic, unique per timeline
  voice: "kick"|"bass"|"perc"|"lead"|"arp"|"pad",
  beat: number,                       // quarter-note coordinates, >= 0
  durationBeats: number >= 0,
  midi: int|null,                     // null for unpitched (kick/perc)
  pitchClass: int|null,
  velocity: 0..1, accent: 0..1,
  bar: int, step: int (0..15),
  section: { name, index },
  phrase: { index, op } | null,
  motifTheme: themeKey | null,
  provenance: { songSeed, label, op?: string },   // RULE 7 — explainability
  meta: {}                            // voice-specific (pad chordIndex, perc type, slide intent)
}
Frozen (Object.freeze). Mutation attempts throw in strict mode (tested).
MusicalEvent must NEVER contain: audioTime, ctx/nodes, Date values, setTimeout/setInterval
handles, React anything, radio/analyser state. Enforced by source-scan test (RULE 9 S/T).

## MusicalTimeline
{ version:"1.0", songSeed, params:{bars}, lengthBeats, eventCount, events:[MusicalEvent] }
events sorted by beat (stable within step: kick, perc, bass, lead, arp, pad). Deep-frozen.
Determinism contract: resolveSong(song, params) identical for identical (song, params).

## MusicalContext (RULE 6 — answers "where am I musically", owns NO timing)
contextAt(song, beat) -> frozen {
  beat (wrapped into song loop), bar, step, barInSection, barInTrack,
  section:{name,index}, phraseIndex, planOp, key, mode, scaleName, scale
}
beat < 0 -> FoundationError. beat >= length wraps (loop semantics, documented).

## PRNG (RULE 4 — canonical randomness)
mulberry32(seed:int) — throws on non-integer seed. subSeed(parentSeed:int, label:string) —
throws on invalid args. rngFor(parentSeed,label). No global mutable random state; every
consumer gets an independent stream keyed by (seed,label). Math.random forbidden in
foundation (source-scan tested).

## Resolver (RULE 3)
resolveSong(song, params={bars?}) -> MusicalTimeline.
Covers the existing proven structures: four-on-floor kick (section-gated), bass styles
(gallop/offbeat/pumping/pedal with passing tones + octave lift + bar-aware pickup),
perc (claps/shakers/openhats + snare fills + pre-drop held-breath gate), lead (theme
phrase-plan resolution incl. displace/transpose/invert), arp (song.arpPhrase, DROP/DROP2),
pad drone (root+5th+oct, every 2 bars).
Excluded by design (belongs to WHEN/psy4): swing, latency, audio time, scheduling.

## Serialization / replay (RULE 8)
serializeTimeline(tl) -> JSON string; parseTimeline(json) -> validated, re-frozen timeline.
Replay = resolve identity: resolve(song,p) === resolve(song,p) byte-identical after any
number of serialize/parse cycles (tested x10 generations).

## Provenance (RULE 7)
Every event answers "where did this come from": songSeed + subSeed label + phrase op +
themeKey (lead/arp) or grid label (kick/perc/bass/pad). Enough to reconstruct the decision
chain; nothing more (no over-engineering).

## Non-goals (deliberately NOT in P1)
Composer, AI, MotifLearner, learning/memory, harmony progression model, swing/timing,
audio rendering, psy4 transport consumption, multi-device protocol. (RULE 14: integration
is a separate gate.)
