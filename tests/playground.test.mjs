
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
    suspend() { this.state = "suspended"; return Promise.resolve(); },
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
      style: { setProperty(k, v) { this[k] = v; } },
      _innerHTML: "",
      get innerHTML() { return this._innerHTML; },
      set innerHTML(v) { this._innerHTML = v; if (v === "") this.children = []; },
      width: 860, height: 90,
      addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
      removeEventListener() {},
      dispatch(type, ev) { (listeners[type] || []).forEach((fn) => fn.call(this, ev || { preventDefault() {}, target: this })); },
      appendChild(c) { this.children.push(c); return c; },
      getContext() { return { fillRect() {}, clearRect() {}, fillStyle: "", fillText() {} }; },
      querySelectorAll() { return []; },
      focus() {}, blur() {}, click() { this.dispatch("click"); }, reset() {},
    };
  }
  const elements = {};
  ["playBtn", "variateBtn", "nextSecBtn", "lcd1", "lcd2", "lcdSteps", "knobs", "seq", "pads", "viz", "status", "selfTest", "engState"]
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
  const winListeners = {};
  sandbox.addEventListener = (type, fn) => { (winListeners[type] = winListeners[type] || []).push(fn); };
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

/* ---------------- core engine tests ---------------- */

test("device loads; exposes __psy6 with 6 part buses", () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  assert.ok(dev, "__psy6 missing");
  assert.equal(Object.keys(dev.mutes).length, 6);
  assert.equal(dev.patterns.kick.length, 16);
});

test("self-test renders non-silent bar (all voices scheduled)", async () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  const st = await dev.selfTest();
  assert.equal(st.ok, true, JSON.stringify(st));
  assert.ok(st.rms > 0.01, "rms too low: " + st.rms);
});

test("full FX chain wired: compressor, shaper, convolver, delays", async () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  await dev.init();
  assert.ok(dev.comp && dev.shaper && dev.dL && dev.dR && dev.reverbIn, "fx chain incomplete");
  assert.equal(env.counters.comp, 1);
  assert.equal(env.counters.shaper, 1);
  assert.equal(env.counters.conv, 1);
});

test("Play schedules voices and advances steps; Stop stops", async () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  const before = env.counters.oscStart;
  env.elements.playBtn.dispatch("click");
  await sleep(400);
  try {
    assert.equal(dev.isPlaying, true, "not playing after Play");
    assert.ok(env.counters.oscStart > before, "no voices scheduled");
    assert.ok(dev.absStep > 0, "absStep did not advance");
  } finally {
    env.elements.playBtn.dispatch("click");
    await sleep(60);
  }
  assert.equal(dev.isPlaying, false, "Stop did not stop");
});

test("arranger: INTRO -> BUILD after 8 bars; part gains follow section", async () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  await dev.init();
  for (let i = 0; i < 8; i++) dev.advanceBar(0);
  assert.equal(dev.arr.secIdx, 1, "expected BUILD");
  assert.equal(dev.partGains.ARP.gain.value, 1, "ARP should be active in BUILD");
  assert.equal(dev.partGains.LEAD.gain.value, 0, "LEAD should be muted in BUILD");
  for (let i = 0; i < 8; i++) dev.advanceBar(0);
  assert.equal(dev.arr.secIdx, 2, "expected DROP");
  assert.equal(dev.partGains.LEAD.gain.value, 1, "LEAD active in DROP");
});

test("full 48-bar cycle: cycle++, variation++, patterns mutate", async () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  await dev.init();
  const before = JSON.stringify(dev.patterns);
  for (let i = 0; i < 48; i++) dev.advanceBar(0);
  assert.equal(dev.arr.cycle, 1, "cycle should increment");
  assert.equal(dev.variation, 2, "variation should increment");
  assert.notEqual(JSON.stringify(dev.patterns), before, "patterns mutated");
});

test("pattern generator deterministic per seed", () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  const a = JSON.stringify(dev.makePatterns(42));
  const b = JSON.stringify(dev.makePatterns(42));
  assert.equal(a, b, "same seed must give same patterns");
});

test("knobs: bpm updates delay time; filter moves djFilter; drive curve", async () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  await dev.init();
  dev.setKnob("bpm", 1);
  assert.equal(Math.round(dev.bpm), 165);
  const beat = 60 / dev.bpm;
  assert.ok(Math.abs(dev.dL.delayTime.value - beat * 0.75) < 0.001, "delay not tempo-synced");
  dev.setKnob("filter", 0.25);
  assert.ok(dev.djFilter.frequency.value < 500, "djFilter should close: " + dev.djFilter.frequency.value);
  dev.setKnob("drive", 0.8);
  assert.ok(dev.shaper.curve && dev.shaper.curve.length === 512, "drive curve missing");
});

