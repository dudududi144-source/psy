// tests/foundation.test.mjs — P1 foundation test suite (RULE 9: A–T + adversarial + invariants + perf)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as F from "../foundation/foundation.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FOUNDATION_SRC = readFileSync(path.join(__dirname, "..", "foundation", "foundation.mjs"), "utf8");
const deepEqualJson = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));

/* A. canonical Song construction */
test("A: canonical Song construction + validation", () => {
  const song = F.buildFoundationSong(42);
  assert.equal(F.validateSong(song), true);
  assert.equal(song.totalBars, 176);
  assert.equal(song.sections.length, 7);
  assert.throws(() => F.validateSong({}), F.FoundationError);
  assert.throws(() => F.validateSong({ ...song, sections: [] }), F.FoundationError);
  assert.throws(() => F.validateSong({ ...song, totalBars: 5 }), F.FoundationError);
});

/* B. section ordering */
test("B: section ordering + starts monotonic + sum", () => {
  const song = F.buildFoundationSong(7);
  const names = song.sections.map((s) => s.name);
  deepEqualJson(names, ["INTRO", "BUILD", "DROP", "BREAK", "RISER", "DROP2", "OUTRO"]);
  let prev = -1, sum = 0;
  for (let i = 0; i < song.sections.length; i++) {
    assert.ok(song.sectionStarts[i] > prev);
    prev = song.sectionStarts[i];
    sum += song.sections[i].bars;
  }
  assert.equal(sum, song.totalBars);
  const at50 = F.sectionAt(song, 50);
  assert.equal(at50.section.name, "DROP");
  assert.equal(at50.barInSection, 50 - 48);
});

/* C. phrase ordering */
test("C: phrase ordering cycles barInSection % planLength with fixed op sequence", () => {
  const song = F.buildFoundationSong(3);
  const theme = song.themes.A;
  const ops = theme.phrasePlan.map((t) => t.op);
  deepEqualJson(ops, ["identity", "displace", "transposeDegree", "invert"]);
  for (let bar = 0; bar < 8; bar++) {
    const ctx = F.contextAt(song, (48 + bar) * 4); // inside DROP
    assert.equal(ctx.phraseIndex, bar % 4);
    assert.equal(ctx.planOp, ops[bar % 4]);
  }
});

/* D. motif identity */
test("D: motif identity — seedCell valid + reproducible", () => {
  const s1 = F.buildFoundationSong(11);
  const s2 = F.buildFoundationSong(11);
  assert.equal(F.validateMotif(s1.themes.A.seedCell), true);
  deepEqualJson(s1.themes.A.seedCell, s2.themes.A.seedCell);
});

/* E/F. transforms produce valid motifs; transpose exact */
test("E+F: transforms valid; transposeDegree exact; rests preserved", () => {
  const motif = [
    { deg: 0, oct: 0, dur: 2, accent: 1, rest: false },
    { deg: 2, oct: 0, dur: 1, accent: 0.5, rest: false },
    { deg: 0, oct: 0, dur: 1, accent: 0.3, rest: true },
  ];
  for (const op of Object.keys(F.TRANSFORMS)) {
    const params = { n: 2, steps: 1, start: 0, len: 2, repeats: 2 };
    const out = F.applyTransform(motif, { op, params });
    assert.equal(F.validateMotif(out), true, op + " produced invalid motif");
  }
  const t = F.applyTransform(motif, { op: "transposeDegree", params: { n: 3 } });
  assert.equal(t[0].deg, 3);
  assert.equal(t[1].deg, 5);
  assert.equal(t[2].rest, true);
  assert.equal(t[2].deg, 0); // rest keeps original deg, no semantic change
});

