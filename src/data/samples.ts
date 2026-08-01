import { VideoProject } from '../types';

export const SAMPLE_PROJECTS: VideoProject[] = [
  {
    id: 'sample-atlantida',
    createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    topic: 'Los Enigmas Desconocidos de la Atlántida y las Civilizaciones Perdidas',
    durationMin: 10,
    tone: 'misterio',
    visualStyle: 'cinematic',
    subtitlesEnabled: true,
    status: 'completed',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1280&q=80',
    totalScenes: 8,
    renderedProgress: 100,
    script: {
      titulo: 'Los Enigmas Desconocidos de la Atlántida y las Civilizaciones Perdidas',
      duracion_estimada_min: 10,
      tono: 'misterio',
      estiloVisual: 'cinematic',
      escenas: [
        {
          numero: 1,
          texto_narracion: 'Durante miles de años, la humanidad ha susurrado la leyenda de un imperio sumergido en las profundidades del océano.',
          prompt_imagen: 'Cinematic wide shot of an ancient majestic underwater golden city with glowing temples and statues under crystal blue ocean waves, 8k resolution, dramatic lighting',
          texto_subtitulo: 'Durante miles de años la humanidad ha buscado la Atlántida',
          imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1280&q=80'
        },
        {
          numero: 2,
          texto_narracion: 'Platón escribió por primera vez sobre esta civilización avanzada en sus diálogos Timaeus y Critias alrededor del año 360 antes de Cristo.',
          prompt_imagen: 'Ancient Greek philosopher writing on parchment in a grand stone library with marble pillars, lit by flickering torchlight, cinematic atmosphere',
          texto_subtitulo: 'Platón escribió por primera vez en el 360 a.C.',
          imageUrl: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1280&q=80'
        },
        {
          numero: 3,
          texto_narracion: 'Según los textos antiguos, poseían tecnología que desafiaba su época y una arquitectura de anillos concéntricos monumental.',
          prompt_imagen: 'Aerial view of a futuristic ancient city with concentric circular canals, grand palaces of gold and brass, hyperrealistic sunset glow',
          texto_subtitulo: 'Poseían arquitectura de anillos concéntricos monumental',
          imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1280&q=80'
        },
        {
          numero: 4,
          texto_narracion: 'Sin embargo, en una sola noche cataclísmica de fuego y terremotos, toda la isla se hundió misteriosamente en el abismo marino.',
          prompt_imagen: 'Apocalyptic scene of massive tsunami waves and volcanic lightning crashing against golden temples, intense dramatic storm atmosphere',
          texto_subtitulo: 'En una noche de cataclismo se hundió en el abismo',
          imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1280&q=80'
        },
        {
          numero: 5,
          texto_narracion: 'Hoy en día, satélites y exploradores marinos continúan escaneando el suelo oceánico buscando la verdad oculta tras el mito.',
          prompt_imagen: 'High-tech modern exploration submarine projecting blue sonar beams onto dark abyssal ocean floor ruins, hyperdetailed',
          texto_subtitulo: 'Hoy los satélites y sonares buscan la verdad oculta',
          imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1280&q=80'
        }
      ]
    }
  },
  {
    id: 'sample-ai-revolution',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    topic: 'La Revolución Silenciosa de la Inteligencia Artificial y el Futuro de la Humanidad',
    durationMin: 5,
    tone: 'educativo',
    visualStyle: '3d_render',
    subtitlesEnabled: true,
    status: 'completed',
    thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1280&q=80',
    totalScenes: 5,
    renderedProgress: 100,
    script: {
      titulo: 'La Revolución Silenciosa de la Inteligencia Artificial',
      duracion_estimada_min: 5,
      tono: 'educativo',
      estiloVisual: '3d_render',
      escenas: [
        {
          numero: 1,
          texto_narracion: 'La inteligencia artificial ya no forma parte únicamente de la ciencia ficción; está redefiniendo el núcleo de la civilización moderna.',
          prompt_imagen: '3D render of a futuristic human brain made of glowing fiber optic networks and neon purple data streams, dark technology background',
          texto_subtitulo: 'La IA está redefiniendo la civilización moderna',
          imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1280&q=80'
        },
        {
          numero: 2,
          texto_narracion: 'Desde modelos del lenguaje hasta generadores de video fotorrealistas, las redes neuronales procesan billones de parámetros por segundo.',
          prompt_imagen: 'Macro close-up of a quantum microchip pulsating with emerald green light trails and complex holographic circuits',
          texto_subtitulo: 'Redes neuronales procesan billones de parámetros por segundo',
          imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1280&q=80'
        },
        {
          numero: 3,
          texto_narracion: 'En la medicina, los algoritmos predicen estructuras de proteínas en segundos, acelerando curas que antes tomaban décadas.',
          prompt_imagen: 'Futuristic medical research lab with glowing 3D DNA double helix holograms and scientists interacting with transparent displays',
          texto_subtitulo: 'En medicina, predice proteínas acelerando curas científicas',
          imageUrl: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1280&q=80'
        },
        {
          numero: 4,
          texto_narracion: 'El verdadero dilema no es lo que la IA puede hacer, sino cómo los humanos elegiremos colaborar con esta inteligencia emergente.',
          prompt_imagen: 'A human hand touching a glowing robotic synthetic hand in a dramatic minimalist studio, symbolizing human AI symbiosis',
          texto_subtitulo: 'El dilema es cómo colaboraremos con la IA emergente',
          imageUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1280&q=80'
        }
      ]
    }
  },
  {
    id: 'sample-mindset',
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    topic: 'El Arte de Dominar la Mente: Cómo Desbloquear tu Máximo Potencial',
    durationMin: 15,
    tone: 'motivacional',
    visualStyle: 'arte_digital',
    subtitlesEnabled: true,
    status: 'completed',
    thumbnailUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1280&q=80',
    totalScenes: 6,
    renderedProgress: 100,
    script: {
      titulo: 'El Arte de Dominar la Mente: Desbloquea tu Máximo Potencial',
      duracion_estimada_min: 15,
      tono: 'motivacional',
      estiloVisual: 'arte_digital',
      escenas: [
        {
          numero: 1,
          texto_narracion: 'Tu mente es el territorio más poderoso que conquistarás en toda tu vida. Cada pensamiento moldea tu realidad.',
          prompt_imagen: 'Epic digital painting of a solitary figure standing at the peak of a glowing mountain above the clouds at dawn, inspiring artwork',
          texto_subtitulo: 'Tu mente es el territorio más poderoso a conquistar',
          imageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1280&q=80'
        },
        {
          numero: 2,
          texto_narracion: 'Las personas exitosas no carecen de miedo o dudas, sino que han entrenado su disciplina para actuar a pesar de ellos.',
          prompt_imagen: 'A athlete training in a dramatic dark gym illuminated by a single spotlight, determination and sweat, cinematic focus',
          texto_subtitulo: 'La disciplina es actuar a pesar del miedo y las dudas',
          imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1280&q=80'
        },
        {
          numero: 3,
          texto_narracion: 'Cuando cambias la forma en que enfocas los obstáculos, las mayores dificultades se convierten en tus peldaños de crecimiento.',
          prompt_imagen: 'Concept art of a golden bridge spanning across a dark misty canyon leading towards a bright glowing metropolis',
          texto_subtitulo: 'Los obstáculos son los peldaños hacia el crecimiento',
          imageUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1280&q=80'
        }
      ]
    }
  }
];
