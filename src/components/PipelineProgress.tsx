import React from 'react';
import {
  PipelineProgressState,
  PipelineStep,
} from '../types';
import {
  Cpu,
  Image as ImageIcon,
  Volume2,
  Film,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

interface PipelineProgressProps {
  progress: PipelineProgressState;
  onCancel?: () => void;
}

const STEPS_CONFIG: {
  id: PipelineStep;
  title: string;
  subtitle: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  {
    id: 'script',
    title: '1. Guion',
    subtitle: 'Gemini',
    icon: Cpu,
  },
  {
    id: 'images',
    title: '2. Imágenes',
    subtitle: 'Imagen',
    icon: ImageIcon,
  },
  {
    id: 'audio',
    title: '3. Audio',
    subtitle: 'TTS',
    icon: Volume2,
  },
  {
    id: 'assembly',
    title: '4. Ensamblado',
    subtitle: 'FFmpeg',
    icon: Film,
  },
];

export const PipelineProgress: React.FC<
  PipelineProgressProps
> = ({ progress }) => {
  const getStepStatus = (stepId: PipelineStep) => {
    const order: PipelineStep[] = [
      'script',
      'images',
      'audio',
      'assembly',
      'completed',
    ];

    const currentIndex = order.indexOf(progress.currentStep);
    const stepIndex = order.indexOf(stepId);

    if (
      progress.currentStep === 'completed' ||
      stepIndex < currentIndex
    ) {
      return 'completed';
    }

    if (stepIndex === currentIndex) {
      return 'active';
    }

    return 'pending';
  };

  const isCompleted = progress.currentStep === 'completed';

  return (
    <div className="w-full glass-card rounded-xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
            )}

            <h2 className="text-sm font-black uppercase tracking-wider text-white">
              {isCompleted
                ? 'Video Generado'
                : 'Pipeline de Producción en Vivo'}
            </h2>
          </div>

          <p className="text-[11px] text-slate-400 mt-1">
            {progress.message ||
              'Procesando escenas con aceleración IA...'}
          </p>
        </div>

        <div className="text-right">
          <div
            className={`text-2xl font-black font-mono ${
              isCompleted
                ? 'text-emerald-400'
                : 'text-violet-400'
            }`}
          >
            {progress.percentage}%
          </div>

          <span className="text-[11px] text-slate-400">
            {progress.completedScenesCount} de{' '}
            {progress.totalScenesCount || '?'} escenas
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="w-full bg-[#050508] h-3 rounded-full overflow-hidden border border-white/5">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isCompleted
              ? 'bg-emerald-500'
              : 'bg-gradient-to-r from-[#8b5cf6] via-fuchsia-500 to-[#22c55e]'
          }`}
          style={{
            width: `${Math.min(
              100,
              Math.max(0, progress.percentage)
            )}%`,
          }}
        />
      </div>

      {/* Completion */}
      {isCompleted && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-4 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />

          <div>
            <div className="text-sm font-bold text-emerald-300">
              ¡Video generado al 100%!
            </div>

            <div className="text-[11px] text-slate-400 mt-1">
              El video terminó de procesarse y está listo para
              revisión y descarga.
            </div>
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="w-full flex items-center justify-between px-2 gap-2 overflow-x-auto py-2">
        {STEPS_CONFIG.map((step, idx) => {
          const status = getStepStatus(step.id);
          const Icon = step.icon;

          return (
            <React.Fragment key={step.id}>
              {idx > 0 && (
                <div className="h-px flex-1 bg-white/10 mx-2 min-w-[20px]" />
              )}

              <div
                className={`flex items-center gap-2 shrink-0 ${
                  status === 'pending'
                    ? 'opacity-30'
                    : ''
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center ${
                    status === 'completed'
                      ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
                      : status === 'active'
                      ? 'bg-[#8b5cf6] border border-[#8b5cf6] text-white animate-pulse'
                      : 'bg-white/10 border border-white/10 text-slate-400'
                  }`}
                >
                  {status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                </div>

                <div className="hidden sm:block">
                  <span
                    className={`text-[10px] uppercase font-bold block ${
                      status === 'active'
                        ? 'text-white'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.title}
                  </span>

                  <span className="text-[9px] text-slate-500">
                    {step.subtitle}
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Console */}
      <div className="bg-[#050508] border border-white/5 rounded-lg p-4 font-mono text-xs">
        <div className="flex items-center justify-between text-slate-400 border-b border-white/5 pb-2 mb-2">
          <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-bold">
            <span
              className={`w-2 h-2 rounded-full ${
                isCompleted
                  ? 'bg-emerald-400'
                  : 'bg-[#22c55e] animate-ping'
              }`}
            />

            Consola de Ejecución en Tiempo Real
          </span>

          <span className="text-[10px] text-slate-500">
            Cloud Engine
          </span>
        </div>

        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-2 text-slate-300">
          {progress.logs.map((log, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 text-[11px]"
            >
              <span className="text-[#8b5cf6] select-none">
                &gt;
              </span>

              <span
                className={
                  idx === progress.logs.length - 1
                    ? 'text-emerald-300 font-semibold'
                    : 'text-slate-400'
                }
              >
                {log}
              </span>
            </div>
          ))}

          {progress.logs.length === 0 && (
            <div className="text-slate-600 italic">
              Iniciando pipeline...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};