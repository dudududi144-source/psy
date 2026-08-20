// tests/render.test.mjs — W6 (render) + W7 (MIDI) tests (A–V)
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFoundationSong, resolveSong } from "../foundation/foundation.mjs";
import {
  renderPlan,
  renderSong,
  renderStems,
  audioBufferToWav,
} from "../foundation/render.mjs";
import {
  listMidiInputs,
  openMidiInput,
  MidiClockOut,
  timelineToMidiFile,
  encodeVarLen,
  decodeVarLen,
  FoundationError,
} from "../foundation/midi.mjs";

// Re-import FoundationError from foundation for completeness, since midi.mjs re-exports it.
import { FoundationError as FoundationErrorFromFoundation } from "../foundation/foundation.mjs";

const deepEqualJson = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));

const SONG_SEED = 7;
const song = buildFoundationSong(SONG_SEED);

/* ---------- helper: mock AudioBuffer-like object ---------- */
function mockAudioBuffer(opts) {
  const sampleRate = opts.sampleRate || 44100;
  const numberOfChannels = opts.numberOfChannels || opts.channels || 2;
  const length = opts.length || 4;
  const channels = [];
  for (let c = 0; c < numberOfChannels; c++) {
    const data = opts.channels_data ? opts.channels_data[c] : new Float32Array(length);
    channels.push(data);
  }
  return {
    sampleRate,
    numberOfChannels,
    length,
    getChannelData: (i) => channels[i] || new Float32Array(length),
  };
}

/* ===================== RENDER TESTS (A–K) ===================== */

/* A: renderPlan — same (song, opts) → byte-identical plan (run 10 times) */
test("A: renderPlan deterministic across 10 invocations", () => {
  const plans = [];
  for (let i = 0; i < 10; i++) plans.push(JSON.stringify(renderPlan(song, { bars: 8 })));
  for (let i = 1; i < plans.length; i++) assert.equal(plans[i], plans[0]);
});

/* B: renderPlan — 8 bars → event count matches resolveSong(song, {bars:8}).eventCount */
test("B: renderPlan 8 bars event count matches resolveSong", () => {
  const plan = renderPlan(song, { bars: 8 });
  const timeline = resolveSong(song, { bars: 8 });
  assert.equal(plan.events.length, timeline.eventCount);
});

/* C: renderPlan — 176 bars (full song) → event count matches resolveSong */
test("C: renderPlan 176 bars (full song) event count matches resolveSong", () => {
  const plan = renderPlan(song, { bars: 176 });
  const timeline = resolveSong(song, { bars: 176 });
  assert.equal(plan.events.length, timeline.eventCount);
  assert.equal(plan.events.length, timeline.events.length);
});

/* D: renderSong (metadata mode, no audioContextCtor) → returns { plan } only */
test("D: renderSong metadata mode returns { plan } only, byte-identical to renderPlan", async () => {
  const result = await renderSong(song, { bars: 8 });
  assert.ok(result.plan, "result.plan should be present");
  assert.equal(result.buffer, undefined, "result.buffer should be undefined in metadata mode");
  const directPlan = renderPlan(song, { bars: 8 });
  deepEqualJson(result.plan, directPlan);
});

/* E: renderStems — 6 stems produced (kick, bass, perc, lead, arp, pad), each non-empty */
test("E: renderStems produces 6 stems each with non-empty plan", async () => {
  // Use 64 bars so we cover INTRO + BUILD + DROP — perc/lead/arp only exist
  // from BUILD onward per SECTION_PARTS in foundation.mjs.
  const { stems, plans } = await renderStems(song, { bars: 64 });
  const voices = ["kick", "bass", "perc", "lead", "arp", "pad"];
  for (const v of voices) {
    assert.ok(stems.hasOwnProperty(v), "stems should have key " + v);
    assert.ok(plans.hasOwnProperty(v), "plans should have key " + v);
    assert.ok(plans[v].events.length > 0, "stem plan " + v + " should be non-empty");
    assert.equal(plans[v].events.every((e) => e.voice === v), true, "stem " + v + " should only contain events for voice " + v);
  }
  assert.ok(plans.hasOwnProperty("master"), "plans should have master key");
});

