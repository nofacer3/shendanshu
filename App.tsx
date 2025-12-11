import React, { useState, useCallback, Suspense, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import { Upload, Music } from 'lucide-react';
import HandController from './components/HandController';
import { Scene } from './components/Scene';
import { AppState, HandControlState, GestureType, PhotoData } from './types';
import { INITIAL_PHOTOS } from './constants';

const generateUUID = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.ASSEMBLED);
  const [handState, setHandState] = useState<HandControlState>({
    gesture: GestureType.NONE,
    position: { x: 0, y: 0 },
    rotation: 0,
  });
  
  const [photos, setPhotos] = useState<PhotoData[]>(
    INITIAL_PHOTOS.map(url => ({ id: generateUUID(), url, aspectRatio: 1 }))
  );

  // Audio State
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleHandUpdate = useCallback((newState: HandControlState) => {
    setHandState(newState);
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach((file) => {
        const url = URL.createObjectURL(file as Blob);
        setPhotos((prev) => [...prev, { id: generateUUID(), url, aspectRatio: 1 }]);
      });
    }
  };

  const handleAudioUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
    }
  };

  // Music Control Logic: Play when Scattered/Focused, Pause when Assembled
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    if (appState !== AppState.ASSEMBLED) {
        audio.play().catch((e) => console.warn("Audio play prevented:", e));
    } else {
        audio.pause();
    }
  }, [appState, audioUrl]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* 3D Canvas */}
      <Canvas shadows camera={{ position: [0, 0, 18], fov: 45 }} gl={{ preserveDrawingBuffer: true }}>
        <Suspense fallback={null}>
          <Scene 
              handState={handState} 
              photos={photos} 
              setAppState={setAppState} 
              appState={appState} 
          />
        </Suspense>
      </Canvas>
      
      {/* Global Loading Overlay */}
      <Loader />

      {/* CV Controller (Hidden on Mobile) */}
      <HandController onUpdate={handleHandUpdate} />

      {/* Top Right Controls */}
      <div className="absolute top-6 right-6 flex flex-col sm:flex-row gap-4 pointer-events-auto z-40 items-end">
        {/* Music Upload */}
        <label className={`flex items-center gap-2 px-4 py-3 rounded-full backdrop-blur-md cursor-pointer transition-all border shadow-lg group ${audioUrl ? 'bg-gold/20 border-gold/40 text-gold' : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'}`}>
            <Music size={20} className={`group-hover:scale-110 transition-transform ${audioUrl && appState !== AppState.ASSEMBLED ? 'animate-pulse' : ''}`} />
            <span className="text-sm font-medium hidden sm:inline">{audioUrl ? 'Change Music' : 'Select Music'}</span>
            <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
        </label>

        {/* Photo Upload */}
        <label className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-full backdrop-blur-md cursor-pointer transition-all border border-white/20 shadow-lg group">
            <Upload size={20} className="group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium hidden sm:inline">Add Memories</span>
            <input type="file" multiple accept="image/*" onChange={handleFileUpload} className="hidden" />
        </label>
      </div>

      {/* Simplified Gesture Status (Minimal dot) */}
      <div className="absolute bottom-6 left-6 flex items-center gap-3 pointer-events-none opacity-40">
        <div className={`w-2 h-2 rounded-full ${handState.gesture !== GestureType.NONE ? 'bg-gold animate-ping' : 'bg-white/20'}`} />
      </div>

      {/* Audio Element */}
      <audio ref={audioRef} src={audioUrl || undefined} loop />
      
    </div>
  );
}

export default App;