// foundation/render.mjs — PSY offline render + stem export + WAV encoder (W6)
// Pure ESM, zero deps. Defensive: works in Node (metadata mode) without an
// AudioContext, and in the browser when an OfflineAudioContext-like constructor
// is injected. renderPlan / audioBufferToWav are pure (no Math.random, no
// Date.now, no performance.now). Determinism: byte-identical per (song, opts).

import {
  FoundationError,
  deepFreeze,
  resolveSong,
  validateSong,
} from "./foundation.mjs";

const DEFAULT_SAMPLE_RATE = 44100;
const DEFAULT_CHANNELS = 2;
const VOICE_ORDER = ["kick", "bass", "perc", "lead", "arp", "pad"];

/* ---------------- pure plan (deterministic per song + opts) ---------------- */
// Build a RenderPlan: schedule-ahead list of (audioTime, voice, midi, duration,
// velocity, ...) tuples. Pure — same (song, opts) always returns same plan.
export function renderPlan(song, opts = {}) {
  validateSong(song);
  const bars = opts.bars != null ? opts.bars : song.totalBars;
  const sampleRate = opts.sampleRate != null ? opts.sampleRate : DEFAULT_SAMPLE_RATE;
  if (!Number.isInteger(bars) || bars < 0) throw new FoundationError("opts.bars must be integer >= 0");
  if (!Number.isInteger(sampleRate) || sampleRate <= 0) throw new FoundationError("opts.sampleRate must be positive integer");
  const secPerBeat = 60 / song.bpm;
  const timeline = resolveSong(song, { bars });
  const out = [];
  for (let i = 0; i < timeline.events.length; i++) {
    const ev = timeline.events[i];
    if (opts.voice && ev.voice !== opts.voice) continue;
    out.push({
      audioTime: ev.beat * secPerBeat,
      voice: ev.voice,
      midi: ev.midi,
      durationBeats: ev.durationBeats,
      velocity: ev.velocity,
      accent: ev.accent,
      bar: ev.bar,
      step: ev.step,
      section: ev.section,
      phrase: ev.phrase,
      provenance: ev.provenance,
    });
  }
  return deepFreeze({
    version: "1.0",
    songSeed: song.seed,
    sampleRate,
    lengthSeconds: bars * 4 * secPerBeat,
    events: out,
  });
}

/* ---------------- render song (offline or metadata mode) ---------------- */
// If `audioContextCtor` is provided (browser OfflineAudioContext), schedule the
// events and render a real buffer. Otherwise return metadata only ({ plan }).
// In both cases the plan is byte-identical per (song, opts) — that is what we test.
export async function renderSong(song, opts = {}) {
  validateSong(song);
  const bars = opts.bars != null ? opts.bars : song.totalBars;
  const sampleRate = opts.sampleRate != null ? opts.sampleRate : DEFAULT_SAMPLE_RATE;
  const channels = opts.channels != null ? opts.channels : DEFAULT_CHANNELS;
  if (channels !== 1 && channels !== 2) throw new FoundationError("opts.channels must be 1 or 2");
  const plan = renderPlan(song, { bars, sampleRate, voice: opts.voice });
  if (typeof opts.audioContextCtor !== "function") {
    return { plan };
  }
  // Browser path: create OfflineAudioContext, schedule blips, render.
  const lengthSeconds = plan.lengthSeconds + 0.5; // tail
  const length = Math.ceil(lengthSeconds * sampleRate);
  const OfflineCtx = opts.audioContextCtor;
  let ctx;
  try {
    // Standard signature: new OfflineAudioContext(numberOfChannels, length, sampleRate)
    ctx = new OfflineCtx(channels, length, sampleRate);
  } catch (e) {
    throw new FoundationError("Failed to construct OfflineAudioContext: " + e.message);
  }
  schedulePlanIntoContext(ctx, plan.events);
  let buffer;
  try {
    buffer = await ctx.startRendering();
  } catch (e) {
    throw new FoundationError("startRendering failed: " + e.message);
  }
  return { plan, buffer };
}

/* ---------------- render per-device stems ---------------- */
// 6 voice-specific plans + 1 master plan (= concat of 6 stem plans sorted by
// audioTime). In metadata mode (no audioContextCtor), stems are null but each
// plan is fully populated.
export async function renderStems(song, opts = {}) {
  validateSong(song);
  const sampleRate = opts.sampleRate != null ? opts.sampleRate : DEFAULT_SAMPLE_RATE;
  const plans = {};
  const stems = {};
  for (let i = 0; i < VOICE_ORDER.length; i++) {
    const voice = VOICE_ORDER[i];
    const voicePlan = renderPlan(song, { bars: opts.bars, sampleRate, voice });
    plans[voice] = voicePlan;
    stems[voice] = null;
  }
  // Master plan = concat of 6 stem plans sorted by audioTime (stable sort).
  const masterEvents = [];
  for (let i = 0; i < VOICE_ORDER.length; i++) {
    const voice = VOICE_ORDER[i];
    const evs = plans[voice].events;
    for (let j = 0; j < evs.length; j++) masterEvents.push(evs[j]);
  }
  stableSortByAudioTime(masterEvents);
  plans.master = deepFreeze({
    version: "1.0",
    songSeed: song.seed,
    sampleRate,
    lengthSeconds: plans[VOICE_ORDER[0]].lengthSeconds,
    events: masterEvents,
  });
  stems.master = null;
  // Browser path: render each stem to a real buffer (defensive — best effort).
  if (typeof opts.audioContextCtor === "function") {
    for (let i = 0; i < VOICE_ORDER.length; i++) {
      const voice = VOICE_ORDER[i];
      try {
        const rendered = await renderSong(song, {
          bars: opts.bars, sampleRate, channels: 2, voice,
          audioContextCtor: opts.audioContextCtor,
        });
        stems[voice] = rendered.buffer;
      } catch (e) {
        stems[voice] = null;
      }
    }
    // Master = sum of stems. For now we re-render the whole song (browser only).
    try {
      const master = await renderSong(song, {
        bars: opts.bars, sampleRate, channels: 2,
        audioContextCtor: opts.audioContextCtor,
      });
      stems.master = master.buffer;
    } catch (e) {
      stems.master = null;
    }
  }
  return { stems, plans };
}