/* F: renderStems — master plan = concat of 6 stem plans sorted by audioTime */
test("F: renderStems master plan = concat of 6 stem plans sorted by audioTime", async () => {
  const { plans } = await renderStems(song, { bars: 16 });
  const voices = ["kick", "bass", "perc", "lead", "arp", "pad"];
  const expected = [];
  for (const v of voices) for (const e of plans[v].events) expected.push(e);
  expected.sort((a, b) => {
    if (a.audioTime < b.audioTime) return -1;
    if (a.audioTime > b.audioTime) return 1;
    return 0;
  });
  assert.equal(plans.master.events.length, expected.length);
  deepEqualJson(plans.master.events, expected);
});

/* G: audioBufferToWav — 44-byte header (RIFF + fmt + data chunk headers) */
test("G: audioBufferToWav header is 44 bytes", () => {
  const buf = mockAudioBuffer({ length: 4, numberOfChannels: 2 });
  const wav = audioBufferToWav(buf);
  assert.ok(wav instanceof ArrayBuffer);
  const view = new DataView(wav);
  // 12 bytes RIFF + 24 bytes fmt + 8 bytes data header = 44 bytes
  assert.equal(wav.byteLength, 44 + 4 * 2 * 2);
  // ASCII "RIFF" at offset 0
  assert.equal(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)), "RIFF");
  // ASCII "WAVE" at offset 8
  assert.equal(String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11)), "WAVE");
  // ASCII "fmt " at offset 12
  assert.equal(String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15)), "fmt ");
  // ASCII "data" at offset 36
  assert.equal(String.fromCharCode(view.getUint8(36), view.getUint8(37), view.getUint8(38), view.getUint8(39)), "data");
});

/* H: audioBufferToWav — format = 1 (PCM), channels match, sampleRate matches, bitsPerSample = 16 */
test("H: audioBufferToWav fmt fields", () => {
  const buf = mockAudioBuffer({ length: 2, numberOfChannels: 2, sampleRate: 48000 });
  const wav = audioBufferToWav(buf);
  const view = new DataView(wav);
  assert.equal(view.getUint32(16, true), 16);    // fmt subchunk size
  assert.equal(view.getUint16(20, true), 1);      // audioFormat = 1 (PCM)
  assert.equal(view.getUint16(22, true), 2);      // numChannels
  assert.equal(view.getUint32(24, true), 48000);  // sampleRate
  assert.equal(view.getUint16(32, true), 4);      // blockAlign = 2 channels * 2 bytes
  assert.equal(view.getUint16(34, true), 16);     // bitsPerSample
});

/* I: audioBufferToWav — data chunk size = numSamples * channels * 2 (16-bit) */
test("I: audioBufferToWav data chunk size = numSamples * channels * 2", () => {
  const numFrames = 100;
  const numChannels = 2;
  const buf = mockAudioBuffer({ length: numFrames, numberOfChannels: numChannels });
  const wav = audioBufferToWav(buf);
  const view = new DataView(wav);
  const dataSize = view.getUint32(40, true);
  assert.equal(dataSize, numFrames * numChannels * 2);
  assert.equal(wav.byteLength, 44 + dataSize);
  // byteRate should be sampleRate * blockAlign
  assert.equal(view.getUint32(28, true), 44100 * numChannels * 2);
});

/* J: audioBufferToWav — clamping (input > 1.0 → 32767, input < -1.0 → -32768) */
test("J: audioBufferToWav clamps out-of-range samples", () => {
  // 1 frame, 1 channel, with samples > 1.0 and < -1.0
  const leftData = new Float32Array([2.0, -2.0, 0.5, -0.5, 0.0]);
  const buf = mockAudioBuffer({ length: 5, numberOfChannels: 1, channels_data: [leftData] });
  const wav = audioBufferToWav(buf);
  const view = new DataView(wav);
  // Samples start at offset 44
  const s0 = view.getInt16(44, true);
  const s1 = view.getInt16(46, true);
  const s2 = view.getInt16(48, true);
  const s3 = view.getInt16(50, true);
  const s4 = view.getInt16(52, true);
  assert.equal(s0, 32767, "input 2.0 should clamp to 32767");
  assert.equal(s1, -32768, "input -2.0 should clamp to -32768");
  assert.equal(s4, 0, "input 0.0 should be 0");
  // Sanity: 0.5 * 32767 = 16383.5 → round to 16384
  assert.ok(s2 > 0 && s2 < 32767, "input 0.5 should be a positive value < 32767");
  assert.ok(s3 < 0 && s3 > -32768, "input -0.5 should be a negative value > -32768");
});

