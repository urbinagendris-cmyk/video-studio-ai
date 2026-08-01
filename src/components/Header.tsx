import React from 'react';
import { Video, Film, History, PlusCircle, Sparkles } from 'lucide-react';

interface HeaderProps {
  onNewVideo: () => void;
  onOpenHistory: () => void;
  onOpenExamples: () => void;
  historyCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onNewVideo,
  onOpenHistory,
  onOpenExamples,
  historyCount,
}) => {
  return (
    <header className="sticky top-0 z-50 w-full bg-[#0a0a0f]/95 backdrop-blur-md border-b border-white/5 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Brand Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={onNewVideo}>
          <div className="w-8 h-8 bg-[#8b5cf6] rounded flex items-center justify-center shadow-lg shadow-purple-900/40">
            <div className="w-4 h-4 bg-white rounded-sm rotate-45" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white uppercase font-sans">
                Video Studio <span className="text-[#8b5cf6]">AI</span>
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-[#8b5cf6]/10 text-[#8b5cf6] border border-[#8b5cf6]/30 rounded-full">
                Beta Studio v2.5
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Generador de Videos Largos con Gemini 3.6 & Imagen 4
            </p>
          </div>
        </div>

        {/* Right: Navigation Actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={onOpenExamples}
            className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            <Film className="w-4 h-4 text-[#8b5cf6]" />
            <span>Ejemplos</span>
          </button>

          <button
            onClick={onOpenHistory}
            className="relative flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            <History className="w-4 h-4 text-emerald-400" />
            <span>Historial</span>
            {historyCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold bg-[#22c55e] text-black rounded-full">
                {historyCount}
              </span>
            )}
          </button>

          <button
            onClick={onNewVideo}
            className="bg-[#8b5cf6] px-4 py-2 rounded-lg text-white font-semibold hover:bg-[#8b5cf6]/90 active:scale-[0.98] transition-all flex items-center gap-2 text-sm shadow-md shadow-purple-950/50"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nuevo Video</span>
            <Sparkles className="w-3.5 h-3.5 text-emerald-300 ml-0.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
