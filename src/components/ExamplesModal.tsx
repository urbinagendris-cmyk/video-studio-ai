import React from 'react';
import { VideoProject } from '../types';
import { SAMPLE_PROJECTS } from '../data/samples';
import { X, Film, Play, Sparkles } from 'lucide-react';

interface ExamplesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectExample: (project: VideoProject) => void;
}

export const ExamplesModal: React.FC<ExamplesModalProps> = ({
  isOpen,
  onClose,
  onSelectExample,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-card rounded-xl max-w-3xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white bg-white/5 rounded-lg border border-white/10 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Film className="w-4 h-4 text-[#8b5cf6]" />
          <h2 className="text-base font-bold text-white uppercase tracking-wider">Ejemplos de Videos Listos</h2>
        </div>
        <p className="text-xs text-slate-400 mb-6">
          Explora proyectos pre-generados con la estructura completa de guion, imágenes y subtítulos.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SAMPLE_PROJECTS.map((sample) => (
            <div
              key={sample.id}
              className="bg-[#050508] border border-white/5 hover:border-[#8b5cf6]/50 rounded-lg overflow-hidden flex flex-col justify-between p-3 space-y-3 cursor-pointer group transition-all"
              onClick={() => {
                onSelectExample(sample);
                onClose();
              }}
            >
              <div className="aspect-video w-full bg-black rounded overflow-hidden relative">
                <img
                  src={sample.thumbnailUrl}
                  alt={sample.topic}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center border border-white/20">
                    <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[9px] font-bold text-[#8b5cf6] uppercase tracking-widest block mb-1">
                  {sample.tone} • {sample.durationMin} MIN
                </span>
                <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug group-hover:text-[#8b5cf6] transition-colors">
                  {sample.script.titulo}
                </h4>
              </div>

              <button className="w-full py-1.5 bg-[#8b5cf6] hover:bg-[#8b5cf6]/90 text-white text-xs font-bold rounded flex items-center justify-center gap-1 cursor-pointer">
                <Sparkles className="w-3 h-3 text-emerald-300" />
                <span>Cargar Ejemplo</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
