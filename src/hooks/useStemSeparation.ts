import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface StemResult {
  id: string;
  label: string;
  url: string;
}

export interface SeparationProgress {
  stage: 'idle' | 'uploading' | 'processing' | 'complete' | 'error';
  progress: number;
  message: string;
}

export interface UseStemSeparationResult {
  isProcessing: boolean;
  progress: SeparationProgress;
  stems: StemResult[];
  error: string | null;
  separate: (audioFile: File) => Promise<StemResult[]>;
  separateFromUrl: (audioUrl: string, selectedStems?: string[]) => Promise<StemResult[]>;
  cancel: () => void;
}

const STEM_LABELS: Record<string, string> = {
  vocals: 'Vocals',
  drums: 'Drums',
  bass: 'Bass',
  other: 'Other',
  guitar: 'Guitar',
  piano: 'Piano',
};

const POLL_INTERVAL = 2000; // 2 seconds

export function useStemSeparation(): UseStemSeparationResult {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<SeparationProgress>({
    stage: 'idle',
    progress: 0,
    message: 'Ready',
  });
  const [stems, setStems] = useState<StemResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const cancelledRef = useRef(false);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const uploadToStorage = useCallback(async (file: File): Promise<string> => {
    const fileName = `${crypto.randomUUID()}-${file.name}`;
    const filePath = `uploads/${fileName}`;

    setProgress({
      stage: 'uploading',
      progress: 10,
      message: 'Uploading audio file...',
    });

    const { error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('audio-files')
      .getPublicUrl(filePath);

    return publicUrl;
  }, []);

  const startSeparation = useCallback(async (audioUrl: string, stem?: string) => {
    setProgress({
      stage: 'processing',
      progress: 20,
      message: 'Starting stem separation...',
    });

    const { data, error: invokeError } = await supabase.functions.invoke('stem-separation', {
      body: {
        audioUrl,
        stem,
        modelName: 'htdemucs',
        outputFormat: 'mp3',
      },
    });

    if (invokeError) {
      throw new Error(`Failed to start separation: ${invokeError.message}`);
    }

    if (data.error) {
      throw new Error(data.error);
    }

    return data.id as string;
  }, []);

  const pollPrediction = useCallback(async (predictionId: string): Promise<StemResult[]> => {
    const poll = async (): Promise<StemResult[]> => {
      if (cancelledRef.current) {
        throw new Error('Cancelled');
      }

      const { data, error: invokeError } = await supabase.functions.invoke('stem-separation', {
        body: { predictionId },
      });

      if (invokeError) {
        throw new Error(`Failed to check status: ${invokeError.message}`);
      }

      const status = data.status;
      console.log('Prediction status:', status);

      if (status === 'succeeded') {
        // Extract stems from output
        const output = data.output;
        const results: StemResult[] = [];

        for (const [key, url] of Object.entries(output)) {
          if (url && typeof url === 'string') {
            results.push({
              id: key,
              label: STEM_LABELS[key] || key,
              url,
            });
          }
        }

        return results;
      }

      if (status === 'failed' || status === 'canceled') {
        throw new Error(data.error || 'Separation failed');
      }

      // Update progress based on status
      let progressValue = 30;
      let message = 'Processing...';

      if (status === 'starting') {
        progressValue = 25;
        message = 'Starting AI model...';
      } else if (status === 'processing') {
        progressValue = 50;
        message = 'Separating stems (this may take a few minutes)...';
      }

      setProgress({
        stage: 'processing',
        progress: progressValue,
        message,
      });

      // Continue polling
      await new Promise<void>((resolve) => {
        pollTimeoutRef.current = setTimeout(resolve, POLL_INTERVAL);
      });

      return poll();
    };

    return poll();
  }, []);

  const separateFromUrl = useCallback(async (
    audioUrl: string,
    selectedStems?: string[]
  ): Promise<StemResult[]> => {
    setIsProcessing(true);
    setError(null);
    setStems([]);
    cancelledRef.current = false;

    try {
      // If only one stem is selected, use the stem parameter for faster processing
      const stem = selectedStems?.length === 1 ? selectedStems[0] : undefined;

      // Start separation
      const predictionId = await startSeparation(audioUrl, stem);
      console.log('Started prediction:', predictionId);

      // Poll for results
      const results = await pollPrediction(predictionId);

      // Filter results if specific stems were selected
      const filteredResults = selectedStems?.length
        ? results.filter(r => selectedStems.includes(r.id))
        : results;

      setStems(filteredResults);
      setProgress({
        stage: 'complete',
        progress: 100,
        message: 'Separation complete!',
      });

      return filteredResults;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      if (errorMessage !== 'Cancelled') {
        setError(errorMessage);
        setProgress({
          stage: 'error',
          progress: 0,
          message: errorMessage,
        });
      }

      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [startSeparation, pollPrediction]);

  const separate = useCallback(async (audioFile: File): Promise<StemResult[]> => {
    setIsProcessing(true);
    setError(null);
    setStems([]);
    cancelledRef.current = false;

    try {
      // Upload file to storage
      const audioUrl = await uploadToStorage(audioFile);
      console.log('Uploaded to:', audioUrl);

      // Start separation
      const predictionId = await startSeparation(audioUrl);
      console.log('Started prediction:', predictionId);

      // Poll for results
      const results = await pollPrediction(predictionId);

      setStems(results);
      setProgress({
        stage: 'complete',
        progress: 100,
        message: 'Separation complete!',
      });

      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      if (errorMessage !== 'Cancelled') {
        setError(errorMessage);
        setProgress({
          stage: 'error',
          progress: 0,
          message: errorMessage,
        });
      }

      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [uploadToStorage, startSeparation, pollPrediction]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }
    setIsProcessing(false);
    setProgress({
      stage: 'idle',
      progress: 0,
      message: 'Cancelled',
    });
  }, []);

  return {
    isProcessing,
    progress,
    stems,
    error,
    separate,
    separateFromUrl,
    cancel,
  };
}
