/**
 * PSY SOUND BANK — Professional instrument library
 *
 * ARCHITECTURE:
 *   - 8 categories: drum, bass, lead, pad, pluck, arp, fx, texture
 *   - 6 genres: PSYTRANCE, TECHNO, TRANCE, PROGRESSIVE, DARK-PSY, GOA
 *   - 150+ presets total (each with full parameter spec)
 *   - Unified parameter schema (works with PooledEngine)
 *
 * Each preset defines:
 *   - engine: DRUM | SYNTH | FM | NOISE
 *   - Full ADSR envelope
 *   - Filter (type, cutoff, resonance, envelope)
 *   - LFO (rate, depth, destination)
 *   - Effects sends (delay, reverb)
 *   - Genre tags (for auto-selection by learning system)
 */

// ─── Types ─────────────────────────────────────────────────────────────────
export type EngineType = 'DRUM' | 'SYNTH' | 'FM' | 'NOISE' | 'WAVETABLE';
export type DrumType = 'kick' | 'snare' | 'clap' | 'hatC' | 'hatO' | 'tom' | 'rim' | 'glitch' | 'shaker' | 'riser' | 'impact' | 'downlifter';
export type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch' | 'allpass';
export type Category = 'drum' | 'bass' | 'lead' | 'pad' | 'pluck' | 'arp' | 'fx' | 'texture';
export type Genre = 'PSYTRANCE' | 'TECHNO' | 'TRANCE' | 'PROGRESSIVE' | 'DARK-PSY' | 'GOA' | 'ANY';
export type LFODest = 'off' | 'cutoff' | 'pitch' | 'gain' | 'pan';

export interface SoundPreset {
  id: string;
  name: string;
  genre: Genre;
  cat: Category;
  engine: EngineType;

  // Drum-specific
  drumType?: DrumType;
  tune?: number;
  decay?: number;
  tone?: number;
  punch?: number;

  // Synth oscillators
  wave1?: OscillatorType;
  wave2?: OscillatorType;
  oct2?: number;       // octave offset for osc2
  detune?: number;     // cents
  fmAmount?: number;   // for FM engine
  fmRatio?: number;    // carrier:modulator ratio

  // Filter
  fType?: FilterType;
  cutoff?: number;
  res?: number;
  fEnvAmt?: number;    // filter envelope amount
  fDecay?: number;     // filter envelope decay

  // Amp envelope (ADSR)
  atk?: number;
  dec?: number;
  sus?: number;
  rel?: number;
  gate?: number;       // note gate (multiplier of step duration)

  // LFO
  lfoRate?: number;
  lfoDepth?: number;
  lfoDest?: LFODest;
  lfoShape?: OscillatorType;

  // Effects sends
  sendDelay?: number;  // 0-1
  sendReverb?: number; // 0-1

  // Polyphony
  poly?: number;

  // Velocity sensitivity
  velSens?: number;    // 0-1

  // Musical context (for learning system auto-selection)
  scaleDegrees?: number[]; // which scale degrees this fits (e.g., [0, 4, 7] = root, 3rd, 5th)
  energyLevel?: number;    // 0-1, how energetic
  moodTags?: string[];     // ['dark', 'hypnotic', 'uplifting', 'aggressive', 'ethereal']
}