/* ---------------- WAV encoder (16-bit PCM, RIFF/WAVE) ---------------- */
// Accepts an AudioBuffer-like object: { sampleRate, numberOfChannels,
// getChannelData(i): Float32Array, length }. Returns an ArrayBuffer of bytes.
export function audioBufferToWav(buffer) {
  if (!buffer || typeof buffer !== "object") throw new FoundationError("buffer must be object");
  if (!Number.isInteger(buffer.sampleRate) || buffer.sampleRate <= 0) throw new FoundationError("buffer.sampleRate must be positive integer");
  if (!Number.isInteger(buffer.numberOfChannels) || buffer.numberOfChannels < 1) throw new FoundationError("buffer.numberOfChannels must be >= 1");
  if (!Number.isInteger(buffer.length) || buffer.length < 0) throw new FoundationError("buffer.length must be >= 0");
  if (typeof buffer.getChannelData !== "function") throw new FoundationError("buffer.getChannelData must be a function");

  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  // RIFF chunk: 12 bytes (RIFF + chunkSize + WAVE)
  // fmt subchunk: 24 bytes (fmt + 16 + audioFormat + channels + sampleRate + byteRate + blockAlign + bitsPerSample)
  // data subchunk header: 8 bytes (data + dataSize)
  // total header = 44 bytes
  const totalSize = 44 + dataSize;
  const out = new ArrayBuffer(totalSize);
  const view = new DataView(out);
  let p = 0;
  // RIFF header
  writeAscii(view, p, "RIFF"); p += 4;
  view.setUint32(p, 36 + dataSize, true); p += 4; // chunkSize = totalSize - 8
  writeAscii(view, p, "WAVE"); p += 4;
  // fmt subchunk
  writeAscii(view, p, "fmt "); p += 4;
  view.setUint32(p, 16, true); p += 4; // subchunk size = 16 for PCM
  view.setUint16(p, 1, true); p += 2; // audioFormat = 1 (PCM)
  view.setUint16(p, numChannels, true); p += 2;
  view.setUint32(p, sampleRate, true); p += 4;
  view.setUint32(p, byteRate, true); p += 4;
  view.setUint16(p, blockAlign, true); p += 2;
  view.setUint16(p, bitsPerSample, true); p += 2;
  // data subchunk
  writeAscii(view, p, "data"); p += 4;
  view.setUint32(p, dataSize, true); p += 4;
  // Interleaved 16-bit signed PCM samples, clamped to [-1, 1] before quantization.
  // Positive samples use *32767 (peak 32767), negative samples use *32768 (floor -32768).
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const channelData = buffer.getChannelData(c);
      const sample = channelData[i];
      const clamped = sample > 1 ? 1 : (sample < -1 ? -1 : sample);
      let intSample;
      if (clamped >= 0) intSample = Math.round(clamped * 32767);
      else intSample = Math.round(clamped * 32768);
      if (intSample > 32767) intSample = 32767;
      if (intSample < -32768) intSample = -32768;
      view.setInt16(p, intSample, true);
      p += 2;
    }
  }
  return out;
}

/* ---------------- internal helpers ---------------- */
// Schedule a plan's events into an AudioContext (browser path). Each event gets
// a short oscillator blip — this is intentionally minimal: the canonical audio
// engine lives elsewhere (dsp.mjs / index.html); render.mjs only needs to drive
// a deterministic schedule-ahead plan into an OfflineAudioContext so that
// `buffer` exists when one is requested.
function schedulePlanIntoContext(ctx, events) {
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const t = ev.audioTime;
    // Fixed 0.2s blip per event — the canonical synth engine lives in dsp.mjs /
    // index.html; render.mjs only needs to drive a deterministic schedule-ahead
    // plan into an OfflineAudioContext so `buffer` exists when requested.
    const dur = 0.2;
    const freq = ev.midi != null ? midiToFreq(ev.midi) : (ev.voice === "kick" ? 60 : 220);
    let osc, gain;
    try {
      osc = ctx.createOscillator();
      gain = ctx.createGain();
    } catch (e) {
      continue;
    }
    osc.type = voiceToOscType(ev.voice);
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const peak = Math.max(0.001, Math.min(0.5, ev.velocity * 0.3));
    try {
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(peak, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.start(t);
      osc.stop(t + dur + 0.01);
    } catch (e) {
      // Defensive: if scheduling fails (e.g. ctx closed), skip this event.
    }
  }
}

function voiceToOscType(voice) {
  switch (voice) {
    case "kick": return "sine";
    case "bass": return "sawtooth";
    case "perc": return "square";
    case "lead": return "sawtooth";
    case "arp": return "triangle";
    case "pad": return "sine";
    default: return "sine";
  }
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function writeAscii(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

// Stable sort by audioTime. JS Array.prototype.sort is stable in Node 12+.
function stableSortByAudioTime(arr) {
  arr.sort((a, b) => {
    if (a.audioTime < b.audioTime) return -1;
    if (a.audioTime > b.audioTime) return 1;
    return 0;
  });
  return arr;
}
