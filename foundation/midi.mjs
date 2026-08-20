// foundation/midi.mjs — PSY Web MIDI input + 24ppq clock out + SMF export (W7)
// Pure ESM, zero deps. Browser-only paths (navigator.requestMIDIAccess,
// MIDIOutput.send) are wrapped defensively: in Node they throw FoundationError
// or return []. Pure functions (encodeVarLen, decodeVarLen, timelineToMidiFile)
// contain no Math.random, no Date.now, no performance.now.

import { FoundationError } from "./foundation.mjs";

// Re-export FoundationError so consumers can match midi module errors against a single class.
export { FoundationError };

/* ---------------- Web MIDI input ---------------- */
// In Node (no navigator), returns []. In browser, returns the list of MIDI
// inputs as plain objects (id, name, manufacturer, connection).
export async function listMidiInputs() {
  if (typeof navigator === "undefined" || typeof navigator.requestMIDIAccess !== "function") {
    return [];
  }
  let access;
  try {
    access = await navigator.requestMIDIAccess();
  } catch (e) {
    return [];
  }
  const out = [];
  try {
    // MIDIInputMap is iterable as [key, input] pairs.
    for (const input of access.inputs.values()) {
      out.push({
        id: input.id,
        name: input.name,
        manufacturer: input.manufacturer,
        connection: input.connection,
      });
    }
  } catch (e) {
    return out;
  }
  return out;
}

// Open a MIDI input by name or id. In Node, throws FoundationError.
// `onMessage` is called with a normalized MidiMessage object.
export async function openMidiInput(nameOrId, onMessage) {
  if (typeof nameOrId !== "string" || nameOrId.length === 0) {
    throw new FoundationError("nameOrId must be non-empty string");
  }
  if (typeof onMessage !== "function") {
    throw new FoundationError("onMessage must be a function");
  }
  if (typeof navigator === "undefined" || typeof navigator.requestMIDIAccess !== "function") {
    throw new FoundationError("Web MIDI API not available in this environment");
  }
  let access;
  try {
    access = await navigator.requestMIDIAccess();
  } catch (e) {
    throw new FoundationError("requestMIDIAccess failed: " + e.message);
  }
  let target = null;
  for (const input of access.inputs.values()) {
    if (input.name === nameOrId || input.id === nameOrId) {
      target = input;
      break;
    }
  }
  if (!target) throw new FoundationError("MIDI input not found: " + nameOrId);
  const handler = (event) => {
    if (!event || !event.data) return;
    const msg = normalizeMidiMessage(event.data, event.timeStamp || 0);
    if (msg) {
      try { onMessage(msg); } catch (e) { /* swallow consumer errors */ }
    }
  };
  try {
    target.onmidimessage = handler;
  } catch (e) {
    throw new FoundationError("Failed to open MIDI input: " + e.message);
  }
  return {
    close: () => {
      try { target.onmidimessage = null; } catch (e) { /* ignore */ }
    }
  };
}

function normalizeMidiMessage(data, timestamp) {
  if (!(data instanceof Uint8Array) && !Array.isArray(data)) return null;
  if (data.length < 1) return null;
  const status = data[0] & 0xf0;
  const channel = (data[0] & 0x0f) + 1; // 1-indexed
  let type = null;
  if (status === 0x80) type = "noteoff";
  else if (status === 0x90) type = data[2] === 0 ? "noteoff" : "noteon";
  else if (status === 0xb0) type = "cc";
  else if (status === 0xf8) type = "clock";
  else if (status === 0xfa) type = "start";
  else if (status === 0xfc) type = "stop";
  else if (status === 0xfb) type = "continue";
  else return null;
  return {
    type,
    channel: type === "clock" || type === "start" || type === "stop" || type === "continue" ? 0 : channel,
    data1: data.length > 1 ? data[1] : 0,
    data2: data.length > 2 ? data[2] : 0,
    timestamp,
  };
}

