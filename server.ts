import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import compression from "compression";
import sharp from "sharp";

import {
  startExportJob,
  getExportJobStatus,
  cleanupJob,
  getPersistentVideoPath,
} from "./server/ffmpegVideoRenderer";

dotenv.config();

/*
============================================================
VIDEO STUDIO AI
SERVER.TS
============================================================
*/

const app = express();

// Habilitar compresión para reducir el ancho de banda de las respuestas
app.use(compression());

const PORT = Number(process.env.PORT) || 3000;

app.use(
  express.json({
    limit: "100mb",
  })
);

/*
============================================================
NEON DATABASE (Configuración con Pool y WebSocket)
============================================================
*/

// Configurar WebSocket para que Neon funcione de forma estable en Node.js
neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL || "";

let pool: Pool | null = null;

if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    max: 5, // Límite bajo para el plan gratuito
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 15000,
    keepAlive: true,
  });
  console.log("NEON DATABASE: Pool configurado");
} else {
  console.warn("NEON DATABASE: DATABASE_URL NO ENCONTRADA");
}

/*
============================================================
INICIALIZAR TABLA DE PROYECTOS
============================================================
*/

async function initializeDatabase() {
  if (!pool) {
    console.warn(
      "Neon no está configurado. La persistencia estará desactivada."
    );
    return;
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS video_studio_projects (
        id TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        topic TEXT NOT NULL,
        duration_min DOUBLE PRECISION,
        tone TEXT,
        visual_style TEXT,
        subtitles_enabled BOOLEAN DEFAULT TRUE,
        status TEXT,
        thumbnail_url TEXT,
        total_scenes INTEGER DEFAULT 0,
        rendered_progress INTEGER DEFAULT 0,
        video_url TEXT,
        download_url TEXT,
        render_job_id TEXT,
        project_data JSONB NOT NULL
      )
    `);

    console.log("NEON DATABASE: tabla video_studio_projects lista.");
  } catch (error) {
    console.error("NEON DATABASE: error inicializando tabla:", error);
  }
}

/*
============================================================
GOOGLE GENAI
============================================================
*/

const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY || "";

  console.log("API KEY:", apiKey ? "ENCONTRADA" : "NO ENCONTRADA");

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

/*
============================================================
SYSTEM PROMPT DEL GUION
============================================================
*/

const SCRIPT_SYSTEM_PROMPT = `
[ROL Y OBJETIVO]
Actúa como un Guionista y Director Creativo especializado
en contenido narrativo para YouTube, Facebook, TikTok,
Shorts y Reels.
Tu objetivo es convertir el prompt del usuario en un guion
estructurado por escenas, listo para ser convertido
automáticamente en imágenes, narración de audio y video final.

[ENTRADA DE DATOS]
El usuario puede proporcionar:
1. Un tema o prompt central.
2. Una duración objetivo.
3. Un tono deseado.
4. Un estilo visual.
5. Una estructura narrativa específica.
6. Una cantidad de escenas específica.
7. Indicaciones especiales sobre formato, música,
   subtítulos o destino del video.

============================================================
[DURACIÓN]
============================================================
La duración del video es completamente libre.
NO debes limitar la duración a 5, 10 o 15 minutos.
El usuario puede solicitar, por ejemplo:
1 minuto, 2 minutos, 3 minutos, 4 minutos, 5 minutos,
7 minutos, 10 minutos, 15 minutos, 20 minutos, 30 minutos, etc.

Si el usuario proporciona una duración específica,
debes respetarla aproximadamente.
La duración final real será determinada posteriormente
por la duración del audio TTS generado para cada escena.
Cada escena representa aproximadamente entre 8 y 12 segundos
de contenido narrativo, salvo que el usuario indique otra
estructura o timing explícito.
Si el usuario proporciona una cantidad específica de escenas,
debes respetarla aproximadamente.

============================================================
[ESTRUCTURA DE RESPUESTA]
============================================================
Responde ÚNICAMENTE en JSON válido.
No escribas texto adicional fuera del JSON.
Formato:

{
  "titulo": "Título llamativo para el video",
  "duracion_estimada_min": número,
  "escenas": [
    {
      "numero": 1,
      "texto_narracion": "Texto exacto para audio",
      "prompt_imagen": "Descripción visual detallada en inglés",
      "texto_subtitulo": "Versión corta para pantalla"
    }
  ]
}

============================================================
[REGLAS DE NARRACIÓN]
============================================================
- La narración debe fluir como una historia continua.
- No escribas escenas como datos aislados.
- Respeta el tono solicitado.
- Usa lenguaje natural.
- Evita tecnicismos innecesarios.
- Mantén coherencia entre escenas.
- La narración debe ser adecuada para el público indicado.

============================================================
[REGLAS VISUALES]
============================================================
Los prompts de imagen deben estar escritos en inglés.
Cada prompt debe describir:
- sujeto principal
- ambiente
- época
- iluminación
- composición
- cámara
- profundidad
- estilo visual
- nivel de detalle
Mantén consistencia visual entre escenas.
No introduzcas anacronismos cuando el tema sea histórico.

============================================================
[SUBTÍTULOS]
============================================================
Los subtítulos deben ser breves y legibles.
Preferiblemente no más de 8 palabras por escena,
salvo que el usuario solicite otra cosa.

============================================================
[CONTENIDO]
============================================================
No inventes hechos históricos presentándolos como hechos
verificados.
Cuando el usuario proporcione información específica,
úsala como base del guion.
Si existe una afirmación discutible, formula la narración
con rigor y evita presentar una afirmación dudosa como certeza.
============================================================
`;

/*
============================================================
HEALTH CHECK
============================================================
*/

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "Video Studio AI Backend",
    neonConfigured: Boolean(DATABASE_URL),
  });
});

/*
============================================================
1. GENERAR GUION
============================================================
*/

app.post("/api/generate-script", async (req, res) => {
  try {
    const { topic, duration = 5, tone = "misterio", style = "cinematic" } = req.body;

    if (!topic || typeof topic !== "string") {
      return res.status(400).json({ error: "El tema es obligatorio." });
    }

    const numericDuration = Number(duration);

    if (!Number.isFinite(numericDuration) || numericDuration <= 0) {
      return res.status(400).json({
        error: "La duración debe ser un número mayor que cero.",
      });
    }

    const ai = getGenAI();

    const userPrompt = `
Tema del video:
${topic}

Duración objetivo:
${numericDuration} minutos

Tono:
${tone}

Estilo visual:
${style}

INSTRUCCIONES IMPORTANTES:
Analiza primero el prompt completo del usuario.
Si el usuario proporciona una estructura narrativa
con tiempos específicos, respétala.
Si el usuario indica una cantidad aproximada de escenas,
respétala.
Si el usuario indica una duración exacta,
genera contenido suficiente para aproximarse a ella.
Cada escena debe contener narración, prompt visual
y subtítulo.
No limites artificialmente la cantidad de escenas
a 12, 25, 35, 70 u otro número fijo.
La cantidad de escenas debe surgir de la duración,
del timing indicado por el usuario y de la estructura
narrativa solicitada.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: userPrompt,
      config: {
        systemInstruction: SCRIPT_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    });

    let rawText = response.text || "{}";

    rawText = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "")
      .trim();

    let scriptData;

    try {
      scriptData = JSON.parse(rawText);
    } catch (parseError) {
      console.error("Fallo el JSON.parse directo. Intentando reparar...");
      
      const start = rawText.indexOf('{');
      const end = rawText.lastIndexOf('}');
      
      if (start !== -1 && end !== -1 && end > start) {
        const jsonSlice = rawText.slice(start, end + 1);
        try {
          scriptData = JSON.parse(jsonSlice);
        } catch (secondError) {
          console.error("El JSON de la IA está roto o truncado.");
          throw new Error(
            "La IA devolvió un JSON inválido o incompleto. Intenta reducir la duración del video o vuelve a intentarlo."
          );
        }
      } else {
        throw new Error("La IA no devolvió ningún JSON válido.");
      }
    }

    if (!scriptData.escenas || !Array.isArray(scriptData.escenas)) {
      throw new Error("Formato de guion inválido devuelto por Gemini.");
    }

    const normalizedScenes = scriptData.escenas.map((sc: any, idx: number) => ({
      numero: Number(sc.numero) || idx + 1,
      texto_narracion: sc.texto_narracion || "Narración de la escena.",
      prompt_imagen:
        sc.prompt_imagen ||
        `A cinematic scene representing ${topic}, highly detailed, professional lighting, realistic composition`,
      texto_subtitulo:
        sc.texto_subtitulo ||
        (sc.texto_narracion || "Escena").substring(0, 80),
    }));

    res.json({
      success: true,
      script: {
        titulo: scriptData.titulo || `Documental: ${topic}`,
        duracion_estimada_min:
          Number(scriptData.duracion_estimada_min) || numericDuration,
        escenas: normalizedScenes,
        tono: tone,
        estiloVisual: style,
      },
    });
  } catch (error: any) {
    console.error("Error generating script:", error);
    res.status(500).json({
      error: "Error al generar el guion con Gemini AI",
      details: error?.message || "Error desconocido.",
    });
  }
});

