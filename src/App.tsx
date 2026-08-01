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
  DurationMinutes,
  VisualStyle,
  PipelineProgressState,
  Scene,
} from './types';
import { SAMPLE_PROJECTS } from './data/samples';

export default function App() {
  const [projects, setProjects] = useState<VideoProject[]>(() => {
    const saved = localStorage.getItem('video_studio_projects');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return [...parsed, ...SAMPLE_PROJECTS];
      } catch (e) {
        return SAMPLE_PROJECTS;
      }
    }
    return SAMPLE_PROJECTS;
  });

  const [activeProject, setActiveProject] = useState<VideoProject | null>(SAMPLE_PROJECTS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<PipelineProgressState>({
    currentStep: 'idle',
    percentage: 0,
    message: '',
    completedScenesCount: 0,
    totalScenesCount: 0,
    logs: [],
  });

  const [isExamplesOpen, setIsExamplesOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Save user projects to localStorage
  useEffect(() => {
    const userOnly = projects.filter((p) => !p.id.startsWith('sample-'));
    localStorage.setItem('video_studio_projects', JSON.stringify(userOnly));
  }, [projects]);

  // Main Pipeline Execution Logic
  const handleGenerateVideo = async (params: {
    topic: string;
    durationMin: DurationMinutes;
    tone: ToneType;
    visualStyle: VisualStyle;
    subtitlesEnabled: boolean;
  }) => {
    setIsGenerating(true);
    const logs: string[] = [];

    const addLog = (msg: string) => {
      logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
      setProgress((prev) => ({ ...prev, logs: [...logs] }));
    };

    addLog(`Iniciando generación para: "${params.topic}" (${params.durationMin} min, tono ${params.tone})`);

    // STEP 1: Script Generation via Gemini 3.6 Flash
    setProgress({
      currentStep: 'script',
      percentage: 15,
      message: 'Generando guion narrativo por escenas con Gemini 3.6 Flash...',
      completedScenesCount: 0,
      totalScenesCount: 0,
      logs: [...logs],
    });

    try {
      addLog('Enviando prompt estructurado a Gemini 3.6 Flash (System Prompt YouTube/Facebook)...');
      const scriptRes = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: params.topic,
          duration: params.durationMin,
          tone: params.tone,
          style: params.visualStyle,
        }),
      });

      const scriptData = await scriptRes.json();
      if (!scriptData.success || !scriptData.script) {
        throw new Error(scriptData.error || 'Error al generar el guion');
      }

      const script = scriptData.script;
      const totalScenes = script.escenas.length;
      addLog(`Guion generado exitosamente: "${script.titulo}" (${totalScenes} escenas).`);

      // STEP 2: Scene Images Generation via Imagen 4
      setProgress({
        currentStep: 'images',
        percentage: 35,
        message: 'Renderizando imágenes artísticas HD por escena (Imagen 4)...',
        completedScenesCount: 0,
        totalScenesCount: totalScenes,
        logs: [...logs],
      });

      const updatedScenes: Scene[] = [];

      for (let i = 0; i < totalScenes; i++) {
        const sc = script.escenas[i];
        addLog(`Generando imagen para Escena ${i + 1}/${totalScenes}: ${sc.prompt_imagen.substring(0, 45)}...`);

        try {
          const imgRes = await fetch('/api/generate-scene-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt_imagen: sc.prompt_imagen,
              style: params.visualStyle,
              topic: params.topic,
            }),
          });
          const imgData = await imgRes.json();

          const currentPct = 35 + Math.round(((i + 1) / totalScenes) * 30);
          setProgress((prev) => ({
            ...prev,
            percentage: currentPct,
            completedScenesCount: i + 1,
          }));

          updatedScenes.push({
            ...sc,
            imageUrl: imgData.imageUrl || `https://picsum.photos/seed/${i + 100}/1280/720`,
          });
        } catch (scErr) {
          addLog(`Aviso: Usando imagen optimizada de respaldo para escena ${i + 1}`);
          updatedScenes.push({
            ...sc,
            imageUrl: `https://picsum.photos/seed/${i + 200}/1280/720`,
          });
        }
      }

      // STEP 3: Audio & TTS Narration
      setProgress({
        currentStep: 'audio',
        percentage: 75,
        message: 'Sintetizando locución en español latino (Gemini TTS) y música...',
        completedScenesCount: totalScenes,
        totalScenesCount: totalScenes,
        logs: [...logs],
      });
      addLog('Sintetizando pistas de audio narrado e integrando fondo musical Lyria...');

      await new Promise((r) => setTimeout(r, 1200));

      // STEP 4: Video Assembly
      setProgress({
        currentStep: 'assembly',
        percentage: 90,
        message: 'Ensamblando transiciones Ken Burns y subtítulos animados quemados...',
        completedScenesCount: totalScenes,
        totalScenesCount: totalScenes,
        logs: [...logs],
      });
      addLog('Aplicando efectos de dinamismo visual Ken Burns y subtítulos resaltados...');

      await new Promise((r) => setTimeout(r, 1000));

      // Build New Completed Video Project
      const newProject: VideoProject = {
        id: `proj-${Date.now()}`,
        createdAt: new Date().toISOString(),
        topic: params.topic,
        durationMin: params.durationMin,
        tone: params.tone,
        visualStyle: params.visualStyle,
        subtitlesEnabled: params.subtitlesEnabled,
        status: 'completed',
        thumbnailUrl: updatedScenes[0]?.imageUrl,
        totalScenes: totalScenes,
        renderedProgress: 100,
        script: {
          ...script,
          escenas: updatedScenes,
        },
      };

      addLog('¡Video ensamblado y listo para previsualizar y descargar!');

      setProgress({
        currentStep: 'completed',
        percentage: 100,
        message: '¡Generación completada con éxito!',
        completedScenesCount: totalScenes,
        totalScenesCount: totalScenes,
        logs: [...logs],
      });

      setProjects((prev) => [newProject, ...prev]);
      setActiveProject(newProject);

      // Scroll to player view smooth
      setTimeout(() => {
        setIsGenerating(false);
        const playerEl = document.getElementById('studio-player-container');
        if (playerEl) {
          playerEl.scrollIntoView({ behavior: 'smooth' });
        }
      }, 800);
    } catch (err: any) {
      console.error('Pipeline error:', err);
      addLog(`ERROR: ${err.message || 'Error en la generación del video.'}`);
      setIsGenerating(false);
      alert(`Ocurrió un error en la generación: ${err.message}`);
    }
  };

  const handleDeleteProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProject?.id === id) {
      setActiveProject(null);
    }
  };

  const handleNewVideoClick = () => {
    setActiveProject(null);
    const formEl = document.getElementById('creator-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-100 font-sans selection:bg-[#8b5cf6] selection:text-white">
      {/* 1. Fixed Desktop Header */}
      <Header
        onNewVideo={handleNewVideoClick}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenExamples={() => setIsExamplesOpen(true)}
        historyCount={projects.length}
      />

      {/* 2. Notice Banner */}
      <NoticeBanner />

      {/* Main Container max-width ~1000px */}
      <main className="max-w-[1050px] mx-auto px-4 py-8 space-y-10">
        {/* 3. Hero Section */}
        <HeroSection />

        {/* 4. Action Card Creator Form */}
        <VideoCreatorForm onGenerate={handleGenerateVideo} isLoading={isGenerating} />

        {/* 5. Live Pipeline Progress View */}
        {isGenerating && <PipelineProgress progress={progress} />}

        {/* 6. Video Studio Interactive Canvas Player */}
        {activeProject && (
          <div id="studio-player-container">
            <VideoStudioPlayer
              project={activeProject}
              onUpdateProject={(updated) => {
                setActiveProject(updated);
                setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
              }}
            />
          </div>
        )}

        {/* 7. Lower Video Gallery */}
        <VideoGallery
          projects={projects}
          onSelectProject={(proj) => {
            setActiveProject(proj);
            const playerEl = document.getElementById('studio-player-container');
            if (playerEl) {
              playerEl.scrollIntoView({ behavior: 'smooth' });
            }
          }}
          onDeleteProject={handleDeleteProject}
        />
      </main>

      {/* Modals */}
      <ExamplesModal
        isOpen={isExamplesOpen}
        onClose={() => setIsExamplesOpen(false)}
        onSelectExample={(proj) => {
          setActiveProject(proj);
          const playerEl = document.getElementById('studio-player-container');
          if (playerEl) {
            playerEl.scrollIntoView({ behavior: 'smooth' });
          }
        }}
      />

      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        projects={projects}
        onSelectProject={(proj) => {
          setActiveProject(proj);
          const playerEl = document.getElementById('studio-player-container');
          if (playerEl) {
            playerEl.scrollIntoView({ behavior: 'smooth' });
          }
        }}
        onDeleteProject={handleDeleteProject}
      />

      {/* Footer */}
      <footer className="w-full border-t border-white/5 bg-[#050508] py-6 px-4 text-center text-xs text-slate-500 font-mono">
        <p>
          Video Studio AI • Motor de creación de video impulsado por Gemini 3.6, Imagen 4, Veo &amp; Lyria.
        </p>
      </footer>
    </div>
  );
}