/* ---------------- 24ppq MIDI clock out ---------------- */
// Driven externally by the scheduler — does NOT use setInterval.
// start() sends 0xFA (Start). tick(audioTime) sends a single 0xF8 (Clock) at the
// given audio time. stop() sends 0xFC. continue() sends 0xFB.
export class MidiClockOut {
  constructor(output) {
    if (!output || typeof output.send !== "function") {
      throw new FoundationError("MidiClockOut requires an output with a send() method");
    }
    this._output = output;
    this._bpm = 145;
    this._running = false;
  }
  start() {
    this._running = true;
    this._send([0xfa]);
  }
  stop() {
    this._running = false;
    this._send([0xfc]);
  }
  continue() {
    this._running = true;
    this._send([0xfb]);
  }
  // Schedule a single clock tick at audioTime. Caller is responsible for
  // calling tick() 24 times per beat.
  tick(audioTime) {
    if (typeof audioTime !== "number" || !Number.isFinite(audioTime)) {
      throw new FoundationError("audioTime must be finite number");
    }
    this._send([0xf8], audioTime);
  }
  setBpm(bpm) {
    if (typeof bpm !== "number" || !Number.isFinite(bpm) || bpm <= 0) {
      throw new FoundationError("bpm must be positive finite number");
    }
    this._bpm = bpm;
  }
  isRunning() { return this._running; }
  _send(bytes, timestamp) {
    try {
      const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      if (timestamp !== undefined) this._output.send(data, timestamp);
      else this._output.send(data);
    } catch (e) {
      // Defensive: swallow send errors (e.g. device disconnected).
    }
  }
}

/* ---------------- variable-length quantity (SMF delta encoding) ---------------- */
// Standard MIDI variable-length quantity: 7 bits per byte, MSB=1 means more
// bytes follow. Max 4 bytes (28 bits).
export function encodeVarLen(value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new FoundationError("encodeVarLen requires non-negative integer");
  }
  if (value > 0x0fffffff) {
    throw new FoundationError("encodeVarLen value exceeds 28 bits: " + value);
  }
  if (value === 0) return new Uint8Array([0x00]);
  const bytes = [];
  let buffer = value & 0x7f;
  let v = value >>> 7;
  while (v > 0) {
    buffer = (buffer << 8) | ((v & 0x7f) | 0x80);
    v = v >>> 7;
  }
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer = buffer >>> 8;
    else break;
  }
  return new Uint8Array(bytes);
}

export function decodeVarLen(bytes, offset = 0) {
  if (!(bytes instanceof Uint8Array) && !Array.isArray(bytes)) {
    throw new FoundationError("decodeVarLen requires Uint8Array or array");
  }
  if (!Number.isInteger(offset) || offset < 0 || offset >= bytes.length) {
    throw new FoundationError("decodeVarLen offset out of range");
  }
  let value = 0;
  let bytesRead = 0;
  let byte;
  do {
    if (offset + bytesRead >= bytes.length) {
      throw new FoundationError("decodeVarLen: unexpected end of input");
    }
    byte = bytes[offset + bytesRead];
    value = (value << 7) | (byte & 0x7f);
    bytesRead++;
    if (bytesRead > 4) {
      throw new FoundationError("decodeVarLen: value exceeds 28 bits");
    }
  } while (byte & 0x80);
  return { value: value >>> 0, bytesRead };
}

/* ---------------- Standard MIDI File (format 0) export ---------------- */
// Maps each MusicalEvent from `timeline` to a (note on, note off) pair in the
// SMF. Delta times are variable-length encoded. Channel mapping (1-indexed):
// kick=10 (drums), bass=1, perc=10, lead=2, arp=3, pad=4.
const VOICE_TO_CHANNEL_0INDEXED = {
  kick: 9,   // channel 10
  bass: 0,   // channel 1
  perc: 9,   // channel 10
  lead: 1,   // channel 2
  arp: 2,    // channel 3
  pad: 3,    // channel 4
};

// Default GM drum notes (for unpitched events).
const DEFAULT_DRUM_NOTE = {
  kick: 36,
  clap: 39,
  shaker: 42,
  oh: 46,
  openhat: 46,
  snare: 40,
  crash: 49,
};

function noteForVoice(ev) {
  if (ev.midi != null && ev.midi !== undefined) return ev.midi;
  // Unpitched: pick from meta.type or voice default.
  const meta = ev.meta || {};
  if (meta.type && DEFAULT_DRUM_NOTE[meta.type] != null) return DEFAULT_DRUM_NOTE[meta.type];
  if (DEFAULT_DRUM_NOTE[ev.voice] != null) return DEFAULT_DRUM_NOTE[ev.voice];
  return 60;
}

function velocityForEvent(ev) {
  // 100 for accent, 80 for normal, 60 for low.
  if (ev.accent >= 0.8) return 100;
  if (ev.accent >= 0.3) return 80;
  return 60;
}

function writeAsciiArr(arr, offset, str) {
  for (let i = 0; i < str.length; i++) arr[offset + i] = str.charCodeAt(i);
  return offset + str.length;
}