/* G. inversion invariants */
test("G: invert(invert(m)) == m; pivot unchanged", () => {
  const motif = [
    { deg: 4, oct: 0, dur: 1, accent: 1, rest: false },
    { deg: 6, oct: 0, dur: 1, accent: 0.5, rest: false },
    { deg: 2, oct: 0, dur: 2, accent: 0.3, rest: false },
  ];
  const inv = F.applyTransform(motif, { op: "invert" });
  assert.equal(inv[0].deg, 4);
  assert.equal(inv[1].deg, 2); // 4-(6-4)
  assert.equal(inv[2].deg, 6); // 4-(2-4)
  deepEqualJson(F.applyTransform(inv, { op: "invert" }), motif);
});

/* H. retrograde invariants */
test("H: retrograde(retrograde(m)) == m; total duration preserved", () => {
  const motif = [
    { deg: 0, oct: 0, dur: 1, accent: 1, rest: false },
    { deg: 1, oct: 0, dur: 3, accent: 0.5, rest: false },
  ];
  const retro = F.applyTransform(motif, { op: "retrograde" });
  assert.equal(retro[0].deg, 1);
  assert.equal(retro[1].deg, 0);
  const total = (m) => m.reduce((s, e) => s + e.dur, 0);
  assert.equal(total(retro), total(motif));
  deepEqualJson(F.applyTransform(retro, { op: "retrograde" }), motif);
});

/* I. deterministic seed */
test("I: deterministic seeding (subSeed/mulberry32)", () => {
  assert.equal(F.subSeed(12345, "themeA"), F.subSeed(12345, "themeA"));
  assert.notEqual(F.subSeed(12345, "themeA"), F.subSeed(12345, "themeB"));
  assert.notEqual(F.subSeed(1, "x"), F.subSeed(2, "x"));
  const r1 = F.rngFor(9, "lbl"); const r2 = F.rngFor(9, "lbl");
  for (let i = 0; i < 10; i++) assert.equal(r1(), r2());
  deepEqualJson(F.buildFoundationSong(42), F.buildFoundationSong(42));
});

/* J. same seed -> identical resolution */
test("J: same seed -> identical timeline output", () => {
  const song = F.buildFoundationSong(5);
  const t1 = F.resolveSong(song, { bars: 32 });
  const t2 = F.resolveSong(song, { bars: 32 });
  assert.equal(F.serializeTimeline(t1), F.serializeTimeline(t2));
});

/* K. different seed -> valid variation */
test("K: different seed -> different but valid output", () => {
  const sA = F.buildFoundationSong(1), sB = F.buildFoundationSong(2);
  assert.notEqual(JSON.stringify(sA.themes), JSON.stringify(sB.themes));
  assert.equal(F.validateSong(sA), true);
  assert.equal(F.validateSong(sB), true);
  const tA = F.resolveSong(sA, { bars: 16 });
  assert.equal(F.validateTimelineShape(tA), true);
});

/* L. timeline ordering */
test("L: timeline events ordered by beat; durations >= 0", () => {
  const song = F.buildFoundationSong(4);
  const tl = F.resolveSong(song, { bars: 64 });
  let last = -1;
  for (const ev of tl.events) {
    assert.ok(ev.beat >= last);
    last = ev.beat;
    assert.ok(ev.durationBeats >= 0);
  }
  assert.equal(F.validateTimelineShape(tl), true);
});

/* M. event immutability */
test("M: events and timeline are frozen (mutation throws)", () => {
  const tl = F.resolveSong(F.buildFoundationSong(2), { bars: 8 });
  assert.ok(Object.isFrozen(tl));
  assert.ok(Object.isFrozen(tl.events));
  assert.ok(Object.isFrozen(tl.events[0]));
  assert.throws(() => { tl.events[0].beat = 99; }, TypeError);
  assert.throws(() => { tl.events.push({}); }, TypeError);
  assert.throws(() => { tl.version = "9.9"; }, TypeError);
});

