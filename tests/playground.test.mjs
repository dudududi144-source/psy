// PSY-6 M2 test suite (21 tests) — run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML_PATH = path.join(__dirname, "..", "index.html");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let counters;
function makeParam(init) {
  return { value: init,
    setValueAtTime(v) { this.value = v; return this; },
    linearRampToValueAtTime(v) { this.value = v; return this; },
    exponentialRampToValueAtTime(v) { this.value = v; return this; },
    setTargetAtTime(v) { this.value = v; return this; },
    cancelScheduledValues() { return this; } };
}
function makeAudioContext(opts) {
  opts = opts || {};
  const startTime = Date.now();
  const ctx = {
    _isOffline: !!opts.offline, _scheduledVoices: 0,
    sampleRate: opts.sampleRate || 44100, state: "running",
    destination: { _tag: "destination" },
    get currentTime() { return opts.offline ? 0 : (Date.now() - startTime) / 1000; },
    resume() { this.state = "running"; return Promise.resolve(); },
    createGain() { counters.gain++; return { gain: makeParam(1), connect() { return arguments[0]; } }; },
    createOscillator() { counters.osc++; return { type: "sine", frequency: makeParam(440), detune: makeParam(0),
      connect() { return arguments[0]; },
      start() { counters.oscStart++; if (ctx._isOffline) ctx._scheduledVoices++; }, stop() {} }; },
    createBiquadFilter() { counters.filter++; return { type: "lowpass", Q: makeParam(1), frequency: makeParam(350), connect() { return arguments[0]; } }; },
    createDelay() { counters.delay++; return { delayTime: makeParam(0.3), connect() { return arguments[0]; } }; },
    createAnalyser() { counters.analyser++; return { fftSize: 0, smoothingTimeConstant: 0,
      connect() { return arguments[0]; },
      getByteTimeDomainData(a) { for (let i = 0; i < a.length; i++) a[i] = 128; },
      getByteFrequencyData(a) { for (let i = 0; i < a.length; i++) a[i] = 0; } }; },
    createBuffer(ch, len, sr) { const data = new Float32Array(len); return { length: len, sampleRate: sr, getChannelData() { return data; } }; },
    createBufferSource() { counters.bufSrc++; return { buffer: null, connect() { return arguments[0]; },
      start() { if (ctx._isOffline) ctx._scheduledVoices++; }, stop() {} }; },
    createStereoPanner() { counters.pan++; return { pan: makeParam(0), connect() { return arguments[0]; } }; },
    createDynamicsCompressor() { counters.comp++; return { threshold: makeParam(-14), knee: makeParam(10),
      ratio: makeParam(5), attack: makeParam(0.004), release: makeParam(0.16), connect() { return arguments[0]; } }; },
    createWaveShaper() { counters.shaper++; return { curve: null, connect() { return arguments[0]; } }; },
    createConvolver() { counters.conv++; return { buffer: null, connect() { return arguments[0]; } }; },
  };
  return ctx;
}
function buildSandbox() {
  counters = { osc: 0, gain: 0, filter: 0, delay: 0, analyser: 0, bufSrc: 0, pan: 0, oscStart: 0, comp: 0, shaper: 0, conv: 0 };
  function AudioContextStub() { return makeAudioContext({ offline: false }); }
  function OfflineAudioContextStub(channels, length, sampleRate) {
    const c = makeAudioContext({ offline: true, sampleRate });
    c.length = length; c.numberOfChannels = channels;
    c.startRendering = function () {
      const voices = c._scheduledVoices;
      const buf = new Float32Array(length);
      if (voices > 0) for (let i = 0; i < length; i++) buf[i] = 0.4 * Math.sin(2 * Math.PI * 110 * i / sampleRate) * (i % 500 < 250 ? 1 : 0.6);
      return Promise.resolve({ length, sampleRate, duration: length / sampleRate, getChannelData() { return buf; } });
    };
    return c;
  }
  function makeEl(tag) {
    const listeners = {};
    return {
      tagName: (tag || "div").toUpperCase(), _listeners: listeners,
      children: [], className: "", id: "", value: "", checked: false, textContent: "",
      dataset: {},
      style: new Proxy({}, { get: (t, p2) => t[p2], set: (t, p2, v) => { t[p2] = v; return true; } }),
      _innerHTML: "",
      get innerHTML() { return this._innerHTML; },
      set innerHTML(v) { this._innerHTML = v; if (v === "") this.children = []; },
      width: 860, height: 90,
      addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
      removeEventListener() {},
      dispatch(type, ev) { (listeners[type] || []).forEach((fn) => fn.call(this, ev || { preventDefault() {}, target: this })); },
      appendChild(c) { this.children.push(c); return c; },
      getContext() { return { fillRect() {}, clearRect() {}, fillStyle: "", fillText() {} }; },
      querySelector() { return makeEl("div"); },
      querySelectorAll() { return []; },
      closest() { return null; },
      focus() {}, blur() {}, click() { this.dispatch("click"); }, reset() {},
    };
  }
  const elements = {};
  ["playBtn", "variateBtn", "nextSecBtn", "lcd1", "lcd2", "lcdSteps", "knobs", "seq", "pads", "viz", "status", "selfTest", "engState", "timeline", "nowPlaying"]
    .forEach((id) => { elements[id] = makeEl("div"); elements[id].id = id; });
  elements.playBtn = makeEl("button"); elements.playBtn.id = "playBtn";
  elements.viz = makeEl("canvas"); elements.viz.id = "viz";
  const documentStub = {
    readyState: "complete",
    getElementById(id) { if (!elements[id]) { elements[id] = makeEl("div"); elements[id].id = id; } return elements[id]; },
    createElement(tag) { return makeEl(tag); },
    querySelectorAll() { return []; },
    addEventListener() {},
    body: makeEl("body"),
  };
  const store = {};
  const localStorageStub = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
  };
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.addEventListener = () => {};
  sandbox.removeEventListener = () => {};
  sandbox.document = documentStub;
  sandbox.localStorage = localStorageStub;
  sandbox.fetch = () => Promise.reject(new Error("offline-mock"));
  sandbox.requestAnimationFrame = () => 0;
  sandbox.AudioContext = AudioContextStub;
  sandbox.OfflineAudioContext = OfflineAudioContextStub;
  sandbox.console = console;
  sandbox.setTimeout = (fn, ms, ...a) => { const t = setTimeout(fn, ms, ...a); if (t.unref) t.unref(); return t; };
  sandbox.setInterval = (fn, ms, ...a) => { const t = setInterval(fn, ms, ...a); if (t.unref) t.unref(); return t; };
  sandbox.clearTimeout = clearTimeout;
  sandbox.clearInterval = clearInterval;
  sandbox.Promise = Promise; sandbox.Math = Math; sandbox.Date = Date; sandbox.JSON = JSON;
  sandbox.Uint8Array = Uint8Array; sandbox.Float32Array = Float32Array; sandbox.Object = Object;
  sandbox.Array = Array; sandbox.Number = Number; sandbox.String = String; sandbox.Error = Error;
  sandbox.isFinite = isFinite; sandbox.NaN = NaN; sandbox.Infinity = Infinity;
  sandbox.navigator = { userAgent: "node-test" };
  vm.createContext(sandbox);
  return { sandbox, elements, store, get counters() { return counters; } };
}
function loadAndRun() {
  const html = readFileSync(HTML_PATH, "utf8");
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(m, "index.html must contain one inline <script>");
  const env = buildSandbox();
  vm.runInContext(m[1], env.sandbox, { timeout: 15000 });
  return env;
}
let _g = null;
function G() { if (_g) return _g; _g = loadAndRun().sandbox; return _g; }