function writeUint32BE(arr, offset, value) {
  arr[offset] = (value >>> 24) & 0xff;
  arr[offset + 1] = (value >>> 16) & 0xff;
  arr[offset + 2] = (value >>> 8) & 0xff;
  arr[offset + 3] = value & 0xff;
  return offset + 4;
}

function writeUint16BE(arr, offset, value) {
  arr[offset] = (value >>> 8) & 0xff;
  arr[offset + 1] = value & 0xff;
  return offset + 2;
}

export function timelineToMidiFile(timeline, opts = {}) {
  if (!timeline || typeof timeline !== "object") {
    throw new FoundationError("timeline must be object");
  }
  if (!Array.isArray(timeline.events)) {
    throw new FoundationError("timeline.events must be array");
  }
  if (!opts || typeof opts.bpm !== "number" || !Number.isFinite(opts.bpm) || opts.bpm <= 0) {
    throw new FoundationError("opts.bpm must be positive finite number");
  }
  const ticksPerBeat = opts.ticksPerBeat != null ? opts.ticksPerBeat : 480;
  if (!Number.isInteger(ticksPerBeat) || ticksPerBeat <= 0) {
    throw new FoundationError("opts.ticksPerBeat must be positive integer");
  }
  const bpm = opts.bpm;
  const mpqn = Math.round(60000000 / bpm); // microseconds per quarter note

  // Build the event list: (tick, type, channel, note, velocity) tuples.
  const events = [];
  for (let i = 0; i < timeline.events.length; i++) {
    const ev = timeline.events[i];
    if (!ev || typeof ev.voice !== "string") continue;
    const channel = VOICE_TO_CHANNEL_0INDEXED[ev.voice];
    if (channel === undefined) continue;
    const note = noteForVoice(ev);
    const velocity = velocityForEvent(ev);
    const tickOn = Math.round(ev.beat * ticksPerBeat);
    const tickOff = Math.round((ev.beat + ev.durationBeats) * ticksPerBeat);
    events.push({ tick: tickOn, type: "on", channel, note, velocity });
    events.push({ tick: tickOff, type: "off", channel, note, velocity: 0x40 });
  }
  // Stable sort by tick; at the same tick, offs come before ons (so notes that
  // end where another begins don't overlap).
  events.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    if (a.type !== b.type) return a.type === "off" ? -1 : 1;
    return 0;
  });

  // Build track bytes: delta-time (varlen) + event bytes, plus tempo meta at
  // tick 0 and End-of-Track meta at the end.
  const trackBytes = [];
  const pushVarLen = (value) => {
    const enc = encodeVarLen(value);
    for (let i = 0; i < enc.length; i++) trackBytes.push(enc[i]);
  };
  // Tempo meta event at tick 0 (delta = 0).
  pushVarLen(0);
  trackBytes.push(0xff, 0x51, 0x03);
  trackBytes.push((mpqn >>> 16) & 0xff, (mpqn >>> 8) & 0xff, mpqn & 0xff);

  let lastTick = 0;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const delta = ev.tick - lastTick;
    pushVarLen(delta >= 0 ? delta : 0);
    if (ev.type === "on") {
      trackBytes.push(0x90 | ev.channel, ev.note, ev.velocity);
    } else {
      trackBytes.push(0x80 | ev.channel, ev.note, ev.velocity);
    }
    lastTick = ev.tick;
  }
  // End of track meta.
  pushVarLen(0);
  trackBytes.push(0xff, 0x2f, 0x00);

  // Header chunk: "MThd" + 6 + format(0) + ntracks(1) + division.
  const header = new Uint8Array(14);
  let p = 0;
  p = writeAsciiArr(header, p, "MThd");
  p = writeUint32BE(header, p, 6);
  p = writeUint16BE(header, p, 0); // format 0
  p = writeUint16BE(header, p, 1); // 1 track
  p = writeUint16BE(header, p, ticksPerBeat); // division

  // Track chunk: "MTrk" + length + bytes.
  const trackHeader = new Uint8Array(8);
  p = 0;
  p = writeAsciiArr(trackHeader, p, "MTrk");
  p = writeUint32BE(trackHeader, p, trackBytes.length);

  const total = header.length + trackHeader.length + trackBytes.length;
  const out = new Uint8Array(total);
  out.set(header, 0);
  out.set(trackHeader, header.length);
  out.set(new Uint8Array(trackBytes), header.length + trackHeader.length);
  return out.buffer;
}