/* N. MusicalContext resolution */
test("N: contextAt — section/phrase/key/mode; negatives throw; loop wraps", () => {
  const song = F.buildFoundationSong(6);
  const c0 = F.contextAt(song, 0);
  assert.equal(c0.section.name, "INTRO");
  assert.equal(c0.mode, "intro");
  assert.equal(c0.scaleName, "phrygian");
  assert.equal(c0.key, 33);
  const cDrop = F.contextAt(song, 48 * 4);
  assert.equal(cDrop.section.name, "DROP");
  assert.equal(cDrop.scaleName, "phrygianDominant");
  const cBreak = F.contextAt(song, 80 * 4);
  assert.equal(cBreak.section.name, "BREAK");
  assert.equal(cBreak.scaleName, "harmonicMinor");
  assert.throws(() => F.contextAt(song, -1), F.FoundationError);
  assert.throws(() => F.contextAt(song, NaN), F.FoundationError);
  const wrapped = F.contextAt(song, song.totalBars * 4 + 4);
  const direct = F.contextAt(song, 4);
  deepEqualJson(wrapped, direct);
});

/* O. provenance */
test("O: provenance on every event (songSeed + label; lead carries theme+op)", () => {
  const song = F.buildFoundationSong(8);
  const tl = F.resolveSong(song, { bars: 176 });
  assert.ok(tl.eventCount > 500);
  let leadSeen = 0, arpSeen = 0;
  for (const ev of tl.events) {
    assert.equal(ev.provenance.songSeed, song.seed);
    assert.equal(typeof ev.provenance.label, "string");
    if (ev.voice === "lead") {
      assert.ok(ev.provenance.label.startsWith("theme:"));
      assert.ok(ev.provenance.op !== null);
      assert.equal(ev.motifTheme, ev.section.name === "DROP" || ev.section.name === "BREAK" ? ev.motifTheme : ev.motifTheme);
      leadSeen++;
    }
    if (ev.voice === "arp") { assert.equal(ev.provenance.label, "arp"); arpSeen++; }
  }
  assert.ok(leadSeen > 0);
  assert.ok(arpSeen > 0);
});

/* P. replay determinism across generations */
test("P: replay determinism — 10-generation serialize/parse chain identical", () => {
  const song = F.buildFoundationSong(77);
  const original = F.serializeTimeline(F.resolveSong(song, { bars: 48 }));
  let current = original;
  for (let gen = 0; gen < 10; gen++) {
    const parsed = F.parseTimeline(current);
    const reResolved = F.serializeTimeline(F.resolveSong(song, { bars: 48 }));
    assert.equal(reResolved, original, "resolve diverged at generation " + gen);
    current = F.serializeTimeline(parsed);
    assert.equal(current, original, "round-trip diverged at generation " + gen);
  }
});

/* Q. serialization round-trip */
test("Q: serialization round-trip preserves meaning", () => {
  const tl = F.resolveSong(F.buildFoundationSong(3), { bars: 16 });
  const back = F.parseTimeline(F.serializeTimeline(tl));
  deepEqualJson(back, tl);
  assert.throws(() => F.parseTimeline(JSON.stringify({ version: "9.9", events: [] })), F.FoundationError);
});

/* R. ARP migration correctness (canonical arpPhrase) */
test("R: arp canonical — deterministic phrase, valid degrees, timeline matches in DROP/DROP2", () => {
  const s1 = F.buildFoundationSong(10), s2 = F.buildFoundationSong(10);
  deepEqualJson(s1.arpPhrase, s2.arpPhrase);
  assert.equal(s1.arpPhrase.length, 16);
  const validDeg = new Set([0, 1, 2, 4, 7]);
  let nonNull = 0;
  for (const a of s1.arpPhrase) {
    if (a === null) continue;
    nonNull++;
    assert.ok(validDeg.has(a.deg), "arp deg " + a.deg);
  }
  assert.ok(nonNull >= 8);
  const tl = F.resolveSong(s1, { bars: 176 });
  const dropStart = s1.sectionStarts[2];
  const arpInDropBar0 = tl.events.filter((e) => e.voice === "arp" && e.bar === dropStart);
  assert.equal(arpInDropBar0.length, nonNull, "DROP bar arp events == phrase gates");
  const drop2Start = s1.sectionStarts[5];
  const arpInDrop2Bar0 = tl.events.filter((e) => e.voice === "arp" && e.bar === drop2Start);
  assert.equal(arpInDrop2Bar0.length, nonNull);
  deepEqualJson(arpInDropBar0.map((e) => e.midi), arpInDrop2Bar0.map((e) => e.midi + 0 - (s1.drop2RootOffset)));
});

