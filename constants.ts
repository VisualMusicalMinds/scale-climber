export interface NoteDefinition {
  solfege: string;
  color: string;
  textColor: string;
  playFrequencies: number[]; // Frequencies to play when clicked
}

export interface ScaleData {
  levels: NoteDefinition[];
  scaleLow: { freq: number, index: number }[];
  scaleHigh: { freq: number, index: number }[];
}

export const KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// Visual definition of the 8 tower blocks (Do to High Do)
const VISUAL_TEMPLATES = [
  { solfege: 'Do', color: 'bg-red-500', textColor: 'text-white' },
  { solfege: 'Re', color: 'bg-orange-500', textColor: 'text-white' },
  { solfege: 'Mi', color: 'bg-yellow-400', textColor: 'text-black' },
  { solfege: 'Fa', color: 'bg-green-500', textColor: 'text-white' },
  { solfege: 'So', color: 'bg-cyan-500', textColor: 'text-white' },
  { solfege: 'La', color: 'bg-indigo-500', textColor: 'text-white' },
  { solfege: 'Ti', color: 'bg-purple-500', textColor: 'text-white' },
  { solfege: 'Do', color: 'bg-red-600', textColor: 'text-white' },
];

// Base frequency for C3
const BASE_C3_MIDI = 48; 

// Semitone intervals for Major Scale
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11, 12];

// Root offsets from C
const KEY_OFFSETS: Record<string, number> = {
  'C': 0,
  'C#': 1, 'Db': 1,
  'D': 2,
  'D#': 3, 'Eb': 3,
  'E': 4,
  'F': 5,
  'F#': 6, 'Gb': 6,
  'G': 7,
  'G#': 8, 'Ab': 8,
  'A': 9,
  'A#': 10, 'Bb': 10,
  'B': 11
};

const getFrequency = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export const generateScaleData = (rootKey: string = 'C'): ScaleData => {
  const rootOffset = KEY_OFFSETS[rootKey] || 0;
  const rootMidi = BASE_C3_MIDI + rootOffset;

  // Generate the 8 frequencies for the scale (Do...High Do)
  const scaleMidiNotes = MAJOR_SCALE_INTERVALS.map(interval => rootMidi + interval);
  
  // Create Scale Objects for Hit Testing
  // Low Scale: Octave 3 (or whatever root is)
  const scaleLow = scaleMidiNotes.map((midi, index) => ({
    freq: getFrequency(midi),
    index: index
  }));

  // High Scale: Octave 4 (root + 12)
  const scaleHigh = scaleMidiNotes.map((midi, index) => ({
    freq: getFrequency(midi + 12),
    index: index
  }));

  // Generate Tower Levels
  const levels = VISUAL_TEMPLATES.map((template, i) => {
    // Determine frequencies for playback.
    // Level 0 (Do) -> plays Root and Root+Octave
    // Level 7 (High Do) -> plays Root+Octave and Root+2Octaves
    
    const midiBase = scaleMidiNotes[i];
    const freq1 = getFrequency(midiBase);
    const freq2 = getFrequency(midiBase + 12);
    
    return {
      ...template,
      playFrequencies: [freq1, freq2]
    };
  });

  return {
    levels,
    scaleLow,
    scaleHigh
  };
};

// Deprecated static exports preserved for compatibility if needed, but App uses generateScaleData now
export const DEFAULT_SCALE_DATA = generateScaleData('C');
export const TOWER_LEVELS = DEFAULT_SCALE_DATA.levels;
export const SCALE_LOW = DEFAULT_SCALE_DATA.scaleLow;
export const SCALE_HIGH = DEFAULT_SCALE_DATA.scaleHigh;

export const AUDIO_CONTEXT_CONFIG = {
  sampleRate: 44100,
  fftSize: 2048,
  smoothingTimeConstant: 0.8,
};

export const MIN_VOLUME_DB = -50;