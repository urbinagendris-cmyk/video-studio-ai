import React from 'react';
import { Sparkles, Layers, Cpu, Music, ShieldCheck } from 'lucide-react';

export const HeroSection: React.FC = () => {
  return (
    <div className="text-center py-6 px-4 max-w-4xl mx-auto space-y-3">
      {/* Small Badge */}
      <div className="inline-block px-3 py-1 rounded-full border border-[#8b5cf6]/30 bg-[#8b5cf6]/10 text-[10px] text-[#8b5cf6] font-bold uppercase tracking-widest">
        Beta Studio v2.5 • Gemini 3.6 + Imagen 4 + Veo + Lyria
      </div>

      {/* Hero Title */}
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
        De idea a video viral en{' '}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-emerald-400">
          minutos
        </span>
      </h1>

      {/* Subtitle */}
      <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
        Utiliza los motores Gemini, Imagen 4, Veo y Lyria para crear narrativas cinematográficas de larga duración (5 a 15+ min) automáticamente con guiones, voz y música.
      </p>

      {/* Engine tags */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400 pt-2">
        <span className="flex items-center gap-1.5 bg-[#16161e] px-3 py-1 rounded-lg border border-white/5">
          <Cpu className="w-3.5 h-3.5 text-[#8b5cf6]" />
          Guiones por Escenas
        </span>
        <span className="flex items-center gap-1.5 bg-[#16161e] px-3 py-1 rounded-lg border border-white/5">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          Efecto Ken Burns Zoom
        </span>
        <span className="flex items-center gap-1.5 bg-[#16161e] px-3 py-1 rounded-lg border border-white/5">
          <Music className="w-3.5 h-3.5 text-fuchsia-400" />
          Bandas Sonoras Lyria
        </span>
        <span className="flex items-center gap-1.5 bg-[#16161e] px-3 py-1 rounded-lg border border-white/5">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          Subtítulos Animados
        </span>
      </div>
    </div>
  );
};