// ─── DRUM PRESETS (40 drums) ──────────────────────────────────────────────
export const DRUMS: SoundPreset[] = [
  // PSYTRANCE drums (12)
  { id: 'PSY-KICK-DEEP', name: 'Psy Deep Kick', genre: 'PSYTRANCE', cat: 'drum', engine: 'DRUM', drumType: 'kick', tune: 0.7, decay: 1.15, punch: 0.4, sendReverb: 0.05 },
  { id: 'PSY-KICK-TIGHT', name: 'Psy Tight Kick', genre: 'PSYTRANCE', cat: 'drum', engine: 'DRUM', drumType: 'kick', tune: 0.9, decay: 0.5, punch: 0.85 },
  { id: 'PSY-KICK-PUNCHY', name: 'Psy Punchy Kick', genre: 'PSYTRANCE', cat: 'drum', engine: 'DRUM', drumType: 'kick', tune: 0.8, decay: 0.7, punch: 0.95 },
  { id: 'PSY-KICK-SUB', name: 'Psy Sub Kick', genre: 'PSYTRANCE', cat: 'drum', engine: 'DRUM', drumType: 'kick', tune: 0.6, decay: 1.4, punch: 0.2, sendReverb: 0.08 },
  { id: 'PSY-SNARE-TIGHT', name: 'Psy Tight Snare', genre: 'PSYTRANCE', cat: 'drum', engine: 'DRUM', drumType: 'snare', tune: 1.1, decay: 0.6, tone: 1.3, sendReverb: 0.15 },
  { id: 'PSY-SNARE-OPEN', name: 'Psy Open Snare', genre: 'PSYTRANCE', cat: 'drum', engine: 'DRUM', drumType: 'snare', tune: 1.0, decay: 0.9, tone: 1.1, sendReverb: 0.2 },
  { id: 'PSY-CLAP-PSY', name: 'Psy Clap', genre: 'PSYTRANCE', cat: 'drum', engine: 'DRUM', drumType: 'clap', tune: 1.0, decay: 0.7, tone: 1.0, sendReverb: 0.25 },
  { id: 'PSY-HAT-CLOSED', name: 'Psy Closed Hat', genre: 'PSYTRANCE', cat: 'drum', engine: 'DRUM', drumType: 'hatC', tune: 1.0, decay: 0.3, tone: 1.2 },
  { id: 'PSY-HAT-OPEN', name: 'Psy Open Hat', genre: 'PSYTRANCE', cat: 'drum', engine: 'DRUM', drumType: 'hatO', tune: 1.0, decay: 0.8, tone: 1.0, sendReverb: 0.1 },
  { id: 'PSY-PERC-MAIN', name: 'Psy Main Perc', genre: 'PSYTRANCE', cat: 'drum', engine: 'DRUM', drumType: 'perc', tune: 1.2, decay: 0.5, tone: 1.4 },
  { id: 'PSY-RIM-SHOT', name: 'Psy Rim Shot', genre: 'PSYTRANCE', cat: 'drum', engine: 'DRUM', drumType: 'rim', tune: 1.0, decay: 0.4, tone: 1.0 },
  { id: 'PSY-GLITCH-MAIN', name: 'Psy Main Glitch', genre: 'PSYTRANCE', cat: 'drum', engine: 'DRUM', drumType: 'glitch', tune: 1.0, decay: 0.6, tone: 1.5 },
  // TECHNO drums (12)
  { id: 'TEC-KICK-DEEP', name: 'Techno Deep Kick', genre: 'TECHNO', cat: 'drum', engine: 'DRUM', drumType: 'kick', tune: 0.65, decay: 1.3, punch: 0.3, sendReverb: 0.04 },
  { id: 'TEC-KICK-TIGHT', name: 'Techno Tight Kick', genre: 'TECHNO', cat: 'drum', engine: 'DRUM', drumType: 'kick', tune: 0.85, decay: 0.4, punch: 0.9 },
  { id: 'TEC-KICK-PUNCHY', name: 'Techno Punchy Kick', genre: 'TECHNO', cat: 'drum', engine: 'DRUM', drumType: 'kick', tune: 0.75, decay: 0.6, punch: 0.95 },
  { id: 'TEC-SNARE-TIGHT', name: 'Techno Tight Snare', genre: 'TECHNO', cat: 'drum', engine: 'DRUM', drumType: 'snare', tune: 1.0, decay: 0.5, tone: 1.2, sendReverb: 0.12 },
  { id: 'TEC-SNARE-OPEN', name: 'Techno Open Snare', genre: 'TECHNO', cat: 'drum', engine: 'DRUM', drumType: 'snare', tune: 0.9, decay: 0.8, tone: 1.0, sendReverb: 0.18 },
  { id: 'TEC-CLAP-TEC', name: 'Techno Clap', genre: 'TECHNO', cat: 'drum', engine: 'DRUM', drumType: 'clap', tune: 1.0, decay: 0.6, tone: 0.9, sendReverb: 0.2 },
  { id: 'TEC-HAT-CLOSED', name: 'Techno Closed Hat', genre: 'TECHNO', cat: 'drum', engine: 'DRUM', drumType: 'hatC', tune: 1.0, decay: 0.25, tone: 1.1 },
  { id: 'TEC-HAT-OPEN', name: 'Techno Open Hat', genre: 'TECHNO', cat: 'drum', engine: 'DRUM', drumType: 'hatO', tune: 1.0, decay: 0.7, tone: 0.9, sendReverb: 0.08 },
  { id: 'TEC-PERC-MAIN', name: 'Techno Main Perc', genre: 'TECHNO', cat: 'drum', engine: 'DRUM', drumType: 'perc', tune: 1.1, decay: 0.4, tone: 1.3 },
  { id: 'TEC-RIM-SHOT', name: 'Techno Rim Shot', genre: 'TECHNO', cat: 'drum', engine: 'DRUM', drumType: 'rim', tune: 1.0, decay: 0.35, tone: 0.9 },
  { id: 'TEC-GLITCH-MAIN', name: 'Techno Main Glitch', genre: 'TECHNO', cat: 'drum', engine: 'DRUM', drumType: 'glitch', tune: 1.0, decay: 0.5, tone: 1.4 },
  { id: 'TEC-SHAKER-MAIN', name: 'Techno Main Shaker', genre: 'TECHNO', cat: 'drum', engine: 'DRUM', drumType: 'shaker', tune: 1.0, decay: 0.4, tone: 1.2 },
  // TRANCE drums (8)
  { id: 'TRA-KICK-DEEP', name: 'Trance Deep Kick', genre: 'TRANCE', cat: 'drum', engine: 'DRUM', drumType: 'kick', tune: 0.7, decay: 1.2, punch: 0.35, sendReverb: 0.05 },
  { id: 'TRA-KICK-TIGHT', name: 'Trance Tight Kick', genre: 'TRANCE', cat: 'drum', engine: 'DRUM', drumType: 'kick', tune: 0.9, decay: 0.45, punch: 0.85 },
  { id: 'TRA-SNARE-TIGHT', name: 'Trance Tight Snare', genre: 'TRANCE', cat: 'drum', engine: 'DRUM', drumType: 'snare', tune: 1.0, decay: 0.55, tone: 1.1, sendReverb: 0.15 },
  { id: 'TRA-CLAP-TRA', name: 'Trance Clap', genre: 'TRANCE', cat: 'drum', engine: 'DRUM', drumType: 'clap', tune: 1.0, decay: 0.65, tone: 1.0, sendReverb: 0.22 },
  { id: 'TRA-HAT-CLOSED', name: 'Trance Closed Hat', genre: 'TRANCE', cat: 'drum', engine: 'DRUM', drumType: 'hatC', tune: 1.0, decay: 0.28, tone: 1.15 },
  { id: 'TRA-HAT-OPEN', name: 'Trance Open Hat', genre: 'TRANCE', cat: 'drum', engine: 'DRUM', drumType: 'hatO', tune: 1.0, decay: 0.75, tone: 0.95, sendReverb: 0.1 },
  { id: 'TRA-PERC-MAIN', name: 'Trance Main Perc', genre: 'TRANCE', cat: 'drum', engine: 'DRUM', drumType: 'perc', tune: 1.15, decay: 0.45, tone: 1.35 },
  { id: 'TRA-RIM-SHOT', name: 'Trance Rim Shot', genre: 'TRANCE', cat: 'drum', engine: 'DRUM', drumType: 'rim', tune: 1.0, decay: 0.38, tone: 0.95 },
  // PROGRESSIVE drums (4)
  { id: 'PRO-KICK-DEEP', name: 'Progressive Deep Kick', genre: 'PROGRESSIVE', cat: 'drum', engine: 'DRUM', drumType: 'kick', tune: 0.6, decay: 1.5, punch: 0.25, sendReverb: 0.06 },
  { id: 'PRO-KICK-TIGHT', name: 'Progressive Tight Kick', genre: 'PROGRESSIVE', cat: 'drum', engine: 'DRUM', drumType: 'kick', tune: 0.8, decay: 0.55, punch: 0.8 },
  { id: 'PRO-SNARE-TIGHT', name: 'Progressive Tight Snare', genre: 'PROGRESSIVE', cat: 'drum', engine: 'DRUM', drumType: 'snare', tune: 0.95, decay: 0.6, tone: 1.05, sendReverb: 0.14 },
  { id: 'PRO-HAT-CLOSED', name: 'Progressive Closed Hat', genre: 'PROGRESSIVE', cat: 'drum', engine: 'DRUM', drumType: 'hatC', tune: 1.0, decay: 0.3, tone: 1.1 },
  // DARK-PSY drums (4)
  { id: 'DRK-KICK-DEEP', name: 'Dark Psy Deep Kick', genre: 'DARK-PSY', cat: 'drum', engine: 'DRUM', drumType: 'kick', tune: 0.55, decay: 1.6, punch: 0.2, sendReverb: 0.07 },
  { id: 'DRK-KICK-TIGHT', name: 'Dark Psy Tight Kick', genre: 'DARK-PSY', cat: 'drum', engine: 'DRUM', drumType: 'kick', tune: 0.75, decay: 0.6, punch: 0.75 },
  { id: 'DRK-SNARE-TIGHT', name: 'Dark Psy Tight Snare', genre: 'DARK-PSY', cat: 'drum', engine: 'DRUM', drumType: 'snare', tune: 0.9, decay: 0.65, tone: 1.0, sendReverb: 0.16 },
  { id: 'DRK-GLITCH-MAIN', name: 'Dark Psy Main Glitch', genre: 'DARK-PSY', cat: 'drum', engine: 'DRUM', drumType: 'glitch', tune: 1.0, decay: 0.7, tone: 1.6 },
];

