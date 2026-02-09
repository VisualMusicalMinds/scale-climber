import React, { useRef, useEffect, useState } from 'react';
import { NoteDefinition, ScaleData } from '../constants';
import { playTone, getNoteName } from '../services/audioAnalyzer';

interface TowerProps {
  detectedFrequency: number;
  scaleData: ScaleData;
  isListening: boolean;
}

const Tower: React.FC<TowerProps> = ({ detectedFrequency, scaleData, isListening }) => {
  const prevPositionRef = useRef<number | null>(null);
  const { levels, scaleLow, scaleHigh } = scaleData;
  
  // State for the displayed note name to stabilize the text (update 1/sec)
  const [displayedNote, setDisplayedNote] = useState<string>("");
  const lastNoteUpdateRef = useRef<number>(0);

  // Helper to warp the fractional progress for specific intervals
  // This narrows the visual "middle" (accidental) zone for any Whole Step
  const getWarpedFraction = (fraction: number, startFreq: number, endFreq: number): number => {
    // Determine the gap interval
    const n1 = Math.round(12 * Math.log2(startFreq/440) + 69);
    const n2 = Math.round(12 * Math.log2(endFreq/440) + 69);
    const semitoneDist = Math.abs(n2 - n1);
    
    // Only apply warping if it's a whole tone (2 semitones)
    // This assumes we want to skip over the accidental in between
    if (semitoneDist === 2) {
         // Warping logic:
         // 0 -> 0.375 maps to 0 -> 0.5 (Expanded start note)
         // 0.375 -> 0.625 maps to 0.5 -> 0.5 (Compressed middle - technically linear traverse but fast)
         // 0.625 -> 1.0 maps to 0.5 -> 1.0 (Expanded end note)
         
         // Using a piecewise linear function for stickiness
         if (fraction < 0.375) {
           return (fraction / 0.375) * 0.45; // Map to 0..0.45
         } else if (fraction > 0.625) {
           return 0.55 + ((fraction - 0.625) / 0.375) * 0.45; // Map 0.55..1.0
         } else {
           // The gap traversal (0.375 to 0.625 maps to 0.45 to 0.55)
           return 0.45 + ((fraction - 0.375) / 0.25) * 0.1;
         }
    }
    return fraction;
  };

  // Helper to calculate position (0.0 to 7.0) within a specific scale definition
  const calculateScalePosition = (freq: number, scale: { freq: number, index: number }[]): number | null => {
    const minFreq = scale[0].freq;
    const maxFreq = scale[scale.length - 1].freq;
    const buffer = 15; // Hz buffer

    if (freq < minFreq - buffer || freq > maxFreq + buffer) return null;

    for (let i = 0; i < scale.length - 1; i++) {
      const current = scale[i];
      const next = scale[i + 1];

      if (freq >= current.freq && freq <= next.freq) {
        const range = next.freq - current.freq;
        const diff = freq - current.freq;
        const rawFraction = diff / range;
        
        // Apply warping to make the box stick to notes and jump over specific accidentals
        const fraction = getWarpedFraction(rawFraction, current.freq, next.freq);
        
        return current.index + fraction;
      }
    }
    
    // Handle slightly below start (within buffer)
    if (freq >= minFreq - buffer && freq < minFreq) {
         return 0; // Clamp to bottom
    }
    // Handle slightly above end (within buffer)
    if (freq > maxFreq && freq <= maxFreq + buffer) {
        return 7; // Clamp to top
    }

    return null;
  };

  const getPosition = (freq: number): number | null => {
    if (freq <= 0) return null;

    const posLow = calculateScalePosition(freq, scaleLow);
    const posHigh = calculateScalePosition(freq, scaleHigh);

    // If both valid (e.g. around the transition octave)
    if (posLow !== null && posHigh !== null) {
      if (prevPositionRef.current !== null) {
         if (prevPositionRef.current > 3.5) {
             return posLow; // Prefer keeping it at the top (7) of low scale (which is 0 of high scale logic wise, but here we prefer continuity)
         } else {
             return posHigh; // Prefer keeping it at the bottom
         }
      }
      return posLow;
    }

    if (posLow !== null) return posLow;
    if (posHigh !== null) return posHigh;

    return null;
  };

  const position = getPosition(detectedFrequency);
  
  useEffect(() => {
      if (position !== null) {
          prevPositionRef.current = position;
      }
  }, [position]);

  // Throttled note name update
  useEffect(() => {
    const now = Date.now();
    // Update immediately if frequency is -1 (silence/reset) or if 1 second has passed
    if (detectedFrequency <= 0) {
        setDisplayedNote("");
    } else if (now - lastNoteUpdateRef.current >= 1000) {
        setDisplayedNote(getNoteName(detectedFrequency));
        lastNoteUpdateRef.current = now;
    }
  }, [detectedFrequency]);
  
  // Height of one block in percent
  const blockHeight = 100 / 8;
  const halfBlock = blockHeight / 2;
  
  // Determine effective position for rendering
  // If isListening is true but no pitch detected (position === null), 
  // rest at the bottom (position -0.5 corresponds to 0% height)
  let renderPosition = position;
  if (renderPosition === null && isListening) {
    renderPosition = -0.5;
  }

  const bottomPercent = renderPosition !== null && renderPosition >= -1 && renderPosition <= 8
    ? (renderPosition * blockHeight) + halfBlock
    : null;

  return (
    <div className="relative w-full max-w-[160px] md:max-w-[224px] h-[400px] mx-auto pl-12 md:pl-16">
      
      {/* Moving Arrow Box (Indicator) */}
      {bottomPercent !== null && (
        <div 
          className="absolute left-0 w-20 h-[12.5%] pointer-events-none floating-box z-20 flex items-center justify-end pr-2"
          style={{ bottom: `calc(${bottomPercent}% - 6.25%)` }}
        >
           <div className={`bg-slate-800 text-white font-bold h-10 px-3 flex items-center justify-center rounded-l-md shadow-lg min-w-[3.5rem] whitespace-nowrap transition-all ${!displayedNote ? 'opacity-80' : 'opacity-100'}`}>
              {displayedNote}
           </div>
           <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[12px] border-l-slate-800 border-b-[10px] border-b-transparent drop-shadow-sm transform translate-x-[-1px]"></div>
        </div>
      )}

      {/* The Tower Stack */}
      <div className="relative h-full w-full bg-gray-100 rounded-2xl shadow-xl overflow-hidden border-4 border-gray-200">
        <div className="flex flex-col-reverse h-full w-full">
          {levels.map((level, index) => (
            <button
              key={index}
              onClick={() => playTone(level.playFrequencies)}
              className={`
                w-full h-[12.5%] 
                flex items-center justify-center px-3 md:px-4 
                ${level.color} ${level.textColor}
                hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white/50
                cursor-pointer active:scale-[0.98]
              `}
              aria-label={`Play ${level.solfege}`}
            >
              <span className="font-bold text-lg md:text-xl">{level.solfege}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Tower;