/* K: audioBufferToWav — silence (all zeros input) → all-zero data bytes */
test("K: audioBufferToWav silence → all-zero data bytes", () => {
  const buf = mockAudioBuffer({ length: 64, numberOfChannels: 2 });
  const wav = audioBufferToWav(buf);
  const view = new DataView(wav);
  const dataSize = view.getUint32(40, true);
  assert.equal(dataSize, 64 * 2 * 2);
  for (let i = 44; i < wav.byteLength; i++) {
    assert.equal(view.getUint8(i), 0, "byte at offset " + i + " should be 0");
  }
});

/* ===================== MIDI TESTS (L–V) ===================== */

const SONG_FOR_MIDI = buildFoundationSong(42);
const TIMELINE = resolveSong(SONG_FOR_MIDI, { bars: 8 });

/* L: timelineToMidiFile — header "MThd" + track "MTrk" */
test("L: timelineToMidiFile header and track chunk identifiers", () => {
  const smf = timelineToMidiFile(TIMELINE, { bpm: 145 });
  assert.ok(smf instanceof ArrayBuffer);
  const view = new DataView(smf);
  const mthd = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  assert.equal(mthd, "MThd");
  const mtrk = String.fromCharCode(view.getUint8(14), view.getUint8(15), view.getUint8(16), view.getUint8(17));
  assert.equal(mtrk, "MTrk");
});

/* M: timelineToMidiFile — format=0, ntracks=1, division=480 (default ticksPerBeat) */
test("M: timelineToMidiFile format=0, ntracks=1, division=480", () => {
  const smf = timelineToMidiFile(TIMELINE, { bpm: 145 });
  const view = new DataView(smf);
  assert.equal(view.getUint32(4, false), 6);      // MThd length
  assert.equal(view.getUint16(8, false), 0);     // format
  assert.equal(view.getUint16(10, false), 1);   // ntracks
  assert.equal(view.getUint16(12, false), 480); // division (default)
});

/* N: timelineToMidiFile — Tempo meta event present (0xFF 0x51 0x03) */
test("N: timelineToMidiFile Tempo meta event present", () => {
  const smf = timelineToMidiFile(TIMELINE, { bpm: 120 });
  const bytes = new Uint8Array(smf);
  let found = false;
  for (let i = 18; i < bytes.length - 3; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0x51 && bytes[i + 2] === 0x03) {
      found = true;
      // Verify tempo value: 60000000 / 120 = 500000 = 0x07A120
      const mpqn = (bytes[i + 3] << 16) | (bytes[i + 4] << 8) | bytes[i + 5];
      assert.equal(mpqn, 500000);
      break;
    }
  }
  assert.ok(found, "Tempo meta (0xFF 0x51 0x03) should be present");
});

/* O: timelineToMidiFile — End of track meta present (0xFF 0x2F 0x00) */
test("O: timelineToMidiFile End of track meta present", () => {
  const smf = timelineToMidiFile(TIMELINE, { bpm: 145 });
  const bytes = new Uint8Array(smf);
  const len = bytes.length;
  // EOT should be the last 3 bytes of the track chunk.
  assert.equal(bytes[len - 3], 0xff);
  assert.equal(bytes[len - 2], 0x2f);
  assert.equal(bytes[len - 1], 0x00);
});

/* P: timelineToMidiFile — event count in SMF matches timeline.eventCount */
test("P: timelineToMidiFile note-on count matches timeline.eventCount", () => {
  const smf = timelineToMidiFile(TIMELINE, { bpm: 145 });
  const bytes = new Uint8Array(smf);
  let noteOnCount = 0;
  // Skip header (14 bytes) + track header (8 bytes) = 22 bytes. Then walk events.
  // We count status bytes in range 0x90..0x9F (note on with velocity > 0).
  for (let i = 22; i < bytes.length; i++) {
    const b = bytes[i];
    if (b >= 0x90 && b <= 0x9f) {
      // Following 2 bytes are note + velocity. Skip them.
      if (i + 2 < bytes.length && bytes[i + 2] > 0) noteOnCount++;
      i += 2;
    }
  }
  assert.equal(noteOnCount, TIMELINE.eventCount);
});

/* Q: timelineToMidiFile — byte-identical per (timeline, opts) */
test("Q: timelineToMidiFile deterministic byte output", () => {
  const a = new Uint8Array(timelineToMidiFile(TIMELINE, { bpm: 145 }));
  const b = new Uint8Array(timelineToMidiFile(TIMELINE, { bpm: 145 }));
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) assert.equal(a[i], b[i], "byte " + i + " differs");
});