/*
============================================================
2. GENERAR IMAGEN DE ESCENA
============================================================
*/

app.post("/api/generate-scene-image", async (req, res) => {
  try {
    const {
      prompt_imagen,
      style = "cinematic",
      topic = "general",
      aspectRatio: requestedAspectRatio,
    } = req.body;

    if (!prompt_imagen) {
      return res.status(400).json({ error: "prompt_imagen es requerido." });
    }

    const aspectRatio: "16:9" | "9:16" =
      requestedAspectRatio === "9:16" ? "9:16" : "16:9";

    const isVertical = aspectRatio === "9:16";

    const formatLine = isVertical
      ? "High resolution 9:16 vertical cinematic shot. Vertical portrait composition for a phone screen, main subject centered and framed for portrait orientation."
      : "High resolution 16:9 cinematic shot.";

    const ai = getGenAI();

    const styledPrompt = `
${formatLine}
Visual style:
${style}
Topic:
${topic}
Scene:
${prompt_imagen}
Professional cinematic composition, realistic lighting, strong depth, high detail, consistent visual identity.
`;

    const MAX_IMAGE_ATTEMPTS = 3;

    for (let attempt = 1; attempt <= MAX_IMAGE_ATTEMPTS; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite-image",
          contents: styledPrompt,
          config: {
            imageConfig: {
              aspectRatio: aspectRatio,
            },
          },
        });

        const candidate = response.candidates?.[0];

        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData && part.inlineData.data) {
              const mime = part.inlineData.mimeType || "image/png";
              const imageUrl = `data:${mime};base64,${part.inlineData.data}`;

              return res.json({
                success: true,
                imageUrl,
                isAiGenerated: true,
              });
            }
          }
        }

        console.warn(
          `AI Image generation: intento ${attempt} de ${MAX_IMAGE_ATTEMPTS} sin imagen en la respuesta (finishReason: ${
            candidate?.finishReason || "desconocido"
          })`
        );
      } catch (imgError: any) {
        console.warn(
          `AI Image generation: intento ${attempt} de ${MAX_IMAGE_ATTEMPTS} falló:`,
          imgError?.message || imgError
        );
      }

      if (attempt < MAX_IMAGE_ATTEMPTS) {
        await new Promise<void>((resolve) => setTimeout(resolve, attempt * 700));
      }
    }

    const fallbackWidth = isVertical ? 720 : 1280;
    const fallbackHeight = isVertical ? 1280 : 720;

    const neutralPngBuffer = await sharp({
      create: {
        width: fallbackWidth,
        height: fallbackHeight,
        channels: 3,
        background: { r: 18, g: 18, b: 30 },
      },
    })
      .png()
      .toBuffer();

    const neutralFallbackUrl = `data:image/png;base64,${neutralPngBuffer.toString("base64")}`;

    return res.json({
      success: true,
      imageUrl: neutralFallbackUrl,
      isAiGenerated: false,
    });
  } catch (error: any) {
    console.error("Error in scene image route:", error);
    res.status(500).json({
      error: error?.message || "Error generando imagen.",
    });
  }
});