// ─── BASS PRESETS (20 basses) ─────────────────────────────────────────────
export const BASSES: SoundPreset[] = [
  // PSYTRANCE bass (8)
  { id: 'PSY-BASS-ROLL', name: 'Psy Rolling Bass', genre: 'PSYTRANCE', cat: 'bass', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'square', oct2: -1, detune: 4, fType: 'lowpass', cutoff: 700, res: 9,
    atk: 0.005, dec: 0.1, sus: 0.2, rel: 0.05, gate: 0.3, poly: 2, sendDelay: 0.05, velSens: 0.8,
    scaleDegrees: [0, 3, 5, 7], energyLevel: 0.8, moodTags: ['driving', 'hypnotic'] },
  { id: 'PSY-BASS-DEEP', name: 'Psy Deep Bass', genre: 'PSYTRANCE', cat: 'bass', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', oct2: -1, detune: 12, fType: 'lowpass', cutoff: 450, res: 7,
    atk: 0.005, dec: 0.15, sus: 0.3, rel: 0.08, gate: 0.5, poly: 2, velSens: 0.7,
    scaleDegrees: [0, 5], energyLevel: 0.6, moodTags: ['deep', 'meditative'] },
  { id: 'PSY-BASS-AGGRO', name: 'Psy Aggro Bass', genre: 'PSYTRANCE', cat: 'bass', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', oct2: -1, detune: 18, fType: 'lowpass', cutoff: 1100, res: 12,
    atk: 0.005, dec: 0.12, sus: 0.25, rel: 0.06, gate: 0.35, poly: 2, sendDelay: 0.08, velSens: 0.85,
    scaleDegrees: [0, 3, 5, 7], energyLevel: 0.9, moodTags: ['aggressive', 'driving'] },
  { id: 'PSY-BASS-ACID', name: 'Psy Acid Bass', genre: 'PSYTRANCE', cat: 'bass', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'square', fType: 'lowpass', cutoff: 900, res: 14, fEnvAmt: 0.7, fDecay: 0.12,
    atk: 0.005, dec: 0.1, sus: 0.2, rel: 0.05, gate: 0.3, poly: 2, sendDelay: 0.1, velSens: 0.9,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.85, moodTags: ['acid', 'squelchy'] },
  { id: 'PSY-BASS-SUB', name: 'Psy Sub Bass', genre: 'PSYTRANCE', cat: 'bass', engine: 'SYNTH',
    wave1: 'sine', wave2: 'sine', oct2: -1, fType: 'lowpass', cutoff: 200, res: 2,
    atk: 0.01, dec: 0.2, sus: 0.4, rel: 0.1, gate: 0.6, poly: 2, velSens: 0.6,
    scaleDegrees: [0, 5], energyLevel: 0.5, moodTags: ['deep', 'sub'] },
  { id: 'PSY-BASS-OFFBEAT', name: 'Psy Offbeat Bass', genre: 'PSYTRANCE', cat: 'bass', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'square', oct2: -1, detune: 6, fType: 'lowpass', cutoff: 800, res: 10,
    atk: 0.005, dec: 0.08, sus: 0.15, rel: 0.04, gate: 0.25, poly: 2, sendDelay: 0.06, velSens: 0.85,
    scaleDegrees: [0, 3, 5, 7], energyLevel: 0.85, moodTags: ['offbeat', 'driving'] },
  { id: 'PSY-BASS-WALKING', name: 'Psy Walking Bass', genre: 'PSYTRANCE', cat: 'bass', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'triangle', oct2: -1, detune: 8, fType: 'lowpass', cutoff: 600, res: 8,
    atk: 0.005, dec: 0.12, sus: 0.25, rel: 0.06, gate: 0.4, poly: 2, velSens: 0.75,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.7, moodTags: ['walking', 'melodic'] },
  { id: 'PSY-BASS-MELODIC', name: 'Psy Melodic Bass', genre: 'PSYTRANCE', cat: 'bass', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', oct2: -1, detune: 10, fType: 'lowpass', cutoff: 750, res: 9,
    atk: 0.005, dec: 0.1, sus: 0.2, rel: 0.05, gate: 0.3, poly: 2, sendDelay: 0.07, velSens: 0.8,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.75, moodTags: ['melodic', 'driving'] },
  // TECHNO bass (6)
  { id: 'TEC-BASS-ROLL', name: 'Techno Rolling Bass', genre: 'TECHNO', cat: 'bass', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'square', oct2: -1, detune: 3, fType: 'lowpass', cutoff: 650, res: 8,
    atk: 0.005, dec: 0.1, sus: 0.2, rel: 0.05, gate: 0.3, poly: 2, sendDelay: 0.04, velSens: 0.8,
    scaleDegrees: [0, 3, 5, 7], energyLevel: 0.8, moodTags: ['driving', 'hypnotic'] },
  { id: 'TEC-BASS-DEEP', name: 'Techno Deep Bass', genre: 'TECHNO', cat: 'bass', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', oct2: -1, detune: 10, fType: 'lowpass', cutoff: 400, res: 6,
    atk: 0.005, dec: 0.15, sus: 0.3, rel: 0.08, gate: 0.5, poly: 2, velSens: 0.7,
    scaleDegrees: [0, 5], energyLevel: 0.6, moodTags: ['deep', 'meditative'] },
  { id: 'TEC-BASS-ACID', name: 'Techno Acid Bass', genre: 'TECHNO', cat: 'bass', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'square', fType: 'lowpass', cutoff: 850, res: 15, fEnvAmt: 0.8, fDecay: 0.1,
    atk: 0.005, dec: 0.1, sus: 0.2, rel: 0.05, gate: 0.3, poly: 2, sendDelay: 0.1, velSens: 0.9,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.85, moodTags: ['acid', 'squelchy'] },
  { id: 'TEC-BASS-SUB', name: 'Techno Sub Bass', genre: 'TECHNO', cat: 'bass', engine: 'SYNTH',
    wave1: 'sine', wave2: 'sine', oct2: -1, fType: 'lowpass', cutoff: 180, res: 2,
    atk: 0.01, dec: 0.2, sus: 0.4, rel: 0.1, gate: 0.6, poly: 2, velSens: 0.6,
    scaleDegrees: [0, 5], energyLevel: 0.5, moodTags: ['deep', 'sub'] },
  { id: 'TEC-BASS-OFFBEAT', name: 'Techno Offbeat Bass', genre: 'TECHNO', cat: 'bass', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'square', oct2: -1, detune: 5, fType: 'lowpass', cutoff: 750, res: 9,
    atk: 0.005, dec: 0.08, sus: 0.15, rel: 0.04, gate: 0.25, poly: 2, sendDelay: 0.05, velSens: 0.85,
    scaleDegrees: [0, 3, 5, 7], energyLevel: 0.85, moodTags: ['offbeat', 'driving'] },
  { id: 'TEC-BASS-MINIMAL', name: 'Techno Minimal Bass', genre: 'TECHNO', cat: 'bass', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'triangle', oct2: -1, detune: 4, fType: 'lowpass', cutoff: 550, res: 7,
    atk: 0.005, dec: 0.12, sus: 0.25, rel: 0.06, gate: 0.4, poly: 2, velSens: 0.75,
    scaleDegrees: [0, 3, 5], energyLevel: 0.65, moodTags: ['minimal', 'hypnotic'] },
  // TRANCE bass (4)
  { id: 'TRA-BASS-ROLL', name: 'Trance Rolling Bass', genre: 'TRANCE', cat: 'bass', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'square', oct2: -1, detune: 5, fType: 'lowpass', cutoff: 700, res: 8,
    atk: 0.005, dec: 0.1, sus: 0.2, rel: 0.05, gate: 0.3, poly: 2, sendDelay: 0.05, velSens: 0.8,
    scaleDegrees: [0, 3, 5, 7], energyLevel: 0.8, moodTags: ['driving', 'uplifting'] },
  { id: 'TRA-BASS-DEEP', name: 'Trance Deep Bass', genre: 'TRANCE', cat: 'bass', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', oct2: -1, detune: 12, fType: 'lowpass', cutoff: 500, res: 7,
    atk: 0.005, dec: 0.15, sus: 0.3, rel: 0.08, gate: 0.5, poly: 2, velSens: 0.7,
    scaleDegrees: [0, 5], energyLevel: 0.6, moodTags: ['deep', 'meditative'] },
  { id: 'TRA-BASS-UPLIFT', name: 'Trance Uplifting Bass', genre: 'TRANCE', cat: 'bass', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', oct2: -1, detune: 14, fType: 'lowpass', cutoff: 900, res: 10,
    atk: 0.005, dec: 0.12, sus: 0.25, rel: 0.06, gate: 0.35, poly: 2, sendDelay: 0.08, velSens: 0.85,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.85, moodTags: ['uplifting', 'driving'] },
  { id: 'TRA-BASS-MELODIC', name: 'Trance Melodic Bass', genre: 'TRANCE', cat: 'bass', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'triangle', oct2: -1, detune: 8, fType: 'lowpass', cutoff: 650, res: 8,
    atk: 0.005, dec: 0.1, sus: 0.2, rel: 0.05, gate: 0.3, poly: 2, sendDelay: 0.06, velSens: 0.8,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.75, moodTags: ['melodic', 'driving'] },
  // PROGRESSIVE bass (2)
  { id: 'PRO-BASS-ROLL', name: 'Progressive Rolling Bass', genre: 'PROGRESSIVE', cat: 'bass', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'square', oct2: -1, detune: 4, fType: 'lowpass', cutoff: 600, res: 7,
    atk: 0.005, dec: 0.12, sus: 0.25, rel: 0.06, gate: 0.35, poly: 2, sendDelay: 0.05, velSens: 0.75,
    scaleDegrees: [0, 3, 5, 7], energyLevel: 0.7, moodTags: ['driving', 'progressive'] },
  { id: 'PRO-BASS-DEEP', name: 'Progressive Deep Bass', genre: 'PROGRESSIVE', cat: 'bass', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', oct2: -1, detune: 10, fType: 'lowpass', cutoff: 450, res: 6,
    atk: 0.005, dec: 0.15, sus: 0.3, rel: 0.08, gate: 0.5, poly: 2, velSens: 0.7,
    scaleDegrees: [0, 5], energyLevel: 0.55, moodTags: ['deep', 'progressive'] },
];

