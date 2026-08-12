# FOUNDATION_VERSION.md
Versioning + admission rules for foundation components (psy4 -> psy).

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

## Registry (current state: NOTHING promoted yet)
| component | version | source | status | blocking gaps |
|---|---|---|---|---|
| transport | (none yet) | psy4 BeatPLL R1 + PSY6_ARCHITECTURE contract | CANDIDATE | tests A-J; gap/unlock; confidence decay; phaseErrorMs exposure; latency model; consumer contract tests |
| beat-observer | (none yet) | not built | PLANNED | observation contract first; no worklet yet |
| pitch-observer | (none yet) | psy4 melodyObserver (unverified) | NOT ADMITTED | zero tests; observation contract missing |
| prng | (none yet) | psy uses inline mulberry32; psy4 uses Math.random | TO BUILD | extract + deterministic tests |
| pattern-transforms | (none yet) | psy M2 transforms (in-product today) | CANDIDATE | extract + tests; product currently owns |
| forensic-harness | (none yet) | psy4 forensic/* (server-side tooling) | CANDIDATE | extraction + tests |

Rule reminder: CLAIMED + UNTESTED = NOT foundation. DEAD CODE = NOT foundation.
