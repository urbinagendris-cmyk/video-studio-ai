import React from 'react';
import { PipelineProgressState, PipelineStep } from '../types';
import { Cpu, Image as ImageIcon, Volume2, Film, CheckCircle2, Loader2, Sparkles } from 'lucide-react';

interface PipelineProgressProps {
  progress: PipelineProgressState;
  onCancel?: () => void;
}

const STEPS_CONFIG: { id: PipelineStep; title: string; subtitle: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'script', title: '1. Guion Estructurado', subtitle: 'Gemini 3.6 Flash por Escenas', icon: Cpu },
  { id: 'images', title: '2. Arte Escénico HD', subtitle: 'Imagen 4 / Veo Prompts', icon: ImageIcon },
  { id: 'audio', title: '3. Narración & Lyria', subtitle: 'Gemini TTS Español Latino', icon: Volume2 },
  { id: 'assembly', title: '4. Ensamblado FX', subtitle: 'Ken Burns & Subtítulos', icon: Film },
];

export const PipelineProgress: React.FC<PipelineProgressProps> = ({ progress }) => {
  const getStepStatus = (stepId: PipelineStep) => {
    const order: PipelineStep[] = ['script', 'images', 'audio', 'assembly', 'completed'];
    const currentIndex = order.indexOf(progress.currentStep);
    const stepIndex = order.indexOf(stepId);

    if (stepIndex < currentIndex || progress.currentStep === 'completed') {
      return 'completed';
    } else if (stepIndex === currentIndex) {
      return 'active';
    } else {
      return 'pending';
    }
  };

  return (
    <div className="glass-card w-full max-w-[1000px] mx-auto rounded-xl p-6 sm:p-8 space-y-6 relative overflow-hidden my-8">
      {/* Pipeline Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#8b5cf6]/10 text-[#8b5cf6] border border-[#8b5cf6]/30">
              <Sparkles className="w-4 h-4 animate-spin" />
            </span>
            <h2 className="text-lg font-bold text-white uppercase tracking-tight">Pipeline de Producción en Vivo</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Procesando escenas con aceleración IA en tiempo real
          </p>
        </div>

        <div className="text-right">
          <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-emerald-400 font-mono">
            {progress.percentage}%
          </div>
          <span className="text-[11px] text-slate-400">
            {progress.completedScenesCount} de {progress.totalScenesCount || '?'} escenas listas
          </span>
        </div>
      </div>

      {/* Main Progress Bar */}
      <div className="w-full bg-[#050508] h-2.5 rounded-full overflow-hidden p-0.5 border border-white/5">
        <div
          className="bg-gradient-to-r from-[#8b5cf6] via-fuchsia-500 to-[#22c55e] h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.max(5, progress.percentage)}%` }}
        />
      </div>

      {/* Steps Visual Bar Grid matching design HTML */}
      <div className="w-full flex items-center justify-between px-2 gap-2 overflow-x-auto py-2">
        {STEPS_CONFIG.map((step, idx) => {
          const status = getStepStatus(step.id);
          return (
            <React.Fragment key={step.id}>
              {idx > 0 && <div className="h-px flex-1 bg-white/10 mx-2 min-w-[20px]" />}
              <div className={`flex items-center gap-2.5 shrink-0 ${status === 'pending' ? 'opacity-30' : ''}`}>
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    status === 'completed'
                      ? 'bg-[#8b5cf6]/20 border border-[#8b5cf6]/50 text-[#8b5cf6]'
                      : status === 'active'
                      ? 'bg-[#8b5cf6] border border-[#8b5cf6] text-white animate-pulse'
                      : 'bg-white/10 border border-white/10 text-slate-400'
                  }`}
                >
                  {status === 'completed' ? '✓' : idx + 1}
                </div>
                <span className={`text-[10px] uppercase font-bold ${status === 'active' ? 'text-white' : 'text-slate-400'}`}>
                  {step.title.split('. ')[1]}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Live Activity Logs Console */}
      <div className="bg-[#050508] border border-white/5 rounded-lg p-4 font-mono text-xs">
        <div className="flex items-center justify-between text-slate-400 border-b border-white/5 pb-2 mb-2">
          <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-bold">
            <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-ping" />
            Consola de Ejecución en Tiempo Real
          </span>
          <span className="text-[10px] text-slate-500">Cloud Engine Active</span>
        </div>

        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-2 text-slate-300">
          {progress.logs.map((log, idx) => (
            <div key={idx} className="flex items-start gap-2 text-[11px]">
              <span className="text-[#8b5cf6] select-none">&gt;</span>
              <span className={idx === progress.logs.length - 1 ? 'text-emerald-300 font-semibold' : 'text-slate-400'}>
                {log}
              </span>
            </div>
          ))}
          {progress.logs.length === 0 && (
            <div className="text-slate-600 italic">Iniciando pipeline...</div>
          )}
        </div>
      </div>
    </div>
  );
};
