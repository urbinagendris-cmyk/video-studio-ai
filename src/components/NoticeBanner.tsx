import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

export const NoticeBanner: React.FC = () => {
  return (
    <div className="w-full bg-amber-950/20 border-y border-amber-500/20 px-8 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-[11px] text-amber-200/80">
        <div className="flex items-center gap-2.5">
          <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center text-[10px] text-black font-bold flex-shrink-0">
            !
          </div>
          <p className="uppercase tracking-widest font-medium">
            <strong>Uso Profesional:</strong> Esta herramienta genera contenido de video con IA bajo la responsabilidad única del usuario final.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-slate-400 text-[11px] flex-shrink-0">
          <Info className="w-3.5 h-3.5 text-[#8b5cf6]" />
          <span>Optimizado para YouTube (16:9) y Facebook</span>
        </div>
      </div>
    </div>
  );
};