// ─── LEAD PRESETS (15 leads) ──────────────────────────────────────────────
export const LEADS: SoundPreset[] = [
  // PSYTRANCE leads (5)
  { id: 'PSY-LEAD-SQUELCH', name: 'Psy Squelch Lead', genre: 'PSYTRANCE', cat: 'lead', engine: 'SYNTH',
    wave1: 'square', wave2: 'sawtooth', detune: 8, fType: 'lowpass', cutoff: 2400, res: 12, fEnvAmt: 0.5, fDecay: 0.2,
    atk: 0.005, dec: 0.18, sus: 0.4, rel: 0.15, gate: 0.45, poly: 4, sendDelay: 0.3, sendReverb: 0.2, velSens: 0.8,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.85, moodTags: ['squelchy', 'psychedelic'] },
  { id: 'PSY-LEAD-FMTEX', name: 'Psy FM Texture', genre: 'PSYTRANCE', cat: 'lead', engine: 'FM',
    wave1: 'sine', wave2: 'sine', oct2: 1, detune: 2, fmAmount: 0.4, fmRatio: 3, fType: 'lowpass', cutoff: 2600,
    lfoRate: 8, lfoDepth: 0.3, lfoDest: 'cutoff',
    atk: 0.005, dec: 0.2, sus: 0.5, rel: 0.2, gate: 0.6, poly: 4, sendDelay: 0.25, sendReverb: 0.25, velSens: 0.75,
    scaleDegrees: [0, 5, 7, 10], energyLevel: 0.75, moodTags: ['fm', 'texture', 'ethereal'] },
  { id: 'PSY-LEAD-ACID', name: 'Psy Acid Lead', genre: 'PSYTRANCE', cat: 'lead', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'square', fType: 'lowpass', cutoff: 2000, res: 14, fEnvAmt: 0.6, fDecay: 0.15,
    atk: 0.005, dec: 0.15, sus: 0.3, rel: 0.1, gate: 0.4, poly: 4, sendDelay: 0.35, sendReverb: 0.15, velSens: 0.9,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.9, moodTags: ['acid', 'squelchy'] },
  { id: 'PSY-LEAD-MELODIC', name: 'Psy Melodic Lead', genre: 'PSYTRANCE', cat: 'lead', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', detune: 6, fType: 'lowpass', cutoff: 2200, res: 8,
    atk: 0.005, dec: 0.2, sus: 0.5, rel: 0.2, gate: 0.6, poly: 4, sendDelay: 0.3, sendReverb: 0.25, velSens: 0.8,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.75, moodTags: ['melodic', 'driving'] },
  { id: 'PSY-LEAD-FAST', name: 'Psy Fast Lead', genre: 'PSYTRANCE', cat: 'lead', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'square', detune: 10, fType: 'lowpass', cutoff: 2800, res: 10,
    atk: 0.005, dec: 0.12, sus: 0.3, rel: 0.1, gate: 0.3, poly: 4, sendDelay: 0.4, sendReverb: 0.2, velSens: 0.85,
    scaleDegrees: [0, 3, 5, 7, 10, 12], energyLevel: 0.9, moodTags: ['fast', 'driving'] },
  // TECHNO leads (4)
  { id: 'TEC-LEAD-STAB', name: 'Techno Stab Lead', genre: 'TECHNO', cat: 'lead', engine: 'SYNTH',
    wave1: 'square', wave2: 'triangle', fType: 'lowpass', cutoff: 1800, res: 8,
    atk: 0.001, dec: 0.08, sus: 0.05, rel: 0.04, gate: 0.15, poly: 4, sendDelay: 0.15, velSens: 0.9,
    scaleDegrees: [0, 3, 5, 7], energyLevel: 0.85, moodTags: ['stab', 'punchy'] },
  { id: 'TEC-LEAD-ACID', name: 'Techno Acid Lead', genre: 'TECHNO', cat: 'lead', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'square', fType: 'lowpass', cutoff: 1600, res: 16, fEnvAmt: 0.7, fDecay: 0.12,
    atk: 0.005, dec: 0.12, sus: 0.25, rel: 0.08, gate: 0.35, poly: 4, sendDelay: 0.3, sendReverb: 0.15, velSens: 0.9,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.85, moodTags: ['acid', 'squelchy'] },
  { id: 'TEC-LEAD-HYPNO', name: 'Techno Hypnotic Lead', genre: 'TECHNO', cat: 'lead', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'triangle', oct2: -1, detune: 8, fType: 'lowpass', cutoff: 1200, res: 6,
    lfoRate: 0.5, lfoDepth: 0.4, lfoDest: 'cutoff',
    atk: 0.01, dec: 0.2, sus: 0.6, rel: 0.3, gate: 0.7, poly: 4, sendDelay: 0.25, sendReverb: 0.2, velSens: 0.7,
    scaleDegrees: [0, 5], energyLevel: 0.7, moodTags: ['hypnotic', 'minimal'] },
  { id: 'TEC-LEAD-MINIMAL', name: 'Techno Minimal Lead', genre: 'TECHNO', cat: 'lead', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'triangle', detune: 4, fType: 'lowpass', cutoff: 1400, res: 7,
    atk: 0.005, dec: 0.15, sus: 0.3, rel: 0.1, gate: 0.4, poly: 4, sendDelay: 0.2, sendReverb: 0.15, velSens: 0.8,
    scaleDegrees: [0, 3, 5, 7], energyLevel: 0.75, moodTags: ['minimal', 'driving'] },
  // TRANCE leads (3)
  { id: 'TRA-LEAD-UPLIFT', name: 'Trance Uplifting Lead', genre: 'TRANCE', cat: 'lead', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', detune: 12, fType: 'lowpass', cutoff: 2600, res: 8,
    atk: 0.005, dec: 0.2, sus: 0.5, rel: 0.2, gate: 0.6, poly: 4, sendDelay: 0.35, sendReverb: 0.3, velSens: 0.8,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.85, moodTags: ['uplifting', 'driving'] },
  { id: 'TRA-LEAD-MELODIC', name: 'Trance Melodic Lead', genre: 'TRANCE', cat: 'lead', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'triangle', detune: 6, fType: 'lowpass', cutoff: 2200, res: 7,
    atk: 0.005, dec: 0.18, sus: 0.4, rel: 0.15, gate: 0.5, poly: 4, sendDelay: 0.3, sendReverb: 0.25, velSens: 0.8,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.75, moodTags: ['melodic', 'driving'] },
  { id: 'TRA-LEAD-DREAM', name: 'Trance Dream Lead', genre: 'TRANCE', cat: 'lead', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sine', oct2: 1, detune: 10, fType: 'lowpass', cutoff: 1800, res: 6,
    lfoRate: 0.3, lfoDepth: 0.3, lfoDest: 'cutoff',
    atk: 0.01, dec: 0.25, sus: 0.6, rel: 0.3, gate: 0.7, poly: 4, sendDelay: 0.3, sendReverb: 0.35, velSens: 0.7,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.65, moodTags: ['dream', 'ethereal'] },
  // PROGRESSIVE leads (2)
  { id: 'PRO-LEAD-PROG', name: 'Progressive Lead', genre: 'PROGRESSIVE', cat: 'lead', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', detune: 8, fType: 'lowpass', cutoff: 2000, res: 7,
    atk: 0.005, dec: 0.2, sus: 0.5, rel: 0.2, gate: 0.6, poly: 4, sendDelay: 0.3, sendReverb: 0.25, velSens: 0.8,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.75, moodTags: ['progressive', 'driving'] },
  { id: 'PRO-LEAD-MELODIC', name: 'Progressive Melodic Lead', genre: 'PROGRESSIVE', cat: 'lead', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'triangle', detune: 6, fType: 'lowpass', cutoff: 1800, res: 6,
    atk: 0.005, dec: 0.18, sus: 0.4, rel: 0.15, gate: 0.5, poly: 4, sendDelay: 0.25, sendReverb: 0.2, velSens: 0.8,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.7, moodTags: ['melodic', 'progressive'] },
  // DARK-PSY leads (1)
  { id: 'DRK-LEAD-DARK', name: 'Dark Psy Lead', genre: 'DARK-PSY', cat: 'lead', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', oct2: -1, detune: 20, fType: 'lowpass', cutoff: 1000, res: 12,
    lfoRate: 0.2, lfoDepth: 0.5, lfoDest: 'cutoff',
    atk: 0.01, dec: 0.3, sus: 0.6, rel: 0.4, gate: 0.8, poly: 4, sendDelay: 0.3, sendReverb: 0.4, velSens: 0.7,
    scaleDegrees: [0, 1, 5], energyLevel: 0.6, moodTags: ['dark', 'void'] },
];

