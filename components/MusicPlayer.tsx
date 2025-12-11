import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Music } from 'lucide-react';

interface MusicPlayerProps {
  audioUrl: string | null;
}

export const MusicPlayer: React.FC<MusicPlayerProps> = ({ audioUrl }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lyricText, setLyricText] = useState("Merry Christmas!");

  // Handle Audio Source Changes and Auto-play
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    // Reset state
    setIsPlaying(false);
    setProgress(0);
    audio.src = audioUrl;

    // Attempt Auto-play safely
    const playAudio = async () => {
      try {
        await audio.play();
      } catch (err: any) {
        // Ignore AbortError: happens if user pauses immediately or component unmounts
        if (err.name !== 'AbortError') {
          console.warn("Auto-play failed:", err);
        }
      }
    };

    playAudio();

    return () => {
      // Cleanup: pause if unmounting or changing song
      audio.pause();
    };
  }, [audioUrl]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
        // setIsPlaying(true) will be handled by onPlay event
      } catch (error: any) {
        // Suppress interruption errors
        if (error.name !== 'AbortError') {
             console.error("Play failed:", error);
        }
      }
    } else {
      audio.pause();
      // setIsPlaying(false) will be handled by onPause event
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const duration = audioRef.current.duration || 1;
      setProgress((current / duration) * 100);

      // Simulate Lyric Updates based on time for visual effect
      const phrases = [
        "Spark and shine...",
        "It's Christmastime...",
        "Joy to the world...",
        "Let it glow...",
        "Happy Holidays!",
      ];
      // Cycle phrases every 4 seconds
      const index = Math.floor(current / 4) % phrases.length;
      setLyricText(phrases[index]);
    }
  };

  // Sync state with actual audio events to avoid drift and race conditions
  const onPlay = () => setIsPlaying(true);
  const onPause = () => setIsPlaying(false);
  const onEnded = () => setIsPlaying(false);

  return (
    // Responsive Hide: Hidden on mobile (<1024px), Flex on Desktop (lg)
    <div className="hidden lg:flex absolute right-6 top-1/2 transform -translate-y-1/2 flex-col items-center gap-4 z-40 pointer-events-auto">
      {/* Glass Player Container */}
      <div className="w-64 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 group transition-all hover:bg-black/50">
        
        {/* Cover Art / Icon */}
        <div className="w-full aspect-square bg-gradient-to-br from-xmas-red/20 to-gold/20 rounded-xl flex items-center justify-center border border-white/5 shadow-inner relative overflow-hidden">
             <div className="absolute inset-0 bg-gold/10 opacity-0 group-hover:opacity-100 transition-opacity animate-pulse" />
             <Music size={48} className={`text-gold/80 drop-shadow-lg ${isPlaying ? 'animate-bounce' : ''}`} />
        </div>

        {/* Title & Lyrics */}
        <div className="text-center space-y-1">
            <h3 className="text-white font-medium tracking-wide text-sm uppercase opacity-80">Now Playing</h3>
            <div className="h-12 flex items-center justify-center">
                 <p className="text-gold font-christmas-script text-2xl text-glow-gold transition-all duration-500 transform scale-100">
                    {lyricText}
                 </p>
            </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div 
                className="h-full bg-gradient-to-r from-xmas-red to-gold transition-all duration-300 ease-linear"
                style={{ width: `${progress}%` }}
            />
        </div>

        {/* Controls */}
        <div className="flex justify-center pt-2">
            <button 
                onClick={togglePlay}
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-all shadow-[0_0_15px_rgba(255,215,0,0.1)] hover:shadow-[0_0_25px_rgba(255,215,0,0.3)]"
            >
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
            </button>
        </div>
        
        <audio 
            ref={audioRef} 
            onTimeUpdate={handleTimeUpdate} 
            onPlay={onPlay}
            onPause={onPause}
            onEnded={onEnded} 
            loop 
        />
      </div>
    </div>
  );
};