import React from 'react';
import { VideoProject } from '../types';
import { Play, Download, Clock, Film, Sparkles, Trash2, Subtitles } from 'lucide-react';

interface VideoGalleryProps {
  projects: VideoProject[];
  onSelectProject: (project: VideoProject) => void;
  onDeleteProject?: (id: string) => void;
}

export const VideoGallery: React.FC<VideoGalleryProps> = ({
  projects,
  onSelectProject,
  onDeleteProject,
}) => {
  if (!projects || projects.length === 0) {
    return (
      <div className="glass-card w-full max-w-[1000px] mx-auto rounded-xl p-8 text-center my-8">
        <div className="w-12 h-12 rounded-xl bg-[#8b5cf6]/10 text-[#8b5cf6] border border-[#8b5cf6]/30 flex items-center justify-center mx-auto mb-3">
          <Film className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white uppercase tracking-wider mb-1">Galería de Videos Vacía</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Genera tu primer video usando el formulario principal para ver las tarjetas interactivas de reproductor aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1000px] mx-auto space-y-4 my-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-[#8b5cf6]" />
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recientes / Galería</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#8b5cf6]/10 text-[#8b5cf6] border border-[#8b5cf6]/30 font-mono">
            {projects.length} proyectos
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map((project) => (
          <div
            key={project.id}
            className="glass-card rounded-lg overflow-hidden group relative flex flex-col justify-between transition-all hover:border-[#8b5cf6]/50 cursor-pointer"
          >
            {/* Thumbnail Preview Header */}
            <div
              className="relative aspect-video bg-slate-900 overflow-hidden"
              onClick={() => onSelectProject(project)}
            >
              <img
                src={
                  project.thumbnailUrl ||
                  project.script.escenas?.[0]?.imageUrl ||
                  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1280&q=80'
                }
                alt={project.topic}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />

              {/* Play Button Overlay */}
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-all opacity-90 group-hover:opacity-100">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform border border-white/20">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </div>
              </div>

              {/* Badges Overlay */}
              <div className="absolute top-2 left-2 flex items-center gap-1.5">
                <span className="px-2 py-0.5 text-[9px] font-bold bg-black/80 backdrop-blur-md text-emerald-400 border border-emerald-500/30 rounded">
                  {project.durationMin} MIN
                </span>
                <span className="px-2 py-0.5 text-[9px] font-bold bg-black/80 backdrop-blur-md text-[#8b5cf6] border border-[#8b5cf6]/30 rounded capitalize">
                  {project.tone}
                </span>
              </div>

              {/* Scenes Count Tag */}
              <div className="absolute bottom-2 right-2 px-2 py-0.5 text-[9px] font-mono bg-black/80 backdrop-blur-md text-slate-300 rounded border border-white/10">
                {project.script.escenas?.length || 0} escenas
              </div>
            </div>

            {/* Card Content */}
            <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-xs text-white line-clamp-1 leading-snug group-hover:text-[#8b5cf6] transition-colors">
                  {project.script.titulo || project.topic}
                </h3>
                <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 font-sans italic">
                  {project.topic}
                </p>
              </div>

              {/* Actions Footer */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectProject(project)}
                  className="flex-1 py-1.5 px-3 text-xs font-bold text-white bg-[#8b5cf6] hover:bg-[#8b5cf6]/90 rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Reproducir</span>
                </button>

                {onDeleteProject && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteProject(project.id);
                    }}
                    title="Eliminar proyecto"
                    className="p-1.5 text-slate-400 hover:text-red-400 bg-white/5 hover:bg-red-950/40 border border-white/5 rounded-md transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
