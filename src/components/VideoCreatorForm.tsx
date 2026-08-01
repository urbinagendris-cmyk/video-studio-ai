import React, { useState } from 'react';
import { ToneType, DurationMinutes, VisualStyle } from '../types';
import { Sparkles, Clock, Compass, Eye, Subtitles, Palette, Lightbulb } from 'lucide-react';

interface VideoCreatorFormProps {
  onGenerate: (params: {
    topic: string;
    durationMin: DurationMinutes;
    tone: ToneType;
    visualStyle: VisualStyle;
    subtitlesEnabled: boolean;
  }) => void;
  isLoading: boolean;
}

const POPULAR_SUGGESTIONS = [
  'Misterios no resueltos de la Atlántida',
  'La Revolución de la Inteligencia Artificial',
  'Secretos de la Mente y el Subconsciente',
  'Civilizaciones Antiguas y sus Secretos',
  'Tecnologías del Futuro 2030-2050',
  'Finanzas Personales e Inversión para Jóvenes',
  'El Origen del Universo y Agujeros Negros',
  'Psicología Oscura y Lenguaje Corporal',
];

const TONE_OPTIONS: { id: ToneType; label: string; icon: string; desc: string }[] = [
  { id: 'misterio', label: 'Misterio & Enigma', icon: '🕵️‍♂️', desc: 'Suspenso, revelaciones y ambiente intrigante' },
  { id: 'educativo', label: 'Educativo & Docu', icon: '🎓', desc: 'Explicativo, científico, estructurado y claro' },
  { id: 'motivacional', label: 'Motivacional & Éxito', icon: '🔥', desc: 'Inspirador, enérgico, reflexivo e impulsador' },
  { id: 'narrativo', label: 'Narrativo / Cuento', icon: '📖', desc: 'Historia inmersiva, evolución de personajes y drama' },
];

const DURATION_OPTIONS: { minutes: DurationMinutes; label: string; detail: string }[] = [
  { minutes: 5, label: '5 Minutos', detail: '~25 Escenas HD' },
  { minutes: 10, label: '10 Minutos', detail: '~50 Escenas HD' },
  { minutes: 15, label: '15+ Minutos', detail: '~75 Escenas HD' },
];

const STYLE_OPTIONS: { id: VisualStyle; label: string }[] = [
  { id: 'cinematic', label: '🎬 Fotorrealista Cinematic' },
  { id: '3d_render', label: '⚡ 3D Render / Cyber' },
  { id: 'arte_digital', label: '🎨 Arte Digital & Concept' },
  { id: 'fotorrealista', label: '📸 Fotografía Documental' },
  { id: 'anime', label: '🐉 Anime / Ilustración' },
];

export const VideoCreatorForm: React.FC<VideoCreatorFormProps> = ({ onGenerate, isLoading }) => {
  const [topic, setTopic] = useState('');
  const [durationMin, setDurationMin] = useState<DurationMinutes>(5);
  const [tone, setTone] = useState<ToneType>('misterio');
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('cinematic');
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isLoading) return;
    onGenerate({
      topic: topic.trim(),
      durationMin,
      tone,
      visualStyle,
      subtitlesEnabled,
    });
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setTopic(suggestion);
  };

  return (
    <div id="creator-form" className="glass-card w-full max-w-[1000px] mx-auto rounded-xl p-6 sm:p-8 space-y-5 relative overflow-hidden">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Topic Input Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="topic-input" className="text-xs font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-2">
              <Compass className="w-3.5 h-3.5 text-[#8b5cf6]" />
              <span>Tema o Prompt del Video</span>
            </label>
            <span className="text-[11px] text-slate-500 font-mono">
              {topic.length} caracteres
            </span>
          </div>

          <div className="relative">
            <textarea
              id="topic-input"
              rows={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Describe el tema central, contexto y detalles para el guion (Ej: La historia prohibida de la ciudad perdida de Z en el Amazonas)..."
              className="w-full bg-[#050508] border border-white/10 focus:border-[#8b5cf6]/60 rounded-lg p-3.5 text-white placeholder-slate-500 text-sm focus:outline-none transition-all resize-none font-sans leading-relaxed"
            />
          </div>

          {/* Popular Idea Chips */}
          <div className="pt-1">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-2">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              <span>Sugerencias rápidas:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {POPULAR_SUGGESTIONS.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => handleSelectSuggestion(sug)}
                  className="text-[10px] px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 rounded transition-all text-left cursor-pointer"
                >
                  #{sug}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Configuration Row 1: Duration & Style */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-white/5">
          {/* Duration Pills */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Duración Objetivo</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.minutes}
                  type="button"
                  onClick={() => setDurationMin(opt.minutes)}
                  className={`py-2 px-3 rounded-lg border text-center transition-all flex flex-col items-center justify-center ${
                    durationMin === opt.minutes
                      ? 'bg-[#8b5cf6]/10 border-[#8b5cf6] text-[#8b5cf6] font-bold'
                      : 'bg-[#050508] border-white/5 text-slate-400 hover:border-white/10'
                  }`}
                >
                  <span className="text-xs font-semibold">{opt.label}</span>
                  <span className="text-[9px] opacity-70 mt-0.5">{opt.detail}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Visual Style Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-2">
              <Palette className="w-3.5 h-3.5 text-fuchsia-400" />
              <span>Estilo Estético (Imagen 4)</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              <select
                value={visualStyle}
                onChange={(e) => setVisualStyle(e.target.value as VisualStyle)}
                className="w-full bg-[#050508] border border-white/10 focus:border-[#8b5cf6] rounded-lg p-2.5 text-white text-xs focus:outline-none transition-all cursor-pointer"
              >
                {STYLE_OPTIONS.map((st) => (
                  <option key={st.id} value={st.id} className="bg-[#0a0a0f]">
                    {st.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500">
                Renderiza la estética visual adaptada con el modelo Imagen 4 de Google.
              </p>
            </div>
          </div>
        </div>

        {/* Configuration Row 2: Tone Selector */}
        <div className="pt-2 border-t border-white/5 space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-[#8b5cf6]" />
            <span>Tono Narrativo</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {TONE_OPTIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTone(t.id)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  tone === t.id
                    ? 'bg-[#8b5cf6]/10 border-[#8b5cf6] text-white shadow-sm'
                    : 'bg-[#050508] border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/10'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-white mb-1">
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Configuration Row 3: Subtitles Burn-In Toggle */}
        <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-emerald-400">
              <Subtitles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Subtítulos Animados Quemados</span>
              <span className="text-[11px] text-slate-400 block">
                Resalta texto corto en pantalla optimizado para YouTube y Facebook Reels.
              </span>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={subtitlesEnabled}
              onChange={(e) => setSubtitlesEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:bg-[#8b5cf6] relative transition-colors">
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${subtitlesEnabled ? 'right-1' : 'left-1'}`} />
            </div>
          </label>
        </div>

        {/* Submit Button */}
        <div className="pt-3">
          <button
            type="submit"
            disabled={!topic.trim() || isLoading}
            className={`w-full py-3.5 px-6 rounded-lg font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-3 active:scale-[0.99] cursor-pointer ${
              !topic.trim() || isLoading
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                : 'bg-[#22c55e] hover:bg-[#22c55e]/90 text-black shadow-lg shadow-emerald-950/50'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                <span>Generando con Gemini & Imagen 4...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generar Video con IA</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