// ─── PAD PRESETS (10 pads) ────────────────────────────────────────────────
export const PADS: SoundPreset[] = [
  { id: 'PSY-PAD-PSYCH', name: 'Psy Psychedelic Pad', genre: 'PSYTRANCE', cat: 'pad', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sine', oct2: 1, detune: 14, fType: 'lowpass', cutoff: 1400, res: 6,
    lfoRate: 0.3, lfoDepth: 0.4, lfoDest: 'cutoff',
    atk: 0.7, dec: 0.5, sus: 0.8, rel: 1.3, gate: 2.6, poly: 8, sendReverb: 0.5, velSens: 0.4,
    scaleDegrees: [0, 5, 7, 10], energyLevel: 0.5, moodTags: ['psychedelic', 'ethereal'] },
  { id: 'PSY-PAD-DEEP', name: 'Psy Deep Pad', genre: 'PSYTRANCE', cat: 'pad', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', oct2: -1, detune: 18, fType: 'lowpass', cutoff: 800,
    atk: 1.0, dec: 0.8, sus: 0.7, rel: 1.5, gate: 3.0, poly: 8, sendReverb: 0.6, velSens: 0.3,
    scaleDegrees: [0, 5], energyLevel: 0.4, moodTags: ['deep', 'meditative'] },
  { id: 'TEC-PAD-DARK', name: 'Techno Dark Pad', genre: 'TECHNO', cat: 'pad', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'square', oct2: -1, detune: 16, fType: 'lowpass', cutoff: 700,
    atk: 0.8, dec: 0.6, sus: 0.7, rel: 1.4, gate: 2.6, poly: 8, sendReverb: 0.5, velSens: 0.4,
    scaleDegrees: [0, 3], energyLevel: 0.5, moodTags: ['dark', 'minimal'] },
  { id: 'TEC-PAD-HYPNO', name: 'Techno Hypnotic Pad', genre: 'TECHNO', cat: 'pad', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'triangle', detune: 10, fType: 'lowpass', cutoff: 1000,
    lfoRate: 0.2, lfoDepth: 0.3, lfoDest: 'cutoff',
    atk: 0.9, dec: 0.7, sus: 0.8, rel: 1.3, gate: 2.8, poly: 6, sendReverb: 0.45, velSens: 0.35,
    scaleDegrees: [0, 5], energyLevel: 0.45, moodTags: ['hypnotic', 'minimal'] },
  { id: 'TRA-PAD-UPLIFT', name: 'Trance Uplifting Pad', genre: 'TRANCE', cat: 'pad', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', detune: 12, fType: 'lowpass', cutoff: 1600, res: 5,
    atk: 0.6, dec: 0.5, sus: 0.8, rel: 1.2, gate: 2.4, poly: 8, sendReverb: 0.55, velSens: 0.4,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.6, moodTags: ['uplifting', 'ethereal'] },
  { id: 'TRA-PAD-DREAM', name: 'Trance Dream Pad', genre: 'TRANCE', cat: 'pad', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sine', oct2: 1, detune: 10, fType: 'lowpass', cutoff: 1200,
    lfoRate: 0.25, lfoDepth: 0.35, lfoDest: 'cutoff',
    atk: 0.8, dec: 0.6, sus: 0.8, rel: 1.4, gate: 2.8, poly: 8, sendReverb: 0.6, velSens: 0.35,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.5, moodTags: ['dream', 'ethereal'] },
  { id: 'PRO-PAD-PROG', name: 'Progressive Pad', genre: 'PROGRESSIVE', cat: 'pad', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', detune: 8, fType: 'lowpass', cutoff: 1200, res: 5,
    atk: 0.7, dec: 0.6, sus: 0.8, rel: 1.3, gate: 2.6, poly: 8, sendReverb: 0.5, velSens: 0.4,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.55, moodTags: ['progressive', 'ethereal'] },
  { id: 'PRO-PAD-DEEP', name: 'Progressive Deep Pad', genre: 'PROGRESSIVE', cat: 'pad', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', oct2: -1, detune: 14, fType: 'lowpass', cutoff: 700,
    atk: 1.0, dec: 0.8, sus: 0.7, rel: 1.5, gate: 3.0, poly: 8, sendReverb: 0.6, velSens: 0.3,
    scaleDegrees: [0, 5], energyLevel: 0.4, moodTags: ['deep', 'progressive'] },
  { id: 'DRK-PAD-VOID', name: 'Dark Psy Void Pad', genre: 'DARK-PSY', cat: 'pad', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', oct2: -1, detune: 24, fType: 'lowpass', cutoff: 500,
    lfoRate: 0.15, lfoDepth: 0.6, lfoDest: 'cutoff',
    atk: 1.2, dec: 1.0, sus: 0.8, rel: 1.8, gate: 3.5, poly: 8, sendReverb: 0.7, velSens: 0.25,
    scaleDegrees: [0, 1], energyLevel: 0.3, moodTags: ['void', 'dark', 'ambient'] },
  { id: 'GOA-PAD-COSMIC', name: 'Goa Cosmic Pad', genre: 'GOA', cat: 'pad', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', oct2: 1, detune: 16, fType: 'lowpass', cutoff: 1800, res: 6,
    lfoRate: 0.3, lfoDepth: 0.4, lfoDest: 'cutoff',
    atk: 0.8, dec: 0.7, sus: 0.8, rel: 1.4, gate: 2.8, poly: 8, sendReverb: 0.55, velSens: 0.35,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.55, moodTags: ['cosmic', 'ethereal', 'goa'] },
];