test("M2 device loads; song exists; version v4", () => {
  const dev = loadAndRun().sandbox.window.__psy6;
  assert.ok(dev, "__psy6 missing");
  assert.ok(dev.song, "song missing");
  assert.equal(dev.report().version, "4.0.0-m2-song");
});
test("self-test renders non-silent bar", async () => {
  const dev = loadAndRun().sandbox.window.__psy6;
  const st = await dev.selfTest();
  assert.equal(st.ok, true, JSON.stringify(st));
  assert.ok(st.rms > 0.01);
});
test("FX chain wired", async () => {
  const dev = loadAndRun().sandbox.window.__psy6;
  await dev.init();
  assert.ok(dev.comp && dev.shaper && dev.dL && dev.dR && dev.reverbIn);
});
test("Play schedules voices; Stop stops", async () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  const before = env.counters.oscStart;
  env.elements.playBtn.dispatch("click");
  await sleep(400);
  try {
    assert.equal(dev.isPlaying, true);
    assert.ok(env.counters.oscStart > before, "no voices scheduled");
    assert.ok(dev.absStep > 0);
  } finally {
    env.elements.playBtn.dispatch("click");
    await sleep(60);
  }
  assert.equal(dev.isPlaying, false);
});
test("knobs work", async () => {
  const dev = loadAndRun().sandbox.window.__psy6;
  await dev.init();
  dev.setKnob("bpm", 1);
  assert.equal(Math.round(dev.bpm), 165);
  dev.setKnob("filter", 0.25);
  assert.ok(dev.djFilter.frequency.value < 500);
  dev.setKnob("drive", 0.8);
  assert.ok(dev.shaper.curve && dev.shaper.curve.length === 512);
});
test("pad triggers voice", async () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  await dev.init();
  const before = env.counters.oscStart;
  await dev.triggerPad(4);
  assert.ok(env.counters.oscStart > before);
});
test("VARIATE regenerates song themes", () => {
  const dev = loadAndRun().sandbox.window.__psy6;
  const a = JSON.stringify(dev.song.themes.A.seedCell);
  dev.variate(false);
  assert.notEqual(JSON.stringify(dev.song.themes.A.seedCell), a);
  assert.equal(dev.variation, 2);
});
test("subSeed deterministic + label/seed sensitive", () => {
  const g = G();
  assert.equal(g.subSeed(12345, "themeA"), g.subSeed(12345, "themeA"));
  assert.notEqual(g.subSeed(12345, "themeA"), g.subSeed(12345, "themeB"));
  assert.notEqual(g.subSeed(1, "themeA"), g.subSeed(2, "themeA"));
});
test("buildSong: bars multiples of 4; totalBars=sum; deterministic", () => {
  const g = G();
  const song = g.buildSong(42);
  for (const s of song.sections) assert.equal(s.bars % 4, 0, s.name);
  assert.equal(song.totalBars, song.sections.reduce((a, s) => a + s.bars, 0));
  assert.deepEqual(JSON.stringify(song.themes.A.seedCell), JSON.stringify(g.buildSong(42).themes.A.seedCell));
});
test("sectionAt resolves + wraps", () => {
  const g = G();
  const song = g.buildSong(5);
  for (let bar = 0; bar < song.totalBars; bar += 7) {
    const r = g.sectionAt(song, bar);
    assert.ok(r.barInSection >= 0 && r.barInSection < r.section.bars);
  }
  const a = g.sectionAt(song, 3), b = g.sectionAt(song, 3 + song.totalBars);
  assert.equal(a.section.name, b.section.name);
  assert.equal(a.barInSection, b.barInSection);
});
test("transforms: transpose/invert/retrograde/displace/fragment/scaleDuration", () => {
  const g = G();
  const motif = [
    { deg: 0, oct: 0, dur: 4, accent: 1, rest: false },
    { deg: 2, oct: 0, dur: 4, accent: 0.5, rest: false },
    { deg: 4, oct: 0, dur: 4, accent: 0.5, rest: false },
    { deg: 1, oct: 0, dur: 4, accent: 0.3, rest: false },
  ];
  assert.deepEqual(g.transposeDegree(motif, 3).map(e => e.deg), [3, 5, 7, 4]);
  const inv = g.invert(motif);
  assert.equal(inv[0].deg, 0); assert.equal(inv[1].deg, -2); assert.equal(inv[2].deg, -4);
  assert.equal(g.retrograde(motif)[0].deg, motif[motif.length - 1].deg);
  const total = arr => arr.reduce((s, e) => s + e.dur, 0);
  assert.equal(total(g.displace(motif, 4)), total(motif));
  const uneven = [ { deg: 0, oct: 0, dur: 3, accent: 1, rest: false }, { deg: 2, oct: 0, dur: 5, accent: 0.5, rest: false } ];
  assert.equal(total(g.displace(uneven, 2)), total(uneven));
  assert.equal(g.fragment(motif, 0, 2, 2).length, 4);
  assert.equal(total(g.scaleDuration(motif, 2)), total(motif) * 2);
});
test("degreeToSemitone + renderMotif (rests carry no midi)", () => {
  const g = G();
  const pd = g.SCALES.phrygianDominant;
  assert.equal(g.degreeToSemitone(pd, 0), 0);
  assert.equal(g.degreeToSemitone(pd, 2), 4);
  assert.equal(g.degreeToSemitone(pd, 7), 12);
  const song = g.buildSong(99);
  for (let bar = 0; bar < 8; bar++) {
    const rendered = g.resolveThemeBar(song.themes.B, bar, g.SCALES);
    for (const ev of rendered) {
      if (ev.rest) assert.equal(ev.midi, undefined, "rest has midi");
      else assert.equal(typeof ev.midi, "number");
    }
  }
});
test("resolveThemeBar pure + varies per bar; A2 differs; B harmonicMinor", () => {
  const g = G();
  const song = g.buildSong(99);
  assert.deepEqual(JSON.stringify(g.resolveThemeBar(song.themes.A, 2, g.SCALES)), JSON.stringify(g.resolveThemeBar(song.themes.A, 2, g.SCALES)));
  assert.notDeepEqual(JSON.stringify(g.resolveThemeBar(song.themes.A, 0, g.SCALES)), JSON.stringify(g.resolveThemeBar(song.themes.A, 1, g.SCALES)));
  assert.notDeepEqual(JSON.stringify(song.themes.A.seedCell), JSON.stringify(song.themes.A2.seedCell));
  assert.equal(song.themes.B.scaleKey, "harmonicMinor");
  assert.equal(song.themes.A.scaleKey, "phrygianDominant");
});
test("bass styles: gallop/offbeat/pedal", () => {
  const g = G();
  for (let bar = 0; bar < 8; bar++) {
    const bb = g.generateBassBar("gallop", 45, g.SCALES.phrygianDominant, bar, g.rngFor(3, "bar:" + bar));
    for (const ks of g.KICK_STEPS) assert.equal(bb[ks], null, "gallop on kick step " + ks);
  }
  const ob = g.generateBassBar("offbeat", 45, g.SCALES.naturalMinor, 0, g.rngFor(1, "x"));
  ob.forEach((ev, i) => { if (ev) assert.ok([2, 6, 10, 14].includes(i)); });
  assert.ok(g.generateBassBar("pedal", 45, g.SCALES.naturalMinor, 0, g.rngFor(1, "x")).filter(Boolean).length <= 1);
});
test("fills + transitions", () => {
  const g = G();
  const base = [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0];
  const filled = g.applyFill(base, 1.0, g.rngFor(1, "fill"));
  base.forEach((v, i) => { if (v) assert.equal(filled[i], 1); });
  const zeros = new Array(16).fill(0);
  let c0 = 0, c1 = 0;
  for (let s = 0; s < 200; s++) {
    c0 += g.applyFill(zeros, 0, g.rngFor(s, "a")).filter(Boolean).length;
    c1 += g.applyFill(zeros, 1, g.rngFor(s, "b")).filter(Boolean).length;
  }
  assert.ok(c1 > c0);
  assert.equal(g.isPreDropSilenceBar("DROP", 7, 8), true);
  assert.equal(g.isPreDropSilenceBar("DROP", 6, 8), false);
  assert.equal(g.isPreDropSilenceBar("BREAK", 7, 8), false);
  assert.equal(g.isSectionDownbeat(0), true);
  assert.equal(g.isSectionDownbeat(1), false);
});
test("energy curves + automation", () => {
  const g = G();
  let prev = -1;
  for (let b = 0; b < 16; b++) { const e = g.EnergyCurves.rampUp(b, 16); assert.ok(e >= prev); prev = e; }
  const e1 = g.energyAt("DROP", 0, 32), e2 = g.energyAt("DROP", 31, 32);
  assert.ok(Math.abs(e1 - e2) < 0.01 && e1 > 0.7);
  assert.ok(g.automationFromEnergy(0.9).filterCutoffHz > g.automationFromEnergy(0.1).filterCutoffHz);
});
test("drop2RootOffset in {0,2}", () => {
  const g = G();
  for (let s = 0; s < 50; s++) {
    const song = g.buildSong(s);
    assert.ok(song.drop2RootOffset === 0 || song.drop2RootOffset === 2);
  }
});
function recorderVoices() {
  const c = { kick: 0, bass: 0, lead: 0, arp: 0, pad: 0, clap: 0, shaker: 0, oh: 0, snare: 0, crash: 0, leadMidis: [] };
  return { c, v: {
    kick() { c.kick++; }, bassNote(t, m) { c.bass++; }, leadNote(t, m) { c.lead++; c.leadMidis.push(m); },
    arpNote() { c.arp++; }, padChord() { c.pad++; }, clap() { c.clap++; }, shaker() { c.shaker++; },
    openhat() { c.oh++; }, snare() { c.snare++; }, crash() { c.crash++; },
  } };
}
test("scheduler: DROP bar fires kick/bass/lead/crash", async () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  await dev.init();
  const rec = recorderVoices();
  dev.voices = rec.v;
  dev.mutes = { KICK: 0, BASS: 0, PERC: 0, LEAD: 0, ARP: 0, PAD: 0 };
  const dropStart = dev.song.sectionStarts[2];
  dev._barCacheKey = -1;
  const base = dropStart * 16;
  for (let s = 0; s < 16; s++) dev.scheduleStep(base + s, 1 + s * 0.1);
  assert.equal(rec.c.kick, 4, "kicks=" + rec.c.kick);
  assert.equal(rec.c.bass, 12, "bass=" + rec.c.bass);
  assert.ok(rec.c.lead >= 1, "lead fired");
  assert.equal(rec.c.crash, 1, "downbeat crash");
});
test("scheduler: BREAK lead uses harmonic-minor pitches", async () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  await dev.init();
  const rec = recorderVoices();
  dev.voices = rec.v;
  dev.mutes = { KICK: 0, BASS: 0, PERC: 0, LEAD: 0, ARP: 0, PAD: 0 };
  const breakStart = dev.song.sectionStarts[3];
  dev._barCacheKey = -1;
  for (let bar = 0; bar < 4; bar++) {
    const base = (breakStart + bar) * 16;
    for (let s = 0; s < 16; s++) dev.scheduleStep(base + s, 1 + s * 0.1);
  }
  assert.ok(rec.c.lead >= 1, "break lead fired");
  // Harmonic-minor pitch classes, offset by the actual key root (ROOT=33 -> A, pc 9).
  const rootPC = ((dev.song.root % 12) + 12) % 12;
  const HM = new Set([0, 2, 3, 5, 7, 8, 11].map((x) => (rootPC + x) % 12));
  for (const m of rec.c.leadMidis) assert.ok(HM.has(((m % 12) + 12) % 12), "non-HM pitch " + m + " (root pc " + rootPC + ")");
});
test("scheduler: pre-drop silence gates last-beat kick", async () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  await dev.init();
  const rec = recorderVoices();
  dev.voices = rec.v;
  dev.mutes = { KICK: 0, BASS: 0, PERC: 0, LEAD: 0, ARP: 0, PAD: 0 };
  const buildStart = dev.song.sectionStarts[1];
  const lastBuildBar = buildStart + 16 - 1;
  dev._barCacheKey = -1;
  const base = lastBuildBar * 16;
  for (let s = 0; s < 16; s++) dev.scheduleStep(base + s, 1 + s * 0.1);
  assert.equal(rec.c.kick, 3, "expected 3 kicks (step 12 gated), got " + rec.c.kick);
});
test("swing shifts odd-16th schedule times (scheduler loop)", async () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  await dev.init();
  const bassTimes = [];
  dev.voices = { kick() {}, bassNote(t) { bassTimes.push(t); }, leadNote() {}, arpNote() {}, padChord() {},
                 clap() {}, shaker() {}, openhat() {}, snare() {}, crash() {} };
  dev.mutes = { KICK: 1, BASS: 0, PERC: 1, LEAD: 1, ARP: 1, PAD: 1 };
  const dropStart = dev.song.sectionStarts[2];
  // run scheduler at an odd step (1) with swing=0 -> record time
  dev.swing = 0; dev._barCacheKey = -1;
  dev.absStep = dropStart * 16 + 1;
  const now = dev.ctx.currentTime;
  dev.nextNoteTime = now + 0.001;
  dev.scheduler();
  const tNoSwing = bassTimes[0]; // first scheduled note = the odd step
  // same odd step with swing=1 -> must be later by swing*stepDur*0.5
  dev.swing = 1; dev._barCacheKey = -1; bassTimes.length = 0;
  dev.absStep = dropStart * 16 + 1;
  dev.nextNoteTime = now + 0.001;
  dev.scheduler();
  const tSwing = bassTimes[0]; // first scheduled note = the odd step
  const expectedShift = 1 * dev.stepDur() * 0.5;
  assert.ok(tSwing > tNoSwing, "swing did not shift odd step");
  assert.ok(Math.abs((tSwing - tNoSwing) - expectedShift) < 1e-9, "shift != swing*stepDur*0.5");
});
test("timeline renders 7 sections; seekToBar sets position", () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  dev.renderTimeline();
  assert.equal(env.elements.timeline.children.length, 7);
  dev.seekToBar(48);
  assert.equal(dev.absStep, 48 * 16);
  dev.stop();
});