test("step sequencer editing toggles gates (click)", () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  const kickRow = env.elements.seq.children[0];
  const stepsDiv = kickRow.children[2];
  assert.equal(stepsDiv.children.length, 16);
  assert.equal(dev.patterns.kick[1], 0, "kick step 1 starts off");
  stepsDiv.children[1].dispatch("click");
  assert.equal(dev.patterns.kick[1], 1, "click should enable step");
  assert.ok(stepsDiv.children[1].className.includes("on"), "step UI not updated");
  stepsDiv.children[1].dispatch("click");
  assert.equal(dev.patterns.kick[1], 0, "second click disables");
});

test("mute button silences part bus", async () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  await dev.init();
  const kickRow = env.elements.seq.children[0];
  const muteBtn = kickRow.children[0];
  muteBtn.dispatch("click");
  assert.equal(dev.mutes.KICK, 1);
  assert.equal(dev.partGains.KICK.gain.value, 0, "KICK bus should be 0 when muted");
  muteBtn.dispatch("click");
  assert.equal(dev.mutes.KICK, 0);
  assert.equal(dev.partGains.KICK.gain.value, 1, "KICK bus restored");
});

test("performance pad triggers lead voice", async () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  await dev.init();
  const before = env.counters.oscStart;
  await dev.triggerPad(4);
  assert.ok(env.counters.oscStart > before, "pad scheduled nothing");
});

test("VARIATE button mutates patterns and bumps variation", () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  const v0 = dev.variation;
  const p0 = JSON.stringify(dev.patterns);
  env.elements.variateBtn.dispatch("click");
  assert.equal(dev.variation, v0 + 1);
  assert.notEqual(JSON.stringify(dev.patterns), p0);
});

/* ---------------- musical property tests (M1) ---------------- */

test("version/style: FULL-ON modal engine v3", () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  const rep = dev.report();
  assert.equal(rep.version, "3.0.0-m1-fullon");
  assert.equal(rep.style, "FULL-ON");
  assert.equal(dev.styleCfg.scale, "phrygianDominant");
});

test("scale: lead + arp notes comply with phrygian dominant", () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  const PD = new Set([0,1,4,5,7,8,10]);
  for (const n of dev.patterns.lead) {
    if (!n) continue;
    const semi = dev.scaleExt[n.deg] % 12;
    assert.ok(PD.has(semi), `lead note ${semi} not in phrygian dominant`);
  }
  for (const n of dev.patterns.arp) {
    if (!n) continue;
    const semi = dev.scaleExt[n.deg] % 12;
    assert.ok(PD.has(semi), `arp note ${semi} not in phrygian dominant`);
  }
});

test("lead: 32-step call & response, stable strong beats (bar 1), accents, density", () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  const lead = dev.patterns.lead;
  assert.equal(lead.length, 32, "lead should be a 2-bar phrase");
  let notes = 0, hasAcc2 = false;
  for (let s = 0; s < 32; s++) {
    if (!lead[s]) continue;
    notes++;
    if (lead[s].acc === 2) hasAcc2 = true;
    if (s < 16 && s % 4 === 0) {
      const semi = dev.scaleExt[lead[s].deg] % 12;
      assert.ok(semi === 0 || semi === 7, `strong beat step ${s} should be root/5th, got ${semi}`);
    }
  }
  assert.ok(notes >= 8, `lead too sparse: ${notes} notes`);
  assert.ok(hasAcc2, "no top accents");
});

test("bass: K-B-B-B gate, root-dominant", () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  const bass = dev.patterns.bass;
  assert.equal(bass.length, 16);
  let roots = 0, total = 0;
  for (let s = 0; s < 16; s++) {
    if (s % 4 === 0) { assert.equal(bass[s], null, `bass on kick step ${s}`); continue; }
    assert.ok(bass[s], `bass missing on off-beat ${s}`);
    total++;
    if (bass[s].n === 0 || bass[s].n === 12) roots++;
  }
  assert.equal(total, 12, "12 off-beat bass notes");
  assert.ok(roots / total >= 0.6, `bass root ratio too low: ${roots}/${total}`);
});

test("kick: four-on-the-floor", () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  assert.deepEqual(dev.patterns.kick, [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0]);
});

test("glide only on characteristic intervals (2-3 semitones)", () => {
  const env = loadAndRun();
  const dev = env.sandbox.window.__psy6;
  const lead = dev.patterns.lead;
  let prev = null;
  for (let s = 0; s < lead.length; s++) {
    if (!lead[s]) continue;
    if (prev !== null && lead[s].slide) {
      const iv = Math.abs(dev.scaleExt[lead[s].deg] - dev.scaleExt[prev]);
      assert.ok(iv === 2 || iv === 3, `slide on non-characteristic interval ${iv} at step ${s}`);
    }
    prev = lead[s].deg;
  }
});