/* R: encodeVarLen — specific values */
test("R: encodeVarLen specific values", () => {
  deepEqualJson(Array.from(encodeVarLen(0)), [0x00]);
  deepEqualJson(Array.from(encodeVarLen(127)), [0x7f]);
  deepEqualJson(Array.from(encodeVarLen(128)), [0x81, 0x00]);
  deepEqualJson(Array.from(encodeVarLen(0x4000)), [0x81, 0x80, 0x00]);
});

/* S: decodeVarLen round-trip */
test("S: decodeVarLen round-trip", () => {
  const values = [0, 1, 127, 128, 1000, 100000];
  for (const v of values) {
    const enc = encodeVarLen(v);
    const { value, bytesRead } = decodeVarLen(enc, 0);
    assert.equal(value, v, "decode(encode(" + v + ")) !== " + v);
    assert.equal(bytesRead, enc.length, "bytesRead mismatch for " + v);
  }
});

/* T: MidiClockOut — start/stop/continue send correct bytes */
test("T: MidiClockOut start/stop/continue send correct bytes", () => {
  const sent = [];
  const mockOutput = {
    send: (data, timestamp) => {
      sent.push({ data: Array.from(data), timestamp });
    }
  };
  const clock = new MidiClockOut(mockOutput);
  clock.start();
  clock.stop();
  clock.continue();
  assert.equal(sent.length, 3);
  assert.deepEqual(sent[0].data, [0xfa]); // Start
  assert.deepEqual(sent[1].data, [0xfc]); // Stop
  assert.deepEqual(sent[2].data, [0xfb]); // Continue
});

/* U: MidiClockOut — tick(t) sends [0xF8] */
test("U: MidiClockOut tick sends 0xF8", () => {
  const sent = [];
  const mockOutput = {
    send: (data, timestamp) => {
      sent.push({ data: Array.from(data), timestamp });
    }
  };
  const clock = new MidiClockOut(mockOutput);
  clock.tick(1.5);
  clock.tick(2.0);
  assert.equal(sent.length, 2);
  assert.deepEqual(sent[0].data, [0xf8]);
  assert.equal(sent[0].timestamp, 1.5);
  assert.deepEqual(sent[1].data, [0xf8]);
  assert.equal(sent[1].timestamp, 2.0);
});

/* V: listMidiInputs() in Node returns [] */
test("V: listMidiInputs returns [] in Node", async () => {
  const inputs = await listMidiInputs();
  assert.ok(Array.isArray(inputs));
  assert.equal(inputs.length, 0);
  // openMidiInput should throw FoundationError in Node.
  await assert.rejects(
    () => openMidiInput("nonexistent", () => {}),
    (err) => err instanceof FoundationError || err instanceof FoundationErrorFromFoundation
  );
});

/* ---------- extra: renderStems in metadata mode produces no buffers ---------- */
test("W: renderStems metadata mode returns null buffers + plans", async () => {
  const { stems, plans } = await renderStems(song, { bars: 16 });
  const voices = ["kick", "bass", "perc", "lead", "arp", "pad", "master"];
  for (const v of voices) {
    assert.equal(stems[v], null, "stem " + v + " should be null in metadata mode");
    assert.ok(plans[v], "plan " + v + " should exist");
    assert.equal(plans[v].version, "1.0");
    assert.equal(plans[v].songSeed, song.seed);
  }
});

/* ---------- extra: renderPlan defaults to full song when bars omitted ---------- */
test("X: renderPlan defaults to full song bars when bars omitted", () => {
  const plan = renderPlan(song);
  assert.equal(plan.events.length, resolveSong(song).eventCount);
  assert.equal(plan.events.length, resolveSong(song, { bars: song.totalBars }).eventCount);
});

/* ---------- extra: encodeVarLen rejects negative / non-integer ---------- */
test("Y: encodeVarLen rejects invalid inputs", () => {
  assert.throws(() => encodeVarLen(-1), FoundationError);
  assert.throws(() => encodeVarLen(1.5), FoundationError);
  assert.throws(() => encodeVarLen(0x10000000), FoundationError);
});

/* ---------- extra: timelineToMidiFile rejects invalid bpm ---------- */
test("Z: timelineToMidiFile rejects invalid bpm", () => {
  assert.throws(() => timelineToMidiFile(TIMELINE, { bpm: 0 }), FoundationError);
  assert.throws(() => timelineToMidiFile(TIMELINE, { bpm: -10 }), FoundationError);
  assert.throws(() => timelineToMidiFile(TIMELINE, { bpm: NaN }), FoundationError);
});
