# PSY — Winning Device of the PSY Family

> **🔗 LIVE SITE: https://dudududi144-source.github.io/psy/**
>
> Click the link, press PLAY, watch the AudioWorklet scheduler lock the PLL in real-time.
> No localhost, no build step — it's a single HTML file served by GitHub Pages.

## What this is

PSY is the canonical psytrance groovebox of the PSY family — a single-file
`index.html` (no build step, no framework, no server) that runs entirely in the
browser. It's also the **winning device**: the only repo in the 13-member PSY
family that combines all of:

- ✅ Real **AudioWorklet** scheduler in the live audio path (replaces `setInterval`)
- ✅ **PolyBLEP + ZDF SVF + FM + wavetable** DSP primitives (40 tests)
- ✅ Real **MusicalTransport PLL** with octave-fold, gap recovery, confidence decay (15 tests A–J × 5 seeds)
- ✅ **MusicalDirector** with DO-NOTHING abstention (5 conditions)
- ✅ **3 grammar classes** (BassGrammar + MelodicGrammar + RhythmGrammar) with provenance
- ✅ **Offline WAV render** + per-device stem export + byte-identical per seed
- ✅ **MIDI clock out** (24ppq) + **SMF0 file export** (480 ticks/beat)
- ✅ **PWA** (installable, offline-capable, self-diagnosing)
- ✅ **164 tests** (was 59 — 2.8× growth; first deterministic timing tests A–J in the family)

## Live URLs

| What | URL |
|------|-----|
| **The groovebox** | https://dudududi144-source.github.io/psy/ |
| **Dashboard** | https://dudududi144-source.github.io/psy/WINNING_DEVICE_DASHBOARD.html |
| **The roast** | https://dudududi144-source.github.io/psy/ROAST.md |
| **The plan** | https://dudududi144-source.github.io/psy/PSY_WINNING_DEVICE.md |
| **The roadmap** | https://dudududi144-source.github.io/psy/ROADMAP.md |

## How to use the live site

1. Open https://dudududi144-source.github.io/psy/
2. Click **▶ PLAY**
3. Watch the **MusicalTransport** panel — the PLL locks (`locked: true`, `conf: ~0.83`)
4. Watch the **MusicalDirector** panel — it decides `PLAY` (green) or `ABSTAIN` (red) per bar
5. Click **↯ GRAMMAR VARIATION** — the arp pattern mutates via the grammar classes
6. Click **⬇ RENDER WAV** — downloads a 4-bar `.wav` file
7. Click **⬇ EXPORT MIDI** — downloads a 4-bar `.mid` file (SMF0, 480 ticks/beat)
8. Open browser console — you'll see `[PSY P4] AudioWorklet scheduler started (replaces setInterval)`

## Run locally (optional)

```bash
git clone https://github.com/dudududi144-source/psy.git
cd psy
node --test tests/*.test.mjs tests/foundation-consumer/*.test.mjs
# → 164 tests / 0 fail
```

To run the groovebox locally, serve the folder over HTTP (the foundation
modules use `fetch` + ES module `import`, which require `http://` not `file://`):

```bash
python3 -m http.server 8000
# open http://localhost:8000/
```

Or just use the live site — it's already deployed.

## Architecture (one-line summary)

```
foundation/ (pure ESM, 164 tests)        index.html (single-file runtime)
├── foundation.mjs  — song/motif/transform   ├── PWA + service worker (inline Blob URL)
├── transport.mjs   — PLL                    ├── foundation loader (Blob URL + import rewriting)
├── dsp.mjs          — PolyBLEP/ZDF/FM       ├── AudioWorklet scheduler (PsySchedulerProcessor)
├── director.mjs     — DO-NOTHING abstention ├── MusicalTransport LCD (live PLL readout)
├── grammar.mjs      — 3 grammar classes     ├── MusicalDirector panel (PLAY/ABSTAIN)
├── render.mjs       — offline render + WAV  ├── Grammar/Render/MIDI action buttons
└── midi.mjs         — Web MIDI + SMF0       └── DSP oscilloscope (PolyBLEP vs naive)
```

## The family (13 repos)

| repo | what it holds | psy took |
|------|--------------|---------|
| psy5 | real PLL (TransportClock) | the PLL design |
| PsySynthPro | PolyBLEP + ZDF + FM + worklet | the DSP + worklet pattern |
| psy-foundation | 729 tests + VST | the foundation contract |
| psy-sampler | provenance + offline render | the render pattern |
| psystar | 24ppq MIDI clock | the MIDI clock design |
| PSY6-ULTIMATE | 3 grammar classes | the grammar design |
| psy4 | BeatPLL (with documented bug) | the bug to avoid |

psy is the **integration** — the only repo that combines all of the above in a
single-file browser product.

## Status

See [ROADMAP.md](ROADMAP.md) for the canonical 5-phase execution plan.

| Phase | Capability | Status |
|---|---|---|
| P1 | Foundation modules + 105 tests | ✅ DONE |
| P2 | PWA + foundation loader | ✅ DONE |
| P3 | Foundation drives runtime (6 capabilities) | ✅ DONE |
| P4 | AudioWorklet replaces setInterval | ✅ DONE |
| P5 | Soak test + radio observation | ⏸ PENDING |

## License

MIT. The PSY family is open source.
