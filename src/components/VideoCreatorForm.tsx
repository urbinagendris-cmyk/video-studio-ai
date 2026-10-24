import React, { useState } from 'react';
import { ToneType, VisualStyle } from '../types';
import {
  Sparkles,
  Eye,
  Subtitles,
  Palette,
  Lightbulb,
} from 'lucide-react';

interface VideoCreatorFormProps {
  onGenerate: (params: {
    topic: string;
    durationMin: number;
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
  'Psicología y Lenguaje Corporal',
];

const TONE_OPTIONS: {
  id: ToneType;
  label: string;
  icon: string;
  desc: string;
}[] = [
  {
    id: 'misterio',
    label: 'Misterio & Enigma',
    icon: '🕵️‍♂️',
    desc: 'Suspenso, revelaciones y ambiente intrigante',
  },
  {
    id: 'educativo',
    label: 'Educativo & Docu',
    icon: '🎓',
    desc: 'Explicativo, científico, estructurado y claro',
  },
  {
    id: 'motivacional',
    label: 'Motivacional & Éxito',
    icon: '🔥',
    desc: 'Inspirador, enérgico, reflexivo e impulsador',
  },
  {
    id: 'narrativo',
    label: 'Narrativo / Cuento',
    icon: '📖',
    desc: 'Historia inmersiva, evolución de personajes y drama',
  },
];

const STYLE_OPTIONS: { id: VisualStyle; label: string }[] = [
  { id: 'cinematic', label: '🎬 Fotorrealista Cinematic' },
  { id: '3d_render', label: '⚡ 3D Render / Cyber' },
  { id: 'arte_digital', label: '🎨 Arte Digital & Concept' },
  { id: 'fotorrealista', label: '📸 Fotografía Documental' },
  { id: 'anime', label: '🐉 Anime / Ilustración' },
];

export const VideoCreatorForm: React.FC<VideoCreatorFormProps> = ({
  onGenerate,
  isLoading,
}) => {
  const [topic, setTopic] = useState('');
  const [durationMin, setDurationMin] = useState<number | ''>('');
  const [tone, setTone] = useState<ToneType>('misterio');
  const [visualStyle, setVisualStyle] =
    useState<VisualStyle>('cinematic');
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!topic.trim() || isLoading) return;

    /*
      La duración es opcional.

      Si el usuario escribe:
      "Haz un video de 2 minutos..."
      el backend detectará los 2 minutos.

      Si además escribe una duración en este campo,
      esa duración tiene prioridad.
    */
    const selectedDuration =
      durationMin === ''
        ? undefined
        : Number(durationMin);

    onGenerate({
      topic: topic.trim(),
      durationMin: selectedDuration as number,
      tone,
      visualStyle,
      subtitlesEnabled,
    });
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setTopic(suggestion);
  };

  return (
    <div
      id="creator-form"
      className="w-full glass-card rounded-xl p-5 space-y-6"
    >
      {/* Topic */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Tema o Prompt del Video
          </label>

          <span className="text-[10px] text-slate-500">
            {topic.length} caracteres
          </span>
        </div>

        <textarea
          id="topic-input"
          rows={4}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Ej: Crea un documental de 3 minutos sobre los misterios de la Atlántida, con tono de misterio y estilo cinematográfico..."
          className="w-full bg-[#050508] border border-white/10 focus:border-[#8b5cf6]/60 rounded-lg p-3.5 text-white placeholder-slate-500 text-sm focus:outline-none transition-all resize-none font-sans leading-relaxed"
        />

        <div className="flex items-start gap-2 rounded-lg bg-violet-950/20 border border-violet-500/10 p-3">
          <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />

          <div className="text-[11px] text-slate-400 leading-relaxed">
            <span className="text-violet-300 font-semibold">
              Duración libre:
            </span>{' '}
            puedes escribirla directamente en el prompt:
            <span className="text-slate-200">
              {' '}
              "video de 1 minuto", "documental de 4 minutos",
              "video de 10 minutos", etc.
            </span>
            <br />
            Si no indicas duración, se utilizarán 5 minutos como
            duración predeterminada.
          </div>
        </div>

        {/* Quick suggestions */}
        <div>
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

      {/* Optional duration */}
      <div className="pt-2 border-t border-white/5 space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-tighter">
          Duración opcional
        </label>

        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            step="1"
            value={durationMin}
            onChange={(e) => {
              const value = e.target.value;

              if (value === '') {
                setDurationMin('');
                return;
              }

              const numberValue = Number(value);

              if (numberValue >= 1) {
                setDurationMin(numberValue);
              }
            }}
            placeholder="Ej: 2"
            className="w-32 bg-[#050508] border border-white/10 focus:border-[#8b5cf6] rounded-lg p-2.5 text-white text-xs focus:outline-none"
          />

          <div className="flex items-center text-[10px] text-slate-500">
            minutos
          </div>
        </div>

        <p className="text-[10px] text-slate-500">
          Déjalo vacío para que la IA detecte la duración escrita
          en el prompt.
        </p>
      </div>

      {/* Style */}
      <div className="pt-2 border-t border-white/5 space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-2">
          <Palette className="w-3.5 h-3.5 text-fuchsia-400" />
          <span>Estilo Estético</span>
        </label>

        <select
          value={visualStyle}
          onChange={(e) =>
            setVisualStyle(e.target.value as VisualStyle)
          }
          className="w-full bg-[#050508] border border-white/10 focus:border-[#8b5cf6] rounded-lg p-2.5 text-white text-xs focus:outline-none transition-all cursor-pointer"
        >
          {STYLE_OPTIONS.map((st) => (
            <option
              key={st.id}
              value={st.id}
              className="bg-[#0a0a0f]"
            >
              {st.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tone */}
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

              <p className="text-[10px] text-slate-400 leading-snug">
                {t.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Subtitles */}
      <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-emerald-400">
            <Subtitles className="w-4 h-4" />
          </div>

          <div>
            <span className="text-xs font-bold text-white block">
              Subtítulos Animados
            </span>

            <span className="text-[11px] text-slate-400 block">
              Texto optimizado para YouTube, Facebook, Instagram y TikTok
            </span>
          </div>
        </div>

        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            checked={subtitlesEnabled}
            onChange={(e) =>
              setSubtitlesEnabled(e.target.checked)
            }
            className="sr-only peer"
          />

          <div className="w-10 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:bg-[#8b5cf6] relative transition-colors">
            <div
              className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${
                subtitlesEnabled
                  ? 'right-1'
                  : 'left-1'
              }`}
            />
          </div>
        </label>
      </div>

      {/* Generate */}
      <div className="pt-3">
        <button
          type="submit"
          disabled={!topic.trim() || isLoading}
          onClick={handleSubmit}
          className={`w-full py-3.5 px-6 rounded-lg font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-3 active:scale-[0.99] cursor-pointer ${
            !topic.trim() || isLoading
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
              : 'bg-[#22c55e] hover:bg-[#22c55e]/90 text-black shadow-lg shadow-emerald-950/50'
          }`}
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              <span>Generando video...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Generar Video con IA</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};