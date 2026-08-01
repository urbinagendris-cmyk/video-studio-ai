import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import dotenv from "dotenv";
import { startExportJob, getExportJobStatus, cleanupJob } from "./server/ffmpegVideoRenderer";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "100mb" }));

// Initialize Google GenAI with telemetry header
const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY || "";
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// System prompt as required by specification
const SCRIPT_SYSTEM_PROMPT = `[ROL Y OBJETIVO]
Actúa como un Guionista y Director Creativo especializado en contenido narrativo para YouTube y Facebook. Tu objetivo es convertir un tema o idea en un guion estructurado por escenas, listo para ser convertido automáticamente en imágenes, narración en audio y video final.

[ENTRADA DE DATOS]
El usuario te proporcionará:
1. Un tema o prompt central del video.
2. La duración objetivo en minutos (5, 10 o 15+).
3. Tono deseado: misterio, educativo, motivacional, narrativo.

[ESTRUCTURA DE RESPUESTA REQUERIDA]
Responde ÚNICAMENTE en formato JSON válido, sin texto adicional antes o después:

{
  "titulo": "Título llamativo para YouTube",
  "duracion_estimada_min": número,
  "escenas": [
    {
      "numero": 1,
      "texto_narracion": "Texto exacto para audio (10-15 segundos de lectura, ritmo natural)",
      "prompt_imagen": "Descripción visual detallada en inglés para el generador de imágenes, con estilo, iluminación y composición",
      "texto_subtitulo": "Versión corta para pantalla (máx 8 palabras)"
    }
  ]
}

El número de escenas corresponde a la duración: ~35 escenas para 5 min, ~70 para 10 min, ~100+ para 15 min (cada escena ≈ 8-10 segundos).

[INSTRUCCIONES ADICIONALES]
* La narración fluye como historia continua entre escenas, no como datos sueltos.
* Los prompts de imagen mantienen consistencia visual (mismo estilo artístico) en todo el guion, salvo que el tema pida lo contrario.
* Si el tema es vago o corto para la duración pedida, expande con contexto relevante, curiosidades o subtemas relacionados en vez de repetir ideas.
* Nunca generes contenido difamatorio, falso presentado como hecho verificado, o que use nombres de personas reales vivas de forma difamatoria.`;

// API Routes
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "Video Studio AI Backend" });
});

// 1. Generate Script using Gemini 3.6 Flash
app.post("/api/generate-script", async (req, res) => {
  try {
    const { topic, duration = 5, tone = "misterio", style = "cinematic" } = req.body;

    if (!topic || typeof topic !== "string") {
      return res.status(400).json({ error: "El tema es obligatorio." });
    }

    const ai = getGenAI();

    // Adjusted prompt count suggestion to avoid truncation while keeping high quality
    const userPrompt = `Tema del video: ${topic}\nDuración objetivo: ${duration} minutos\nTono deseado: ${tone}\nEstilo visual preferido: ${style}\n\nPor favor genera las escenas clave para este video (genera entre 12 a 25 escenas de alta calidad de 10-15 segundos cada una para cubrir la estructura narrativa completa).`;

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
    // Sanitize possible markdown backticks
    rawText = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();

    const scriptData = JSON.parse(rawText);

    if (!scriptData.escenas || !Array.isArray(scriptData.escenas)) {
      throw new Error("Formato de guion inválido devuelto por Gemini.");
    }

    res.json({
      success: true,
      script: {
        titulo: scriptData.titulo || `Documental: ${topic}`,
        duracion_estimada_min: Number(scriptData.duracion_estimada_min) || Number(duration),
        escenas: scriptData.escenas.map((sc: any, idx: number) => ({
          numero: sc.numero || idx + 1,
          texto_narracion: sc.texto_narracion || "Narración de la escena.",
          prompt_imagen: sc.prompt_imagen || `A dramatic cinematic scene representing ${topic}, highly detailed 8k cinematic lighting`,
          texto_subtitulo: sc.texto_subtitulo || sc.texto_narracion?.substring(0, 40) || "Subtítulo de la escena",
        })),
        tono: tone,
        estiloVisual: style,
      },
    });
  } catch (error: any) {
    console.error("Error generating script:", error);
    res.status(500).json({
      error: "Error al generar el guion con Gemini AI",
      details: error.message,
    });
  }
});

