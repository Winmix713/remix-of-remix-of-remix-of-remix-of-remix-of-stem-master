import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, XCircle, Download, Play, Pause, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useStemSeparation, StemResult } from '@/hooks/useStemSeparation';

interface StemSeparatorProps {
  audioUrl?: string;
  audioFile?: File;
  onComplete?: (stems: StemResult[]) => void;
  onError?: (error: string) => void;
}

const AVAILABLE_STEMS = [
  { id: 'vocals', label: 'Vocals', color: 'bg-pink-500' },
  { id: 'drums', label: 'Drums', color: 'bg-orange-500' },
  { id: 'bass', label: 'Bass', color: 'bg-purple-500' },
  { id: 'other', label: 'Other', color: 'bg-blue-500' },
];

const STEM_COLORS: Record<string, string> = {
  vocals: 'bg-pink-500',
  drums: 'bg-orange-500',
  bass: 'bg-purple-500',
  other: 'bg-blue-500',
  guitar: 'bg-green-500',
  piano: 'bg-cyan-500',
};

export function StemSeparator({
  audioUrl,
  audioFile,
  onComplete,
  onError,
}: StemSeparatorProps) {
  const { isProcessing, progress, stems, error, separate, separateFromUrl, cancel } = useStemSeparation();
  const [selectedStems, setSelectedStems] = useState<string[]>(['vocals', 'drums', 'bass', 'other']);
  const [playingStem, setPlayingStem] = useState<string | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  const handleStemToggle = (stemId: string) => {
    setSelectedStems(prev =>
      prev.includes(stemId)
        ? prev.filter(s => s !== stemId)
        : [...prev, stemId]
    );
  };

  const handleStart = useCallback(async () => {
    try {
      let results: StemResult[];
      
      if (audioFile) {
        results = await separate(audioFile);
      } else if (audioUrl) {
        results = await separateFromUrl(audioUrl, selectedStems);
      } else {
        throw new Error('No audio source provided');
      }
      
      onComplete?.(results);
    } catch (err) {
      if (err instanceof Error && err.message !== 'Cancelled') {
        onError?.(err.message);
      }
    }
  }, [audioFile, audioUrl, selectedStems, separate, separateFromUrl, onComplete, onError]);

  const handlePlayStem = useCallback((stem: StemResult) => {
    // Stop currently playing
    if (playingStem) {
      const currentAudio = audioRefs.current.get(playingStem);
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
    }

    if (playingStem === stem.id) {
      setPlayingStem(null);
      return;
    }

    let audio = audioRefs.current.get(stem.id);
    if (!audio) {
      audio = new Audio(stem.url);
      audio.onended = () => setPlayingStem(null);
      audioRefs.current.set(stem.id, audio);
    }

    audio.play();
    setPlayingStem(stem.id);
  }, [playingStem]);

  const handleDownloadStem = useCallback((stem: StemResult) => {
    const a = document.createElement('a');
    a.href = stem.url;
    a.download = `${stem.label.toLowerCase()}.mp3`;
    a.target = '_blank';
    a.click();
  }, []);

  const handleDownloadAll = useCallback(() => {
    stems.forEach((stem, index) => {
      setTimeout(() => handleDownloadStem(stem), index * 500);
    });
  }, [stems, handleDownloadStem]);

  const getStageIcon = () => {
    switch (progress.stage) {
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return isProcessing ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Music2 className="h-5 w-5 text-primary" />;
    }
  };

  const hasSource = !!audioUrl || !!audioFile;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStageIcon()}
          Stem Separation
        </CardTitle>
        <CardDescription>
          {progress.stage === 'complete'
            ? 'Your stems are ready!'
            : 'Powered by Demucs AI - separate vocals, drums, bass and more'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stem selection */}
        {!isProcessing && progress.stage !== 'complete' && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Select stems to extract:</Label>
            <div className="grid grid-cols-2 gap-3">
              {AVAILABLE_STEMS.map((stem) => (
                <div
                  key={stem.id}
                  className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    id={stem.id}
                    checked={selectedStems.includes(stem.id)}
                    onCheckedChange={() => handleStemToggle(stem.id)}
                  />
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${stem.color}`} />
                    <Label htmlFor={stem.id} className="cursor-pointer">
                      {stem.label}
                    </Label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress display */}
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{progress.message}</span>
              <span className="font-medium">{Math.round(progress.progress)}%</span>
            </div>
            <Progress value={progress.progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              Separation typically takes 1-3 minutes depending on track length
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={cancel}
              className="w-full"
            >
              Cancel
            </Button>
          </motion.div>
        )}

        {/* Error display */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg"
          >
            <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Processing failed</p>
              <p className="text-muted-foreground">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Stem results */}
        {stems.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2"
          >
            <AnimatePresence>
              {stems.map((stem, index) => (
                <motion.div
                  key={stem.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${STEM_COLORS[stem.id] || 'bg-gray-500'}`} />
                    <span className="font-medium">{stem.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePlayStem(stem)}
                      className="h-8 w-8"
                    >
                      {playingStem === stem.id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownloadStem(stem)}
                      className="h-8 w-8"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Start button */}
        {!isProcessing && progress.stage !== 'complete' && (
          <Button
            onClick={handleStart}
            disabled={!hasSource || selectedStems.length === 0}
            className="w-full gap-2"
          >
            <Play className="h-4 w-4" />
            Start Separation
          </Button>
        )}

        {/* Download all button when complete */}
        {progress.stage === 'complete' && stems.length > 0 && (
          <Button
            variant="outline"
            onClick={handleDownloadAll}
            className="w-full gap-2"
          >
            <Download className="h-4 w-4" />
            Download All Stems
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
