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

export interface SeparationModel {
  id: string;
  name: string;
  description: string;
  stems: string[];
}

export interface UseStemSeparationResult {
  isProcessing: boolean;
  progress: SeparationProgress;
  stems: StemResult[];
  error: string | null;
  availableModels: SeparationModel[];
  separate: (audioFile: File, modelName?: string) => Promise<StemResult[]>;
  separateFromUrl: (audioUrl: string, modelName?: string) => Promise<StemResult[]>;
  cancel: () => void;
}

export const AVAILABLE_MODELS: SeparationModel[] = [
  { 
    id: 'htdemucs_ft', 
    name: 'Demucs v4 (Fine-tuned)', 
    description: 'Legjobb minőség - 4 stem szétválasztás',
    stems: ['vocals', 'drums', 'bass', 'other'] 
  },
  { 
    id: 'htdemucs', 
    name: 'Demucs v4 (Standard)', 
    description: 'Gyorsabb feldolgozás - 4 stem',
    stems: ['vocals', 'drums', 'bass', 'other'] 
  },
  { 
    id: 'model_bs_roformer', 
    name: 'BS-Roformer', 
    description: 'Vokál + Hangszeres - 2 stem',
    stems: ['vocals', 'instrumental'] 
  },
  { 
    id: 'UVR_MDXNET_KARA_2', 
    name: 'MDX-Net Karaoke', 
    description: 'Karaoke készítéshez optimalizált - 2 stem',
    stems: ['vocals', 'instrumental'] 
  },
];

const STEM_LABELS: Record<string, string> = {
  vocals: 'Vocals',
  drums: 'Drums',
  bass: 'Bass',
  other: 'Other',
  instrumental: 'Instrumental',
  guitar: 'Guitar',
  piano: 'Piano',
};