// 2. Generate Image for a Scene using Imagen 4 / Nano Banana Lite Image
app.post("/api/generate-scene-image", async (req, res) => {
  try {
    const { prompt_imagen, style = "cinematic", topic = "general" } = req.body;

    if (!prompt_imagen) {
      return res.status(400).json({ error: "prompt_imagen es requerido." });
    }

    const ai = getGenAI();
    const styledPrompt = `High resolution 16:9 cinematic shot, ${style} aesthetic, vivid color grading, professional lighting: ${prompt_imagen}`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-image",
        contents: styledPrompt,
        config: {
          imageConfig: {
            aspectRatio: "16:9",
          },
        },
      });

      const candidate = response.candidates?.[0];
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            const mime = part.inlineData.mimeType || "image/png";
            const imageUrl = `data:${mime};base64,${part.inlineData.data}`;
            return res.json({ success: true, imageUrl, isAiGenerated: true });
          }
        }
      }
    } catch (imgError) {
      console.warn("AI Image generation model fallback triggered:", imgError);
    }

    // High quality thematic Unsplash / Picsum fallback if image quota is reached or unavailable
    const seed = encodeURIComponent(prompt_imagen.substring(0, 30));
    const fallbackUrl = `https://picsum.photos/seed/${seed}/1280/720`;
    return res.json({ success: true, imageUrl: fallbackUrl, isAiGenerated: false });

  } catch (error: any) {
    console.error("Error in scene image route:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Generate Audio Narrations using Gemini TTS or Web Speech / Synthesis
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
        contents: [{ parts: [{ text: `En español latino, narra con tono profesional y expresivo: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      });

      const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioBase64) {
        const mimeType = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || "audio/wav";
        return res.json({
          success: true,
          audioUrl: `data:${mimeType};base64,${audioBase64}`,
          isTtsGenerated: true,
        });
      }
    } catch (ttsError) {
      console.warn("Gemini TTS fallback triggered:", ttsError);
    }

    // Client will fallback to Web Speech Synthesis API smoothly
    return res.json({ success: true, audioUrl: null, useClientTts: true });

  } catch (error: any) {
    console.error("Error generating scene audio:", error);
    res.status(500).json({ error: error.message });
  }
});

// 4. FFmpeg Video Export Endpoint - Starts background assembly job
app.post("/api/export-video-ffmpeg", (req, res) => {
  try {
    const { project, subtitlesEnabled = true, voice = "Kore" } = req.body;

    if (!project || !project.script || !project.script.escenas) {
      return res.status(400).json({ error: "El proyecto y su guion son obligatorios." });
    }

    const jobId = startExportJob(project, subtitlesEnabled, voice);
    res.json({ success: true, jobId });
  } catch (err: any) {
    console.error("Error starting export job:", err);
    res.status(500).json({ error: "Error al iniciar el trabajo de exportación de video.", details: err.message });
  }
});

// 5. FFmpeg Video Export Status Endpoint
app.get("/api/export-video-status/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = getExportJobStatus(jobId);

  if (!job) {
    return res.status(404).json({ error: "Trabajo de renderizado no encontrado." });
  }

  res.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    message: job.message,
    downloadUrl: job.status === "completed" ? `/api/download-video/${job.id}` : null,
    error: job.error || null,
  });
});

// 6. Download Final Rendered MP4 Endpoint
app.get("/api/download-video/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = getExportJobStatus(jobId);

  if (!job || job.status !== "completed" || !job.videoPath || !fs.existsSync(job.videoPath)) {
    return res.status(404).json({ error: "El archivo de video final no está disponible o ha expirado." });
  }

  const safeFilename = `video_studio_${jobId}.mp4`;
  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);

  const stream = fs.createReadStream(job.videoPath);
  stream.pipe(res);
});

// Start Express + Vite
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
  });
}

startServer();
