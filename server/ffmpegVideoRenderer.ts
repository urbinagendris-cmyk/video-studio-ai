import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { GoogleGenAI, Modality } from '@google/genai';
import ffmpegPath from 'ffmpeg-static';

// @ts-ignore - ffprobe-static no trae declaraciones de tipos propias
import ffprobeStatic from 'ffprobe-static';

const ffprobePath = ffprobeStatic.path;
const execAsync = promisify(exec);

/*
============================================================
VIDEO STUDIO AI
FFMPEG VIDEO RENDERER
============================================================

RESPONSABILIDADES:

1. Recibir proyecto generado por el pipeline.
2. Preparar imágenes.
3. Generar / preparar audio TTS.
4. Medir duración REAL del audio.
5. Crear video individual por escena.
6. Concatenar todas las escenas.
7. Agregar música ambiental.
8. Generar subtítulos sincronizados.
9. Crear video final.
10. Mantener estado del Job para App.tsx.

============================================================
*/

export interface RenderJob {
  id: string;

  status:
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed';

  progress: number;

  message: string;

  videoPath?: string;

  error?: string;

  createdAt: number;
}

const jobs = new Map<string, RenderJob>();

/*
============================================================
ALMACENAMIENTO PERSISTENTE DE VIDEOS FINALES
============================================================

IMPORTANTE:

El Map "jobs" vive únicamente en memoria del proceso.

Si el servidor se reinicia (cierre de terminal, reinicio
de la máquina, redeploy, etc.), ese Map nace vacío de
nuevo, aunque en Neon sigamos teniendo proyectos con
status "completed" y una downloadUrl apuntando a un
jobId que ya no existe en memoria.

Para que esos proyectos viejos (Historial) sigan
pudiendo reproducirse/descargarse aunque el servidor
se haya reiniciado, copiamos el MP4 final a una carpeta
persistente del proyecto (fuera de os.tmpdir()) usando
el jobId como nombre de archivo. Así, aunque el Map esté
vacío, el archivo se puede seguir localizando en disco.

============================================================
*/

const RENDERED_VIDEOS_DIR = path.join(
  process.cwd(),
  'rendered-videos'
);

fs.mkdirSync(
  RENDERED_VIDEOS_DIR,
  {
    recursive: true,
  }
);

export function getPersistentVideoPath(
  jobId: string
): string {
  return path.join(
    RENDERED_VIDEOS_DIR,
    `${jobId}.mp4`
  );
}

/*
============================================================
GEMINI
============================================================
*/

