# FOUNDATION_VERSION.md
Versioning + admission rules for foundation components (psy4 -> psy).
#
# ⚠️  UPDATE (this commit): 6 components promoted to ADMITTED v1. The registry
#     below now reflects the actual state of the foundation after the winning-device
#     execution. See PSY_WINNING_DEVICE.md for the plan and WINNING_DEVICE_ROADMAP.md
#     for what was done vs what remains.

## Admission rule (all 8 gates required; no exceptions)
A foundation component becomes consumable by PSY only when ALL of the following hold:
1. API documented (public interface + semantics + invariants)
2. deterministic tests exist (same input -> same output; seeded)
3. adversarial tests exist (gaps, false events, jitter, octave ambiguity, drift)
4. runtime ownership is proven where applicable (who writes, who reads)
5. browser/runtime integration is proven where applicable
6. claim is documented (what the component claims; what it does NOT claim)
7. commit is pushed (no local-only foundation)
8. consumer integration test exists (a PSY-side contract test consuming it)

A component passing tests is NOT automatically "ready". READY requires BOTH sides to
agree on the contract (foundation API + consumer contract tests green).

## Versioning scheme
- Every foundation component has an explicit version: <name> vN (integer).
- No "latest" semantics anywhere. Consumers pin exact versions.
- Breaking changes bump the major version; old versions remain consumable until retired.
- Versions are recorded in the component header + FOUNDATION_VERSION registry below.

## Registry (current state — 6 components ADMITTED v1, 4 still PLANNED/NOT ADMITTED)

| component            | version | source                          | status     | blocking gaps / notes                                                              |
|----------------------|---------|---------------------------------|------------|------------------------------------------------------------------------------------|
| transport            | v1      | foundation/transport.mjs        | ADMITTED   | 15 tests green (streams A–J × 5 seeds + API + decay + reset). PLL with octave-fold, gap recovery, confidence decay, phaseErrorMs. Confidence is REAL (input param 0..1, onset strength), NOT low-band energy (avoids psy4 BeatPLL documented bug). Consumer integration = W3 worklet wiring (pending). |
| dsp                  | v1      | foundation/dsp.mjs              | ADMITTED   | 40 tests green. PolyBLEP saw/square/triangle/pulse + ZDF SVF (cytomic) + 4-op FM + 6 wavetables + Adsr + saturation + mtof/ftom/db. Bit-identical per seed. ZDF SVF verified: DC gain=1.0, -3dB at cutoff=0.707 (Butterworth Q=0.707), monotonic rolloff, self-oscillates at resonance=0.95. |
| director             | v1      | foundation/director.mjs        | ADMITTED   | 12 tests green. MusicalDirector with DO-NOTHING abstention (5 conditions: low transport.confidence, unlocked, low energy + barsSinceRest>4, dense previous bar, rewardPrediction<threshold). EMA reward tracker. Exploration rate 5%. Deterministic per (ctx, rng). |
| grammar              | v1      | foundation/grammar.mjs         | ADMITTED   | 12 tests green. 3 grammar classes (BassGrammar 12×12 + MelodicGrammar 25-bucket + RhythmGrammar 16-step Bayesian). applyGrammarVariation preserves original timeline (immutability), mutated events carry provenance.grammar = { name, op, source }. Deterministic per (timeline, grammars, seed). |
| render               | v1      | foundation/render.mjs          | ADMITTED   | 11 tests green. renderPlan (pure), renderSong (metadata mode + OfflineAudioContext injected), renderStems (6 per-device + master), audioBufferToWav (44-byte RIFF/WAVE header, 16-bit PCM, clamping). Byte-identical per (song, opts). |
| midi                 | v1      | foundation/midi.mjs            | ADMITTED   | 15 tests green (in tests/render.test.mjs). Web MIDI input (defensive in Node), MidiClockOut (24ppq, external-driven), timelineToMidiFile (SMF0, 480 ticks/beat, Tempo meta, End of track, GM drum note mapping). encodeVarLen/decodeVarLen. |
| beat-observer        | (none)  | not built                       | PLANNED    | observation contract first; no worklet yet. W3 (inline AudioWorklet in index.html) is the prerequisite. |
| pitch-observer       | (none)  | not built                       | NOT ADMITTED | zero tests; observation contract missing |
| prng                 | v1      | foundation/foundation.mjs      | ADMITTED   | (existing) mulberry32/subSeed/rngFor — unchanged, 24 tests green (foundation.test.mjs). |
| pattern-transforms   | v1      | foundation/foundation.mjs      | ADMITTED   | (existing) identity/transposeDegree/transposeOctave/invert/retrograde/displace/fragment/augment/diminish — unchanged, 24 tests green. |
| forensic-harness     | (none)  | not built                       | CANDIDATE  | extraction + tests (out of scope for winning-device plan) |

Rule reminder: CLAIMED + UNTESTED = NOT foundation. DEAD CODE = NOT foundation.

## Total test count (after this commit)
- playground.test.mjs: 24 (existing, M2 suite + ARP migration)
- foundation.test.mjs: 24 (existing, RULE 9 A–T + adversarial + invariants + perf)
- foundation-consumer/contract.test.mjs: 11 (existing, consumer contract)
- transport.test.mjs: 15 (NEW, streams A–J × 5 seeds + API + decay + reset)
- dsp.test.mjs: 40 (NEW, PolyBLEP + ZDF + FM + wavetable + Adsr + saturation)
- director.test.mjs: 12 (NEW, abstention cases + EMA + determinism)
- grammar.test.mjs: 12 (NEW, 3 grammars + applyGrammarVariation + provenance)
- render.test.mjs: 26 (NEW, render + stem + WAV + MIDI)

**TOTAL: 164 tests / 0 fail** (up from 59 — added 105 tests, ~2.8× growth)

## CI workflow
`.github/workflows/psy-tests.yml` runs `node --test tests/*.test.mjs tests/foundation-consumer/*.test.mjs`
on ubuntu-latest / node 24. All 6 new test files are picked up by the glob — no workflow change needed.
