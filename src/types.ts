export type ToneType =
  | 'misterio'
  | 'educativo'
  | 'motivacional'
  | 'narrativo';

export type DurationMinutes = number;

export type VisualStyle =
  | 'fotorrealista'
  | 'cinematic'
  | 'arte_digital'
  | '3d_render'
  | 'anime';

export interface Scene {
  numero: number;

  texto_narracion: string;

  prompt_imagen: string;

  texto_subtitulo: string;

  imageUrl?: string;

  audioUrl?: string;

  /**
   * Duración real de la escena en segundos.
   * Se obtiene preferiblemente a partir del audio TTS.
   */
  durationSeconds?: number;
}

export interface VideoScript {
  titulo: string;

  /**
   * Duración solicitada/estimada por el usuario.
   * Puede ser cualquier número positivo.
   */
  duracion_estimada_min: number;

  escenas: Scene[];

  tono?: ToneType;

  estiloVisual?: VisualStyle;
}

export interface VideoProject {
  id: string;

  createdAt: string;

  topic: string;

  /**
   * Duración elegida por el usuario en minutos.
   * Ya no está limitada a 5, 10 o 15.
   */
  durationMin: DurationMinutes;

  tone: ToneType;

  visualStyle: VisualStyle;

  subtitlesEnabled: boolean;

  script: VideoScript;

  status:
    | 'draft'
    | 'generating'
    | 'completed'
    | 'failed';

  thumbnailUrl?: string;

  totalScenes: number;

  /**
   * Progreso del renderizado final: 0-100.
   */
  renderedProgress: number;

  backgroundMusicUrl?: string;
}

export type PipelineStep =
  | 'idle'
  | 'script'
  | 'images'
  | 'audio'
  | 'assembly'
  | 'completed';

export interface PipelineProgressState {
  currentStep: PipelineStep;

  /**
   * Progreso general del pipeline: 0-100.
   */
  percentage: number;

  message: string;

  completedScenesCount: number;

  totalScenesCount: number;

  logs: string[];
}