import React, { useState, useEffect, useRef, useMemo } from 'react';
import Tower from './components/Tower';
import { AudioAnalyzer } from './services/audioAnalyzer';
import { Mic, MicOff, AlertCircle, Music } from 'lucide-react';
import { generateScaleData } from './constants';

const App: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [pitch, setPitch] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);
  const [currentKey, setCurrentKey] = useState<string>('C');

  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Memoize scale data so we don't recalculate on every render unless key changes
  const scaleData = useMemo(() => generateScaleData(currentKey), [currentKey]);

  useEffect(() => {
    analyzerRef.current = new AudioAnalyzer();
    return () => {
      stopListening();
    };
  }, []);

  // Function to capture the current pitch
  const checkPitch = () => {
    if (analyzerRef.current) {
      const detectedPitch = analyzerRef.current.getPitch();
      
      // Filter out invalid or extreme pitches
      if (detectedPitch > 70 && detectedPitch < 1000) {
          setPitch(detectedPitch);
      } else if (detectedPitch === -1) {
          setPitch(-1);
      }
    }
  };

  const startListening = async () => {
    setError(null);
    try {
      if (analyzerRef.current) {
        await analyzerRef.current.start();
        setIsListening(true);
      }
    } catch (err) {
      console.error("Microphone access denied or error:", err);
      setError("Please allow microphone access to use the tuner.");
    }
  };

  const stopListening = () => {
    if (analyzerRef.current) {
      analyzerRef.current.stop();
    }
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsListening(false);
    setPitch(-1);
  };

  const toggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };
  
  // Manage the update interval when listening state changes
  useEffect(() => {
    if (isListening) {
      // Check immediately
      checkPitch();
      // Check every 300ms for smoother animation (was 100ms)
      intervalRef.current = window.setInterval(checkPitch, 300);
    } else {
       if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    
    return () => {
        if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
        }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening]);


  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-start pt-12 p-4 transition-colors duration-500">
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700 gap-2 max-w-md">
          <AlertCircle size={16} />
          <span className="text-xs font-medium">{error}</span>
        </div>
      )}

      {/* Main Content Area: Side-by-side layout */}
      <div className="flex flex-row items-center justify-center w-full max-w-4xl gap-12 md:gap-20">
        
        {/* Left Control Panel */}
        <div className="flex flex-col items-center relative h-[400px] w-64">
          
          {/* Header Section - Centered around Ti (18.75% from top) */}
          <div className="absolute top-[18.75%] transform -translate-y-1/2 w-full text-center">
            <h1 className="text-3xl font-extrabold text-slate-800 mb-2 tracking-tight">
              Scale Climber
            </h1>
            <p className="text-slate-500 mx-auto text-xs leading-relaxed">
              Press the Mic to start singing, Press the scale boxes to hear the note.
            </p>
          </div>
          
          {/* Mic Button Section - Centered */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4">
            <button
              onClick={toggleMic}
              className={`
                w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all transform hover:scale-105 active:scale-95
                ${isListening 
                  ? 'bg-red-500 hover:bg-red-600 ring-4 ring-red-200' 
                  : 'bg-blue-600 hover:bg-blue-700 ring-4 ring-blue-100'
                }
              `}
              aria-label={isListening ? "Stop Microphone" : "Start Microphone"}
            >
              {isListening ? (
                 <MicOff size={32} className="text-white" />
              ) : (
                 <Mic size={32} className="text-white" />
              )}
            </button>
            
            <span className={`text-lg font-bold tracking-wide whitespace-nowrap ${isListening ? 'text-red-500' : 'text-blue-600'}`}>
                {isListening ? "Stop Singing" : "Start Singing"}
            </span>
          </div>

        </div>

        {/* Right Panel: Tower */}
        <main className="relative">
          <Tower detectedFrequency={pitch} scaleData={scaleData} isListening={isListening} />
          
          {/* Pitch Display (Debug/Info) */}
          <div className="absolute top-0 right-0 left-0 pointer-events-none flex justify-center -mt-6 opacity-0 md:opacity-100 transition-opacity">
             {pitch > 0 && (
               <span className="bg-black/75 text-white px-3 py-1 rounded-full text-[10px] font-mono flex items-center gap-2">
                 <Music size={10} />
                 {Math.round(pitch)} Hz
               </span>
             )}
          </div>
        </main>

      </div>

    </div>
  );
};

export default App;