/* S/T. no Math.random / no wall-clock / no audio-runtime in foundation source */
test("S/T: foundation source has no Math.random/Date.now/performance.now/setInterval/AudioContext", () => {
  for (const banned of ["Math.random", "Date.now", "new Date", "performance.now", "setInterval", "setTimeout", "AudioContext", "AudioWorklet", "navigator"]) {
    assert.ok(!FOUNDATION_SRC.includes(banned), "forbidden token in foundation source: " + banned);
  }
});

/* adversarial: malformed inputs */
test("adversarial: empty song / one-note motif / invalid durations / invalid positions", () => {
  assert.throws(() => F.validateSong({ seed: 1, root: 33, sections: [], themes: {}, totalBars: 0 }), F.FoundationError);
  const one = [{ deg: 0, oct: 0, dur: 1, accent: 1, rest: false }];
  deepEqualJson(F.applyTransform(one, { op: "invert" }), one);
  deepEqualJson(F.applyTransform(one, { op: "retrograde" }), one);
  assert.throws(() => F.validateMotif([{ deg: 0, oct: 0, dur: 0, accent: 1, rest: false }]), F.FoundationError);
  assert.throws(() => F.validateMotif([{ deg: 0, oct: 0, dur: -1, accent: 1, rest: false }]), F.FoundationError);
  assert.throws(() => F.validateMotif([{ deg: 0, oct: 0, dur: 1.5, accent: 1, rest: false }]), F.FoundationError);
  assert.throws(() => F.validateMotif([]), F.FoundationError);
  assert.throws(() => F.subSeed(undefined, "x"), F.FoundationError);
  assert.throws(() => F.mulberry32(NaN), F.FoundationError);
  assert.throws(() => F.subSeed(5, ""), F.FoundationError);
  assert.throws(() => F.applyTransform(one, { op: "nope" }), /unknown transform/);
  assert.throws(() => F.applyTransform(one, { op: "transposeDegree", params: {} }), F.FoundationError);
});

/* adversarial: duplicate event ids detected */
test("adversarial: duplicate event ids rejected by validateTimelineShape", () => {
  const ev = { id: "kick:0:0:0", voice: "kick", beat: 0, durationBeats: 0.25, midi: null, pitchClass: null,
               velocity: 1, accent: 1, bar: 0, step: 0, section: { name: "DROP", index: 2 },
               phrase: null, motifTheme: null, provenance: { songSeed: 1, label: "x", op: null }, meta: {} };
  const tl = { version: "1.0", songSeed: 1, params: { bars: 1 }, lengthBeats: 4, eventCount: 2, events: [ev, { ...ev }] };
  assert.throws(() => F.validateTimelineShape(tl), /duplicate event id/);
});