// ─── PLUCK PRESETS (8 plucks) ─────────────────────────────────────────────
export const PLUCKS: SoundPreset[] = [
  { id: 'PSY-PLUCK-STAB', name: 'Psy Stab Pluck', genre: 'PSYTRANCE', cat: 'pluck', engine: 'SYNTH',
    wave1: 'square', wave2: 'triangle', fType: 'lowpass', cutoff: 1800, res: 8,
    atk: 0.001, dec: 0.08, sus: 0.05, rel: 0.04, gate: 0.15, poly: 4, sendDelay: 0.15, velSens: 0.9,
    scaleDegrees: [0, 3, 5, 7], energyLevel: 0.85, moodTags: ['stab', 'punchy'] },
  { id: 'PSY-PLUCK-MELODIC', name: 'Psy Melodic Pluck', genre: 'PSYTRANCE', cat: 'pluck', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'triangle', detune: 6, fType: 'lowpass', cutoff: 2400, res: 5,
    atk: 0.001, dec: 0.15, sus: 0.1, rel: 0.1, gate: 0.25, poly: 4, sendDelay: 0.25, sendReverb: 0.15, velSens: 0.85,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.7, moodTags: ['melodic', 'pluck'] },
  { id: 'TEC-PLUCK-STAB', name: 'Techno Stab Pluck', genre: 'TECHNO', cat: 'pluck', engine: 'SYNTH',
    wave1: 'square', wave2: 'triangle', fType: 'lowpass', cutoff: 1500, res: 8,
    atk: 0.001, dec: 0.08, sus: 0.05, rel: 0.04, gate: 0.15, poly: 4, velSens: 0.95,
    scaleDegrees: [0, 3, 5, 7], energyLevel: 0.9, moodTags: ['stab', 'punchy'] },
  { id: 'TEC-PLUCK-ACID', name: 'Techno Acid Pluck', genre: 'TECHNO', cat: 'pluck', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'square', fType: 'lowpass', cutoff: 1000, res: 14, fEnvAmt: 0.8, fDecay: 0.1,
    atk: 0.001, dec: 0.1, sus: 0.1, rel: 0.06, gate: 0.2, poly: 2, sendDelay: 0.2, velSens: 0.9,
    scaleDegrees: [0, 3, 5, 7], energyLevel: 0.85, moodTags: ['acid', 'squelchy'] },
  { id: 'TRA-PLUCK-MELODIC', name: 'Trance Melodic Pluck', genre: 'TRANCE', cat: 'pluck', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'triangle', detune: 8, fType: 'lowpass', cutoff: 2200, res: 6,
    atk: 0.001, dec: 0.12, sus: 0.1, rel: 0.08, gate: 0.2, poly: 4, sendDelay: 0.2, sendReverb: 0.15, velSens: 0.85,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.75, moodTags: ['melodic', 'pluck'] },
  { id: 'TRA-PLUCK-DREAM', name: 'Trance Dream Pluck', genre: 'TRANCE', cat: 'pluck', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sine', oct2: 1, detune: 10, fType: 'lowpass', cutoff: 1600, res: 5,
    atk: 0.005, dec: 0.2, sus: 0.15, rel: 0.15, gate: 0.3, poly: 4, sendDelay: 0.25, sendReverb: 0.2, velSens: 0.75,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.6, moodTags: ['dream', 'ethereal'] },
  { id: 'PRO-PLUCK-PROG', name: 'Progressive Pluck', genre: 'PROGRESSIVE', cat: 'pluck', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'triangle', detune: 6, fType: 'lowpass', cutoff: 1800, res: 6,
    atk: 0.001, dec: 0.1, sus: 0.1, rel: 0.08, gate: 0.2, poly: 4, sendDelay: 0.2, sendReverb: 0.15, velSens: 0.85,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.7, moodTags: ['progressive', 'pluck'] },
  { id: 'GOA-PLUCK-COSMIC', name: 'Goa Cosmic Pluck', genre: 'GOA', cat: 'pluck', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', oct2: 1, detune: 12, fType: 'lowpass', cutoff: 2000, res: 7,
    atk: 0.001, dec: 0.12, sus: 0.1, rel: 0.1, gate: 0.25, poly: 4, sendDelay: 0.25, sendReverb: 0.2, velSens: 0.8,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.7, moodTags: ['cosmic', 'ethereal', 'goa'] },
];