/*
============================================================
3. GENERAR AUDIO
============================================================
*/

app.post("/api/generate-scene-audio", async (req, res) => {
  try {
    const { text, voice = "Kore" } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Texto de narración es requerido." });
    }

    const ai = getGenAI();

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [
          {
            parts: [
              {
                text: `En español latino, narra con tono profesional y expresivo: ${text}`,
              },
            ],
          },
        ],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice,
              },
            },
          },
        },
      });

      const audioBase64 =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (audioBase64) {
        const mimeType =
          response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType ||
          "audio/wav";

        return res.json({
          success: true,
          audioUrl: `data:${mimeType};base64,${audioBase64}`,
          isTtsGenerated: true,
        });
      }
    } catch (ttsError) {
      console.warn("Gemini TTS fallback:", ttsError);
    }

    return res.json({
      success: true,
      audioUrl: null,
      useClientTts: true,
    });
  } catch (error: any) {
    console.error("Error generating scene audio:", error);
    res.status(500).json({
      error: error?.message || "Error generando audio.",
    });
  }
});

/*
============================================================
UTILIDAD: PREPARAR PROYECTO PARA NEON
============================================================
*/

function prepareProjectForDatabase(project: any): any {
  if (!project) {
    return {};
  }

  const clone = JSON.parse(JSON.stringify(project));

  if (clone?.script?.escenas && Array.isArray(clone.script.escenas)) {
    clone.script.escenas = clone.script.escenas.map((scene: any) => {
      const cleanScene = { ...scene };

      if (
        typeof cleanScene.imageUrl === "string" &&
        cleanScene.imageUrl.startsWith("data:image/")
      ) {
        delete cleanScene.imageUrl;
      }

      if (
        typeof cleanScene.audioUrl === "string" &&
        cleanScene.audioUrl.startsWith("data:audio/")
      ) {
        delete cleanScene.audioUrl;
      }

      return cleanScene;
    });
  }

  return clone;
}

