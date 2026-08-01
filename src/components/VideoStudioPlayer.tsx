import React, { useState, useEffect, useRef } from 'react';
import { VideoProject, Scene } from '../types';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Download,
  FileText,
  Subtitles,
  Maximize2,
  Sparkles,
  Layers,
  RefreshCw,
  Share2,
  Sliders,
  CheckCircle2
} from 'lucide-react';

interface VideoStudioPlayerProps {
  project: VideoProject;
  onUpdateProject?: (updated: VideoProject) => void;
  onReGenerateSceneImage?: (sceneIndex: number) => Promise<void>;
}

export const VideoStudioPlayer: React.FC<VideoStudioPlayerProps> = ({
  project,
  onUpdateProject,
  onReGenerateSceneImage,
}) => {
  const scenes = project.script.escenas || [];
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [kenBurnsEnabled, setKenBurnsEnabled] = useState(true);
  const [showSubtitles, setShowSubtitles] = useState(project.subtitlesEnabled);
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatusMessage, setExportStatusMessage] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'player' | 'script'>('player');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const sceneStartTimeRef = useRef<number>(Date.now());
  const currentImageRef = useRef<HTMLImageElement | null>(null);
  const loadedImagesMap = useRef<Map<number, HTMLImageElement>>(new Map());

  const currentScene: Scene | undefined = scenes[currentSceneIndex];
  const SCENE_DURATION_MS = 9000; // 9 seconds per scene preview loop

  // Preload all scene images into memory for seamless canvas transitions
  useEffect(() => {
    scenes.forEach((sc, idx) => {
      if (sc.imageUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = sc.imageUrl;
        img.onload = () => {
          loadedImagesMap.current.set(idx, img);
          if (idx === currentSceneIndex) {
            currentImageRef.current = img;
          }
        };
      }
    });
  }, [scenes]);

  // Update image ref when currentSceneIndex changes
  useEffect(() => {
    const cachedImg = loadedImagesMap.current.get(currentSceneIndex);
    if (cachedImg) {
      currentImageRef.current = cachedImg;
    } else if (currentScene?.imageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = currentScene.imageUrl;
      img.onload = () => {
        loadedImagesMap.current.set(currentSceneIndex, img);
        currentImageRef.current = img;
      };
    }
    sceneStartTimeRef.current = Date.now();
  }, [currentSceneIndex, currentScene]);

  // Play narration via Web Speech Synthesis if audioUrl is absent or fallback
  useEffect(() => {
    if (isPlaying && currentScene?.texto_narracion && !isMuted) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(currentScene.texto_narracion);
        utterance.lang = 'es-MX';
        utterance.rate = 1.0;
        utterance.pitch = 0.95;
        window.speechSynthesis.speak(utterance);
      }
    } else if (!isPlaying && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [isPlaying, currentSceneIndex, isMuted, currentScene]);

  // Main Canvas Rendering Loop with Ken Burns Effect and Subtitles Burn-In
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isSubscribed = true;

    const renderFrame = () => {
      if (!isSubscribed) return;

      const width = canvas.width;
      const height = canvas.height;

      // 1. Clear background
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, width, height);

      // 2. Draw image with Ken Burns Pan/Zoom
      const img = currentImageRef.current;
      if (img && img.complete && img.naturalWidth > 0) {
        const elapsed = Date.now() - sceneStartTimeRef.current;
        const progress = Math.min(1, elapsed / SCENE_DURATION_MS);

        let scale = 1.0;
        let offsetX = 0;
        let offsetY = 0;

        if (kenBurnsEnabled) {
          // Subtle slow zoom from 1.0 to 1.12 with slight diagonal pan
          scale = 1.0 + progress * 0.12;
          const panDirection = currentSceneIndex % 2 === 0 ? 1 : -1;
          offsetX = (progress * 30 - 15) * panDirection;
          offsetY = (progress * 15 - 7.5) * panDirection;
        }

        ctx.save();
        ctx.translate(width / 2 + offsetX, height / 2 + offsetY);
        ctx.scale(scale, scale);

        // Aspect ratio cover calculation
        const imgRatio = img.naturalWidth / img.naturalHeight;
        const canvasRatio = width / height;
        let drawWidth = width;
        let drawHeight = height;

        if (imgRatio > canvasRatio) {
          drawWidth = height * imgRatio;
        } else {
          drawHeight = width / imgRatio;
        }

        ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        ctx.restore();
      } else {
        // Gradient fallback if image loading
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#1a102f');
        grad.addColorStop(1, '#0b1329');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#8b5cf6';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Cargando Imagen de Escena ${currentSceneIndex + 1}...`, width / 2, height / 2);
      }

      // 3. Subtle Vignette Overlay
      const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.3, width / 2, height / 2, width * 0.7);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      // 4. Burned-In Subtitles Overlay
      if (showSubtitles && currentScene?.texto_subtitulo) {
        const text = currentScene.texto_subtitulo;
        ctx.save();

        const fontSize = Math.max(22, Math.floor(height * 0.042));
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Measure text for background box
        const textMetrics = ctx.measureText(text);
        const paddingX = 24;
        const paddingY = 12;
        const boxWidth = textMetrics.width + paddingX * 2;
        const boxHeight = fontSize + paddingY * 2;
        const boxX = width / 2 - boxWidth / 2;
        const boxY = height - boxHeight - 40;

        // Dark pill background with border
        ctx.fillStyle = 'rgba(10, 10, 16, 0.88)';
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.6)';
        ctx.lineWidth = 2;

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 10);
        } else {
          ctx.rect(boxX, boxY, boxWidth, boxHeight);
        }
        ctx.fill();
        ctx.stroke();

        // High contrast yellow/white text
        ctx.fillStyle = '#facc15'; // Neon yellow highlight
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 8;
        ctx.fillText(text, width / 2, boxY + boxHeight / 2);

        ctx.restore();
      }

      // Auto-advance scenes if playing
      if (isPlaying) {
        const elapsed = Date.now() - sceneStartTimeRef.current;
        if (elapsed >= SCENE_DURATION_MS) {
          if (currentSceneIndex < scenes.length - 1) {
            setCurrentSceneIndex((prev) => prev + 1);
          } else {
            setIsPlaying(false);
            setCurrentSceneIndex(0);
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(renderFrame);
    };

    renderFrame();

    return () => {
      isSubscribed = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, currentSceneIndex, kenBurnsEnabled, showSubtitles, currentScene, scenes]);

  const handleNextScene = () => {
    if (currentSceneIndex < scenes.length - 1) {
      setCurrentSceneIndex((prev) => prev + 1);
    }
  };

  const handlePrevScene = () => {
    if (currentSceneIndex > 0) {
      setCurrentSceneIndex((prev) => prev - 1);
    }
  };

  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  // Download SRT Subtitles file
  const handleDownloadSRT = () => {
    let srtContent = '';
    let currentTimeMs = 0;

    scenes.forEach((sc, idx) => {
      const startTime = formatSrtTime(currentTimeMs);
      currentTimeMs += 9000;
      const endTime = formatSrtTime(currentTimeMs);

      srtContent += `${idx + 1}\n`;
      srtContent += `${startTime} --> ${endTime}\n`;
      srtContent += `${sc.texto_subtitulo || sc.texto_narracion}\n\n`;
    });

    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.topic.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}_subtitulos.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export JSON Script
  const handleDownloadScriptJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(project.script, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${project.topic.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}_guion.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export Video File via Server-Side FFmpeg
  const handleExportVideoFile = async () => {
    setIsExportingVideo(true);
    setExportProgress(0);
    setExportStatusMessage('Iniciando solicitud de ensamblado FFmpeg en el servidor...');
    setIsPlaying(false);

    try {
      const response = await fetch('/api/export-video-ffmpeg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project,
          subtitlesEnabled: showSubtitles,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success || !data.jobId) {
        throw new Error(data.error || 'Error al iniciar el trabajo de exportación en el servidor.');
      }

      const jobId = data.jobId;

      // Poll status every 1.5 seconds
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/export-video-status/${jobId}`);
          if (!statusRes.ok) return;

          const statusData = await statusRes.json();
          setExportProgress(statusData.progress || 0);
          if (statusData.message) {
            setExportStatusMessage(statusData.message);
          }

          if (statusData.status === 'completed' && statusData.downloadUrl) {
            clearInterval(pollInterval);
            setIsExportingVideo(false);
            setExportProgress(100);

            // Trigger direct file download
            const downloadAnchor = document.createElement('a');
            downloadAnchor.href = statusData.downloadUrl;
            downloadAnchor.download = `${project.topic.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}_final_video.mp4`;
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
          } else if (statusData.status === 'failed') {
            clearInterval(pollInterval);
            setIsExportingVideo(false);
            alert(`Error durante la exportación con FFmpeg: ${statusData.error || 'Fallo en la renderización.'}`);
          }
        } catch (pollErr) {
          console.warn('Error polling export status:', pollErr);
        }
      }, 1500);
    } catch (err: any) {
      console.error('Error exporting video:', err);
      setIsExportingVideo(false);
      alert(`Error al exportar el video: ${err.message}`);
    }
  };

  function formatSrtTime(ms: number): string {
    const totalSecs = Math.floor(ms / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const millis = ms % 1000;

    return `${pad(hours, 2)}:${pad(mins, 2)}:${pad(secs, 2)},${pad(millis, 3)}`;
  }

  function pad(num: number, size: number): string {
    let s = num + '';
    while (s.length < size) s = '0' + s;
    return s;
  }

  return (
    <div className="glass-card w-full max-w-[1000px] mx-auto rounded-xl p-6 space-y-6">
      {/* Title & Nav Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded bg-[#8b5cf6]/10 text-[#8b5cf6] border border-[#8b5cf6]/30 mb-1">
            <span>Tono: {project.tone}</span>
            <span>•</span>
            <span>Estilo: {project.visualStyle}</span>
          </div>
          <h2 className="text-xl font-bold text-white leading-snug">
            {project.script.titulo || project.topic}
          </h2>
        </div>

        <div className="flex items-center gap-2 bg-[#050508] p-1 rounded-lg border border-white/5">
          <button
            onClick={() => setActiveTab('player')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded transition-all ${
              activeTab === 'player'
                ? 'bg-[#8b5cf6] text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Reproductor Video
          </button>
          <button
            onClick={() => setActiveTab('script')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded transition-all ${
              activeTab === 'script'
                ? 'bg-[#8b5cf6] text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Desglose de Guion ({scenes.length})
          </button>
        </div>
      </div>

      {activeTab === 'player' ? (
        <>
          {/* Main 16:9 Canvas Video Screen */}
          <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-white/10 shadow-2xl">
            <canvas
              ref={canvasRef}
              width={1280}
              height={720}
              className="w-full h-full object-contain cursor-pointer"
              onClick={handleTogglePlay}
            />

            {/* Scene Badge Overlay (Top Left) */}
            <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-md border border-white/10 text-white text-xs font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
              <span>
                Escena {currentSceneIndex + 1} de {scenes.length}
              </span>
            </div>

            {/* Controls Overlay (Top Right) */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button
                onClick={() => setKenBurnsEnabled(!kenBurnsEnabled)}
                title="Efecto Zoom Ken Burns"
                className={`p-2 rounded-md border text-xs font-semibold backdrop-blur-md transition-all ${
                  kenBurnsEnabled
                    ? 'bg-[#8b5cf6] border-[#8b5cf6] text-white'
                    : 'bg-black/60 border-white/10 text-slate-400'
                }`}
              >
                <Layers className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowSubtitles(!showSubtitles)}
                title="Subtítulos Animados"
                className={`p-2 rounded-md border text-xs font-semibold backdrop-blur-md transition-all ${
                  showSubtitles
                    ? 'bg-[#22c55e] border-[#22c55e] text-black font-bold'
                    : 'bg-black/60 border-white/10 text-slate-400'
                }`}
              >
                <Subtitles className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive Player Controls Toolbar */}
          <div className="bg-[#050508] border border-white/5 rounded-lg p-4 space-y-3">
            {/* Timeline Progress Bar */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-400">
                {currentSceneIndex + 1} / {scenes.length}
              </span>
              <div className="flex-1 bg-white/5 h-2 rounded-full overflow-hidden cursor-pointer flex gap-0.5">
                {scenes.map((_, idx) => (
                  <div
                    key={idx}
                    onClick={() => setCurrentSceneIndex(idx)}
                    className={`h-full flex-1 transition-all ${
                      idx === currentSceneIndex
                        ? 'bg-[#22c55e]'
                        : idx < currentSceneIndex
                        ? 'bg-[#8b5cf6]'
                        : 'bg-white/10 hover:bg-white/20'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs font-mono text-slate-400">
                ~{project.durationMin} min
              </span>
            </div>

            {/* Buttons Row */}
            <div className="flex items-center justify-between pt-1">
              {/* Play / Skip Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevScene}
                  disabled={currentSceneIndex === 0}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/5 disabled:opacity-30 cursor-pointer"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                <button
                  onClick={handleTogglePlay}
                  className="px-4 py-2 rounded-lg bg-[#8b5cf6] hover:bg-[#8b5cf6]/90 text-white font-bold flex items-center gap-2 text-xs shadow cursor-pointer"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      <span>Pausar</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Reproducir</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleNextScene}
                  disabled={currentSceneIndex === scenes.length - 1}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/5 disabled:opacity-30 cursor-pointer"
                >
                  <SkipForward className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 ml-2 cursor-pointer"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-[#22c55e]" />}
                </button>
              </div>

              {/* Action Downloads */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadSRT}
                  className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-fuchsia-400" />
                  <span>Subtítulos (.SRT)</span>
                </button>

                <button
                  onClick={handleDownloadScriptJson}
                  className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-[#8b5cf6]" />
                  <span>Guion (.JSON)</span>
                </button>

                <button
                  onClick={handleExportVideoFile}
                  disabled={isExportingVideo}
                  className="px-4 py-2 text-xs font-bold text-black bg-[#22c55e] hover:bg-[#22c55e]/90 rounded-lg flex items-center gap-2 shadow cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{isExportingVideo ? `Exportando (${exportProgress}%)...` : 'Descargar Video MP4'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Active FFmpeg Export Assembly Progress Banner */}
          {isExportingVideo && (
            <div className="bg-[#8b5cf6]/10 border border-[#8b5cf6]/40 rounded-lg p-4 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#8b5cf6] animate-spin" />
                  <span className="uppercase tracking-wider">Ensamblado de Video FFmpeg en Servidor</span>
                </div>
                <span className="font-mono text-[#22c55e] text-sm">{exportProgress}%</span>
              </div>

              <div className="w-full bg-[#050508] h-2.5 rounded-full overflow-hidden p-0.5 border border-white/10">
                <div
                  className="bg-gradient-to-r from-[#8b5cf6] via-fuchsia-500 to-[#22c55e] h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(5, exportProgress)}%` }}
                />
              </div>

              <p className="text-xs text-slate-300 font-mono italic flex items-center gap-1.5">
                <span className="text-[#8b5cf6] font-bold">&gt;</span>
                <span>{exportStatusMessage || 'Procesando imágenes, narraciones TTS, efectos Ken Burns y subtítulos...'}</span>
              </p>
            </div>
          )}

          {/* Current Scene Inspector Card */}
          {currentScene && (
            <div className="bg-[#050508] border border-white/5 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-[#8b5cf6] font-bold">
                <span>ESCENA #{currentScene.numero}</span>
                <span className="text-slate-400 font-normal text-[11px]">Duración Estimada: ~10s</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed font-sans">
                <strong>Narración:</strong> "{currentScene.texto_narracion}"
              </p>
              <p className="text-xs text-slate-400 italic">
                <strong>Prompt Imagen:</strong> {currentScene.prompt_imagen}
              </p>
            </div>
          )}
        </>
      ) : (
        /* Full Script Accordion Breakdown */
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Guion Estructurado Completo ({scenes.length} escenas)</span>
            <button
              onClick={handleDownloadScriptJson}
              className="text-[#8b5cf6] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar JSON completo</span>
            </button>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {scenes.map((scene, idx) => (
              <div
                key={idx}
                className="bg-[#050508] border border-white/5 hover:border-[#8b5cf6]/50 rounded-lg p-4 transition-all flex flex-col md:flex-row gap-4 items-start"
              >
                {scene.imageUrl && (
                  <div className="w-full md:w-48 aspect-video rounded overflow-hidden flex-shrink-0 border border-white/10 relative group">
                    <img
                      src={scene.imageUrl}
                      alt={`Escena ${scene.numero}`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-1 left-1 bg-black/80 px-2 py-0.5 rounded text-[10px] text-white font-mono">
                      #{scene.numero}
                    </div>
                  </div>
                )}

                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#8b5cf6]">
                      ESCENA #{scene.numero}
                    </span>
                    <button
                      onClick={() => {
                        setCurrentSceneIndex(idx);
                        setActiveTab('player');
                      }}
                      className="text-[11px] text-[#22c55e] hover:underline cursor-pointer"
                    >
                      Ver en Reproductor &rarr;
                    </button>
                  </div>

                  <p className="text-sm text-white leading-relaxed">
                    <strong>Narración:</strong> {scene.texto_narracion}
                  </p>

                  <p className="text-xs text-amber-300">
                    <strong>Subtítulo en pantalla:</strong> "{scene.texto_subtitulo}"
                  </p>

                  <p className="text-[11px] text-slate-400 font-mono">
                    <strong>Prompt Imagen (Inglés):</strong> {scene.prompt_imagen}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
