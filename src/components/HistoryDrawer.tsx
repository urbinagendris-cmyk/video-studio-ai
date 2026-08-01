import React from 'react';
import { VideoProject } from '../types';
import { X, History, Play, Trash2 } from 'lucide-react';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projects: VideoProject[];
  onSelectProject: (project: VideoProject) => void;
  onDeleteProject: (id: string) => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  projects,
  onSelectProject,
  onDeleteProject,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex justify-end">
      <div className="bg-[#0a0a0f] border-l border-white/10 w-full max-w-md h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto">
        <div>
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#8b5cf6]" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Historial de Proyectos</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white bg-white/5 rounded-lg border border-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No hay proyectos en el historial local aún.
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  className="bg-[#050508] border border-white/5 hover:border-[#8b5cf6]/50 rounded-lg p-3 flex items-center gap-3 transition-all cursor-pointer group"
                  onClick={() => {
                    onSelectProject(proj);
                    onClose();
                  }}
                >
                  <div className="w-20 aspect-video bg-black rounded overflow-hidden flex-shrink-0 relative">
                    <img
                      src={
                        proj.thumbnailUrl ||
                        proj.script.escenas?.[0]?.imageUrl ||
                        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1280&q=80'
                      }
                      alt={proj.topic}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-4 h-4 text-white fill-current" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-white line-clamp-1 group-hover:text-[#8b5cf6] transition-colors">
                      {proj.script.titulo || proj.topic}
                    </h4>
                    <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                      {proj.durationMin} min • {proj.tone}
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteProject(proj.id);
                    }}
                    className="p-1.5 text-slate-500 hover:text-red-400 rounded transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
