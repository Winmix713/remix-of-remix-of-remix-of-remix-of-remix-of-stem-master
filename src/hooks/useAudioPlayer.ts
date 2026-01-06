import { useState, useRef, useCallback, useEffect } from 'react';

interface AudioTrack {
  id: string;
  audio: HTMLAudioElement;
  volume: number;
  isMuted: boolean;
  isSolo: boolean;
}

interface UseAudioPlayerOptions {
  stemIds: string[];
  audioUrls?: Record<string, string>;
}

export function useAudioPlayer({ stemIds, audioUrls = {} }: UseAudioPlayerOptions) {
  const tracksRef = useRef<Map<string, AudioTrack>>(new Map());
  const animationRef = useRef<number>();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [volumes, setVolumes] = useState<Record<string, number>>(() => 
    Object.fromEntries(stemIds.map(id => [id, 80]))
  );
  const [mutedStems, setMutedStems] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(stemIds.map(id => [id, false]))
  );
  const [soloStems, setSoloStems] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(stemIds.map(id => [id, false]))
  );

  // Initialize audio elements
  useEffect(() => {
    const tracks = tracksRef.current;
    
    stemIds.forEach(id => {
      if (!tracks.has(id)) {
        const audio = new Audio();
        audio.preload = 'metadata';
        
        // Use provided URL or create a demo tone
        if (audioUrls[id]) {
          audio.src = audioUrls[id];
        }
        
        audio.addEventListener('loadedmetadata', () => {
          if (audio.duration && audio.duration > duration) {
            setDuration(audio.duration);
          }
          setIsLoaded(true);
        });
        
        audio.addEventListener('ended', () => {
          setIsPlaying(false);
          setCurrentTime(0);
          // Reset all tracks to beginning
          tracks.forEach(track => {
            track.audio.currentTime = 0;
          });
        });
        
        tracks.set(id, {
          id,
          audio,
          volume: 80,
          isMuted: false,
          isSolo: false,
        });
      }
    });

    // If no audio URLs provided, set a demo duration
    if (Object.keys(audioUrls).length === 0) {
      setDuration(180); // 3 minutes demo
      setIsLoaded(true);
    }

    return () => {
      tracks.forEach(track => {
        track.audio.pause();
        track.audio.src = '';
      });
      tracks.clear();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [stemIds, audioUrls]);

  // Update volumes based on mute/solo state
  const updateTrackVolumes = useCallback(() => {
    const tracks = tracksRef.current;
    const hasSolo = Object.values(soloStems).some(s => s);
    
    tracks.forEach(track => {
      const isSoloed = soloStems[track.id];
      const isMuted = mutedStems[track.id];
      const volume = volumes[track.id] ?? 80;
      
      let effectiveVolume = volume / 100;
      
      if (hasSolo) {
        effectiveVolume = isSoloed ? effectiveVolume : 0;
      } else if (isMuted) {
        effectiveVolume = 0;
      }
      
      track.audio.volume = effectiveVolume;
    });
  }, [volumes, mutedStems, soloStems]);

  useEffect(() => {
    updateTrackVolumes();
  }, [updateTrackVolumes]);

  // Time update animation loop
  const updateTime = useCallback(() => {
    const tracks = tracksRef.current;
    const firstTrack = tracks.values().next().value;
    
    if (firstTrack && !firstTrack.audio.paused) {
      setCurrentTime(firstTrack.audio.currentTime);
      animationRef.current = requestAnimationFrame(updateTime);
    }
  }, []);

  const play = useCallback(() => {
    const tracks = tracksRef.current;
    updateTrackVolumes();
    
    // If we have actual audio files, play them
    if (Object.keys(audioUrls).length > 0) {
      tracks.forEach(track => {
        track.audio.play().catch(console.error);
      });
    }
    
    setIsPlaying(true);
    animationRef.current = requestAnimationFrame(updateTime);
  }, [updateTime, updateTrackVolumes, audioUrls]);

  const pause = useCallback(() => {
    const tracks = tracksRef.current;
    
    tracks.forEach(track => {
      track.audio.pause();
    });
    
    setIsPlaying(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback((time: number) => {
    const tracks = tracksRef.current;
    
    tracks.forEach(track => {
      track.audio.currentTime = time;
    });
    
    setCurrentTime(time);
  }, []);

  const setVolume = useCallback((stemId: string, volume: number) => {
    setVolumes(prev => ({ ...prev, [stemId]: volume }));
  }, []);

  const toggleMute = useCallback((stemId: string) => {
    setMutedStems(prev => ({ ...prev, [stemId]: !prev[stemId] }));
  }, []);

  const toggleSolo = useCallback((stemId: string) => {
    setSoloStems(prev => ({ ...prev, [stemId]: !prev[stemId] }));
  }, []);

  // Simulate time progression for demo mode (no actual audio)
  useEffect(() => {
    if (!isPlaying || Object.keys(audioUrls).length > 0) return;
    
    const interval = setInterval(() => {
      setCurrentTime(prev => {
        if (prev >= duration) {
          setIsPlaying(false);
          return 0;
        }
        return prev + 0.1;
      });
    }, 100);
    
    return () => clearInterval(interval);
  }, [isPlaying, duration, audioUrls]);

  return {
    isPlaying,
    currentTime,
    duration,
    isLoaded,
    volumes,
    mutedStems,
    soloStems,
    play,
    pause,
    togglePlayPause,
    seek,
    setVolume,
    toggleMute,
    toggleSolo,
  };
}
