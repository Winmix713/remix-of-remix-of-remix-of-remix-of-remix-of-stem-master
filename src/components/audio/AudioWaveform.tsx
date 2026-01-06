import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface AudioWaveformProps {
  audioData?: string; // Base64 encoded audio
  audioUrl?: string; // URL to audio file
  className?: string;
}

export function AudioWaveform({ audioData, audioUrl, className = '' }: AudioWaveformProps) {
  const audioSource = audioUrl || audioData;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>([]);

  // Generate waveform from audio
  useEffect(() => {
    if (!audioSource) {
      // Generate fake waveform for demo
      const fakeWaveform = Array.from({ length: 100 }, () => Math.random() * 0.8 + 0.2);
      setWaveformData(fakeWaveform);
      return;
    }

    const generateWaveform = async () => {
      try {
        const audioContext = new AudioContext();
        const response = await fetch(audioSource);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const channelData = audioBuffer.getChannelData(0);
        const samples = 100;
        const blockSize = Math.floor(channelData.length / samples);
        const waveform: number[] = [];
        
        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[i * blockSize + j]);
          }
          waveform.push(sum / blockSize);
        }
        
        // Normalize
        const max = Math.max(...waveform);
        setWaveformData(waveform.map(v => v / max));
      } catch (error) {
        // Fallback to fake waveform
        const fakeWaveform = Array.from({ length: 100 }, () => Math.random() * 0.8 + 0.2);
        setWaveformData(fakeWaveform);
      }
    };

    generateWaveform();
  }, [audioSource]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const { width, height } = canvas;
      const barWidth = width / waveformData.length;
      const progress = duration > 0 ? currentTime / duration : 0;

      ctx.clearRect(0, 0, width, height);

      waveformData.forEach((value, index) => {
        const x = index * barWidth;
        const barHeight = value * height * 0.8;
        const y = (height - barHeight) / 2;
        
        // Color based on playback progress
        const isPlayed = index / waveformData.length < progress;
        ctx.fillStyle = isPlayed ? 'hsl(160, 84%, 39%)' : 'hsl(215, 20%, 40%)';
        
        ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
      });
    };

    draw();
  }, [waveformData, currentTime, duration]);

  // Update time during playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioSource]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio || duration === 0) return;

    const newTime = (value[0] / 100) * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`bg-muted/50 rounded-lg p-4 ${className}`}>
      {audioSource && (
        <audio ref={audioRef} src={audioSource} preload="metadata" crossOrigin="anonymous" />
      )}
      
      {/* Waveform Canvas */}
      <canvas
        ref={canvasRef}
        width={600}
        height={80}
        className="w-full h-20 cursor-pointer rounded"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const progress = x / rect.width;
          handleSeek([progress * 100]);
        }}
      />
      
      {/* Controls */}
      <div className="flex items-center gap-4 mt-4">
        <Button
          variant="outline"
          size="icon"
          onClick={togglePlay}
          className="h-10 w-10"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </Button>

        <div className="flex-1">
          <Slider
            value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
            onValueChange={handleSeek}
            max={100}
            step={0.1}
            className="cursor-pointer"
          />
        </div>

        <span className="text-sm text-muted-foreground min-w-[80px] text-center">
          {formatTime(currentTime)} / {formatTime(duration || 0)}
        </span>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMute}
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
