export type ToneType = 'misterio' | 'educativo' | 'motivacional' | 'narrativo';
export type DurationMinutes = 5 | 10 | 15;
export type VisualStyle = 'fotorrealista' | 'cinematic' | 'arte_digital' | '3d_render' | 'anime';

export interface Scene {
  numero: number;
  texto_narracion: string;
  prompt_imagen: string;
  texto_subtitulo: string;
  imageUrl?: string;
  audioUrl?: string;
  durationSeconds?: number;
}

export interface VideoScript {
  titulo: string;
  duracion_estimada_min: number;
  escenas: Scene[];
  tono?: ToneType;
  estiloVisual?: VisualStyle;
}

export interface VideoProject {
  id: string;
  createdAt: string;
  topic: string;
  durationMin: DurationMinutes;
  tone: ToneType;
  visualStyle: VisualStyle;
  subtitlesEnabled: boolean;
  script: VideoScript;
  status: 'draft' | 'generating' | 'completed' | 'failed';
  thumbnailUrl?: string;
  totalScenes: number;
  renderedProgress: number; // 0-100
  backgroundMusicUrl?: string;
}

export type PipelineStep = 'idle' | 'script' | 'images' | 'audio' | 'assembly' | 'completed';

export interface PipelineProgressState {
  currentStep: PipelineStep;
  percentage: number;
  message: string;
  completedScenesCount: number;
  totalScenesCount: number;
  logs: string[];
}