/*
============================================================
4. GET PROJECTS
============================================================
*/

app.get("/api/projects", async (_req, res) => {
  if (!pool) {
    return res.json({
      success: true,
      projects: [],
      databaseConfigured: false,
    });
  }

  const MAX_ATTEMPTS = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await pool.query('SELECT 1');

      const result = await pool.query(`
        SELECT
          id,
          topic,
          created_at,
          status,
          thumbnail_url,
          total_scenes,
          video_url
        FROM video_studio_projects
        ORDER BY created_at DESC
        LIMIT 20
      `);

      const rows = result.rows;

      const projects = rows.map((row: any) => ({
        id: row.id,
        topic: row.topic,
        createdAt: row.created_at,
        status: row.status,
        thumbnailUrl: row.thumbnail_url,
        totalScenes: row.total_scenes,
        videoUrl: row.video_url,
      }));

      return res.json({
        success: true,
        projects,
        databaseConfigured: true,
      });
    } catch (error: any) {
      lastError = error;
      console.warn(
        `GET /api/projects: intento ${attempt} de ${MAX_ATTEMPTS} falló:`,
        error?.message || error
      );

      if (attempt < MAX_ATTEMPTS) {
        const waitTime = attempt * 2000;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  console.error("GET /api/projects: todos los reintentos fallaron:", lastError);

  return res.status(500).json({
    error: "No se pudieron cargar los proyectos desde Neon.",
    details: lastError?.message || "Error desconocido.",
  });
});

/*
============================================================
5. CREAR PROYECTO
============================================================
*/

app.post("/api/projects", async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      error: "Neon PostgreSQL no está configurado. Falta DATABASE_URL.",
    });
  }

  try {
    const project = req.body?.project;

    if (!project) {
      return res.status(400).json({ error: "El proyecto es obligatorio." });
    }

    if (!project.id) {
      return res.status(400).json({ error: "El proyecto debe tener un id." });
    }

    await pool.query('SELECT 1');

    const cleanProject = prepareProjectForDatabase(project);

    await pool.query(`
      INSERT INTO video_studio_projects (
        id, created_at, topic, duration_min, tone, visual_style,
        subtitles_enabled, status, thumbnail_url, total_scenes,
        rendered_progress, video_url, download_url, render_job_id, project_data
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (id)
      DO UPDATE SET
        topic = EXCLUDED.topic,
        duration_min = EXCLUDED.duration_min,
        tone = EXCLUDED.tone,
        visual_style = EXCLUDED.visual_style,
        subtitles_enabled = EXCLUDED.subtitles_enabled,
        status = EXCLUDED.status,
        thumbnail_url = EXCLUDED.thumbnail_url,
        total_scenes = EXCLUDED.total_scenes,
        rendered_progress = EXCLUDED.rendered_progress,
        video_url = EXCLUDED.video_url,
        download_url = EXCLUDED.download_url,
        render_job_id = EXCLUDED.render_job_id,
        project_data = EXCLUDED.project_data
    `, [
      cleanProject.id,
      cleanProject.createdAt ? new Date(cleanProject.createdAt) : new Date(),
      cleanProject.topic || "",
      Number(cleanProject.durationMin) || 0,
      cleanProject.tone || null,
      cleanProject.visualStyle || null,
      Boolean(cleanProject.subtitlesEnabled),
      cleanProject.status || "completed",
      cleanProject.thumbnailUrl || null,
      Number(cleanProject.totalScenes) || 0,
      Number(cleanProject.renderedProgress) || 0,
      cleanProject.videoUrl || null,
      cleanProject.downloadUrl || null,
      cleanProject.renderJobId || null,
      cleanProject
    ]);

    return res.json({
      success: true,
      project,
      persisted: true,
    });
  } catch (error: any) {
    console.error("POST /api/projects:", error);
    return res.status(500).json({
      error: "No se pudo guardar el proyecto en Neon.",
      details: error?.message || "Error desconocido.",
    });
  }
});

