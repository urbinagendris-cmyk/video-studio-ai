import React, { useState, useEffect } from 'react';

import { Header } from './components/Header';
import { NoticeBanner } from './components/NoticeBanner';
import { HeroSection } from './components/HeroSection';
import { VideoCreatorForm } from './components/VideoCreatorForm';
import { PipelineProgress } from './components/PipelineProgress';
import { VideoStudioPlayer } from './components/VideoStudioPlayer';
import { VideoGallery } from './components/VideoGallery';
import { ExamplesModal } from './components/ExamplesModal';
import { HistoryDrawer } from './components/HistoryDrawer';

import {
  VideoProject,
  ToneType,
  VisualStyle,
  PipelineProgressState,
  Scene,
} from './types';

import { SAMPLE_PROJECTS } from './data/samples';

/*
============================================================
VIDEO STUDIO AI
APP.TSX
============================================================

PIPELINE:

1. Generar guion
2. Generar imágenes
3. Preparar proyecto
4. Iniciar FFmpeg
5. Esperar render real
6. Obtener URL real del MP4
7. Crear proyecto terminado
8. Guardar proyecto COMPLETO en Neon PostgreSQL
9. Mostrar MP4 real en VideoStudioPlayer
10. Permitir reproducir y descargar

IMPORTANTE:

ESTE ARCHIVO NO UTILIZA localStorage.

Los proyectos persistentes se guardan en Neon mediante:

POST   /api/projects
GET    /api/projects
PUT    /api/projects/:id
DELETE /api/projects/:id

El video final se identifica mediante:

videoUrl
downloadUrl
renderJobId

============================================================
*/

export type GeneratedVideoProject = VideoProject & {
  videoUrl?: string;
  downloadUrl?: string;
  renderJobId?: string;
};