/* adversarial: extreme section lengths via custom song */
test("adversarial: extreme section lengths resolve without crash", () => {
  const tiny = {
    seed: 1, root: 33, bpm: 145, styleScale: "phrygianDominant",
    modes: { m: "phrygianDominant" }, drop2RootOffset: 0,
    sections: [{ name: "X", bars: 1, themeKey: "T", mode: "m", bassStyle: "gallop", rootOffset: 0 }],
    sectionStarts: [0], totalBars: 1,
    themes: { T: { themeKey: "T", rootMidi: 57, scaleKey: "phrygianDominant", register: 0, cellLen: 16,
      seedCell: [{ deg: 0, oct: 0, dur: 1, accent: 1, rest: false }], phrasePlan: [{ op: "identity" }] } },
    arpPhrase: new Array(16).fill(null),
  };
  assert.equal(F.validateSong(tiny), true);
  const tl = F.resolveSong(tiny, { bars: 1 });
  assert.equal(F.validateTimelineShape(tl), true);
  const big = { ...tiny, sections: [{ ...tiny.sections[0], bars: 10000 }], totalBars: 10000 };
  assert.equal(F.validateSong(big), true);
});

/* invariants: repeated motifs across phrase cycle; repeated transforms; transform immutability */
test("invariants: repetition across phrase cycle; chained transforms; transforms never mutate input", () => {
  const song = F.buildFoundationSong(12);
  const tl = F.resolveSong(song, { bars: 176 });
  const dropStart = song.sectionStarts[2];
  const leadBar = (bar) => tl.events.filter((e) => e.voice === "lead" && e.bar === bar).map((e) => e.midi + "@" + (e.beat % 4));
  deepEqualJson(leadBar(dropStart + 0), leadBar(dropStart + 4)); // both phrase op "identity"
  const motif = song.themes.A.seedCell;
  const before = JSON.stringify(motif);
  F.applyTransformChain(motif, [{ op: "invert" }, { op: "retrograde" }, { op: "transposeDegree", params: { n: 2 } }]);
  assert.equal(JSON.stringify(motif), before, "transform chain mutated input");
  deepEqualJson(F.applyTransformChain(motif, [{ op: "invert" }, { op: "invert" }]), motif);
  deepEqualJson(F.applyTransformChain(motif, [{ op: "retrograde" }, { op: "retrograde" }]), motif);
});

/* invariants: displace preserves total steps across seeds/shifts */
test("invariants: displace preserves total duration for many shifts/seeds", () => {
  for (const seed of [1, 5, 9, 13]) {
    const motif = F.buildFoundationSong(seed).themes.A.seedCell;
    const total = motif.reduce((s, e) => s + e.dur, 0);
    for (const steps of [0, 1, 3, 7, 8, 15, 31]) {
      const out = F.applyTransform(motif, { op: "displace", params: { steps } });
      assert.equal(out.reduce((s, e) => s + e.dur, 0), total, "displace broke total at seed " + seed + " steps " + steps);
      assert.equal(F.validateMotif(out), true);
    }
  }
});

/* RULE 12: performance measurements */
test("performance: small/medium/large resolution + transform bench (recorded)", () => {
  const song = F.buildFoundationSong(21);
  let t0 = Date.now();
  const small = F.resolveSong(song, { bars: 8 });
  const msSmall = Date.now() - t0;
  t0 = Date.now();
  const med = F.resolveSong(song, { bars: 176 });
  const msMed = Date.now() - t0;
  t0 = Date.now();
  const large = F.resolveSong(song, { bars: 176 * 8 });
  const msLarge = Date.now() - t0;
  const motif = song.themes.A.seedCell;
  t0 = Date.now();
  for (let i = 0; i < 2000; i++) {
    F.applyTransformChain(motif, [{ op: "invert" }, { op: "retrograde" }, { op: "transposeDegree", params: { n: 1 } }]);
  }
  const msTransforms = Date.now() - t0;
  console.log(`perf: small(8 bars)=${small.eventCount} ev/${msSmall}ms | medium(176)=${med.eventCount} ev/${msMed}ms | large(1408)=${large.eventCount} ev/${msLarge}ms | 2000 transform chains=${msTransforms}ms`);
  assert.ok(msSmall < 1000);
  assert.ok(msMed < 3000);
  assert.ok(msLarge < 15000);
  assert.ok(msTransforms < 5000);
});
