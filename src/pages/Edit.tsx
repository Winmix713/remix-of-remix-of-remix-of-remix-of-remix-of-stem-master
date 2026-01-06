import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Play, Pause, SkipBack, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { AppLayout } from '@/components/layout/AppLayout';
import { useLocalProjects, LocalProject } from '@/hooks/useLocalProjects';
import { useToast } from '@/hooks/use-toast';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { StemTrack } from '@/components/audio/StemTrack';

const STEMS = [
  { id: 'vocals', label: 'Vocals', color: 'bg-pink-500', hue: 330 },
  { id: 'drums', label: 'Drums', color: 'bg-orange-500', hue: 30 },
  { id: 'bass', label: 'Bass', color: 'bg-purple-500', hue: 270 },
  { id: 'other', label: 'Other', color: 'bg-blue-500', hue: 210 },
];

export default function Edit() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getProject } = useLocalProjects();
  const { toast } = useToast();
  
  const [project, setProject] = useState<LocalProject | null>(null);

  // Initialize audio player with stem IDs
  const {
    isPlaying,
    currentTime,
    duration,
    volumes,
    mutedStems,
    soloStems,
    togglePlayPause,
    seek,
    setVolume,
    toggleMute,
    toggleSolo,
  } = useAudioPlayer({
    stemIds: STEMS.map(s => s.id),
    // In production, you would pass actual audio URLs here:
    // audioUrls: { vocals: '/audio/vocals.mp3', drums: '/audio/drums.mp3', ... }
  });

  useEffect(() => {
    if (id) {
      const found = getProject(id);
      if (found) {
        setProject(found);
      }
    }
  }, [id, getProject]);

  const handleDownload = useCallback((stemId: string) => {
    const stem = STEMS.find(s => s.id === stemId);
    toast({
      title: 'Download Started',
      description: `Downloading ${stem?.label || stemId} stem...`,
    });
  }, [toast]);

  const handleDownloadAll = useCallback(() => {
    toast({
      title: 'Download Started',
      description: 'Downloading all stems as ZIP...',
    });
  }, [toast]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleRestart = useCallback(() => {
    seek(0);
  }, [seek]);

  // Determine which stems are currently audible
  const hasSolo = Object.values(soloStems).some(s => s);

  if (!project) {
    return (
      <AppLayout>
        <div className="container py-8 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Project not found</h2>
            <Button onClick={() => navigate('/library')} variant="outline">
              Return to Library
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/library')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{project.title}</h1>
              <p className="text-muted-foreground">
                {project.artist && `${project.artist} • `}
                {project.bpm && `${project.bpm} BPM • `}
                {project.key || 'Edit & Mix Stems'}
              </p>
            </div>
          </div>
          <Button onClick={handleDownloadAll} className="gap-2">
            <Download className="h-4 w-4" />
            Download All
          </Button>
        </div>

        {/* Transport Controls */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              {/* Restart Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRestart}
                className="h-10 w-10"
                title="Restart"
              >
                <SkipBack className="h-4 w-4" />
              </Button>

              {/* Play/Pause Button */}
              <Button
                variant="outline"
                size="icon"
                onClick={togglePlayPause}
                className={`h-12 w-12 transition-all ${isPlaying ? 'ring-2 ring-primary/50' : ''}`}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5 ml-0.5" />
                )}
              </Button>
              
              {/* Timeline Slider */}
              <div className="flex-1">
                <Slider
                  value={[currentTime]}
                  onValueChange={([v]) => seek(v)}
                  max={duration}
                  step={0.1}
                />
              </div>
              
              {/* Time Display */}
              <span className="text-sm font-mono text-muted-foreground min-w-[100px] text-right">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Stem Tracks */}
        <div className="space-y-3">
          {STEMS.map((stem, index) => {
            const isStemSoloed = soloStems[stem.id] || false;
            const isStemMuted = mutedStems[stem.id] || false;
            const isActive = isStemSoloed || (!hasSolo && !isStemMuted);
            
            return (
              <StemTrack
                key={stem.id}
                id={stem.id}
                label={stem.label}
                color={stem.color}
                hue={stem.hue}
                volume={volumes[stem.id] ?? 80}
                isMuted={isStemMuted}
                isSolo={isStemSoloed}
                isActive={isActive}
                currentTime={currentTime}
                duration={duration}
                index={index}
                onVolumeChange={(v) => setVolume(stem.id, v)}
                onToggleMute={() => toggleMute(stem.id)}
                onToggleSolo={() => toggleSolo(stem.id)}
                onDownload={() => handleDownload(stem.id)}
              />
            );
          })}
        </div>

        {/* Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-center text-sm text-muted-foreground"
        >
          <p>
            Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">M</kbd> to mute and{' '}
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">S</kbd> to solo individual stems.
            Adjust volume sliders to create your perfect mix.
          </p>
        </motion.div>
      </div>
    </AppLayout>
  );
}
