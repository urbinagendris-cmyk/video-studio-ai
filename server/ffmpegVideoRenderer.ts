import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { GoogleGenAI, Modality } from '@google/genai';
import ffmpegPath from 'ffmpeg-static';
// @ts-ignore - ffprobe-static no trae declaraciones de tipos propias
import ffprobeStatic from 'ffprobe-static';
const ffprobePath = ffprobeStatic.path;
const execAsync = promisify(exec);

export interface RenderJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  videoPath?: string;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, RenderJob>();

const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

export function startExportJob(project: any, subtitlesEnabled: boolean = true, voice: string = 'Kore'): string {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const job: RenderJob = {
    id: jobId,
    status: 'pending',
    progress: 0,
    message: 'Iniciando servidor de ensamblado FFmpeg...',
    createdAt: Date.now(),
  };

  jobs.set(jobId, job);

  // Trigger background asynchronous processing
  processExportJob(jobId, project, subtitlesEnabled, voice).catch((err) => {
    console.error(`Render job ${jobId} failed:`, err);
    const existing = jobs.get(jobId);
    if (existing) {
      existing.status = 'failed';
      existing.error = err.message || 'Error desconocido durante el ensamblado del video.';
      existing.message = 'Error en el procesamiento con FFmpeg.';
    }
  });

  return jobId;
}

export function getExportJobStatus(jobId: string): RenderJob | undefined {
  return jobs.get(jobId);
}