// ─── ARP PRESETS (8 arps) ─────────────────────────────────────────────────
export const ARPS: SoundPreset[] = [
  { id: 'PSY-ARP-ACID', name: 'Psy Acid Arp', genre: 'PSYTRANCE', cat: 'arp', engine: 'SYNTH',
    wave1: 'square', wave2: 'sawtooth', detune: 6, fType: 'lowpass', cutoff: 1800, res: 11, fEnvAmt: 0.5, fDecay: 0.12,
    atk: 0.001, dec: 0.1, sus: 0.2, rel: 0.06, gate: 0.24, poly: 4, sendDelay: 0.3, velSens: 0.85,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.85, moodTags: ['acid', 'fast'] },
  { id: 'PSY-ARP-FAST', name: 'Psy Fast Arp', genre: 'PSYTRANCE', cat: 'arp', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'square', detune: 8, fType: 'lowpass', cutoff: 2400, res: 6,
    atk: 0.001, dec: 0.08, sus: 0.15, rel: 0.05, gate: 0.2, poly: 4, sendDelay: 0.35, velSens: 0.9,
    scaleDegrees: [0, 5, 7, 10, 12], energyLevel: 0.9, moodTags: ['fast', 'driving'] },
  { id: 'TEC-ARP-HYPNO', name: 'Techno Hypnotic Arp', genre: 'TECHNO', cat: 'arp', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'triangle', oct2: -1, detune: 8, fType: 'lowpass', cutoff: 1000, res: 6,
    atk: 0.001, dec: 0.15, sus: 0.3, rel: 0.1, gate: 0.3, poly: 4, sendDelay: 0.3, velSens: 0.8,
    scaleDegrees: [0, 5], energyLevel: 0.75, moodTags: ['hypnotic', 'minimal'] },
  { id: 'TEC-ARP-ACID', name: 'Techno Acid Arp', genre: 'TECHNO', cat: 'arp', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'square', fType: 'lowpass', cutoff: 1200, res: 16, fEnvAmt: 0.7, fDecay: 0.1,
    atk: 0.001, dec: 0.08, sus: 0.15, rel: 0.05, gate: 0.2, poly: 2, sendDelay: 0.25, velSens: 0.9,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.85, moodTags: ['acid', 'squelchy'] },
  { id: 'TRA-ARP-MELODIC', name: 'Trance Melodic Arp', genre: 'TRANCE', cat: 'arp', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'triangle', detune: 6, fType: 'lowpass', cutoff: 2000, res: 6,
    atk: 0.001, dec: 0.12, sus: 0.2, rel: 0.08, gate: 0.25, poly: 4, sendDelay: 0.3, sendReverb: 0.2, velSens: 0.85,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.8, moodTags: ['melodic', 'driving'] },
  { id: 'TRA-ARP-DREAM', name: 'Trance Dream Arp', genre: 'TRANCE', cat: 'arp', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sine', oct2: 1, detune: 10, fType: 'lowpass', cutoff: 1600, res: 5,
    lfoRate: 0.4, lfoDepth: 0.3, lfoDest: 'cutoff',
    atk: 0.005, dec: 0.15, sus: 0.25, rel: 0.12, gate: 0.3, poly: 4, sendDelay: 0.3, sendReverb: 0.25, velSens: 0.75,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.65, moodTags: ['dream', 'ethereal'] },
  { id: 'PRO-ARP-PROG', name: 'Progressive Arp', genre: 'PROGRESSIVE', cat: 'arp', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'triangle', detune: 6, fType: 'lowpass', cutoff: 1800, res: 6,
    atk: 0.001, dec: 0.1, sus: 0.2, rel: 0.08, gate: 0.25, poly: 4, sendDelay: 0.25, sendReverb: 0.2, velSens: 0.85,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.75, moodTags: ['progressive', 'driving'] },
  { id: 'GOA-ARP-COSMIC', name: 'Goa Cosmic Arp', genre: 'GOA', cat: 'arp', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', oct2: 1, detune: 12, fType: 'lowpass', cutoff: 2200, res: 7,
    atk: 0.001, dec: 0.12, sus: 0.2, rel: 0.1, gate: 0.25, poly: 4, sendDelay: 0.3, sendReverb: 0.25, velSens: 0.8,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.75, moodTags: ['cosmic', 'ethereal', 'goa'] },
];

// ─── FX PRESETS (10 fx) ───────────────────────────────────────────────────
export const FXS: SoundPreset[] = [
  { id: 'FX-SWEEP-UP', name: 'Noise Sweep Up', genre: 'ANY', cat: 'fx', engine: 'NOISE',
    fType: 'highpass', cutoff: 500, res: 10,
    atk: 2.0, dec: 0.5, sus: 0.0, rel: 0.3, gate: 2.5, poly: 1, velSens: 0.5,
    energyLevel: 0.8, moodTags: ['sweep', 'riser'] },
  { id: 'FX-SWEEP-DOWN', name: 'Noise Sweep Down', genre: 'ANY', cat: 'fx', engine: 'NOISE',
    fType: 'lowpass', cutoff: 8000, res: 10,
    atk: 0.3, dec: 0.5, sus: 0.0, rel: 2.0, gate: 2.5, poly: 1, velSens: 0.5,
    energyLevel: 0.7, moodTags: ['sweep', 'downlifter'] },
  { id: 'FX-RISE-PSY', name: 'Psy Riser', genre: 'PSYTRANCE', cat: 'fx', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', oct2: 1, detune: 20, fType: 'bandpass', cutoff: 2000, res: 8,
    lfoRate: 0.5, lfoDepth: 0.7, lfoDest: 'cutoff',
    atk: 3.0, dec: 0.3, sus: 0.0, rel: 0.2, gate: 3.5, poly: 2, sendReverb: 0.3, velSens: 0.4,
    energyLevel: 0.9, moodTags: ['riser', 'tension'] },
  { id: 'FX-IMPACT-PSY', name: 'Psy Impact', genre: 'PSYTRANCE', cat: 'fx', engine: 'SYNTH',
    wave1: 'sine', wave2: 'sine', oct2: -1, fType: 'lowpass', cutoff: 200,
    atk: 0.001, dec: 1.5, sus: 0.0, rel: 0.5, gate: 2.0, poly: 1, sendReverb: 0.6, velSens: 0.8,
    energyLevel: 0.95, moodTags: ['impact', 'boom'] },
  { id: 'FX-DOWNLIFTER', name: 'Downlifter', genre: 'ANY', cat: 'fx', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', oct2: 1, fType: 'lowpass', cutoff: 6000, res: 6,
    atk: 0.1, dec: 0.3, sus: 0.0, rel: 2.5, gate: 3.0, poly: 2, sendReverb: 0.4, velSens: 0.5,
    energyLevel: 0.7, moodTags: ['downlifter', 'sweep'] },
  { id: 'FX-WHITE-NOISE', name: 'White Noise', genre: 'ANY', cat: 'fx', engine: 'NOISE',
    fType: 'highpass', cutoff: 2000, res: 2,
    atk: 0.01, dec: 0.5, sus: 0.0, rel: 0.3, gate: 1.5, poly: 1, velSens: 0.5,
    energyLevel: 0.6, moodTags: ['noise', 'texture'] },
  { id: 'FX-PINK-NOISE', name: 'Pink Noise', genre: 'ANY', cat: 'fx', engine: 'NOISE',
    fType: 'lowpass', cutoff: 4000, res: 2,
    atk: 0.01, dec: 0.8, sus: 0.0, rel: 0.5, gate: 2.0, poly: 1, velSens: 0.5,
    energyLevel: 0.5, moodTags: ['noise', 'texture'] },
  { id: 'FX-IMPACT-TEC', name: 'Techno Impact', genre: 'TECHNO', cat: 'fx', engine: 'SYNTH',
    wave1: 'sine', wave2: 'sine', oct2: -1, fType: 'lowpass', cutoff: 150,
    atk: 0.001, dec: 1.2, sus: 0.0, rel: 0.4, gate: 1.8, poly: 1, sendReverb: 0.5, velSens: 0.8,
    energyLevel: 0.9, moodTags: ['impact', 'boom'] },
  { id: 'FX-IMPACT-TRA', name: 'Trance Impact', genre: 'TRANCE', cat: 'fx', engine: 'SYNTH',
    wave1: 'sine', wave2: 'sine', oct2: -1, fType: 'lowpass', cutoff: 180,
    atk: 0.001, dec: 1.3, sus: 0.0, rel: 0.45, gate: 1.9, poly: 1, sendReverb: 0.55, velSens: 0.8,
    energyLevel: 0.9, moodTags: ['impact', 'boom'] },
  { id: 'FX-IMPACT-DRK', name: 'Dark Psy Impact', genre: 'DARK-PSY', cat: 'fx', engine: 'SYNTH',
    wave1: 'sine', wave2: 'sine', oct2: -1, fType: 'lowpass', cutoff: 120,
    atk: 0.001, dec: 1.8, sus: 0.0, rel: 0.6, gate: 2.2, poly: 1, sendReverb: 0.65, velSens: 0.8,
    energyLevel: 0.95, moodTags: ['impact', 'boom', 'dark'] },
];

