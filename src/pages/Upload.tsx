import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload as UploadIcon, X, FileAudio, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AppLayout } from '@/components/layout/AppLayout';
import { useLocalProjects } from '@/hooks/useLocalProjects';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const SUPPORTED_FORMATS = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
  'audio/x-m4a',
  'audio/mp4',
  'video/mp4',
  'video/quicktime',
  'audio/x-ms-wma',
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_FILES = 5;

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

export default function Upload() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addProject } = useLocalProjects();
  const { toast } = useToast();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const validateFile = (file: File): string | null => {
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      return t('upload.invalidFormat');
    }
    if (file.size > MAX_FILE_SIZE) {
      return t('upload.fileTooLarge');
    }
    return null;
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const filesToAdd: UploadFile[] = [];

    for (const file of Array.from(newFiles)) {
      if (files.length + filesToAdd.length >= MAX_FILES) {
        toast({
          variant: 'destructive',
          title: t('common.error'),
          description: t('upload.maxFiles'),
        });
        break;
      }

      const error = validateFile(file);
      if (error) {
        toast({
          variant: 'destructive',
          title: t('common.error'),
          description: `${file.name}: ${error}`,
        });
        continue;
      }

      filesToAdd.push({
        id: crypto.randomUUID(),
        file,
        progress: 0,
        status: 'pending',
      });
    }

    setFiles((prev) => [...prev, ...filesToAdd]);
  }, [files.length, t, toast]);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
    }
  }, [addFiles]);

  const uploadFiles = async () => {
    for (const uploadFileItem of files.filter((f) => f.status === 'pending')) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFileItem.id ? { ...f, status: 'uploading' as const } : f
        )
      );

      try {
        // Update progress during upload
        const progressInterval = setInterval(() => {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFileItem.id && f.progress < 90
                ? { ...f, progress: f.progress + 10 }
                : f
            )
          );
        }, 200);

        // Upload file to Supabase Storage and create project
        await addProject(
          {
            title: uploadFileItem.file.name.replace(/\.[^/.]+$/, ''),
            artist: null,
            genre: null,
            bpm: null,
            key: null,
            duration: null,
            status: 'uploaded',
            original_file_url: null,
            file_name: uploadFileItem.file.name,
            file_type: uploadFileItem.file.type,
          },
          uploadFileItem.file
        );

        clearInterval(progressInterval);

        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFileItem.id ? { ...f, status: 'complete' as const, progress: 100 } : f
          )
        );
      } catch (error) {
        console.error('Upload error:', error);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFileItem.id
              ? { ...f, status: 'error' as const, error: 'Upload failed' }
              : f
          )
        );
      }
    }

    // Navigate to library after all uploads
    const completedFiles = files.filter((f) => f.status === 'complete' || f.status === 'pending');
    if (completedFiles.length > 0) {
      toast({
        title: t('common.success'),
        description: t('upload.uploadComplete'),
      });
      setTimeout(() => {
        navigate('/library');
      }, 1000);
    }
  };

  const hasFiles = files.length > 0;
  const hasPendingFiles = files.some((f) => f.status === 'pending');
  const isUploading = files.some((f) => f.status === 'uploading');

  return (
    <AppLayout>
      <div className="container py-8 max-w-3xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('upload.title')}</h1>
          <p className="text-muted-foreground">{t('upload.subtitle')}</p>
        </div>

        {/* Dropzone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300',
            isDragging
              ? 'border-primary bg-primary/5 scale-[1.02]'
              : 'border-border hover:border-muted-foreground/50',
            hasFiles && 'p-8'
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept={SUPPORTED_FORMATS.join(',')}
            multiple
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isUploading}
          />

          <AnimatePresence mode="wait">
            {!hasFiles ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <UploadIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg font-medium mb-1">{t('upload.dropzone')}</p>
                  <p className="text-muted-foreground text-sm">
                    {t('upload.supportedFormats')}
                  </p>
                </div>
                <Button variant="outline" className="pointer-events-none">
                  {t('upload.browse')}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="files"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {files.map((uploadFile) => (
                  <motion.div
                    key={uploadFile.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center gap-4 p-4 rounded-lg bg-card border border-border"
                  >
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                      <FileAudio className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{uploadFile.file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(uploadFile.file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                      {uploadFile.status === 'uploading' && (
                        <Progress value={uploadFile.progress} className="h-1 mt-2" />
                      )}
                    </div>
                    <div className="shrink-0">
                      {uploadFile.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(uploadFile.id);
                          }}
                          className="h-8 w-8"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      {uploadFile.status === 'uploading' && (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      )}
                      {uploadFile.status === 'complete' && (
                        <CheckCircle className="h-5 w-5 text-success" />
                      )}
                    </div>
                  </motion.div>
                ))}

                {files.length < MAX_FILES && !isUploading && (
                  <div className="text-center pt-2">
                    <p className="text-sm text-muted-foreground">
                      {t('upload.maxFiles')} ({files.length}/{MAX_FILES})
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Upload Button */}
        {hasPendingFiles && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 text-center"
          >
            <Button
              size="lg"
              onClick={uploadFiles}
              disabled={isUploading}
              className="gap-2 min-w-[200px]"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('upload.uploading')}
                </>
              ) : (
                <>
                  <UploadIcon className="h-4 w-4" />
                  {t('common.submit')}
                </>
              )}
            </Button>
          </motion.div>
        )}

        {/* Info */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>{t('upload.maxFileSize')}</p>
        </div>
      </div>
    </AppLayout>
  );
}
