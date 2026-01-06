import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface StemData {
  id: string;
  label: string;
  url: string;
}

export interface LocalProject {
  id: string;
  title: string;
  artist: string | null;
  genre: string | null;
  bpm: number | null;
  key: string | null;
  duration: number | null;
  status: 'uploaded' | 'configuring' | 'processing' | 'completed' | 'error';
  created_at: string;
  updated_at: string;
  original_file_url: string | null;
  file_name?: string;
  file_type?: string;
  stems?: StemData[];
  selected_stems?: string[];
}

export function useLocalProjects() {
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Load projects from Supabase
  const loadProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedProjects: LocalProject[] = (data || []).map((p) => ({
        id: p.id,
        title: p.title,
        artist: p.artist,
        genre: p.genre,
        bpm: p.bpm,
        key: p.key,
        duration: p.duration,
        status: (p.status || 'uploaded') as LocalProject['status'],
        created_at: p.created_at,
        updated_at: p.updated_at,
        original_file_url: p.original_file_url,
        stems: p.separation_config ? (p.separation_config as { stems?: StemData[] }).stems : undefined,
        selected_stems: p.separation_config ? (p.separation_config as { selected_stems?: string[] }).selected_stems : undefined,
      }));

      setProjects(mappedProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    if (!user) throw new Error('Must be logged in to upload');

    const fileName = `${user.id}/${crypto.randomUUID()}-${file.name}`;
    
    const { error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('audio-files')
      .getPublicUrl(fileName);

    return publicUrl;
  }, [user]);

  const addProject = useCallback(async (
    project: Omit<LocalProject, 'id' | 'created_at' | 'updated_at'>,
    file?: File
  ): Promise<LocalProject> => {
    if (!user) throw new Error('Must be logged in to add project');

    let fileUrl = project.original_file_url;
    
    // Upload file if provided
    if (file) {
      fileUrl = await uploadFile(file);
    }

    const separationConfig = {
      selected_stems: project.selected_stems || [],
      stems: project.stems || [],
      file_name: project.file_name || '',
      file_type: project.file_type || '',
    };

    const { data, error } = await supabase
      .from('projects')
      .insert([{
        user_id: user.id,
        title: project.title,
        artist: project.artist,
        genre: project.genre,
        bpm: project.bpm,
        key: project.key,
        duration: project.duration,
        status: project.status || 'uploaded',
        original_file_url: fileUrl,
        separation_config: JSON.parse(JSON.stringify(separationConfig)),
      }])
      .select()
      .single();

    if (error) throw error;

    const newProject: LocalProject = {
      id: data.id,
      title: data.title,
      artist: data.artist,
      genre: data.genre,
      bpm: data.bpm,
      key: data.key,
      duration: data.duration,
      status: (data.status || 'uploaded') as LocalProject['status'],
      created_at: data.created_at,
      updated_at: data.updated_at,
      original_file_url: data.original_file_url,
      file_name: project.file_name,
      file_type: project.file_type,
    };

    setProjects((prev) => [newProject, ...prev]);
    return newProject;
  }, [user, uploadFile]);

  const updateProject = useCallback(async (id: string, updates: Partial<LocalProject>) => {
    const updateData: Record<string, unknown> = {};
    
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.artist !== undefined) updateData.artist = updates.artist;
    if (updates.genre !== undefined) updateData.genre = updates.genre;
    if (updates.bpm !== undefined) updateData.bpm = updates.bpm;
    if (updates.key !== undefined) updateData.key = updates.key;
    if (updates.duration !== undefined) updateData.duration = updates.duration;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.original_file_url !== undefined) updateData.original_file_url = updates.original_file_url;
    
    if (updates.stems || updates.selected_stems) {
      updateData.separation_config = {
        stems: updates.stems || [],
        selected_stems: updates.selected_stems || [],
      };
    }
    
    updateData.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Error updating project:', error);
      return;
    }

    setProjects((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
      )
    );
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting project:', error);
      return;
    }

    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const getProject = useCallback((id: string) => {
    return projects.find((p) => p.id === id) || null;
  }, [projects]);

  const getProjectWithFile = useCallback(async (id: string): Promise<{ project: LocalProject; fileUrl: string } | null> => {
    const project = projects.find((p) => p.id === id);
    if (!project) return null;

    return {
      project,
      fileUrl: project.original_file_url || '',
    };
  }, [projects]);

  return {
    projects,
    loading,
    addProject,
    updateProject,
    deleteProject,
    getProject,
    getProjectWithFile,
    uploadFile,
    refetch: loadProjects,
  };
}