export function cleanupJob(jobId: string): void {
  const job = jobs.get(jobId);
  if (job?.videoPath && fs.existsSync(job.videoPath)) {
    try {
      const dir = path.dirname(job.videoPath);
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (e) {
      console.warn('Failed to cleanup temp dir:', e);
    }
  }
  jobs.delete(jobId);
}

async function processExportJob(jobId: string, project: any, subtitlesEnabled: boolean, voice: string) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = 'processing';
  job.progress = 5;
  job.message = 'Creando directorio de renderizado...';

  const tmpDir = path.join('/tmp', `ffmpeg-render-${jobId}`);
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const escenas = project?.script?.escenas || [];
  if (escenas.length === 0) {
    throw new Error('El proyecto no contiene escenas válidas.');
  }

  const totalScenes = escenas.length;
  const sceneFiles: string[] = [];
  const sceneDurations: number[] = [];

  console.log(`[FFmpeg Job ${jobId}] Rendering ${totalScenes} scenes...`);

  // Step 1: Process each scene (Image + Audio -> Ken Burns MP4 clip)
  for (let i = 0; i < totalScenes; i++) {
    const scene = escenas[i];
    const sceneIndex = i + 1;

    job.message = `Procesando escena ${sceneIndex} de ${totalScenes}...`;
    job.progress = 5 + Math.round((i / totalScenes) * 65);

    const imagePath = path.join(tmpDir, `scene_${sceneIndex}.png`);
    const audioPath = path.join(tmpDir, `scene_${sceneIndex}_audio.mp3`);
    const rawAudioPath = path.join(tmpDir, `scene_${sceneIndex}_raw_audio`);
    const videoClipPath = path.join(tmpDir, `scene_${sceneIndex}.mp4`);

    // 1A. Prepare Image
    if (scene.imageUrl && scene.imageUrl.startsWith('data:image/')) {
      const base64Data = scene.imageUrl.split(',')[1];
      fs.writeFileSync(imagePath, Buffer.from(base64Data, 'base64'));
    } else if (scene.imageUrl && (scene.imageUrl.startsWith('http://') || scene.imageUrl.startsWith('https://'))) {
      try {
        const res = await fetch(scene.imageUrl);
        const arrayBuffer = await res.arrayBuffer();
        fs.writeFileSync(imagePath, Buffer.from(arrayBuffer));
      } catch (err) {
        console.warn(`Failed to fetch image for scene ${sceneIndex}:`, err);
        // Fallback color image with FFmpeg
        await execAsync(`"${ffmpegPath}" -y -f lavfi -i color=c=12121e:s=1280x720:d=1 -vframes 1 "${imagePath}"`);
      }
    } else {
      // Create fallback stylized canvas
      await execAsync(`"${ffmpegPath}" -y -f lavfi -i color=c=12121e:s=1280x720:d=1 -vframes 1 "${imagePath}"`);
    }

    // 1B. Prepare Audio (Narrative TTS)
    let audioReady = false;

    if (scene.audioUrl && scene.audioUrl.startsWith('data:audio/')) {
      try {
        const base64Audio = scene.audioUrl.split(',')[1];
        fs.writeFileSync(rawAudioPath, Buffer.from(base64Audio, 'base64'));
        await execAsync(`"${ffmpegPath}" -y -i "${rawAudioPath}" -c:a mp3 "${audioPath}"`);
        audioReady = true;
      } catch (e) {
        console.warn(`Failed decoding base64 audio for scene ${sceneIndex}:`, e);
      }
    }

    if (!audioReady && scene.texto_narracion) {
      // Try generating Gemini TTS
      try {
        const ai = getGenAI();
        const ttsRes = await ai.models.generateContent({
          model: 'gemini-3.1-flash-tts-preview',
          contents: [{ parts: [{ text: `En español latino, narra con tono profesional: ${scene.texto_narracion}` }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
              },
            },
          },
        });

        const audioBase64 = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (audioBase64) {
          fs.writeFileSync(rawAudioPath, Buffer.from(audioBase64, 'base64'));
          await execAsync(`"${ffmpegPath}" -y -i "${rawAudioPath}" -c:a mp3 "${audioPath}"`);
          audioReady = true;
        }
      } catch (ttsErr) {
        console.warn(`Gemini TTS error for scene ${sceneIndex}:`, ttsErr);
      }
    }

    // Fallback audio if TTS was not available
    if (!audioReady) {
      const wordsCount = (scene.texto_narracion || '').split(/\s+/).filter(Boolean).length;
      const estimatedSecs = Math.max(4, Math.ceil(wordsCount / 2.5));
      await execAsync(`"${ffmpegPath}" -y -f lavfi -i "sine=f=220:d=${estimatedSecs}" -c:a mp3 "${audioPath}"`);
    }

    // 1C. Measure Audio Duration via ffprobe
    let durationSec = 6.0;
    try {
      const { stdout } = await execAsync(`"${ffprobePath}" -v error -show_entries format=duration -of default=noprintwrappers=1:nokey=1 "${audioPath}"`);
      const parsed = parseFloat(stdout.trim());
      if (!isNaN(parsed) && parsed > 0.5) {
        durationSec = parsed;
      }
    } catch (ffErr) {
      console.warn(`ffprobe duration warning for scene ${sceneIndex}:`, ffErr);
    }

    sceneDurations.push(durationSec);

    // 1D. Render Ken Burns ZoomPan Clip for Scene
    const frames = Math.max(25, Math.round(durationSec * 25));
    const isEven = sceneIndex % 2 === 0;

    // Smooth Ken Burns zoom effect
    const zoomFilter = isEven
      ? `zoompan=z='min(zoom+0.0015,1.18)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1280x720,format=yuv420p`
      : `zoompan=z='min(zoom+0.0015,1.20)':x='iw/2-(iw/zoom/2)+sin(in/10)*15':y='ih/2-(ih/zoom/2)':d=${frames}:s=1280x720,format=yuv420p`;

    const ffmpegClipCmd = `"${ffmpegPath}" -y -loop 1 -i "${imagePath}" -i "${audioPath}" -filter_complex "[0:v]${zoomFilter}[v]" -map "[v]" -map 1:a -c:v libx264 -preset ultrafast -crf 22 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "${videoClipPath}"`;

    await execAsync(ffmpegClipCmd);
    sceneFiles.push(videoClipPath);
  }

  // Step 2: Concatenate All Scenes
  job.message = 'Ensamblando y concatenando escenas...';
  job.progress = 75;

  const concatListPath = path.join(tmpDir, 'concat_list.txt');
  const concatContent = sceneFiles.map((f) => `file '${f}'`).join('\n');
  fs.writeFileSync(concatListPath, concatContent);

  const concatVideoPath = path.join(tmpDir, 'scenes_concatenated.mp4');
  await execAsync(`"${ffmpegPath}" -y -f concat -safe 0 -i "${concatListPath}" -c copy "${concatVideoPath}"`);

  // Step 3: Add Background Music
  job.message = 'Mezclando narraciones y música de fondo...';
  job.progress = 85;

  const totalDurationSec = sceneDurations.reduce((a, b) => a + b, 0);
  const ambientMusicPath = path.join(tmpDir, 'bg_ambient.mp3');

  // Generate a soothing background ambient chord synth matching full video duration
  await execAsync(
    `"${ffmpegPath}" -y -f lavfi -i "aevalsrc='0.03*sin(2*PI*174.61*t)+0.03*sin(2*PI*220*t)+0.03*sin(2*PI*261.63*t)+0.02*sin(2*PI*329.63*t)|0.03*sin(2*PI*174.61*t)+0.03*sin(2*PI*220*t)+0.03*sin(2*PI*261.63*t)+0.02*sin(2*PI*329.63*t)':s=44100:d=${Math.ceil(totalDurationSec + 10)}" -c:a mp3 "${ambientMusicPath}"`
  );

  const videoWithMusicPath = path.join(tmpDir, 'video_with_music.mp4');
  await execAsync(
    `"${ffmpegPath}" -i "${concatVideoPath}" -stream_loop -1 -i "${ambientMusicPath}" -filter_complex "[0:a]volume=1.0[a1];[1:a]volume=0.12[a2];[a1][a2]amix=inputs=2:duration=first:dropout_transition=2[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k "${videoWithMusicPath}"`
  );

  // Step 4: Burn Subtitles (SRT) if enabled
  let finalVideoPath = videoWithMusicPath;

  if (subtitlesEnabled) {
    job.message = 'Quemando subtítulos sincronizados...';
    job.progress = 92;

    const srtPath = path.join(tmpDir, 'subtitles.srt');
    let currentTimeMs = 0;
    const srtEntries: string[] = [];

    escenas.forEach((sc: any, idx: number) => {
      const durMs = Math.round((sceneDurations[idx] || 6) * 1000);
      const startTime = formatSrtTime(currentTimeMs);
      const endTime = formatSrtTime(currentTimeMs + durMs);
      currentTimeMs += durMs;

      const subText = sc.texto_subtitulo || sc.texto_narracion || `Escena ${idx + 1}`;
      srtEntries.push(`${idx + 1}\n${startTime} --> ${endTime}\n${subText}\n`);
    });

    fs.writeFileSync(srtPath, srtEntries.join('\n'));

    const burnedVideoPath = path.join(tmpDir, 'final_burned.mp4');
    try {
      await execAsync(
        `"${ffmpegPath}" -y -i "${videoWithMusicPath}" -vf "subtitles=${srtPath}:force_style='FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,BorderStyle=4,MarginV=30,Bold=1'" -c:v libx264 -preset ultrafast -crf 22 -c:a copy "${burnedVideoPath}"`
      );
      finalVideoPath = burnedVideoPath;
    } catch (subErr) {
      console.warn('Subtitle burning fallback:', subErr);
    }
  }

  job.progress = 100;
  job.status = 'completed';
  job.message = '¡Video ensamblado y listo para descargar!';
  job.videoPath = finalVideoPath;
}

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