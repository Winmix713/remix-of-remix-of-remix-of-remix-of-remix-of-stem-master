import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Download, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';

interface StemTrackProps {
  id: string;
  label: string;
  color: string;
  hue: number;
  volume: number;
  isMuted: boolean;
  isSolo: boolean;
  isActive: boolean;
  currentTime: number;
  duration: number;
  index: number;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onToggleSolo: () => void;
  onDownload: () => void;
}

// Memoized waveform data generation
const generateWaveformData = (seed: number) => {
  const waveform: number[] = [];
  let value = 0.5;
  
  for (let i = 0; i < 150; i++) {
    // Pseudo-random based on seed and index for consistency
    const noise = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    const random = noise - Math.floor(noise);
    
    // Smooth transitions
    value += (random - 0.5) * 0.3;
    value = Math.max(0.1, Math.min(0.95, value));
    waveform.push(value);
  }
  
  return waveform;
};

export const StemTrack = memo(function StemTrack({
  id,
  label,
  color,
  hue,
  volume,
  isMuted,
  isSolo,
  isActive,
  currentTime,
  duration,
  index,
  onVolumeChange,
  onToggleMute,
  onToggleSolo,
  onDownload,
}: StemTrackProps) {
  // Generate consistent waveform based on stem id
  const waveform = useMemo(() => {
    const seed = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return generateWaveformData(seed);
  }, [id]);

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className={`transition-all duration-200 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
        <CardContent className="py-3">
          <div className="flex items-center gap-4">
            {/* Stem Info */}
            <div className="flex items-center gap-3 min-w-[120px]">
              <div 
                className="w-3 h-3 rounded-full transition-transform"
                style={{ 
                  backgroundColor: `hsl(${hue}, 70%, 50%)`,
                  transform: isActive ? 'scale(1.2)' : 'scale(1)',
                  boxShadow: isActive ? `0 0 8px hsl(${hue}, 70%, 50%, 0.5)` : 'none'
                }} 
              />
              <span className="font-medium">{label}</span>
            </div>

            {/* Mute/Solo Buttons */}
            <div className="flex gap-1">
              <Button
                variant={isMuted ? 'destructive' : 'outline'}
                size="sm"
                className={`h-7 w-7 p-0 text-xs font-bold transition-all ${
                  isMuted ? 'ring-2 ring-destructive/50' : ''
                }`}
                onClick={onToggleMute}
                title="Mute"
              >
                M
              </Button>
              <Button
                variant={isSolo ? 'default' : 'outline'}
                size="sm"
                className={`h-7 w-7 p-0 text-xs font-bold transition-all ${
                  isSolo ? 'ring-2 ring-primary/50' : ''
                }`}
                onClick={onToggleSolo}
                title="Solo"
              >
                S
              </Button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-2 min-w-[140px]">
              <Volume2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Slider
                value={[volume]}
                onValueChange={([v]) => onVolumeChange(v)}
                max={100}
                className="w-20"
              />
              <span className="text-xs text-muted-foreground w-8 text-right">
                {Math.round(volume)}%
              </span>
            </div>

            {/* Waveform Visualization */}
            <div className="flex-1 h-12 flex items-center gap-[1px] overflow-hidden rounded">
              {waveform.map((v, i) => {
                const barProgress = i / waveform.length;
                const isPlayed = barProgress < progress;
                
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-sm transition-colors duration-75"
                    style={{
                      height: `${v * 100}%`,
                      backgroundColor: isPlayed
                        ? 'hsl(var(--primary))'
                        : `hsl(${hue}, 60%, 50%)`,
                      opacity: isActive ? (isPlayed ? 1 : 0.7) : 0.3,
                    }}
                  />
                );
              })}
            </div>

            {/* Download Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onDownload}
              title={`Download ${label}`}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});
