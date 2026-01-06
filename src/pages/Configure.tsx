import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowLeft, Music, Sliders, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppLayout } from '@/components/layout/AppLayout';
import { useLocalProjects, LocalProject, StemData } from '@/hooks/useLocalProjects';
import { useToast } from '@/hooks/use-toast';
import { AudioWaveform } from '@/components/audio/AudioWaveform';
import { StemSeparator } from '@/components/audio/StemSeparator';
import { StemResult } from '@/hooks/useStemSeparation';

const STEM_OPTIONS = [
  { id: 'vocals', label: 'Vocals', color: 'bg-pink-500' },
  { id: 'drums', label: 'Drums', color: 'bg-orange-500' },
  { id: 'bass', label: 'Bass', color: 'bg-purple-500' },
  { id: 'other', label: 'Other', color: 'bg-blue-500' },
];

export default function Configure() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getProject, updateProject } = useLocalProjects();
  const { toast } = useToast();
  
  const [project, setProject] = useState<LocalProject | null>(null);
  const [selectedStems, setSelectedStems] = useState<string[]>(['vocals', 'drums', 'bass', 'other']);
  const [metadata, setMetadata] = useState({
    artist: '',
    genre: '',
    bpm: '',
    key: '',
  });
  const [showSeparator, setShowSeparator] = useState(false);

  useEffect(() => {
    if (id) {
      const found = getProject(id);
      if (found) {
        setProject(found);
        setMetadata({
          artist: found.artist || '',
          genre: found.genre || '',
          bpm: found.bpm?.toString() || '',
          key: found.key || '',
        });
      }
    }
  }, [id, getProject]);

  const toggleStem = (stemId: string) => {
    setSelectedStems((prev) =>
      prev.includes(stemId)
        ? prev.filter((s) => s !== stemId)
        : [...prev, stemId]
    );
  };

  const handleStartProcessing = useCallback(() => {
    if (!id || selectedStems.length === 0) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: 'Please select at least one stem to extract.',
      });
      return;
    }

    // Save metadata
    updateProject(id, {
      artist: metadata.artist || null,
      genre: metadata.genre || null,
      bpm: metadata.bpm ? parseInt(metadata.bpm) : null,
      key: metadata.key || null,
      status: 'processing',
      selected_stems: selectedStems,
    });

    setShowSeparator(true);
  }, [id, selectedStems, metadata, updateProject, toast, t]);

  const handleSeparationComplete = useCallback((results: StemResult[]) => {
    if (!id) return;

    const stemData: StemData[] = results.map(r => ({
      id: r.id,
      label: r.label,
      url: r.url || '',
    }));

    updateProject(id, {
      status: 'completed',
      stems: stemData,
    });

    toast({
      title: t('common.success'),
      description: 'Stem separation complete! Your stems are ready.',
    });

    setTimeout(() => {
      navigate(`/edit/${id}`);
    }, 1500);
  }, [id, updateProject, toast, t, navigate]);

  const handleSeparationError = useCallback((error: string) => {
    if (!id) return;

    updateProject(id, {
      status: 'error',
    });

    toast({
      variant: 'destructive',
      title: t('common.error'),
      description: error,
    });
  }, [id, updateProject, toast, t]);

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
      <div className="container py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/library')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{project.title}</h1>
            <p className="text-muted-foreground">Configure stem separation</p>
          </div>
        </div>

        {/* Audio Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Preview
              </CardTitle>
              <CardDescription>
                Listen to your track before processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AudioWaveform audioUrl={project.original_file_url || undefined} />
            </CardContent>
          </Card>
        </motion.div>

        {/* Separator UI - shows when processing */}
        {showSeparator && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <StemSeparator
              audioUrl={project?.original_file_url || undefined}
              onComplete={handleSeparationComplete}
              onError={handleSeparationError}
            />
          </motion.div>
        )}

        {!showSeparator && (
          <>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Stem Selection */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sliders className="h-5 w-5" />
                      Select Stems
                    </CardTitle>
                    <CardDescription>
                      Choose which stems to extract (4 stems available)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {STEM_OPTIONS.map((stem) => (
                      <div
                        key={stem.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${stem.color}`} />
                          <span className="font-medium">{stem.label}</span>
                        </div>
                        <Switch
                          checked={selectedStems.includes(stem.id)}
                          onCheckedChange={() => toggleStem(stem.id)}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Metadata */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Music className="h-5 w-5" />
                      Track Metadata
                    </CardTitle>
                    <CardDescription>
                      Optional information about your track
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="artist">Artist</Label>
                      <Input
                        id="artist"
                        value={metadata.artist}
                        onChange={(e) => setMetadata({ ...metadata, artist: e.target.value })}
                        placeholder="Enter artist name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="genre">Genre</Label>
                      <Input
                        id="genre"
                        value={metadata.genre}
                        onChange={(e) => setMetadata({ ...metadata, genre: e.target.value })}
                        placeholder="e.g., Pop, Rock, Electronic"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bpm">BPM</Label>
                        <Input
                          id="bpm"
                          type="number"
                          value={metadata.bpm}
                          onChange={(e) => setMetadata({ ...metadata, bpm: e.target.value })}
                          placeholder="120"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="key">Key</Label>
                        <Input
                          id="key"
                          value={metadata.key}
                          onChange={(e) => setMetadata({ ...metadata, key: e.target.value })}
                          placeholder="e.g., C Major"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Start Processing Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-8 text-center"
            >
              <Button
                size="lg"
                onClick={handleStartProcessing}
                disabled={selectedStems.length === 0}
                className="gap-2 min-w-[200px]"
              >
                <Play className="h-4 w-4" />
                Start Separation
              </Button>
              {selectedStems.length === 0 && (
                <p className="text-sm text-destructive mt-2">
                  Please select at least one stem
                </p>
              )}
            </motion.div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
