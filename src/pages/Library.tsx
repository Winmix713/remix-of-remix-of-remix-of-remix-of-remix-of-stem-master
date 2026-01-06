import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Plus, Search, Music, Clock, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AppLayout } from '@/components/layout/AppLayout';
import { useLocalProjects, LocalProject } from '@/hooks/useLocalProjects';

export default function Library() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projects, loading, deleteProject } = useLocalProjects();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProjects = projects.filter(
    (project) =>
      project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.artist?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      uploaded: 'outline',
      configuring: 'secondary',
      processing: 'default',
      completed: 'default',
      error: 'destructive',
    };

    return (
      <Badge variant={variants[status] || 'outline'} className={status === 'completed' ? 'bg-success text-success-foreground' : ''}>
        {t(`library.status.${status}`)}
      </Badge>
    );
  };

  const handleProjectClick = (project: LocalProject) => {
    if (project.status === 'uploaded') {
      navigate(`/configure/${project.id}`);
    } else if (project.status === 'completed') {
      navigate(`/edit/${project.id}`);
    } else if (project.status === 'processing') {
      navigate(`/process/${project.id}`);
    }
  };

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteProject(id);
  };

  return (
    <AppLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold">{t('library.title')}</h1>
          <Button onClick={() => navigate('/upload')} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('library.addSong')}
          </Button>
        </div>

        {/* Tabs and Search */}
        <Tabs defaultValue="my-songs" className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <TabsList>
              <TabsTrigger value="my-songs">{t('library.mySongs')}</TabsTrigger>
            </TabsList>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('common.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-input border-border"
              />
            </div>
          </div>

          <TabsContent value="my-songs">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredProjects.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <div className="p-4 rounded-full bg-muted mb-4">
                  <Music className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">{t('library.noSongs')}</h3>
                <p className="text-muted-foreground mb-6">{t('library.noSongsDesc')}</p>
                <Button onClick={() => navigate('/upload')} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t('library.addSong')}
                </Button>
              </motion.div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left p-4 font-medium text-muted-foreground">
                        {t('library.columns.title')}
                      </th>
                      <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">
                        {t('library.columns.artist')}
                      </th>
                      <th className="text-left p-4 font-medium text-muted-foreground hidden lg:table-cell">
                        {t('library.columns.genre')}
                      </th>
                      <th className="text-center p-4 font-medium text-muted-foreground hidden sm:table-cell">
                        {t('library.columns.bpm')}
                      </th>
                      <th className="text-center p-4 font-medium text-muted-foreground hidden sm:table-cell">
                        {t('library.columns.key')}
                      </th>
                      <th className="text-center p-4 font-medium text-muted-foreground hidden md:table-cell">
                        {t('library.columns.duration')}
                      </th>
                      <th className="text-center p-4 font-medium text-muted-foreground">
                        {t('library.columns.status')}
                      </th>
                      <th className="text-center p-4 font-medium text-muted-foreground w-16">
                        
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((project, index) => (
                      <motion.tr
                        key={project.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => handleProjectClick(project)}
                        className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                              <Music className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <span className="font-medium">{project.title}</span>
                          </div>
                        </td>
                        <td className="p-4 text-muted-foreground hidden md:table-cell">
                          {project.artist || '-'}
                        </td>
                        <td className="p-4 text-muted-foreground hidden lg:table-cell">
                          {project.genre || '-'}
                        </td>
                        <td className="p-4 text-center text-muted-foreground hidden sm:table-cell">
                          {project.bpm || '-'}
                        </td>
                        <td className="p-4 text-center text-muted-foreground hidden sm:table-cell">
                          {project.key || '-'}
                        </td>
                        <td className="p-4 text-center text-muted-foreground hidden md:table-cell">
                          <div className="flex items-center justify-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(project.duration)}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          {getStatusBadge(project.status)}
                        </td>
                        <td className="p-4 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDeleteProject(e, project.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