// Helper function to validate URL
function isValidUrl(urlString: string): boolean {
  try {
    if (!urlString || typeof urlString !== 'string') {
      return false;
    }
    if (urlString.includes('undefined')) {
      return false;
    }
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}

// Helper function to map error types to user-friendly messages
function getErrorMessage(errorType: string | undefined, originalError: string): string {
  const errorTypeMap: Record<string, string> = {
    'MISSING_BACKEND_CONFIG': 'A backend szerver nincs konfigurálva. Kérjük, ellenőrizze a telepítést.',
    'INVALID_BACKEND_URL': 'A backend szerver URL-je érvénytelen.',
    'BACKEND_CONNECTION_FAILED': 'A backend szerver nem elérhető. Kérjük, győződjön meg, hogy a FastAPI szerver fut.',
    'AUDIO_DOWNLOAD_FAILED': 'Az audio fájl letöltése sikertelen.',
    'AUDIO_DOWNLOAD_HTTP_ERROR': 'Az audio fájl már nem elérhető vagy nem érvényes.',
    'INVALID_AUDIO_URL': 'Az audio URL érvénytelen. A fájl feltöltése sikertelen lehet.',
    'PROCESSING_FAILED': 'Az audio feldolgozása sikertelen. Kérjük, próbálja újra.',
    'UNEXPECTED_ERROR': 'Váratlan hiba történt. Kérjük, próbálja újra később.',
  };

  return errorTypeMap[errorType] || originalError || 'Feldolgozási hiba történt.';
}

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
  const abortControllerRef = useRef<AbortController | null>(null);

  const uploadToStorage = useCallback(async (file: File): Promise<string> => {
    const fileName = `${crypto.randomUUID()}-${file.name}`;
    const filePath = `uploads/${fileName}`;

    setProgress({
      stage: 'uploading',
      progress: 10,
      message: 'Feltöltés folyamatban...',
    });

    const { error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Feltöltés sikertelen: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('audio-files')
      .getPublicUrl(filePath);

    // Validate the returned URL
    if (!publicUrl || !isValidUrl(publicUrl)) {
      console.error('Invalid publicUrl returned from Supabase:', publicUrl);
      throw new Error(
        `Tárolási URL érvénytelen: ${publicUrl}. A Supabase kliens konfigurációja lehet hibás (VITE_SUPABASE_URL).`
      );
    }

    console.log('Audio successfully uploaded to:', publicUrl);
    return publicUrl;
  }, []);

  const processSeparation = useCallback(async (
    audioUrl: string, 
    modelName: string = 'htdemucs_ft'
  ): Promise<StemResult[]> => {
    setProgress({
      stage: 'processing',
      progress: 30,
      message: 'Stem szétválasztás indítása...',
    });

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    // Simulate progress updates during long processing
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev.progress < 90) {
          return {
            ...prev,
            progress: Math.min(prev.progress + 5, 90),
            message: 'Szétválasztás folyamatban (ez eltarthat 1-5 percig)...',
          };
        }
        return prev;
      });
    }, 5000);

    try {
      console.log('Calling stem-separation with model:', modelName);
      console.log('Audio URL:', audioUrl);

      const { data, error: invokeError } = await supabase.functions.invoke('stem-separation', {
        body: {
          audioUrl,
          modelName,
          outputFormat: 'mp3',
        },
      });

      clearInterval(progressInterval);

      if (cancelledRef.current) {
        throw new Error('Cancelled');
      }

      if (invokeError) {
        console.error('Edge function invoke error:', invokeError);
        throw new Error(`Szétválasztás sikertelen: ${invokeError.message}`);
      }

      // Handle error responses from edge function
      if (data?.error) {
        console.error('Edge function returned error:', data);
        const userMessage = getErrorMessage(data.errorType, data.error);
        const details = data.details ? ` (${data.details})` : '';
        throw new Error(userMessage + details);
      }

      if (data?.status !== 'succeeded') {
        console.error('Unexpected response status:', data?.status);
        throw new Error('Ismeretlen hiba történt a feldolgozás során');
      }

      // Extract stems from output
      const output = data.output;
      if (!output || typeof output !== 'object') {
        console.error('Invalid output format:', output);
        throw new Error('Nem sikerült stem-eket kinyerni');
      }

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

      if (results.length === 0) {
        console.error('No stems were extracted from the response');
        throw new Error('Nem sikerült stem-eket kinyerni a feldolgozás eredményéből');
      }

      console.log('Separation completed successfully, stems:', results.map(r => r.id));
      return results;

    } finally {
      clearInterval(progressInterval);
      abortControllerRef.current = null;
    }
  }, []);

  const separateFromUrl = useCallback(async (
    audioUrl: string,
    modelName: string = 'htdemucs_ft'
  ): Promise<StemResult[]> => {
    setIsProcessing(true);
    setError(null);
    setStems([]);
    cancelledRef.current = false;

    try {
      const results = await processSeparation(audioUrl, modelName);

      setStems(results);
      setProgress({
        stage: 'complete',
        progress: 100,
        message: 'Szétválasztás kész!',
      });

      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ismeretlen hiba történt.';

      if (errorMessage !== 'Cancelled') {
        console.error('Separation error:', err);
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
  }, [processSeparation]);

  const separate = useCallback(async (
    audioFile: File,
    modelName: string = 'htdemucs_ft'
  ): Promise<StemResult[]> => {
    setIsProcessing(true);
    setError(null);
    setStems([]);
    cancelledRef.current = false;

    try {
      // Upload file to storage
      const audioUrl = await uploadToStorage(audioFile);
      console.log('Uploaded to:', audioUrl);

      const results = await processSeparation(audioUrl, modelName);

      setStems(results);
      setProgress({
        stage: 'complete',
        progress: 100,
        message: 'Szétválasztás kész!',
      });

      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ismeretlen hiba';

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
  }, [uploadToStorage, processSeparation]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsProcessing(false);
    setProgress({
      stage: 'idle',
      progress: 0,
      message: 'Megszakítva',
    });
  }, []);

  return {
    isProcessing,
    progress,
    stems,
    error,
    availableModels: AVAILABLE_MODELS,
    separate,
    separateFromUrl,
    cancel,
  };
}
