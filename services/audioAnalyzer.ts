export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private buffer: Float32Array = new Float32Array(0);
  
  async start(): Promise<void> {
    if (this.audioContext) return;

    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.buffer = new Float32Array(this.analyser.fftSize);

    this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
    this.mediaStreamSource.connect(this.analyser);
  }

  stop() {
    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.audioContext = null;
    this.analyser = null;
  }

  // Returns frequency in Hz, or -1 if no pitch detected/silence
  getPitch(): number {
    if (!this.analyser || !this.audioContext) return -1;

    this.analyser.getFloatTimeDomainData(this.buffer);
    
    // RMS (Root Mean Square) for volume detection
    let rms = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      rms += this.buffer[i] * this.buffer[i];
    }
    rms = Math.sqrt(rms / this.buffer.length);

    // If signal is too weak, ignore
    if (rms < 0.01) return -1;

    return this.autoCorrelate(this.buffer, this.audioContext.sampleRate);
  }

  private autoCorrelate(buffer: Float32Array, sampleRate: number): number {
    const SIZE = buffer.length;
    const MAX_SAMPLES = Math.floor(SIZE / 2);
    let bestOffset = -1;
    let bestCorrelation = 0;
    let rms = 0;
    let foundGoodCorrelation = false;
    const correlations = new Float32Array(MAX_SAMPLES);

    for (let i = 0; i < SIZE; i++) {
      const val = buffer[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);

    if (rms < 0.01) return -1;

    let lastCorrelation = 1;

    for (let offset = 0; offset < MAX_SAMPLES; offset++) {
      let correlation = 0;

      for (let i = 0; i < MAX_SAMPLES; i++) {
        correlation += Math.abs((buffer[i]) - (buffer[i + offset]));
      }
      
      correlation = 1 - (correlation / MAX_SAMPLES);
      correlations[offset] = correlation;

      if ((correlation > 0.9) && (correlation > lastCorrelation)) {
        foundGoodCorrelation = true;
        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestOffset = offset;
        }
      } else if (foundGoodCorrelation) {
        // Shift exact center based on neighbors
        const shift = (correlations[bestOffset + 1] - correlations[bestOffset - 1]) / correlations[bestOffset];
        return sampleRate / (bestOffset + (8 * shift));
      }
      lastCorrelation = correlation;
    }

    if (bestCorrelation > 0.01) {
      return sampleRate / bestOffset;
    }
    return -1;
  }
}

export const playTone = (frequency: number | number[], duration: number = 0.5) => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const frequencies = Array.isArray(frequency) ? frequency : [frequency];
  
  const now = audioContext.currentTime;
  const gainNode = audioContext.createGain();
  
  // Lower gain slightly when playing multiple tones to avoid clipping
  const gainValue = frequencies.length > 1 ? 0.2 : 0.3;
  
  gainNode.gain.setValueAtTime(gainValue, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
  gainNode.connect(audioContext.destination);

  frequencies.forEach(f => {
    const oscillator = audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = f;
    oscillator.connect(gainNode);
    oscillator.start();
    oscillator.stop(now + duration);
  });
};

export const getNoteName = (frequency: number): string => {
  if (frequency <= 0) return '';
  // Updated D# to Eb and A# to Bb
  const noteStrings = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];
  
  // MIDI note number (float)
  const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2)) + 69;
  
  let roundedNote = Math.round(noteNum);
  const noteIndex = ((roundedNote % 12) + 12) % 12;
  const diff = noteNum - roundedNote; // range approx -0.5 to 0.5

  // Indices to narrow: 1 (C#), 3 (Eb), 8 (G#), 10 (Bb)
  // Narrowing by 50% means the valid window is +/- 0.25 semitones instead of +/- 0.5
  const NARROW_INDICES = [1, 3, 8, 10];

  if (NARROW_INDICES.includes(noteIndex)) {
    // If we are in an accidental zone, check if we are outside the narrow tolerance (0.25)
    if (Math.abs(diff) > 0.25) {
      // Push to the nearest neighbor
      // If diff is positive (e.g. 0.3), we are higher, so round UP (next note)
      // If diff is negative (e.g. -0.3), we are lower, so round DOWN (prev note)
      roundedNote = diff > 0 ? roundedNote + 1 : roundedNote - 1;
    }
  }

  const octave = Math.floor(roundedNote / 12) - 1;
  const finalNoteIndex = ((roundedNote % 12) + 12) % 12;
  
  return `${noteStrings[finalNoteIndex]}${octave}`;
};