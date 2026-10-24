import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';

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
  Sparkles,
  Layers,
  Film,
  ExternalLink,
} from 'lucide-react';

/*
============================================================
TIPO EXTENDIDO
============================================================

VideoProject original no necesariamente contiene
los campos del render.

Aquí agregamos los campos necesarios para el MP4.
============================================================
*/

type RenderedVideoProject =
  VideoProject & {
    videoUrl?: string;
    downloadUrl?: string;
    renderJobId?: string;
  };

interface VideoStudioPlayerProps {
  project: RenderedVideoProject;

  onUpdateProject?: (
    updated: VideoProject
  ) => void;

  onReGenerateSceneImage?: (
    sceneIndex: number
  ) => Promise<void>;
}

export const VideoStudioPlayer: React.FC<
  VideoStudioPlayerProps
> = ({
  project,
  onUpdateProject,
}) => {
  /*
   * ============================================================
   * ESCENAS
   * ============================================================
   */

  const scenes: Scene[] =
    Array.isArray(
      project?.script?.escenas
    )
      ? project.script.escenas
      : [];

  /*
   * ============================================================
   * VIDEO FINAL
   * ============================================================
   */

  const finalVideoUrl =
    project?.videoUrl ||
    project?.downloadUrl ||
    '';

  const hasRenderedVideo =
    Boolean(
      finalVideoUrl &&
      project?.status ===
        'completed'
    );

  /*
   * ============================================================
   * ESTADOS
   * ============================================================
   */

  const [
    currentSceneIndex,
    setCurrentSceneIndex,
  ] = useState(0);

  const [
    isPlaying,
    setIsPlaying,
  ] = useState(false);

  const [
    isMuted,
    setIsMuted,
  ] = useState(false);

  const [
    kenBurnsEnabled,
    setKenBurnsEnabled,
  ] = useState(true);

  const [
    showSubtitles,
    setShowSubtitles,
  ] = useState(
    Boolean(
      project.subtitlesEnabled
    )
  );

  const [
    isExportingVideo,
    setIsExportingVideo,
  ] = useState(false);

  const [
    exportProgress,
    setExportProgress,
  ] = useState(0);

  const [
    exportStatusMessage,
    setExportStatusMessage,
  ] = useState('');

  const [
    activeTab,
    setActiveTab,
  ] = useState<
    'player' | 'script'
  >('player');

  /*
   * ============================================================
   * REFS
   * ============================================================
   */

  const canvasRef =
    useRef<HTMLCanvasElement | null>(
      null
    );

  const videoRef =
    useRef<HTMLVideoElement | null>(
      null
    );

  const animationFrameRef =
    useRef<number | null>(
      null
    );

  const sceneStartTimeRef =
    useRef<number>(
      Date.now()
    );

  const currentImageRef =
    useRef<HTMLImageElement | null>(
      null
    );

  const loadedImagesMap =
    useRef<
      Map<
        number,
        HTMLImageElement
      >
    >(new Map());

  const loadingImagesMap =
    useRef<
      Map<
        number,
        HTMLImageElement
      >
    >(new Map());

  const mountedRef =
    useRef(true);

  const exportPollRef =
    useRef<number | null>(
      null
    );

  /*
   * ============================================================
   * ESCENA ACTUAL
   * ============================================================
   */

  const currentScene:
    | Scene
    | undefined =
    scenes[
      currentSceneIndex
    ];

  /*
   * ============================================================
   * DURACIÓN DE ESCENA
   * ============================================================
   */

  const getSceneDurationSeconds =
    useCallback(
      (
        scene?: Scene
      ): number => {
        const duration =
          Number(
            scene?.durationSeconds
          );

        if (
          Number.isFinite(
            duration
          ) &&
          duration > 0
        ) {
          return duration;
        }

        return 9;
      },
      []
    );

  const currentSceneDurationMs =
    getSceneDurationSeconds(
      currentScene
    ) * 1000;

  /*
   * ============================================================
   * MONTADO / DESMONTADO
   * ============================================================
   */

  useEffect(() => {
    mountedRef.current =
      true;

    return () => {
      mountedRef.current =
        false;

      if (
        animationFrameRef.current !==
        null
      ) {
        cancelAnimationFrame(
          animationFrameRef.current
        );

        animationFrameRef.current =
          null;
      }

      if (
        exportPollRef.current !==
        null
      ) {
        window.clearInterval(
          exportPollRef.current
        );

        exportPollRef.current =
          null;
      }

      if (
        'speechSynthesis' in
        window
      ) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  /*
   * ============================================================
   * CARGADOR DE IMÁGENES
   * ============================================================
   */

  const loadSceneImage =
    useCallback(
      (
        sceneIndex: number,
        scene: Scene
      ): Promise<
        HTMLImageElement | null
      > => {
        return new Promise(
          (resolve) => {
            const cached =
              loadedImagesMap.current.get(
                sceneIndex
              );

            if (
              cached &&
              cached.complete &&
              cached.naturalWidth > 0
            ) {
              resolve(cached);
              return;
            }

            if (
              !scene?.imageUrl
            ) {
              resolve(null);
              return;
            }

            const loading =
              loadingImagesMap.current.get(
                sceneIndex
              );

            if (loading) {
              const checkLoaded =
                () => {
                  const result =
                    loadedImagesMap.current.get(
                      sceneIndex
                    );

                  if (
                    result &&
                    result.complete &&
                    result.naturalWidth > 0
                  ) {
                    resolve(
                      result
                    );

                    return;
                  }

                  window.setTimeout(
                    checkLoaded,
                    50
                  );
                };

              checkLoaded();

              return;
            }

            const img =
              new Image();

            if (
              !scene.imageUrl.startsWith(
                'data:image/'
              )
            ) {
              img.crossOrigin =
                'anonymous';
            }

            loadingImagesMap.current.set(
              sceneIndex,
              img
            );

            img.onload =
              () => {
                loadingImagesMap.current.delete(
                  sceneIndex
                );

                loadedImagesMap.current.set(
                  sceneIndex,
                  img
                );

                resolve(img);
              };

            img.onerror =
              () => {
                loadingImagesMap.current.delete(
                  sceneIndex
                );

                console.warn(
                  `[VideoStudioPlayer] No se pudo cargar la imagen de la escena ${
                    sceneIndex + 1
                  }`
                );

                resolve(null);
              };

            img.src =
              scene.imageUrl;
          }
        );
      },
      []
    );

  /*
   * ============================================================
   * PRECARGAR IMÁGENES
   * ============================================================
   */

  useEffect(() => {
    let cancelled =
      false;

    const preloadImages =
      async () => {
        for (
          let index = 0;
          index < scenes.length;
          index++
        ) {
          if (
            cancelled
          ) {
            return;
          }

          const scene =
            scenes[index];

          if (
            !scene?.imageUrl
          ) {
            continue;
          }

          await loadSceneImage(
            index,
            scene
          );
        }
      };

    preloadImages();

    return () => {
      cancelled =
        true;
    };
  }, [
    scenes,
    loadSceneImage,
  ]);

  /*
   * ============================================================
   * CARGAR ESCENA ACTUAL
   * ============================================================
   */

  useEffect(() => {
    let cancelled =
      false;

    sceneStartTimeRef.current =
      Date.now();

    currentImageRef.current =
      null;

    if (!currentScene) {
      return;
    }

    const cached =
      loadedImagesMap.current.get(
        currentSceneIndex
      );

    if (
      cached &&
      cached.complete &&
      cached.naturalWidth > 0
    ) {
      currentImageRef.current =
        cached;

      return;
    }

    loadSceneImage(
      currentSceneIndex,
      currentScene
    ).then(
      (img) => {
        if (
          cancelled ||
          !mountedRef.current
        ) {
          return;
        }

        currentImageRef.current =
          img;

        sceneStartTimeRef.current =
          Date.now();
      }
    );

    return () => {
      cancelled =
        true;
    };
  }, [
    currentSceneIndex,
    currentScene,
    loadSceneImage,
  ]);

  /*
   * ============================================================
   * SPEECH SYNTHESIS PARA PREVIEW
   * ============================================================
   */

  useEffect(() => {
    /*
    Si ya existe video real,
    no usamos SpeechSynthesis.
    */

    if (
      hasRenderedVideo
    ) {
      return;
    }

    if (
      !isPlaying ||
      !currentScene?.texto_narracion ||
      isMuted ||
      !(
        'speechSynthesis' in
        window
      )
    ) {
      if (
        'speechSynthesis' in
        window
      ) {
        window.speechSynthesis.cancel();
      }

      return;
    }

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(
        currentScene.texto_narracion
      );

    utterance.lang =
      'es-MX';

    utterance.rate =
      1.0;

    utterance.pitch =
      0.95;

    window.speechSynthesis.speak(
      utterance
    );

    return () => {
      if (
        'speechSynthesis' in
        window
      ) {
        window.speechSynthesis.cancel();
      }
    };
  }, [
    isPlaying,
    currentSceneIndex,
    currentScene,
    isMuted,
    hasRenderedVideo,
  ]);

  /*
   * ============================================================
   * FALLBACK CANVAS
   * ============================================================
   */

  const drawFallback =
    useCallback(
      (
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        sceneNumber: number
      ) => {
        const gradient =
          ctx.createLinearGradient(
            0,
            0,
            width,
            height
          );

        gradient.addColorStop(
          0,
          '#1a102f'
        );

        gradient.addColorStop(
          1,
          '#0b1329'
        );

        ctx.fillStyle =
          gradient;

        ctx.fillRect(
          0,
          0,
          width,
          height
        );

        ctx.fillStyle =
          '#8b5cf6';

        ctx.font =
          'bold 26px sans-serif';

        ctx.textAlign =
          'center';

        ctx.textBaseline =
          'middle';

        ctx.fillText(
          `Preparando escena ${sceneNumber}`,
          width / 2,
          height / 2
        );
      },
      []
    );

  /*
   * ============================================================
   * DIBUJAR IMAGEN
   * ============================================================
   */

  const drawImageCover =
    useCallback(
      (
        ctx: CanvasRenderingContext2D,
        img: HTMLImageElement,
        width: number,
        height: number,
        scale: number,
        offsetX: number,
        offsetY: number
      ) => {
        if (
          !img ||
          !img.complete ||
          img.naturalWidth <= 0 ||
          img.naturalHeight <= 0
        ) {
          return false;
        }

        const imgRatio =
          img.naturalWidth /
          img.naturalHeight;

        const canvasRatio =
          width / height;

        let drawWidth =
          width;

        let drawHeight =
          height;

        if (
          imgRatio >
          canvasRatio
        ) {
          drawWidth =
            height *
            imgRatio;
        } else {
          drawHeight =
            width /
            imgRatio;
        }

        ctx.save();

        ctx.translate(
          width / 2 +
            offsetX,
          height / 2 +
            offsetY
        );

        ctx.scale(
          scale,
          scale
        );

        ctx.drawImage(
          img,
          -drawWidth / 2,
          -drawHeight / 2,
          drawWidth,
          drawHeight
        );

        ctx.restore();

        return true;
      },
      []
    );

  /*
   * ============================================================
   * RENDER CANVAS
   *
   * SOLAMENTE PARA PREVISUALIZACIÓN.
   *
   * Si existe MP4 real, el Canvas no se utiliza.
   * ============================================================
   */

  useEffect(() => {
    if (
      hasRenderedVideo
    ) {
      return;
    }

    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }

    const ctx =
      canvas.getContext(
        '2d'
      );

    if (!ctx) {
      return;
    }

    let active =
      true;

    canvas.width =
      1280;

    canvas.height =
      720;

    const renderFrame =
      () => {
        if (!active) {
          return;
        }

        const width =
          canvas.width;

        const height =
          canvas.height;

        ctx.clearRect(
          0,
          0,
          width,
          height
        );

        ctx.fillStyle =
          '#0a0a0f';

        ctx.fillRect(
          0,
          0,
          width,
          height
        );

        const img =
          currentImageRef.current;

        if (
          img &&
          img.complete &&
          img.naturalWidth > 0 &&
          img.naturalHeight > 0
        ) {
          const elapsed =
            Math.max(
              0,
              Date.now() -
                sceneStartTimeRef.current
            );

          const progress =
            Math.min(
              1,
              elapsed /
                Math.max(
                  1,
                  currentSceneDurationMs
                )
            );

          let scale =
            1;

          let offsetX =
            0;

          let offsetY =
            0;

          if (
            kenBurnsEnabled
          ) {
            scale =
              1 +
              progress *
                0.12;

            const direction =
              currentSceneIndex %
                2 ===
              0
                ? 1
                : -1;

            offsetX =
              (progress *
                30 -
                15) *
              direction;

            offsetY =
              (progress *
                15 -
                7.5) *
              direction;
          }

          drawImageCover(
            ctx,
            img,
            width,
            height,
            scale,
            offsetX,
            offsetY
          );
        } else {
          drawFallback(
            ctx,
            width,
            height,
            currentSceneIndex +
              1
          );
        }

        /*
         * VIÑETA
         */

        const vignette =
          ctx.createRadialGradient(
            width / 2,
            height / 2,
            height * 0.3,
            width / 2,
            height / 2,
            width * 0.7
          );

        vignette.addColorStop(
          0,
          'rgba(0,0,0,0)'
        );

        vignette.addColorStop(
          1,
          'rgba(0,0,0,0.55)'
        );

        ctx.fillStyle =
          vignette;

        ctx.fillRect(
          0,
          0,
          width,
          height
        );

        /*
         * SUBTÍTULOS
         */

        if (
          showSubtitles &&
          currentScene?.texto_subtitulo
        ) {
          const text =
            currentScene.texto_subtitulo;

          ctx.save();

          const fontSize =
            Math.max(
              22,
              Math.floor(
                height *
                  0.042
              )
            );

          ctx.font =
            `bold ${fontSize}px sans-serif`;

          ctx.textAlign =
            'center';

          ctx.textBaseline =
            'middle';

          const maxTextWidth =
            width * 0.82;

          let displayText =
            text;

          if (
            ctx.measureText(
              displayText
            ).width >
            maxTextWidth
          ) {
            while (
              displayText.length >
                0 &&
              ctx.measureText(
                `${displayText}…`
              ).width >
                maxTextWidth
            ) {
              displayText =
                displayText.slice(
                  0,
                  -1
                );
            }

            displayText +=
              '…';
          }

          const textMetrics =
            ctx.measureText(
              displayText
            );

          const paddingX =
            24;

          const paddingY =
            12;

          const boxWidth =
            textMetrics.width +
            paddingX * 2;

          const boxHeight =
            fontSize +
            paddingY * 2;

          const boxX =
            width / 2 -
            boxWidth / 2;

          const boxY =
            height -
            boxHeight -
            40;

          ctx.fillStyle =
            'rgba(10,10,16,0.88)';

          ctx.strokeStyle =
            'rgba(139,92,246,0.6)';

          ctx.lineWidth =
            2;

          ctx.beginPath();

          if (
            typeof ctx.roundRect ===
            'function'
          ) {
            ctx.roundRect(
              boxX,
              boxY,
              boxWidth,
              boxHeight,
              10
            );
          } else {
            ctx.rect(
              boxX,
              boxY,
              boxWidth,
              boxHeight
            );
          }

          ctx.fill();

          ctx.stroke();

          ctx.fillStyle =
            '#facc15';

          ctx.shadowColor =
            'rgba(0,0,0,0.9)';

          ctx.shadowBlur =
            8;

          ctx.fillText(
            displayText,
            width / 2,
            boxY +
              boxHeight / 2
          );

          ctx.restore();
        }

        /*
         * CAMBIO AUTOMÁTICO DE ESCENA
         */

        if (
          isPlaying &&
          scenes.length > 0
        ) {
          const elapsed =
            Date.now() -
            sceneStartTimeRef.current;

          if (
            elapsed >=
            currentSceneDurationMs
          ) {
            if (
              currentSceneIndex <
              scenes.length - 1
            ) {
              setCurrentSceneIndex(
                (prev) =>
                  prev + 1
              );

              sceneStartTimeRef.current =
                Date.now();
            } else {
              setIsPlaying(
                false
              );

              setCurrentSceneIndex(
                0
              );

              sceneStartTimeRef.current =
                Date.now();
            }
          }
        }

        animationFrameRef.current =
          requestAnimationFrame(
            renderFrame
          );
      };

    renderFrame();

    return () => {
      active =
        false;

      if (
        animationFrameRef.current !==
        null
      ) {
        cancelAnimationFrame(
          animationFrameRef.current
        );

        animationFrameRef.current =
          null;
      }
    };
  }, [
    hasRenderedVideo,
    isPlaying,
    currentSceneIndex,
    currentSceneDurationMs,
    kenBurnsEnabled,
    showSubtitles,
    currentScene,
    scenes.length,
    drawFallback,
    drawImageCover,
  ]);

  /*
   * ============================================================
   * NAVEGACIÓN
   * ============================================================
   */

  const handleNextScene =
    () => {
      if (
        currentSceneIndex <
        scenes.length - 1
      ) {
        setCurrentSceneIndex(
          (prev) =>
            prev + 1
        );

        sceneStartTimeRef.current =
          Date.now();
      }
    };

  const handlePrevScene =
    () => {
      if (
        currentSceneIndex >
        0
      ) {
        setCurrentSceneIndex(
          (prev) =>
            prev - 1
        );

        sceneStartTimeRef.current =
          Date.now();
      }
    };

  const handleTogglePlay =
    () => {
      /*
      Si existe MP4 real,
      usamos el elemento VIDEO.
      */

      if (
        hasRenderedVideo &&
        videoRef.current
      ) {
        const video =
          videoRef.current;

        if (
          video.paused
        ) {
          video
            .play()
            .catch(
              (error) => {
                console.warn(
                  'No se pudo reproducir el video:',
                  error
                );
              }
            );
        } else {
          video.pause();
        }

        return;
      }

      /*
      Preview Canvas.
      */

      sceneStartTimeRef.current =
        Date.now();

      setIsPlaying(
        (prev) => !prev
      );
    };

  /*
   * ============================================================
   * EVENTOS DEL VIDEO REAL
   * ============================================================
   */

  const handleVideoPlay =
    () => {
      setIsPlaying(
        true
      );
    };

  const handleVideoPause =
    () => {
      setIsPlaying(
        false
      );
    };

  const handleVideoEnded =
    () => {
      setIsPlaying(
        false
      );
    };

  /*
   * ============================================================
   * DESCARGAR MP4 REAL
   * ============================================================
   */

  const handleDownloadFinalVideo =
    () => {
      if (
        !finalVideoUrl
      ) {
        alert(
          'El video final todavía no está disponible.'
        );

        return;
      }

      const anchor =
        document.createElement(
          'a'
        );

      anchor.href =
        finalVideoUrl;

      anchor.download =
        `${sanitizeFileName(
          project.topic
        )}_final_video.mp4`;

      anchor.target =
        '_blank';

      anchor.rel =
        'noopener noreferrer';

      document.body.appendChild(
        anchor
      );

      anchor.click();

      anchor.remove();
    };

  /*
   * ============================================================
   * DESCARGAR SRT
   * ============================================================
   */

  const handleDownloadSRT =
    () => {
      let srtContent =
        '';

      let currentTimeMs =
        0;

      scenes.forEach(
        (
          scene,
          index
        ) => {
          const durationMs =
            getSceneDurationSeconds(
              scene
            ) * 1000;

          const startTime =
            formatSrtTime(
              currentTimeMs
            );

          const endTime =
            formatSrtTime(
              currentTimeMs +
                durationMs
            );

          currentTimeMs +=
            durationMs;

          const text =
            scene.texto_subtitulo ||
            scene.texto_narracion ||
            `Escena ${
              index + 1
            }`;

          srtContent +=
            `${index + 1}\n`;

          srtContent +=
            `${startTime} --> ${endTime}\n`;

          srtContent +=
            `${text}\n\n`;
        }
      );

      const blob =
        new Blob(
          [srtContent],
          {
            type:
              'text/plain;charset=utf-8',
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );

      const anchor =
        document.createElement(
          'a'
        );

      anchor.href =
        url;

      anchor.download =
        `${sanitizeFileName(
          project.topic
        )}_subtitulos.srt`;

      document.body.appendChild(
        anchor
      );

      anchor.click();

      anchor.remove();

      window.setTimeout(
        () =>
          URL.revokeObjectURL(
            url
          ),
        1000
      );
    };

  /*
   * ============================================================
   * DESCARGAR JSON
   * ============================================================
   */

  const handleDownloadScriptJson =
    () => {
      const json =
        JSON.stringify(
          project.script,
          null,
          2
        );

      const blob =
        new Blob(
          [json],
          {
            type:
              'application/json;charset=utf-8',
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );

      const anchor =
        document.createElement(
          'a'
        );

      anchor.href =
        url;

      anchor.download =
        `${sanitizeFileName(
          project.topic
        )}_guion.json`;

      document.body.appendChild(
        anchor
      );

      anchor.click();

      anchor.remove();

      window.setTimeout(
        () =>
          URL.revokeObjectURL(
            url
          ),
        1000
      );
    };

  /*
   * ============================================================
   * EXPORTAR VIDEO
   *
   * SOLO se utiliza cuando todavía NO tenemos
   * un MP4 final.
   * ============================================================
   */

  const handleExportVideoFile =
    async () => {
      if (
        hasRenderedVideo
      ) {
        handleDownloadFinalVideo();
        return;
      }

      if (
        isExportingVideo
      ) {
        return;
      }

      if (
        scenes.length === 0
      ) {
        alert(
          'No existen escenas para exportar.'
        );

        return;
      }

      setIsExportingVideo(
        true
      );

      setExportProgress(
        0
      );

      setExportStatusMessage(
        'Iniciando solicitud de ensamblado FFmpeg en el servidor...'
      );

      setIsPlaying(
        false
      );

      try {
        const response =
          await fetch(
            '/api/export-video-ffmpeg',
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body: JSON.stringify({
                project,

                subtitlesEnabled:
                  showSubtitles,
              }),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success ||
          !data.jobId
        ) {
          throw new Error(
            data.error ||
              'Error al iniciar el trabajo de exportación en el servidor.'
          );
        }

        const jobId =
          data.jobId;

        if (
          exportPollRef.current !==
          null
        ) {
          window.clearInterval(
            exportPollRef.current
          );
        }

        exportPollRef.current =
          window.setInterval(
            async () => {
              try {
                const statusRes =
                  await fetch(
                    `/api/export-video-status/${encodeURIComponent(
                      jobId
                    )}`
                  );

                if (
                  !statusRes.ok
                ) {
                  return;
                }

                const statusData =
                  await statusRes.json();

                if (
                  !mountedRef.current
                ) {
                  return;
                }

                setExportProgress(
                  Number(
                    statusData.progress ||
                      0
                  )
                );

                if (
                  statusData.message
                ) {
                  setExportStatusMessage(
                    statusData.message
                  );
                }

                /*
                ==================================================
                COMPLETADO
                ==================================================
                */

                if (
                  statusData.status ===
                  'completed'
                ) {
                  if (
                    exportPollRef.current !==
                    null
                  ) {
                    window.clearInterval(
                      exportPollRef.current
                    );

                    exportPollRef.current =
                      null;
                  }

                  const generatedUrl =
                    statusData.videoUrl ||
                    statusData.downloadUrl ||
                    `/api/download-video/${encodeURIComponent(
                      jobId
                    )}`;

                  /*
                  Actualizamos el proyecto
                  inmediatamente.

                  Así el MP4 aparece en el
                  reproductor.
                  */

                  const updatedProject:
                    RenderedVideoProject =
                    {
                      ...project,

                      status:
                        'completed',

                      renderedProgress:
                        100,

                      videoUrl:
                        generatedUrl,

                      downloadUrl:
                        statusData.downloadUrl ||
                        generatedUrl,

                      renderJobId:
                        jobId,
                    };

                  setIsExportingVideo(
                    false
                  );

                  setExportProgress(
                    100
                  );

                  setExportStatusMessage(
                    '¡Video ensamblado y listo para reproducir!'
                  );

                  onUpdateProject?.(
                    updatedProject
                  );

                  return;
                }

                /*
                ==================================================
                ERROR
                ==================================================
                */

                if (
                  statusData.status ===
                  'failed'
                ) {
                  if (
                    exportPollRef.current !==
                    null
                  ) {
                    window.clearInterval(
                      exportPollRef.current
                    );

                    exportPollRef.current =
                      null;
                  }

                  setIsExportingVideo(
                    false
                  );

                  alert(
                    `Error durante la exportación con FFmpeg: ${
                      statusData.error ||
                      'Fallo en la renderización.'
                    }`
                  );
                }
              } catch (
                pollErr
              ) {
                console.warn(
                  'Error polling export status:',
                  pollErr
                );
              }
            },
            1500
          );
      } catch (
        err: any
      ) {
        console.error(
          'Error exporting video:',
          err
        );

        if (
          exportPollRef.current !==
          null
        ) {
          window.clearInterval(
            exportPollRef.current
          );

          exportPollRef.current =
            null;
        }

        setIsExportingVideo(
          false
        );

        alert(
          `Error al exportar el video: ${
            err?.message ||
            'Error desconocido'
          }`
        );
      }
    };

  /*
   * ============================================================
   * FORMATO SRT
   * ============================================================
   */

  function formatSrtTime(
    ms: number
  ): string {
    const totalSecs =
      Math.floor(
        ms / 1000
      );

    const hours =
      Math.floor(
        totalSecs / 3600
      );

    const mins =
      Math.floor(
        (totalSecs % 3600) /
          60
      );

    const secs =
      totalSecs % 60;

    const millis =
      Math.floor(
        ms % 1000
      );

    return `${pad(
      hours,
      2
    )}:${pad(
      mins,
      2
    )}:${pad(
      secs,
      2
    )},${pad(
      millis,
      3
    )}`;
  }

  function pad(
    num: number,
    size: number
  ): string {
    let value =
      String(num);

    while (
      value.length <
      size
    ) {
      value =
        '0' + value;
    }

    return value;
  }

  function sanitizeFileName(
    value: string
  ): string {
    return (
      String(value || '')
        .replace(
          /[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]/g,
          '_'
        )
        .substring(
          0,
          50
        ) ||
      'video_studio'
    );
  }

  /*
   * ============================================================
   * SIN ESCENAS
   * ============================================================
   */

  if (
    !scenes.length
  ) {
    return (
      <div className="bg-[#050508] border border-white/5 rounded-lg p-8 text-center">

        <FilmIconPlaceholder />

        <h3 className="text-white font-bold mt-3">
          No hay escenas disponibles
        </h3>

        <p className="text-sm text-slate-400 mt-2">
          Genera un guion antes de
          abrir el reproductor.
        </p>

      </div>
    );
  }

  /*
   * ============================================================
   * INTERFAZ
   * ============================================================
   */

  return (
    <div className="space-y-4">

      {/* HEADER */}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">

        <div>

          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400">

            <span>
              Tono: {project.tone}
            </span>

            <span>
              •
            </span>

            <span>
              Estilo:{' '}
              {project.visualStyle}
            </span>

          </div>

          <h2 className="text-lg md:text-xl font-bold text-white mt-1">
            {project.script.titulo ||
              project.topic}
          </h2>

          <p className="text-[11px] text-slate-500 mt-1">

            {scenes.length}{' '}
            escenas · duración
            configurada:{' '}
            {project.durationMin ||
              'personalizada'}{' '}
            min

          </p>

        </div>

        <div className="flex items-center gap-2 bg-[#050508] p-1 rounded-lg border border-white/5">

          <button
            onClick={() =>
              setActiveTab(
                'player'
              )
            }
            className={`px-3.5 py-1.5 text-xs font-bold rounded transition-all ${
              activeTab ===
              'player'
                ? 'bg-[#8b5cf6] text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Reproductor Video
          </button>

          <button
            onClick={() =>
              setActiveTab(
                'script'
              )
            }
            className={`px-3.5 py-1.5 text-xs font-bold rounded transition-all ${
              activeTab ===
              'script'
                ? 'bg-[#8b5cf6] text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Desglose de Guion (
            {scenes.length})
          </button>

        </div>
      </div>

      {activeTab ===
      'player' ? (
        <>

          {/* ==================================================
              VIDEO FINAL REAL
              ================================================== */}

          {hasRenderedVideo ? (
            <div className="space-y-3">

              <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-[#22c55e]/40 shadow-2xl">

                <video
                  ref={videoRef}
                  src={finalVideoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-contain bg-black"
                  onPlay={
                    handleVideoPlay
                  }
                  onPause={
                    handleVideoPause
                  }
                  onEnded={
                    handleVideoEnded
                  }
                  onError={() => {
                    console.error(
                      'No se pudo cargar el MP4:',
                      finalVideoUrl
                    );
                  }}
                />

                <div className="absolute top-4 left-4 pointer-events-none bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-md border border-[#22c55e]/40 text-white text-xs font-bold flex items-center gap-2">

                  <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />

                  <span>
                    VIDEO FINAL · MP4
                  </span>

                </div>

              </div>

              {/* INFORMACIÓN DEL VIDEO */}

              <div className="bg-[#050508] border border-[#22c55e]/20 rounded-lg p-4">

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">

                  <div>

                    <div className="flex items-center gap-2 text-[#22c55e] text-xs font-bold">

                      <Film className="w-4 h-4" />

                      <span>
                        VIDEO GENERADO CORRECTAMENTE
                      </span>

                    </div>

                    <p className="text-xs text-slate-400 mt-1">
                      El MP4 final fue generado por FFmpeg y está listo para reproducirse.
                    </p>

                  </div>

                  <div className="flex flex-wrap items-center gap-2">

                    <button
                      onClick={
                        handleDownloadFinalVideo
                      }
                      className="px-4 py-2 text-xs font-bold text-black bg-[#22c55e] hover:bg-[#22c55e]/90 rounded-lg flex items-center gap-2 shadow cursor-pointer"
                    >

                      <Download className="w-4 h-4" />

                      Descargar MP4

                    </button>

                    <a
                      href={
                        finalVideoUrl
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg flex items-center gap-2"
                    >

                      <ExternalLink className="w-3.5 h-3.5" />

                      Abrir video

                    </a>

                  </div>

                </div>

              </div>

            </div>
          ) : (

            /* ==================================================
               CANVAS PREVIEW
               ================================================== */

            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-white/10 shadow-2xl">

              <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                className="w-full h-full object-contain cursor-pointer"
                onClick={
                  handleTogglePlay
                }
              />

              <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-md border border-white/10 text-white text-xs font-bold flex items-center gap-2">

                <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />

                <span>
                  Previsualización · Escena{' '}
                  {currentSceneIndex +
                    1}{' '}
                  de{' '}
                  {scenes.length}
                </span>

              </div>

              <div className="absolute top-4 right-4 flex items-center gap-2">

                <button
                  onClick={() =>
                    setKenBurnsEnabled(
                      (prev) =>
                        !prev
                    )
                  }
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
                  onClick={() =>
                    setShowSubtitles(
                      (prev) =>
                        !prev
                    )
                  }
                  title="Subtítulos"
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
          )}

          {/* ==================================================
              CONTROLES
              ================================================== */}

          <div className="bg-[#050508] border border-white/5 rounded-lg p-4 space-y-3">

            {!hasRenderedVideo && (
              <div className="flex items-center gap-3">

                <span className="text-xs font-mono text-slate-400">
                  {currentSceneIndex +
                    1}{' '}
                  / {scenes.length}
                </span>

                <div className="flex-1 bg-white/5 h-2 rounded-full overflow-hidden cursor-pointer flex gap-0.5">

                  {scenes.map(
                    (
                      _,
                      index
                    ) => (
                      <div
                        key={index}
                        onClick={() => {
                          setCurrentSceneIndex(
                            index
                          );

                          sceneStartTimeRef.current =
                            Date.now();
                        }}
                        className={`h-full flex-1 transition-all ${
                          index ===
                          currentSceneIndex
                            ? 'bg-[#22c55e]'
                            : index <
                              currentSceneIndex
                            ? 'bg-[#8b5cf6]'
                            : 'bg-white/10 hover:bg-white/20'
                        }`}
                      />
                    )
                  )}

                </div>

                <span className="text-xs font-mono text-slate-400">
                  ~
                  {project.durationMin ||
                    '—'}{' '}
                  min
                </span>

              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">

              <div className="flex items-center gap-2">

                {!hasRenderedVideo && (
                  <>
                    <button
                      onClick={
                        handlePrevScene
                      }
                      disabled={
                        currentSceneIndex ===
                        0
                      }
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/5 disabled:opacity-30 cursor-pointer"
                    >
                      <SkipBack className="w-4 h-4" />
                    </button>

                    <button
                      onClick={
                        handleTogglePlay
                      }
                      className="px-4 py-2 rounded-lg bg-[#8b5cf6] hover:bg-[#8b5cf6]/90 text-white font-bold flex items-center gap-2 text-xs shadow cursor-pointer"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-4 h-4 fill-current" />

                          <span>
                            Pausar
                          </span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current" />

                          <span>
                            Reproducir Preview
                          </span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={
                        handleNextScene
                      }
                      disabled={
                        currentSceneIndex ===
                        scenes.length -
                          1
                      }
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/5 disabled:opacity-30 cursor-pointer"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </>
                )}

                {hasRenderedVideo && (
                  <button
                    onClick={
                      handleTogglePlay
                    }
                    className="px-4 py-2 rounded-lg bg-[#8b5cf6] hover:bg-[#8b5cf6]/90 text-white font-bold flex items-center gap-2 text-xs shadow cursor-pointer"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-4 h-4 fill-current" />
                        Pausar video
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        Reproducir video
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={() =>
                    setIsMuted(
                      (prev) =>
                        !prev
                    )
                  }
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 ml-2 cursor-pointer"
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4 text-red-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-[#22c55e]" />
                  )}
                </button>

              </div>

              {/* DESCARGAS */}

              <div className="flex flex-wrap items-center gap-2">

                <button
                  onClick={
                    handleDownloadSRT
                  }
                  className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-fuchsia-400" />

                  <span>
                    Subtítulos
                  </span>
                </button>

                <button
                  onClick={
                    handleDownloadScriptJson
                  }
                  className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-[#8b5cf6]" />

                  <span>
                    Guion JSON
                  </span>
                </button>

                <button
                  onClick={
                    handleExportVideoFile
                  }
                  disabled={
                    isExportingVideo
                  }
                  className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    hasRenderedVideo
                      ? 'text-black bg-[#22c55e] hover:bg-[#22c55e]/90'
                      : 'text-black bg-[#22c55e] hover:bg-[#22c55e]/90'
                  }`}
                >

                  <Download className="w-4 h-4" />

                  <span>
                    {isExportingVideo
                      ? `Exportando (${exportProgress}%)...`
                      : hasRenderedVideo
                      ? 'Descargar Video MP4'
                      : 'Generar Video MP4'}
                  </span>

                </button>

              </div>

            </div>
          </div>

          {/* ==================================================
              PROGRESO FFmpeg
              ================================================== */}

          {isExportingVideo && (
            <div className="bg-[#8b5cf6]/10 border border-[#8b5cf6]/40 rounded-lg p-4 space-y-3">

              <div className="flex items-center justify-between text-xs font-bold text-white">

                <div className="flex items-center gap-2">

                  <Sparkles className="w-4 h-4 text-[#8b5cf6] animate-spin" />

                  <span className="uppercase tracking-wider">
                    Ensamblado de Video FFmpeg
                  </span>

                </div>

                <span className="font-mono text-[#22c55e] text-sm">
                  {exportProgress}%
                </span>

              </div>

              <div className="w-full bg-[#050508] h-2.5 rounded-full overflow-hidden p-0.5 border border-white/10">

                <div
                  className="bg-gradient-to-r from-[#8b5cf6] via-fuchsia-500 to-[#22c55e] h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.max(
                      5,
                      exportProgress
                    )}%`,
                  }}
                />

              </div>

              <p className="text-xs text-slate-300 font-mono italic flex items-center gap-1.5">

                <span className="text-[#8b5cf6] font-bold">
                  &gt;
                </span>

                <span>
                  {exportStatusMessage ||
                    'Procesando video...'}
                </span>

              </p>

            </div>
          )}

          {/* ==================================================
              ESCENA ACTUAL
              ================================================== */}

          {currentScene && (
            <div className="bg-[#050508] border border-white/5 rounded-lg p-4 space-y-2">

              <div className="flex items-center justify-between text-xs text-[#8b5cf6] font-bold">

                <span>
                  ESCENA #
                  {
                    currentScene.numero
                  }
                </span>

                <span className="text-slate-400 font-normal text-[11px]">
                  Duración:{' '}
                  {getSceneDurationSeconds(
                    currentScene
                  ).toFixed(
                    1
                  )}
                  s
                </span>

              </div>

              <p className="text-sm text-slate-200 leading-relaxed">

                <strong>
                  Narración:
                </strong>{' '}

                "
                {
                  currentScene.texto_narracion
                }
                "

              </p>

              <p className="text-xs text-slate-400 italic">

                <strong>
                  Prompt Imagen:
                </strong>{' '}

                {
                  currentScene.prompt_imagen
                }

              </p>

            </div>
          )}

        </>
      ) : (

        /* ======================================================
           SCRIPT
           ====================================================== */

        <div className="space-y-3">

          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">

            <span>
              Guion Estructurado
              Completo (
              {scenes.length}{' '}
              escenas)
            </span>

            <button
              onClick={
                handleDownloadScriptJson
              }
              className="text-[#8b5cf6] hover:underline flex items-center gap-1 cursor-pointer"
            >

              <Download className="w-3.5 h-3.5" />

              <span>
                Exportar JSON completo
              </span>

            </button>

          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">

            {scenes.map(
              (
                scene,
                index
              ) => (
                <div
                  key={index}
                  className="bg-[#050508] border border-white/5 hover:border-[#8b5cf6]/50 rounded-lg p-4 transition-all flex flex-col md:flex-row gap-4 items-start"
                >

                  {scene.imageUrl && (
                    <div className="w-full md:w-48 aspect-video rounded overflow-hidden flex-shrink-0 border border-white/10 relative group">

                      <img
                        src={
                          scene.imageUrl
                        }
                        alt={`Escena ${
                          scene.numero
                        }`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />

                      <div className="absolute top-1 left-1 bg-black/80 px-2 py-0.5 rounded text-[10px] text-white font-mono">

                        #
                        {
                          scene.numero
                        }

                      </div>

                    </div>
                  )}

                  <div className="flex-1 space-y-1.5">

                    <div className="flex items-center justify-between">

                      <span className="text-xs font-bold text-[#8b5cf6]">
                        ESCENA #
                        {
                          scene.numero
                        }
                      </span>

                      <button
                        onClick={() => {
                          setCurrentSceneIndex(
                            index
                          );

                          setActiveTab(
                            'player'
                          );

                          sceneStartTimeRef.current =
                            Date.now();
                        }}
                        className="text-[11px] text-[#22c55e] hover:underline cursor-pointer"
                      >
                        Ver en Reproductor →
                      </button>

                    </div>

                    <p className="text-sm text-white leading-relaxed">

                      <strong>
                        Narración:
                      </strong>{' '}

                      {
                        scene.texto_narracion
                      }

                    </p>

                    <p className="text-xs text-amber-300">

                      <strong>
                        Subtítulo:
                      </strong>{' '}

                      "
                      {
                        scene.texto_subtitulo
                      }
                      "

                    </p>

                    <p className="text-[11px] text-slate-400 font-mono">

                      <strong>
                        Prompt Imagen:
                      </strong>{' '}

                      {
                        scene.prompt_imagen
                      }

                    </p>

                    <p className="text-[10px] text-slate-500">

                      Duración estimada:{' '}

                      {getSceneDurationSeconds(
                        scene
                      ).toFixed(
                        1
                      )}
                      s

                    </p>

                  </div>

                </div>
              )
            )}

          </div>

        </div>
      )}

    </div>
  );
};

/*
============================================================
PLACEHOLDER
============================================================
*/

function FilmIconPlaceholder() {
  return (
    <div className="mx-auto w-12 h-12 rounded-xl bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 flex items-center justify-center">

      <Film className="w-6 h-6 text-[#8b5cf6]" />

    </div>
  );
}