/*
============================================================
6. ACTUALIZAR PROYECTO
============================================================
*/

app.put("/api/projects/:id", async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      error: "Neon PostgreSQL no está configurado.",
    });
  }

  try {
    const project = req.body?.project;
    const id = req.params.id;

    if (!project) {
      return res.status(400).json({ error: "El proyecto es obligatorio." });
    }

    const cleanProject = prepareProjectForDatabase({ ...project, id });

    await pool.query(`
      UPDATE video_studio_projects
      SET
        topic = $1,
        duration_min = $2,
        tone = $3,
        visual_style = $4,
        subtitles_enabled = $5,
        status = $6,
        thumbnail_url = $7,
        total_scenes = $8,
        rendered_progress = $9,
        video_url = $10,
        download_url = $11,
        render_job_id = $12,
        project_data = $13
      WHERE id = $14
    `, [
      cleanProject.topic || "",
      Number(cleanProject.durationMin) || 0,
      cleanProject.tone || null,
      cleanProject.visualStyle || null,
      Boolean(cleanProject.subtitlesEnabled),
      cleanProject.status || "completed",
      cleanProject.thumbnailUrl || null,
      Number(cleanProject.totalScenes) || 0,
      Number(cleanProject.renderedProgress) || 0,
      cleanProject.videoUrl || null,
      cleanProject.downloadUrl || null,
      cleanProject.renderJobId || null,
      cleanProject,
      id
    ]);

    return res.json({
      success: true,
      project,
      persisted: true,
    });
  } catch (error: any) {
    console.error("PUT /api/projects/:id:", error);
    return res.status(500).json({
      error: "No se pudo actualizar el proyecto en Neon.",
      details: error?.message || "Error desconocido.",
    });
  }
});

/*
============================================================
7. ELIMINAR PROYECTO
============================================================
*/