export default function App() {
  /*
  ==========================================================
  STATE
  ==========================================================
  */

  const [projects, setProjects] = useState<
    GeneratedVideoProject[]
  >(SAMPLE_PROJECTS as GeneratedVideoProject[]);

  const [activeProject, setActiveProject] =
    useState<GeneratedVideoProject | null>(
      (SAMPLE_PROJECTS[0] as GeneratedVideoProject) || null
    );

  const [isGenerating, setIsGenerating] =
    useState(false);

  const [isLoadingProjects, setIsLoadingProjects] =
    useState(true);

  const [progress, setProgress] =
    useState<PipelineProgressState>({
      currentStep: 'idle',
      percentage: 0,
      message: '',
      completedScenesCount: 0,
      totalScenesCount: 0,
      logs: [],
    });

  const [isExamplesOpen, setIsExamplesOpen] =
    useState(false);

  const [isHistoryOpen, setIsHistoryOpen] =
    useState(false);

  /*
  ==========================================================
  API HELPER
  ==========================================================
  */

  const apiRequest = async (
    url: string,
    options: RequestInit = {}
  ) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    let data: any = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(
        data?.error ||
          data?.message ||
          `Error HTTP ${response.status}`
      );
    }

    return data;
  };

  /*
  ==========================================================
  CARGAR PROYECTOS DESDE NEON
  ==========================================================
  */

  useEffect(() => {
    let cancelled = false;

    const loadProjects = async () => {
      setIsLoadingProjects(true);

      try {
        const data = await apiRequest('/api/projects');

        if (cancelled) {
          return;
        }

        const savedProjects: GeneratedVideoProject[] =
          Array.isArray(data?.projects)
            ? data.projects
            : [];

        /*
        ======================================================
        IMPORTANTE

        Los proyectos reales vienen de Neon.

        Los SAMPLE_PROJECTS solamente se utilizan como
        ejemplos visuales de la aplicación.

        No se guardan en localStorage.
        ======================================================
        */

        const mergedProjects: GeneratedVideoProject[] = [
          ...savedProjects,
          ...(SAMPLE_PROJECTS as GeneratedVideoProject[]),
        ];

        setProjects(mergedProjects);

        if (savedProjects.length > 0) {
          setActiveProject(savedProjects[0]);
        } else {
          setActiveProject(
            (SAMPLE_PROJECTS[0] as GeneratedVideoProject) ||
              null
          );
        }
      } catch (error) {
        console.error(
          'Error cargando proyectos desde Neon:',
          error
        );

        if (!cancelled) {
          /*
          ====================================================
          Si Neon no responde, mostramos solamente los
          proyectos de ejemplo.

          NO usamos localStorage como respaldo.
          ====================================================
          */

          setProjects(
            SAMPLE_PROJECTS as GeneratedVideoProject[]
          );

          setActiveProject(
            (SAMPLE_PROJECTS[0] as GeneratedVideoProject) ||
              null
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProjects(false);
        }
      }
    };

    loadProjects();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
  ==========================================================
  GUARDAR PROYECTO EN NEON
  ==========================================================
  */

  const saveProjectToDatabase = async (
    project: GeneratedVideoProject
  ): Promise<GeneratedVideoProject> => {
    /*
    ========================================================
    TODO EL PROYECTO SE ENVÍA A NEON.

    No se utiliza localStorage.

    Se conservan especialmente:

    - videoUrl
    - downloadUrl
    - renderJobId
    - script
    - escenas
    - imágenes
    - configuración del proyecto
    ========================================================
    */

    const response = await apiRequest(
      '/api/projects',
      {
        method: 'POST',
        body: JSON.stringify({
          project,
        }),
      }
    );

    const savedProject =
      response?.project || {};

    /*
    ========================================================
    Neon puede devolver solamente algunos campos.

    Por eso mezclamos la respuesta con el proyecto
    original para no perder información importante.
    ========================================================
    */

    return {
      ...project,
      ...savedProject,

      videoUrl:
        savedProject?.videoUrl ||
        project.videoUrl,

      downloadUrl:
        savedProject?.downloadUrl ||
        project.downloadUrl,

      renderJobId:
        savedProject?.renderJobId ||
        project.renderJobId,
    };
  };

  /*
  ==========================================================
  ACTUALIZAR PROYECTO EN NEON
  ==========================================================
  */

  const updateProjectInDatabase = async (
    project: VideoProject
  ): Promise<GeneratedVideoProject> => {
    const response = await apiRequest(
      `/api/projects/${encodeURIComponent(
        project.id
      )}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          project,
        }),
      }
    );

    return (
      response?.project ||
      (project as GeneratedVideoProject)
    );
  };

  /*
  ==========================================================
  ELIMINAR PROYECTO DE NEON
  ==========================================================
  */

  const deleteProjectFromDatabase = async (
    id: string
  ) => {
    await apiRequest(
      `/api/projects/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    );
  };

  /*
  ==========================================================
  LOGS
  ==========================================================
  */

  const addLog = (
    logs: string[],
    message: string
  ) => {
    const updatedLogs = [
      ...logs,
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ];

    setProgress((prev) => ({
      ...prev,
      logs: updatedLogs,
    }));

    return updatedLogs;
  };

  /*
  ==========================================================
  ESPERAR RENDER FFMPEG
  ==========================================================
  */

  const waitForExport = async (
    jobId: string,
    logs: string[],
    totalScenes: number
  ) => {
    let currentLogs = [...logs];

    while (true) {
      const response = await fetch(
        `/api/export-video-status/${encodeURIComponent(
          jobId
        )}`
      );

      if (!response.ok) {
        throw new Error(
          'No se pudo consultar el estado del renderizado FFmpeg.'
        );
      }

      const data = await response.json();

      const renderProgress = Math.min(
        100,
        Math.max(
          0,
          Number(data?.progress) || 0
        )
      );

      const uiProgress =
        85 +
        Math.round(
          renderProgress * 0.15
        );

      const status =
        data?.status;

      setProgress((prev) => ({
        ...prev,

        currentStep:
          status === 'completed'
            ? 'completed'
            : status === 'failed'
            ? prev.currentStep
            : 'assembly',

        percentage:
          status === 'completed'
            ? 100
            : Math.min(
                99,
                uiProgress
              ),

        message:
          data?.message ||
          'Renderizando video final con FFmpeg...',

        totalScenesCount:
          totalScenes,

        completedScenesCount:
          status === 'completed'
            ? totalScenes
            : prev.completedScenesCount,
      }));

      if (
        data?.message &&
        currentLogs[
          currentLogs.length - 1
        ] !== data.message
      ) {
        currentLogs = addLog(
          currentLogs,
          data.message
        );
      }

      /*
      ========================================================
      COMPLETADO
      ========================================================
      */

      if (status === 'completed') {
        return data;
      }

      /*
      ========================================================
      FALLIDO
      ========================================================
      */

      if (status === 'failed') {
        throw new Error(
          data?.error ||
            'FFmpeg no pudo completar el video.'
        );
      }

      await new Promise<void>(
        (resolve) =>
          setTimeout(
            resolve,
            1200
          )
      );
    }
  };

  /*
  ==========================================================
  GENERAR VIDEO
  ==========================================================
  */

  const handleGenerateVideo = async (
    params: {
      topic: string;
      durationMin: number;
      tone: ToneType;
      visualStyle: VisualStyle;
      subtitlesEnabled: boolean;
    }
  ) => {
    if (isGenerating) {
      return;
    }

    setIsGenerating(true);

    let logs: string[] = [];

    const requestedDuration =
      Number(params.durationMin) > 0
        ? Number(params.durationMin)
        : 1;

    try {
      /*
      ======================================================
      INICIO
      ======================================================
      */

      logs = addLog(
        logs,
        `Iniciando generación: "${params.topic}"`
      );

      logs = addLog(
        logs,
        `Duración solicitada: ${requestedDuration} minutos.`
      );

      /*
      ======================================================
      STEP 1 — GUION
      ======================================================
      */

      setProgress({
        currentStep: 'script',
        percentage: 5,
        message:
          'Analizando prompt y generando guion...',
        completedScenesCount: 0,
        totalScenesCount: 0,
        logs,
      });

      logs = addLog(
        logs,
        'Enviando solicitud estructurada a Gemini...'
      );

      const scriptRes =
        await fetch(
          '/api/generate-script',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              topic:
                params.topic,
              duration:
                requestedDuration,
              tone:
                params.tone,
              style:
                params.visualStyle,
            }),
          }
        );

      let scriptData: any;

      try {
        scriptData =
          await scriptRes.json();
      } catch {
        throw new Error(
          'El servidor no devolvió una respuesta JSON válida al generar el guion.'
        );
      }

      if (
        !scriptRes.ok ||
        !scriptData?.success ||
        !scriptData?.script
      ) {
        throw new Error(
          scriptData?.error ||
            'Error al generar el guion.'
        );
      }

      const script =
        scriptData.script;

      const totalScenes =
        Array.isArray(
          script.escenas
        )
          ? script.escenas.length
          : 0;

      if (totalScenes === 0) {
        throw new Error(
          'Gemini no devolvió ninguna escena válida.'
        );
      }

      logs = addLog(
        logs,
        `Guion generado: "${script.titulo}". ${totalScenes} escenas.`
      );

      /*
      ======================================================
      STEP 2 — IMÁGENES
      ======================================================
      */

      setProgress({
        currentStep: 'images',
        percentage: 15,
        message:
          'Generando imágenes de las escenas...',
        completedScenesCount: 0,
        totalScenesCount:
          totalScenes,
        logs,
      });

      const updatedScenes: Scene[] = [];

      for (
        let i = 0;
        i < totalScenes;
        i++
      ) {
        const sc =
          script.escenas[i];

        logs = addLog(
          logs,
          `Generando imagen ${i + 1}/${totalScenes}...`
        );

        try {
          const imgRes =
            await fetch(
              '/api/generate-scene-image',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body: JSON.stringify({
                  prompt_imagen:
                    sc.prompt_imagen,
                  style:
                    params.visualStyle,
                  topic:
                    params.topic,
                }),
              }
            );

          let imgData: any;

          try {
            imgData =
              await imgRes.json();
          } catch {
            imgData = null;
          }

          if (!imgRes.ok) {
            throw new Error(
              imgData?.error ||
                `No se pudo generar la imagen de la escena ${i + 1}.`
            );
          }

          const currentPct =
            15 +
            Math.round(
              ((i + 1) /
                totalScenes) *
                55
            );

          setProgress(
            (prev) => ({
              ...prev,
              percentage:
                currentPct,
              completedScenesCount:
                i + 1,
              totalScenesCount:
                totalScenes,
              logs,
            })
          );

          updatedScenes.push({
            ...sc,
            imageUrl:
              imgData?.imageUrl ||
              `https://picsum.photos/seed/${
                i + 100
              }/1280/720`,
          });

        } catch (imageError) {
          console.warn(
            `Imagen de escena ${i + 1}:`,
            imageError
          );

          logs = addLog(
            logs,
            `Aviso: usando imagen de respaldo para escena ${i + 1}.`
          );

          updatedScenes.push({
            ...sc,
            imageUrl:
              `https://picsum.photos/seed/${
                i + 200
              }/1280/720`,
          });
        }
      }

      /*
      ======================================================
      STEP 3 — PREPARAR AUDIO / PROYECTO
      ======================================================
      */

      setProgress((prev) => ({
        ...prev,
        currentStep: 'audio',
        percentage: 75,
        message:
          'Preparando narración y audio...',
        completedScenesCount:
          totalScenes,
        totalScenesCount:
          totalScenes,
        logs,
      }));

      logs = addLog(
        logs,
        'Las escenas están listas. FFmpeg preparará narración, música y video.'
      );

      const scriptDuration =
        Number(
          script.duracion_estimada_min
        );

      const finalRequestedDuration =
        scriptDuration > 0
          ? scriptDuration
          : requestedDuration;

      const projectForExport:
        VideoProject = {
          id:
            `proj-${Date.now()}-${Math.random()
              .toString(36)
              .substring(2, 8)}`,

          createdAt:
            new Date().toISOString(),

          topic:
            params.topic,

          durationMin:
            finalRequestedDuration,

          tone:
            params.tone,

          visualStyle:
            params.visualStyle,

          subtitlesEnabled:
            params.subtitlesEnabled,

          status:
            'generating',

          thumbnailUrl:
            updatedScenes[0]
              ?.imageUrl,

          totalScenes,

          renderedProgress:
            0,

          script: {
            ...script,

            duracion_estimada_min:
              finalRequestedDuration,

            escenas:
              updatedScenes,
          },
        };

      /*
      ======================================================
      STEP 4 — FFMPEG
      ======================================================
      */

      setProgress((prev) => ({
        ...prev,

        currentStep:
          'assembly',

        percentage:
          85,

        message:
          'Iniciando ensamblado final con FFmpeg...',

        logs,
      }));

      logs = addLog(
        logs,
        'Iniciando trabajo de renderizado FFmpeg...'
      );

      const exportRes =
        await fetch(
          '/api/export-video-ffmpeg',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              project:
                projectForExport,

              subtitlesEnabled:
                params.subtitlesEnabled,

              voice:
                'Kore',
            }),
          }
        );

      let exportData: any;

      try {
        exportData =
          await exportRes.json();
      } catch {
        throw new Error(
          'El servidor no devolvió una respuesta válida al iniciar FFmpeg.'
        );
      }

      if (
        !exportRes.ok ||
        !exportData?.success ||
        !exportData?.jobId
      ) {
        throw new Error(
          exportData?.error ||
            'No se pudo iniciar FFmpeg.'
        );
      }

      logs = addLog(
        logs,
        `Trabajo FFmpeg iniciado: ${exportData.jobId}`
      );

      /*
      ======================================================
      ESPERAR RESULTADO REAL
      ======================================================
      */

      const completedJob =
        await waitForExport(
          exportData.jobId,
          logs,
          totalScenes
        );

      logs = addLog(
        logs,
        '¡Video ensamblado correctamente!'
      );

      /*
      ======================================================
      OBTENER URL REAL DEL MP4
      ======================================================
      */

      const finalVideoUrl =
        completedJob?.videoUrl ||
        completedJob?.downloadUrl ||
        `/api/download-video/${encodeURIComponent(
          exportData.jobId
        )}`;

      if (!finalVideoUrl) {
        throw new Error(
          'FFmpeg terminó, pero el servidor no devolvió la URL del video final.'
        );
      }

      logs = addLog(
        logs,
        `Video final disponible: ${finalVideoUrl}`
      );

      /*
      ======================================================
      PROYECTO FINAL
      ======================================================
      */

      const newProject:
        GeneratedVideoProject = {
          ...projectForExport,

          status:
            'completed',

          renderedProgress:
            100,

          videoUrl:
            finalVideoUrl,

          downloadUrl:
            completedJob?.downloadUrl ||
            finalVideoUrl,

          renderJobId:
            exportData.jobId,
        };

      /*
      ======================================================
      GUARDAR PROYECTO COMPLETO EN NEON
      ======================================================

      IMPORTANTE:

      NO GUARDAMOS NADA EN localStorage.

      Neon es la persistencia principal.

      Si el proyecto contiene:

      - escenas
      - imágenes
      - URL del video
      - configuración
      - guion
      - renderJobId

      todo se manda mediante saveProjectToDatabase().
      ======================================================
      */

      logs = addLog(
        logs,
        'Guardando proyecto completo en Neon PostgreSQL...'
      );

      let persistedProject:
        GeneratedVideoProject;

      try {
        persistedProject =
          await saveProjectToDatabase(
            newProject
          );

        logs = addLog(
          logs,
          '✅ Proyecto guardado correctamente en Neon PostgreSQL.'
        );

      } catch (dbError: any) {
        /*
        ====================================================
        MUY IMPORTANTE

        Si Neon falla, NO usamos localStorage.

        El proyecto queda solamente en memoria React
        durante esta sesión para no perder el video que
        acaba de terminar.

        Pero NO afirmamos que quedó guardado en Neon.
        ====================================================
        */

        console.error(
          'El video terminó, pero no pudo guardarse en Neon:',
          dbError
        );

        logs = addLog(
          logs,
          `⚠️ El video terminó correctamente, pero Neon no pudo guardar el proyecto: ${
            dbError?.message ||
            'error de persistencia'
          }`
        );

        persistedProject =
          newProject;

        setProgress((prev) => ({
          ...prev,
          logs,
        }));
      }

      /*
      ======================================================
      ACTUALIZAR GALERÍA EN MEMORIA

      Esto NO es almacenamiento permanente.

      Es solamente el estado React de la interfaz.

      La persistencia real está en Neon.
      ======================================================
      */

      setProjects(
        (prev) => [
          persistedProject,
          ...prev.filter(
            (p) =>
              p.id !==
              persistedProject.id
          ),
        ]
      );

      /*
      ======================================================
      MOSTRAR VIDEO FINAL
      ======================================================
      */

      setActiveProject(
        persistedProject
      );

      /*
      ======================================================
      PROGRESO FINAL
      ======================================================
      */

      logs = addLog(
        logs,
        '¡Video disponible para revisión y descarga!'
      );

      setProgress({
        currentStep:
          'completed',

        percentage:
          100,

        message:
          '¡Video generado al 100% y listo!',

        completedScenesCount:
          totalScenes,

        totalScenesCount:
          totalScenes,

        logs,
      });

      /*
      ======================================================
      TERMINAR
      ======================================================
      */

      setIsGenerating(false);

      setTimeout(() => {
        const playerEl =
          document.getElementById(
            'studio-player-container'
          );

        if (playerEl) {
          playerEl.scrollIntoView({
            behavior:
              'smooth',

            block:
              'start',
          });
        }
      }, 300);

    } catch (err: any) {
      /*
      ======================================================
      ERROR GLOBAL DEL PIPELINE
      ======================================================
      */

      console.error(
        'Pipeline error:',
        err
      );

      logs = addLog(
        logs,
        `ERROR: ${
          err?.message ||
          'Error durante la generación.'
        }`
      );

  setProgress((prev) => ({
  ...prev,

  message:
    err?.message ||
    'La generación falló.',

  logs,
}));
      setIsGenerating(false);

      alert(
        `Ocurrió un error en la generación:\n\n${
          err?.message ||
          'Error desconocido.'
        }`
      );
    }
  };

  /*
  ==========================================================
  ELIMINAR PROYECTO
  ==========================================================
  */

  const handleDeleteProject = async (
    id: string
  ) => {
    const project =
      projects.find(
        (p) =>
          p.id === id
      );

    /*
    ========================================================
    Los proyectos SAMPLE solamente existen en memoria.
    No necesitan eliminarse de Neon.
    ========================================================
    */

    if (
      project?.id.startsWith(
        'sample-'
      )
    ) {
      setProjects(
        (prev) =>
          prev.filter(
            (p) =>
              p.id !== id
          )
      );

      if (
        activeProject?.id ===
        id
      ) {
        setActiveProject(
          null
        );
      }

      return;
    }

    try {
      /*
      ======================================================
      Primero eliminamos de Neon.
      ======================================================
      */

      await deleteProjectFromDatabase(
        id
      );

      /*
      ======================================================
      Después actualizamos solamente el estado de React.
      ======================================================
      */

      setProjects(
        (prev) =>
          prev.filter(
            (p) =>
              p.id !== id
          )
      );

      if (
        activeProject?.id ===
        id
      ) {
        setActiveProject(
          null
        );
      }

    } catch (error: any) {
      console.error(
        'Error eliminando proyecto:',
        error
      );

      alert(
        `No se pudo eliminar el proyecto:\n\n${
          error?.message ||
          'Error de base de datos.'
        }`
      );
    }
  };

  /*
  ==========================================================
  NUEVO VIDEO
  ==========================================================
  */

  const handleNewVideoClick =
    () => {
      setActiveProject(
        null
      );

      const formEl =
        document.getElementById(
          'creator-form'
        );

      if (formEl) {
        formEl.scrollIntoView({
          behavior:
            'smooth',

          block:
            'start',
        });
      }
    };

  /*
  ==========================================================
  ACTUALIZAR PROYECTO DESDE PLAYER
  ==========================================================
  */

  const handleUpdateProject =
    async (
      updated: VideoProject
    ) => {
      /*
      ======================================================
      Actualizamos inmediatamente la interfaz.
      ======================================================
      */

      setActiveProject(
        updated as GeneratedVideoProject
      );

      setProjects(
        (prev) =>
          prev.map(
            (p) =>
              p.id ===
              updated.id
                ? {
                    ...p,
                    ...updated,
                  }
                : p
          )
      );

      /*
      ======================================================
      Los SAMPLE no se guardan en Neon.
      ======================================================
      */

      if (
        updated.id.startsWith(
          'sample-'
        )
      ) {
        return;
      }

      /*
      ======================================================
      Guardamos la modificación en Neon.
      ======================================================
      */

      try {
        const saved =
          await updateProjectInDatabase(
            updated
          );

        /*
        ====================================================
        Conservamos la respuesta actualizada de Neon.
        ====================================================
        */

        setActiveProject(
          saved
        );

        setProjects(
          (prev) =>
            prev.map(
              (p) =>
                p.id ===
                saved.id
                  ? {
                      ...p,
                      ...saved,
                    }
                  : p
            )
        );

      } catch (error) {
        console.error(
          'Error guardando actualización del proyecto:',
          error
        );
      }
    };

  /*
  ==========================================================
  RENDER
  ==========================================================
  */

  return (
    <div className="min-h-screen bg-[#050508] text-white">

      <Header
        onNewVideo={
          handleNewVideoClick
        }

        onOpenHistory={() =>
          setIsHistoryOpen(
            true
          )
        }

        onOpenExamples={() =>
          setIsExamplesOpen(
            true
          )
        }

        historyCount={
          projects.length
        }
      />

      <NoticeBanner />

      <main className="max-w-[1050px] mx-auto px-4 py-8 space-y-10">

        <HeroSection />

        <VideoCreatorForm
          onGenerate={
            handleGenerateVideo
          }

          isLoading={
            isGenerating
          }
        />

        {isGenerating && (
          <PipelineProgress
            progress={
              progress
            }
          />
        )}

        {isLoadingProjects && (
          <div className="text-center text-xs text-slate-500 font-mono">
            Cargando proyectos desde Neon...
          </div>
        )}

        {activeProject && (
          <div
            id="studio-player-container"
          >
            <VideoStudioPlayer
              project={
                activeProject
              }

              onUpdateProject={
                handleUpdateProject
              }
            />
          </div>
        )}

        <VideoGallery
          projects={
            projects
          }

          onSelectProject={(
            proj
          ) => {
            setActiveProject(
              proj as GeneratedVideoProject
            );

            setTimeout(() => {
              const playerEl =
                document.getElementById(
                  'studio-player-container'
                );

              if (playerEl) {
                playerEl.scrollIntoView({
                  behavior:
                    'smooth',

                  block:
                    'start',
                });
              }
            }, 50);
          }}

          onDeleteProject={
            handleDeleteProject
          }
        />

      </main>

      <ExamplesModal
        isOpen={
          isExamplesOpen
        }

        onClose={() =>
          setIsExamplesOpen(
            false
          )
        }

        onSelectExample={(
          proj
        ) => {
          setActiveProject(
            proj as GeneratedVideoProject
          );

          setIsExamplesOpen(
            false
          );
        }}
      />

      <HistoryDrawer
        isOpen={
          isHistoryOpen
        }

        onClose={() =>
          setIsHistoryOpen(
            false
          )
        }

        projects={
          projects
        }

        onSelectProject={(
          proj
        ) => {
          setActiveProject(
            proj as GeneratedVideoProject
          );

          setIsHistoryOpen(
            false
          );
        }}

        onDeleteProject={
          handleDeleteProject
        }
      />

      <footer className="w-full border-t border-white/5 bg-[#050508] py-6 px-4 text-center text-xs text-slate-500 font-mono">

        <p>
          Video Studio AI • Motor de
          creación de video impulsado
          por Gemini, Imagen, TTS &
          FFmpeg.
        </p>

      </footer>

    </div>
  );
}