const getGenAI = () => {
  const apiKey =
    process.env.GEMINI_API_KEY || '';

  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY no está configurada.'
    );
  }

  return new GoogleGenAI({
    apiKey,

    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

/*
============================================================
INICIAR JOB
============================================================
*/

export function startExportJob(
  project: any,
  subtitlesEnabled: boolean = true,
  voice: string = 'Kore'
): string {
  const jobId =
    `job_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 7)}`;

  const job: RenderJob = {
    id: jobId,

    status: 'pending',

    progress: 0,

    message:
      'Iniciando servidor de ensamblado FFmpeg...',

    createdAt: Date.now(),
  };

  jobs.set(
    jobId,
    job
  );

  processExportJob(
    jobId,
    project,
    subtitlesEnabled,
    voice
  ).catch((err) => {
    console.error(
      `Render job ${jobId} failed:`,
      err
    );

    const existing =
      jobs.get(jobId);

    if (existing) {
      existing.status =
        'failed';

      existing.error =
        err?.message ||
        'Error desconocido durante el ensamblado del video.';

      existing.message =
        'Error en el procesamiento con FFmpeg.';
    }
  });

  return jobId;
}

/*
============================================================
OBTENER ESTADO
============================================================
*/

export function getExportJobStatus(
  jobId: string
): RenderJob | undefined {
  return jobs.get(jobId);
}

/*
============================================================
LIMPIAR JOB
============================================================
*/

export function cleanupJob(
  jobId: string
): void {
  const job =
    jobs.get(jobId);

  /*
  Borramos únicamente el archivo persistente de este job
  (no todo el directorio, ya que RENDERED_VIDEOS_DIR es
  compartido por todos los proyectos).
  */

  if (
    job?.videoPath &&
    fs.existsSync(job.videoPath)
  ) {
    try {
      fs.unlinkSync(
        job.videoPath
      );
    } catch (e) {
      console.warn(
        'Failed to cleanup persistent video file:',
        e
      );
    }
  }

  /*
  También borramos la carpeta temporal de trabajo de
  este job, si todavía existe.
  */

  const tmpDir =
    path.join(
      os.tmpdir(),
      `ffmpeg-render-${jobId}`
    );

  if (
    fs.existsSync(tmpDir)
  ) {
    try {
      fs.rmSync(
        tmpDir,
        {
          recursive: true,
          force: true,
        }
      );
    } catch (e) {
      console.warn(
        'Failed to cleanup temp dir:',
        e
      );
    }
  }

  jobs.delete(
    jobId
  );
}

/*
============================================================
PROCESAMIENTO PRINCIPAL
============================================================
*/

async function processExportJob(
  jobId: string,
  project: any,
  subtitlesEnabled: boolean,
  voice: string
) {
  const job =
    jobs.get(jobId);

  if (!job) {
    return;
  }

  if (!ffmpegPath) {
    throw new Error(
      'FFmpeg no está disponible en el sistema.'
    );
  }

  if (!ffprobePath) {
    throw new Error(
      'FFprobe no está disponible en el sistema.'
    );
  }

  job.status =
    'processing';

  job.progress =
    5;

  job.message =
    'Creando directorio de renderizado...';

  /*
  ==========================================================
  DIRECTORIO TEMPORAL
  ==========================================================
  */

  const tmpDir =
    path.join(
      os.tmpdir(),
      `ffmpeg-render-${jobId}`
    );

  fs.mkdirSync(
    tmpDir,
    {
      recursive: true,
    }
  );

  console.log(
    `[FFmpeg Job ${jobId}] Temp directory: ${tmpDir}`
  );

  /*
  ==========================================================
  ESCENAS
  ==========================================================
  */

  const escenas =
    project?.script?.escenas || [];

  if (
    !Array.isArray(escenas) ||
    escenas.length === 0
  ) {
    throw new Error(
      'El proyecto no contiene escenas válidas.'
    );
  }

  const totalScenes =
    escenas.length;

  const sceneFiles: string[] = [];

  const sceneDurations: number[] = [];

  console.log(
    `[FFmpeg Job ${jobId}] Rendering ${totalScenes} scenes...`
  );

  /*
  ==========================================================
  STEP 1
  PROCESAR ESCENAS
  ==========================================================
  */

  for (
    let i = 0;
    i < totalScenes;
    i++
  ) {
    const scene =
      escenas[i];

    const sceneIndex =
      i + 1;

    job.message =
      `Procesando escena ${sceneIndex} de ${totalScenes}...`;

    job.progress =
      5 +
      Math.round(
        (i / totalScenes) * 65
      );

    /*
    ========================================================
    RUTAS
    ========================================================
    */

    const imagePath =
      path.join(
        tmpDir,
        `scene_${sceneIndex}.png`
      );

    const audioPath =
      path.join(
        tmpDir,
        `scene_${sceneIndex}_audio.mp3`
      );

    const rawAudioPath =
      path.join(
        tmpDir,
        `scene_${sceneIndex}_raw_audio`
      );

    const videoClipPath =
      path.join(
        tmpDir,
        `scene_${sceneIndex}.mp4`
      );

    /*
    ========================================================
    1A
    IMAGEN
    ========================================================
    */

    if (
      scene.imageUrl &&
      scene.imageUrl.startsWith(
        'data:image/'
      )
    ) {
      const base64Data =
        scene.imageUrl.split(',')[1];

      if (!base64Data) {
        throw new Error(
          `La imagen de la escena ${sceneIndex} contiene datos inválidos.`
        );
      }

      fs.writeFileSync(
        imagePath,
        Buffer.from(
          base64Data,
          'base64'
        )
      );
    } else if (
      scene.imageUrl &&
      (
        scene.imageUrl.startsWith(
          'http://'
        ) ||
        scene.imageUrl.startsWith(
          'https://'
        )
      )
    ) {
      try {
        const response =
          await fetch(
            scene.imageUrl
          );

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status} al descargar imagen`
          );
        }

        const arrayBuffer =
          await response.arrayBuffer();

        fs.writeFileSync(
          imagePath,
          Buffer.from(
            arrayBuffer
          )
        );
      } catch (err) {
        console.warn(
          `Failed to fetch image for scene ${sceneIndex}:`,
          err
        );

        await createFallbackImage(
          imagePath
        );
      }
    } else {
      await createFallbackImage(
        imagePath
      );
    }

    if (
      !fs.existsSync(imagePath)
    ) {
      throw new Error(
        `No se pudo crear la imagen de la escena ${sceneIndex}.`
      );
    }

    const imageStats =
      fs.statSync(
        imagePath
      );

    if (
      imageStats.size === 0
    ) {
      throw new Error(
        `La imagen de la escena ${sceneIndex} está vacía.`
      );
    }

    /*
    ========================================================
    1B
    AUDIO
    ========================================================
    */

    let audioReady =
      false;

    /*
    --------------------------------------------------------
    AUDIO BASE64 YA GENERADO
    --------------------------------------------------------
    */

    if (
      scene.audioUrl &&
      scene.audioUrl.startsWith(
        'data:audio/'
      )
    ) {
      try {
        const base64Audio =
          scene.audioUrl.split(',')[1];

        if (!base64Audio) {
          throw new Error(
            'Audio base64 vacío.'
          );
        }

        fs.writeFileSync(
          rawAudioPath,
          Buffer.from(
            base64Audio,
            'base64'
          )
        );

        await convertAudioToMp3(
          rawAudioPath,
          audioPath
        );

        audioReady =
          isValidFile(
            audioPath
          );
      } catch (e) {
        console.warn(
          `Failed decoding base64 audio for scene ${sceneIndex}:`,
          e
        );
      }
    }

    /*
    --------------------------------------------------------
    GEMINI TTS
    --------------------------------------------------------
    */

    if (
      !audioReady &&
      scene.texto_narracion
    ) {
      try {
        const ai =
          getGenAI();

        const ttsRes =
          await ai.models.generateContent({
            model:
              'gemini-3.1-flash-tts-preview',

            contents: [
              {
                parts: [
                  {
                    text:
                      `En español latino, narra con tono profesional: ${scene.texto_narracion}`,
                  },
                ],
              },
            ],

            config: {
              responseModalities: [
                Modality.AUDIO,
              ],

              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName:
                      voice,
                  },
                },
              },
            },
          });

        const audioPart =
          ttsRes.candidates?.[0]
            ?.content?.parts?.find(
              (part: any) =>
                part.inlineData?.data
            );

        const audioBase64 =
          audioPart?.inlineData?.data;

        const mimeType =
          audioPart?.inlineData?.mimeType ||
          '';

        if (
          audioBase64
        ) {
          fs.writeFileSync(
            rawAudioPath,
            Buffer.from(
              audioBase64,
              'base64'
            )
          );

          /*
          CORREGIDO:

          Gemini TTS puede devolver audio PCM
          en lugar de un MP3 normal.

          Ahora intentamos detectar el formato
          y convertirlo correctamente.
          */

          await convertGeminiAudioToMp3(
            rawAudioPath,
            audioPath,
            mimeType
          );

          audioReady =
            isValidFile(
              audioPath
            );
        }
      } catch (ttsErr) {
        console.warn(
          `Gemini TTS error for scene ${sceneIndex}:`,
          ttsErr
        );
      }
    }

    /*
    --------------------------------------------------------
    AUDIO DE RESPALDO

    Antes generaba un tono audible (sine 220Hz) cuando
    fallaba el TTS. Ahora generamos silencio en su lugar,
    para que una falla puntual de Gemini (ej. 503 por alta
    demanda) no se escuche como un pitido molesto en medio
    del video.
    --------------------------------------------------------
    */

    if (!audioReady) {
      const wordsCount =
        (
          scene.texto_narracion ||
          ''
        )
          .split(/\s+/)
          .filter(Boolean)
          .length;

      const estimatedSecs =
        Math.max(
          4,
          Math.ceil(
            wordsCount / 2.5
          )
        );

      await execAsync(
        `"${ffmpegPath}" -y -f lavfi -i "anullsrc=r=44100:cl=stereo:d=${estimatedSecs}" -c:a libmp3lame -b:a 192k "${audioPath}"`
      );

      audioReady =
        isValidFile(
          audioPath
        );
    }

    if (
      !audioReady
    ) {
      throw new Error(
        `No se pudo crear el audio de la escena ${sceneIndex}.`
      );
    }

    /*
    ========================================================
    1C
    DURACIÓN REAL DEL AUDIO
    ========================================================
    */

    let durationSec =
      6.0;

    try {
      const {
        stdout,
      } = await execAsync(
        `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`
      );

      const parsed =
        parseFloat(
          stdout.trim()
        );

      if (
        !isNaN(parsed) &&
        parsed > 0.5
      ) {
        durationSec =
          parsed;
      }
    } catch (ffErr) {
      console.warn(
        `ffprobe duration warning for scene ${sceneIndex}:`,
        ffErr
      );
    }

    sceneDurations.push(
      durationSec
    );

    scene.durationSeconds =
      durationSec;

    console.log(
      `[FFmpeg Job ${jobId}] Scene ${sceneIndex} audio duration: ${durationSec.toFixed(2)}s`
    );

    /*
    ========================================================
    1D
    VIDEO DE ESCENA
    ========================================================

    CORRECCIÓN DE TEMBLOR:

    zoompan recorta a posiciones de píxel entero en
    cada frame. Si la imagen fuente está en la misma
    resolución que la salida (1280x720), el punto de
    recorte cambia por fracciones de píxel entre frame
    y frame, y ese redondeo genera el efecto de "temblor".

    Solución: escalar la imagen a una resolución mucho
    mayor (supersampling) ANTES de zoompan, para que el
    recorte tenga precisión de subpíxel disponible.

    TRANSICIONES VARIADAS (Ken Burns):

    En vez de aplicar siempre el mismo zoom-in a todas
    las escenas, alternamos zoom-in y zoom-out según el
    número de escena (contrapunto visual). Sin paneo.

    ========================================================
    */

    const frames =
      Math.max(
        25,
        Math.ceil(
          durationSec * 25
        )
      );

    const zoomFilter =
      buildKenBurnsFilter(
        i,
        frames,
        scene.prompt_imagen ||
          ''
      );

    /*
    ========================================================
    CREAR VIDEO DE ESCENA
    ========================================================
    */

    const ffmpegClipCmd =
      `"${ffmpegPath}" -y -loop 1 -framerate 25 -i "${imagePath}" -i "${audioPath}" -filter_complex "[0:v]${zoomFilter}[v]" -map "[v]" -map 1:a:0 -c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p -r 25 -c:a aac -ar 48000 -ac 2 -b:a 192k -shortest -movflags +faststart "${videoClipPath}"`;

    console.log(
      `[FFmpeg Job ${jobId}] Rendering scene ${sceneIndex}...`
    );

    await execAsync(
      ffmpegClipCmd
    );

    /*
    ========================================================
    VERIFICACIÓN DEL MP4
    ========================================================
    */

    if (
      !fs.existsSync(
        videoClipPath
      )
    ) {
      throw new Error(
        `FFmpeg no creó el archivo de video de la escena ${sceneIndex}.`
      );
    }

    const clipStats =
      fs.statSync(
        videoClipPath
      );

    if (
      clipStats.size === 0
    ) {
      throw new Error(
        `El video de la escena ${sceneIndex} fue creado pero está vacío.`
      );
    }

    const absoluteClipPath =
      path.resolve(
        videoClipPath
      );

    sceneFiles.push(
      absoluteClipPath
    );

    console.log(
      `[FFmpeg Job ${jobId}] Scene ${sceneIndex} completed: ${absoluteClipPath}`
    );
  }

  /*
  ==========================================================
  STEP 2
  CONCATENAR ESCENAS
  ==========================================================
  */

  job.message =
    'Ensamblando y concatenando escenas...';

  job.progress =
    75;

  const concatListPath =
    path.join(
      tmpDir,
      'concat_list.txt'
    );

  const concatContent =
    sceneFiles
      .map(
        (file) => {
          const filename =
            path.basename(
              file
            );

          const safeFilename =
            filename.replace(
              /'/g,
              `'\\''`
            );

          return `file '${safeFilename}'`;
        }
      )
      .join('\n');

  fs.writeFileSync(
    concatListPath,
    concatContent,
    'utf8'
  );

  console.log(
    `[FFmpeg Job ${jobId}] concat_list.txt:`
  );

  console.log(
    concatContent
  );

  /*
  ==========================================================
  VERIFICAR ARCHIVOS
  ==========================================================
  */

  for (
    let i = 0;
    i < sceneFiles.length;
    i++
  ) {
    const sceneFile =
      sceneFiles[i];

    if (
      !fs.existsSync(
        sceneFile
      )
    ) {
      throw new Error(
        `El archivo de escena ${i + 1} no existe antes de la concatenación: ${sceneFile}`
      );
    }

    const stats =
      fs.statSync(
        sceneFile
      );

    if (
      stats.size === 0
    ) {
      throw new Error(
        `El archivo de escena ${i + 1} está vacío: ${sceneFile}`
      );
    }
  }

  /*
  ==========================================================
  VIDEO CONCATENADO
  ==========================================================
  */

  const concatVideoPath =
    path.join(
      tmpDir,
      'scenes_concatenated.mp4'
    );

  await execAsync(
    `"${ffmpegPath}" -y -f concat -safe 0 -i "concat_list.txt" -c copy -movflags +faststart "scenes_concatenated.mp4"`,
    {
      cwd: tmpDir,
    }
  );

  /*
  ==========================================================
  VERIFICAR CONCATENACIÓN
  ==========================================================
  */

  if (
    !fs.existsSync(
      concatVideoPath
    )
  ) {
    throw new Error(
      'FFmpeg no pudo generar el video concatenado.'
    );
  }

  const concatStats =
    fs.statSync(
      concatVideoPath
    );

  if (
    concatStats.size === 0
  ) {
    throw new Error(
      'FFmpeg generó el video concatenado, pero el archivo está vacío.'
    );
  }

  console.log(
    `[FFmpeg Job ${jobId}] Concatenación completada: ${concatVideoPath}`
  );

  /*
  ==========================================================
  STEP 3
  MÚSICA DE FONDO
  ==========================================================
  */

  job.message =
    'Generando música de fondo...';

  job.progress =
    82;

  const totalDurationSec =
    sceneDurations.reduce(
      (
        a,
        b
      ) =>
        a + b,
      0
    );

  const ambientMusicPath =
    path.join(
      tmpDir,
      'bg_ambient.mp3'
    );

  /*
  ==========================================================
  MÚSICA AMBIENTAL
  ==========================================================

  Esto es una pista ambiental sintética.

  Posteriormente podemos reemplazarla por:

  - música generada por IA
  - archivo MP3 del usuario
  - música generada con Lyria
  - música seleccionada de una biblioteca

  ==========================================================
  */

  await createAmbientMusic(
    ambientMusicPath,
    totalDurationSec
  );

  if (
    !isValidFile(
      ambientMusicPath
    )
  ) {
    throw new Error(
      'No se pudo generar la música de fondo.'
    );
  }

  console.log(
    `[FFmpeg Job ${jobId}] Background music generated.`
  );

  /*
  ==========================================================
  STEP 3B
  MEZCLAR NARRACIÓN + MÚSICA
  ==========================================================

  CORRECCIÓN:

  La narración queda en volumen 1.0.

  La música queda aproximadamente en 0.10.

  La música se repite automáticamente si hace falta.

  ==========================================================
  */

  job.message =
    'Mezclando narración y música de fondo...';

  job.progress =
    86;

  const videoWithMusicPath =
    path.join(
      tmpDir,
      'video_with_music.mp4'
    );

  const musicMixCommand =
    `"${ffmpegPath}" -y -i "${concatVideoPath}" -stream_loop -1 -i "${ambientMusicPath}" -filter_complex "[0:a]aresample=48000,volume=1.0[narration];[1:a]aresample=48000,volume=0.10[music];[narration][music]amix=inputs=2:duration=first:dropout_transition=3:normalize=0[aout]" -map 0:v:0 -map "[aout]" -c:v copy -c:a aac -ar 48000 -ac 2 -b:a 192k -shortest -movflags +faststart "${videoWithMusicPath}"`;

  console.log(
    `[FFmpeg Job ${jobId}] Mixing narration and background music...`
  );

  await execAsync(
    musicMixCommand
  );

  if (
    !fs.existsSync(
      videoWithMusicPath
    )
  ) {
    throw new Error(
      'No se pudo generar el video con música de fondo.'
    );
  }

  const musicVideoStats =
    fs.statSync(
      videoWithMusicPath
    );

  if (
    musicVideoStats.size === 0
  ) {
    throw new Error(
      'El video con música fue creado pero está vacío.'
    );
  }

  /*
  ==========================================================
  STEP 4
  SUBTÍTULOS
  ==========================================================
  */

  let finalVideoPath =
    videoWithMusicPath;

  if (
    subtitlesEnabled
  ) {
    job.message =
      'Quemando subtítulos sincronizados...';

    job.progress =
      92;

    const srtPath =
      path.join(
        tmpDir,
        'subtitles.srt'
      );

    let currentTimeMs =
      0;

    const srtEntries: string[] =
      [];

    escenas.forEach(
      (
        sc: any,
        idx: number
      ) => {
        const durMs =
          Math.round(
            (
              sceneDurations[
                idx
              ] || 6
            ) *
              1000
          );

        const startTime =
          formatSrtTime(
            currentTimeMs
          );

        const endTime =
          formatSrtTime(
            currentTimeMs +
              durMs
          );

        currentTimeMs +=
          durMs;

        const subText =
          sc.texto_subtitulo ||
          sc.texto_narracion ||
          `Escena ${idx + 1}`;

        srtEntries.push(
          `${idx + 1}\n${startTime} --> ${endTime}\n${subText}\n`
        );
      }
    );

    fs.writeFileSync(
      srtPath,
      srtEntries.join('\n'),
      'utf8'
    );

    const burnedVideoPath =
      path.join(
        tmpDir,
        'final_burned.mp4'
      );

    try {
      const subtitleFilterPath =
        escapeSubtitlePath(
          srtPath
        );

      const subtitleFilter =
        `subtitles='${subtitleFilterPath}':force_style='FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,BorderStyle=4,MarginV=30,Bold=1'`;

      /*
      IMPORTANTE:

      El audio NO se vuelve a codificar.

      Se conserva exactamente el audio
      que ya contiene narración + música.
      */

      await execAsync(
        `"${ffmpegPath}" -y -i "${videoWithMusicPath}" -vf "${subtitleFilter}" -c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p -r 25 -c:a copy -movflags +faststart "${burnedVideoPath}"`
      );

      if (
        fs.existsSync(
          burnedVideoPath
        )
      ) {
        const burnedStats =
          fs.statSync(
            burnedVideoPath
          );

        if (
          burnedStats.size > 0
        ) {
          finalVideoPath =
            burnedVideoPath;
        }
      }
    } catch (subErr) {
      console.warn(
        'Subtitle burning fallback:',
        subErr
      );
    }
  }

  /*
  ==========================================================
  STEP 5
  VALIDACIÓN FINAL
  ==========================================================
  */

  if (
    !fs.existsSync(
      finalVideoPath
    )
  ) {
    throw new Error(
      'El video final no existe después del procesamiento.'
    );
  }

  const finalStats =
    fs.statSync(
      finalVideoPath
    );

  if (
    finalStats.size === 0
  ) {
    throw new Error(
      'El video final fue creado pero está vacío.'
    );
  }

  /*
  ==========================================================
  VERIFICAR DURACIÓN FINAL
  ==========================================================
  */

  try {
    const {
      stdout,
    } = await execAsync(
      `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${finalVideoPath}"`
    );

    const finalDuration =
      parseFloat(
        stdout.trim()
      );

    console.log(
      `[FFmpeg Job ${jobId}] Final video duration: ${finalDuration.toFixed(2)}s`
    );
  } catch (durationError) {
    console.warn(
      'No se pudo verificar duración final:',
      durationError
    );
  }

  /*
  ==========================================================
  VERIFICAR STREAMS FINALES
  ==========================================================
  */

  try {
    const {
      stdout,
    } = await execAsync(
      `"${ffprobePath}" -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels -of default=noprint_wrappers=1 "${finalVideoPath}"`
    );

    console.log(
      `[FFmpeg Job ${jobId}] Final audio stream:`
    );

    console.log(
      stdout
    );
  } catch (audioCheckError) {
    console.warn(
      'No se pudo verificar el audio final:',
      audioCheckError
    );
  }

  /*
  ==========================================================
  COPIAR VIDEO FINAL A ALMACENAMIENTO PERSISTENTE
  ==========================================================

  El archivo en tmpDir puede desaparecer o quedar
  inaccesible si el servidor se reinicia. Copiamos el
  resultado final a RENDERED_VIDEOS_DIR usando el jobId,
  para que /api/download-video pueda encontrarlo incluso
  si el Map "jobs" ya no tiene este job en memoria.

  ==========================================================
  */

  const persistentVideoPath =
    getPersistentVideoPath(jobId);

  fs.copyFileSync(
    finalVideoPath,
    persistentVideoPath
  );

  console.log(
    `[FFmpeg Job ${jobId}] Copia persistente guardada en: ${persistentVideoPath}`
  );

  /*
  ==========================================================
  JOB COMPLETADO
  ==========================================================
  */

  job.progress =
    100;

  job.status =
    'completed';

  job.message =
    '¡Video ensamblado y listo para descargar!';

  job.videoPath =
    persistentVideoPath;

  console.log(
    `[FFmpeg Job ${jobId}] COMPLETED: ${persistentVideoPath}`
  );
}

/*
============================================================
CONVERTIR AUDIO NORMAL A MP3
============================================================

Sirve para:

- MP3
- WAV
- OGG
- M4A
- otros formatos reconocidos por FFmpeg

============================================================
*/

async function convertAudioToMp3(
  inputPath: string,
  outputPath: string
): Promise<void> {
  if (!ffmpegPath) {
    throw new Error(
      'FFmpeg no está disponible.'
    );
  }

  await execAsync(
    `"${ffmpegPath}" -y -i "${inputPath}" -vn -ar 44100 -ac 2 -c:a libmp3lame -b:a 192k "${outputPath}"`
  );
}

/*
============================================================
CONVERTIR AUDIO DE GEMINI TTS
============================================================

Gemini TTS puede devolver audio PCM.

Si es PCM:

- s16le
- 24000 Hz
- mono

Lo convertimos correctamente a MP3.

Si FFmpeg puede reconocer directamente
el archivo, también lo intentamos.

============================================================
*/

async function convertGeminiAudioToMp3(
  inputPath: string,
  outputPath: string,
  mimeType: string
): Promise<void> {
  if (!ffmpegPath) {
    throw new Error(
      'FFmpeg no está disponible.'
    );
  }

  const normalizedMime =
    (
      mimeType ||
      ''
    ).toLowerCase();

  /*
  ----------------------------------------------------------
  PCM RAW
  ----------------------------------------------------------
  */

  if (
    normalizedMime.includes(
      'audio/l16'
    ) ||
    normalizedMime.includes(
      'audio/pcm'
    ) ||
    normalizedMime.includes(
      'audio/raw'
    )
  ) {
    try {
      await execAsync(
        `"${ffmpegPath}" -y -f s16le -ar 24000 -ac 1 -i "${inputPath}" -ar 44100 -ac 2 -c:a libmp3lame -b:a 192k "${outputPath}"`
      );

      if (
        isValidFile(
          outputPath
        )
      ) {
        return;
      }
    } catch (pcmError) {
      console.warn(
        'PCM Gemini audio conversion failed:',
        pcmError
      );
    }
  }

  /*
  ----------------------------------------------------------
  WAV / MP3 / OTROS FORMATOS
  ----------------------------------------------------------
  */

  try {
    await convertAudioToMp3(
      inputPath,
      outputPath
    );

    if (
      isValidFile(
        outputPath
      )
    ) {
      return;
    }
  } catch (normalError) {
    console.warn(
      'Normal Gemini audio conversion failed:',
      normalError
    );
  }

  /*
  ----------------------------------------------------------
  ÚLTIMO INTENTO
  ----------------------------------------------------------

  Algunos modelos devuelven PCM aunque el MIME
  no sea exactamente audio/L16.

  ----------------------------------------------------------
  */

  await execAsync(
    `"${ffmpegPath}" -y -f s16le -ar 24000 -ac 1 -i "${inputPath}" -ar 44100 -ac 2 -c:a libmp3lame -b:a 192k "${outputPath}"`
  );
}

/*
============================================================
CREAR MÚSICA AMBIENTAL
============================================================

IMPORTANTE:

Esta función crea música ambiental sintética.

No es una canción generativa de IA.

Está diseñada como respaldo para que el video
siempre tenga una pista de fondo.

============================================================
*/

async function createAmbientMusic(
  outputPath: string,
  durationSec: number
): Promise<void> {
  if (!ffmpegPath) {
    throw new Error(
      'FFmpeg no está disponible.'
    );
  }

  const safeDuration =
    Math.max(
      1,
      Math.ceil(
        durationSec + 5
      )
    );

  /*
  Música ambiental estéreo.

  Se utilizan varias frecuencias suaves.

  Volumen bajo para no competir con la narración.
  */

  const musicExpression =
    `'0.035*sin(2*PI*174.61*t)+0.025*sin(2*PI*220*t)+0.020*sin(2*PI*261.63*t)+0.015*sin(2*PI*329.63*t)|0.035*sin(2*PI*174.61*t)+0.025*sin(2*PI*220*t)+0.020*sin(2*PI*261.63*t)+0.015*sin(2*PI*329.63*t)'`;

  await execAsync(
    `"${ffmpegPath}" -y -f lavfi -i "aevalsrc=${musicExpression}:s=44100:d=${safeDuration}" -ar 44100 -ac 2 -c:a libmp3lame -b:a 192k "${outputPath}"`
  );
}

/*
============================================================
ANALIZAR PROMPT DE LA ESCENA
============================================================

Revisa el prompt_imagen (en inglés) generado por Gemini
para detectar un punto de interés lateral/vertical
("left", "right", "top", "bottom") y así desviar el
centro del zoom hacia ahí, en vez de usar siempre el
centro matemático de la imagen.

Es una heurística por palabras clave sobre el texto del
prompt, no un análisis visual real de la imagen.

============================================================
*/

interface ScenePromptAnalysis {
  offsetX: number;
  offsetY: number;
}

function analyzeScenePrompt(
  promptImagen: string
): ScenePromptAnalysis {
  const text =
    (promptImagen || '')
      .toLowerCase();

  let offsetX = 0;

  let offsetY = 0;

  const OFFSET_AMOUNT =
    0.15;

  if (
    /\bright\b/.test(text)
  ) {
    offsetX =
      OFFSET_AMOUNT;
  } else if (
    /\bleft\b/.test(text)
  ) {
    offsetX =
      -OFFSET_AMOUNT;
  }

  if (
    /\btop\b|\bupper\b/.test(
      text
    )
  ) {
    offsetY =
      -OFFSET_AMOUNT;
  } else if (
    /\bbottom\b|\blower\b/.test(
      text
    )
  ) {
    offsetY =
      OFFSET_AMOUNT;
  }

  return {
    offsetX,
    offsetY,
  };
}

/*
============================================================
FILTRO KEN BURNS (CONTRAPUNTO VISUAL + ZOOM DESCENTRADO)
============================================================

REGLAS APLICADAS:

1. Contrapunto visual: se alterna estrictamente zoom-in y
   zoom-out según la paridad del índice de la escena (par
   = in, impar = out), para que el ojo nunca vea el mismo
   movimiento dos veces seguidas.

2. Zoom descentrado: si el prompt de la escena menciona un
   punto de interés lateral o vertical ("right", "left",
   "top", "bottom"), el foco del zoom se desvía hacia ese
   cuadrante en vez de quedarse en el centro matemático.

   El desvío se aplica de forma GRADUAL (no de golpe),
   porque al zoom=1.0 no existe margen de imagen disponible
   para desviarse sin salirse del cuadro. En zoom-in el
   desvío crece de 0 hasta el máximo; en zoom-out ocurre al
   revés (empieza en el máximo, porque ahí el zoom ya está
   acercado, y termina en 0 al llegar a zoom=1.0).

   Si no se detecta ningún punto de interés, offsetX/offsetY
   quedan en 0 y la fórmula se reduce exactamente al zoom
   centrado de siempre.

3. Sin paneo: se eliminó por completo (incluso para tomas
   abiertas). Todas las escenas usan únicamente zoom
   in/out — nunca desplazamiento lateral o vertical.

Incluye un "scale" a 4K antes del zoompan (supersampling)
para eliminar el temblor de recorte por redondeo de
píxeles que ocurre cuando la imagen fuente ya está en la
misma resolución que la salida.

============================================================
*/

function buildKenBurnsFilter(
  sceneIndex: number,
  frames: number,
  promptImagen: string
): string {
  const SUPERSAMPLE =
    'scale=3840:2160:flags=lanczos';

  const {
    offsetX,
    offsetY,
  } =
    analyzeScenePrompt(
      promptImagen
    );

  let zoompanExpr: string;

  /*
  ==========================================================
  ZOOM IN / ZOOM OUT ALTERNADO (CONTRAPUNTO VISUAL)
  ==========================================================

  Se quitó el paneo por completo (incluso en tomas
  abiertas): todas las escenas usan zoom in/out.

  VELOCIDAD DEL ZOOM:

  Antes el incremento por frame era fijo (0.0009), así
  que en escenas largas el zoom llegaba a su tope
  (1.12) rápido y luego se quedaba "quieto" el resto de
  la escena (mucho tiempo de inactividad visual, malo
  para redes sociales).

  Ahora el incremento se calcula para que el recorrido
  completo del zoom dure ~70% de la duración de la
  escena (ej. 3.5s de una escena de 5s), sin importar
  cuánto dure la escena, para que siempre haya
  movimiento notorio y solo un margen pequeño de "reposo"
  al final.
  ==========================================================
  */

  const MIN_ZOOM = 1.0;

  const MAX_ZOOM = 1.12;

  const ZOOM_ACTIVE_FRACTION = 0.7;

  const effectiveZoomFrames =
    Math.max(
      1,
      Math.round(
        frames *
          ZOOM_ACTIVE_FRACTION
      )
    );

  const zoomIncrement =
    (MAX_ZOOM - MIN_ZOOM) /
    effectiveZoomFrames;

  const isZoomIn =
    sceneIndex % 2 === 0;

  if (isZoomIn) {
    /*
    ZOOM IN

    El desvío hacia el punto de interés crece
    de 0 a su valor máximo junto con el zoom, y se
    queda fijo en el máximo una vez que el zoom ya
    llegó a su tope (min(...,1) evita que el desvío
    se siga moviendo después de eso).
    */

    zoompanExpr =
      `zoompan=z='min(zoom+${zoomIncrement},${MAX_ZOOM})':x='(0.5+(${offsetX})*(min(on/${effectiveZoomFrames},1)))*iw-(iw/zoom/2)':y='(0.5+(${offsetY})*(min(on/${effectiveZoomFrames},1)))*ih-(ih/zoom/2)':d=${frames}:s=1280x720:fps=25`;
  } else {
    /*
    ZOOM OUT

    Empieza en 1.12 y baja hasta 1.0 en el mismo
    tiempo (effectiveZoomFrames).

    El desvío empieza en su valor máximo y decrece
    a 0 junto con el zoom (max(...,0) evita valores
    negativos una vez que ya llegó a 0).
    */

    zoompanExpr =
      `zoompan=z='if(eq(on,1),${MAX_ZOOM},max(zoom-${zoomIncrement},${MIN_ZOOM}))':x='(0.5+(${offsetX})*(max(1-(on/${effectiveZoomFrames}),0)))*iw-(iw/zoom/2)':y='(0.5+(${offsetY})*(max(1-(on/${effectiveZoomFrames}),0)))*ih-(ih/zoom/2)':d=${frames}:s=1280x720:fps=25`;
  }

  return `${SUPERSAMPLE},${zoompanExpr},format=yuv420p`;
}

/*
============================================================
VALIDAR ARCHIVO
============================================================
*/

function isValidFile(
  filePath: string
): boolean {
  try {
    if (
      !fs.existsSync(
        filePath
      )
    ) {
      return false;
    }

    const stats =
      fs.statSync(
        filePath
      );

    return (
      stats.size > 0
    );
  } catch {
    return false;
  }
}

/*
============================================================
IMAGEN DE RESPALDO
============================================================
*/

async function createFallbackImage(
  imagePath: string
): Promise<void> {
  if (!ffmpegPath) {
    throw new Error(
      'FFmpeg no está disponible para crear imagen de respaldo.'
    );
  }

  await execAsync(
    `"${ffmpegPath}" -y -f lavfi -i "color=c=12121e:s=1280x720:d=1" -frames:v 1 "${imagePath}"`
  );
}

/*
============================================================
ESCAPAR RUTA PARA FILTRO SUBTITLES
============================================================
*/

function escapeSubtitlePath(
  filePath: string
): string {
  return filePath
    .replace(
      /\\/g,
      '/'
    )
    .replace(
      /:/g,
      '\\:'
    )
    .replace(
      /'/g,
      "\\'"
    );
}

/*
============================================================
FORMATO SRT
============================================================
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
    ms % 1000;

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

/*
============================================================
PAD
============================================================
*/

function pad( 
  num: number,
  size: number
): string {
  let s =
    num + '';

  while (
    s.length < size
  ) {
    s =
      '0' + s;
  }

  return s;
}