// ─── TEXTURE PRESETS (8 textures) ─────────────────────────────────────────
export const TEXTURES: SoundPreset[] = [
  { id: 'TEX-PSY-AMBIENT', name: 'Psy Ambient Texture', genre: 'PSYTRANCE', cat: 'texture', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sine', oct2: 1, detune: 15, fType: 'lowpass', cutoff: 1200,
    lfoRate: 0.15, lfoDepth: 0.5, lfoDest: 'cutoff',
    atk: 2.0, dec: 1.5, sus: 0.8, rel: 2.5, gate: 4.0, poly: 8, sendReverb: 0.6, velSens: 0.25,
    scaleDegrees: [0, 5, 7, 10], energyLevel: 0.35, moodTags: ['ambient', 'ethereal'] },
  { id: 'TEX-DRK-VOID', name: 'Dark Void Texture', genre: 'DARK-PSY', cat: 'texture', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', oct2: -1, detune: 28, fType: 'lowpass', cutoff: 400,
    lfoRate: 0.1, lfoDepth: 0.7, lfoDest: 'cutoff',
    atk: 3.0, dec: 2.0, sus: 0.9, rel: 3.0, gate: 5.0, poly: 8, sendReverb: 0.65, velSens: 0.2,
    scaleDegrees: [0, 1], energyLevel: 0.3, moodTags: ['void', 'dark', 'ambient'] },
  { id: 'TEX-GOA-COSMIC', name: 'Goa Cosmic Texture', genre: 'GOA', cat: 'texture', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', oct2: 1, detune: 18, fType: 'lowpass', cutoff: 2200,
    lfoRate: 0.25, lfoDepth: 0.5, lfoDest: 'cutoff',
    atk: 1.5, dec: 1.0, sus: 0.8, rel: 2.0, gate: 3.5, poly: 8, sendReverb: 0.6, velSens: 0.3,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.4, moodTags: ['cosmic', 'ethereal', 'goa'] },
  { id: 'TEX-TRA-DREAM', name: 'Trance Dream Texture', genre: 'TRANCE', cat: 'texture', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', detune: 14, fType: 'lowpass', cutoff: 1600,
    lfoRate: 0.2, lfoDepth: 0.4, lfoDest: 'cutoff',
    atk: 1.8, dec: 1.2, sus: 0.8, rel: 2.2, gate: 3.8, poly: 8, sendReverb: 0.55, velSens: 0.25,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.35, moodTags: ['dream', 'ethereal'] },
  { id: 'TEX-PRO-PROG', name: 'Progressive Texture', genre: 'PROGRESSIVE', cat: 'texture', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', detune: 10, fType: 'lowpass', cutoff: 1400,
    lfoRate: 0.2, lfoDepth: 0.35, lfoDest: 'cutoff',
    atk: 2.0, dec: 1.5, sus: 0.8, rel: 2.5, gate: 4.0, poly: 8, sendReverb: 0.55, velSens: 0.25,
    scaleDegrees: [0, 3, 5, 7, 10], energyLevel: 0.35, moodTags: ['progressive', 'ethereal'] },
  { id: 'TEX-TEC-MINIMAL', name: 'Techno Minimal Texture', genre: 'TECHNO', cat: 'texture', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'triangle', detune: 8, fType: 'lowpass', cutoff: 800,
    lfoRate: 0.15, lfoDepth: 0.3, lfoDest: 'cutoff',
    atk: 2.5, dec: 2.0, sus: 0.9, rel: 3.0, gate: 5.0, poly: 8, sendReverb: 0.5, velSens: 0.2,
    scaleDegrees: [0, 5], energyLevel: 0.3, moodTags: ['minimal', 'ambient'] },
  { id: 'TEX-NOISE-AMBIENT', name: 'Noise Ambient Texture', genre: 'ANY', cat: 'texture', engine: 'NOISE',
    fType: 'bandpass', cutoff: 1000, res: 4,
    lfoRate: 0.1, lfoDepth: 0.4, lfoDest: 'cutoff',
    atk: 2.0, dec: 1.5, sus: 0.8, rel: 2.5, gate: 4.0, poly: 1, sendReverb: 0.5, velSens: 0.2,
    energyLevel: 0.3, moodTags: ['ambient', 'noise'] },
  { id: 'TEX-DRONE-DEEP', name: 'Deep Drone Texture', genre: 'ANY', cat: 'texture', engine: 'SYNTH',
    wave1: 'sawtooth', wave2: 'sawtooth', oct2: -1, detune: 20, fType: 'lowpass', cutoff: 300,
    lfoRate: 0.08, lfoDepth: 0.6, lfoDest: 'cutoff',
    atk: 3.0, dec: 2.5, sus: 0.9, rel: 3.5, gate: 6.0, poly: 8, sendReverb: 0.7, velSens: 0.15,
    scaleDegrees: [0, 5], energyLevel: 0.25, moodTags: ['drone', 'deep', 'ambient'] },
];

// ─── COMBINED BANK ────────────────────────────────────────────────────────
export const SOUND_BANK: SoundPreset[] = [
  ...DRUMS,
  ...BASSES,
  ...LEADS,
  ...PADS,
  ...PLUCKS,
  ...ARPS,
  ...FXS,
  ...TEXTURES,
];

// ─── Query helpers ────────────────────────────────────────────────────────
export function getByCategory(cat: Category): SoundPreset[] {
  return SOUND_BANK.filter(p => p.cat === cat);
}

export function getByGenre(genre: Genre): SoundPreset[] {
  return SOUND_BANK.filter(p => p.genre === genre || p.genre === 'ANY');
}

export function getById(id: string): SoundPreset | null {
  return SOUND_BANK.find(p => p.id === id) || null;
}

export function getByMood(mood: string): SoundPreset[] {
  return SOUND_BANK.filter(p => p.moodTags?.includes(mood));
}

export function getByEnergyLevel(min: number, max: number): SoundPreset[] {
  return SOUND_BANK.filter(p => (p.energyLevel || 0) >= min && (p.energyLevel || 0) <= max);
}

/**
 * Auto-select presets by detected scale + genre + energy.
 * Used by the learning system to pick the best sounds for the
 * current musical context.
 */
export function autoSelectPresets(
  genre: Genre,
  scaleDegrees: number[],
  energyLevel: number,
): Record<Category, SoundPreset[]> {
  const candidates = getByGenre(genre).filter(p => {
    const energyMatch = Math.abs((p.energyLevel || 0) - energyLevel) < 0.3;
    const scaleMatch = (p.scaleDegrees || []).some(d => scaleDegrees.includes(d));
    return energyMatch || scaleMatch;
  });

  const result: Record<Category, SoundPreset[]> = {
    drum: [], bass: [], lead: [], pad: [], pluck: [], arp: [], fx: [], texture: [],
  };

  candidates.forEach(p => {
    if (result[p.cat].length < 5) {
      result[p.cat].push(p);
    }
  });

  return result;
}

export function bankStats() {
  const cats: Record<string, number> = {};
  const genres: Record<string, number> = {};
  SOUND_BANK.forEach(p => {
    cats[p.cat] = (cats[p.cat] || 0) + 1;
    genres[p.genre] = (genres[p.genre] || 0) + 1;
  });
  return { total: SOUND_BANK.length, cats, genres };
}