app.delete("/api/projects/:id", async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      error: "Neon PostgreSQL no está configurado.",
    });
  }

  try {
    const id = req.params.id;

    await pool.query(`DELETE FROM video_studio_projects WHERE id = $1`, [id]);

    return res.json({
      success: true,
      deleted: true,
      id,
    });
  } catch (error: any) {
    console.error("DELETE /api/projects/:id:", error);
    return res.status(500).json({
      error: "No se pudo eliminar el proyecto.",
      details: error?.message || "Error desconocido.",
    });
  }
});

/*
============================================================
8. FFmpeg EXPORT
============================================================
*/

app.post("/api/export-video-ffmpeg", (req, res) => {
  try {
    const { project, subtitlesEnabled = true, voice = "Kore" } = req.body;

    if (!project || !project.script || !project.script.escenas) {
      return res.status(400).json({
        error: "El proyecto y su guion son obligatorios.",
      });
    }

    const jobId = startExportJob(project, subtitlesEnabled, voice);

    res.json({
      success: true,
      jobId,
    });
  } catch (err: any) {
    console.error("Error starting export job:", err);
    res.status(500).json({
      error: "Error al iniciar el trabajo de exportación de video.",
      details: err?.message || "Error desconocido.",
    });
  }
});

/*
============================================================
9. FFmpeg STATUS
============================================================
*/

app.get("/api/export-video-status/:jobId", (req, res) => {
  const { jobId } = req.params;

  const job = getExportJobStatus(jobId);

  if (!job) {
    return res.status(404).json({
      error: "Trabajo de renderizado no encontrado.",
    });
  }

  res.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    message: job.message,
    downloadUrl:
      job.status === "completed" ? `/api/download-video/${job.id}` : null,
    error: job.error || null,
  });
});

/*
============================================================
10. DESCARGAR VIDEO
============================================================
*/

app.get("/api/download-video/:jobId", (req, res) => {
  const { jobId } = req.params;

  const job = getExportJobStatus(jobId);

  let videoPath: string | undefined =
    job &&
    job.status === "completed" &&
    job.videoPath &&
    fs.existsSync(job.videoPath)
      ? job.videoPath
      : undefined;

  if (!videoPath) {
    const persistentPath = getPersistentVideoPath(jobId);
    if (fs.existsSync(persistentPath)) {
      videoPath = persistentPath;
    }
  }

  if (!videoPath) {
    return res.status(404).json({
      error: "El archivo de video final no está disponible o ha expirado.",
    });
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "public, max-age=3600");

  if (!range) {
    res.setHeader("Content-Length", fileSize);
    const stream = fs.createReadStream(videoPath);
    stream.on("error", (error) => {
      console.error("Error streaming video:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error leyendo el archivo de video." });
      } else {
        res.destroy(error);
      }
    });
    return stream.pipe(res);
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);

  if (!match) {
    res.status(416).setHeader("Content-Range", `bytes */${fileSize}`);
    return res.end();
  }

  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : fileSize - 1;

  if (!match[1] && match[2]) {
    const suffixLength = Number(match[2]);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      res.status(416).setHeader("Content-Range", `bytes */${fileSize}`);
      return res.end();
    }
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  }

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    start >= fileSize ||
    end < start
  ) {
    res.status(416).setHeader("Content-Range", `bytes */${fileSize}`);
    return res.end();
  }

  end = Math.min(end, fileSize - 1);
  const chunkSize = end - start + 1;

  res.status(206);
  res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
  res.setHeader("Content-Length", chunkSize);

  const stream = fs.createReadStream(videoPath, { start, end });
  stream.on("error", (error) => {
    console.error("Error streaming video range:", error);
    res.destroy(error);
  });
  return stream.pipe(res);
});

/*
============================================================
START SERVER + VITE
============================================================
*/

async function startServer() {
  await initializeDatabase();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
      },
      appType: "spa",
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));

    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Video Studio AI Server running on http://0.0.0.0:${PORT}`);
    console.log(
      `Neon PostgreSQL: ${DATABASE_URL ? "ACTIVO" : "NO CONFIGURADO"}`
    );
  });
}

startServer();