// Asistente de dudas: usa la API de Claude si hay clave configurada;
// si no, responde con una base de preguntas frecuentes local.
const { db } = require('./db');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

function progressSummary() {
  const phases = db.prepare('SELECT * FROM phases ORDER BY position').all();
  const stepsBy = db.prepare('SELECT * FROM steps WHERE phase_id = ? ORDER BY position');
  return phases.map(p => {
    const steps = stepsBy.all(p.id);
    const done = steps.filter(s => s.done).length;
    const lines = steps.map(s => {
      const state = s.verified ? 'verificado' : s.done ? 'completado, falta verificar' : 'pendiente';
      return `  - ${s.title} (${s.when_text}) → entregable: ${s.deliverable} [${state}]`;
    });
    return `${p.title} (${p.when_text}): ${done}/${steps.length} pasos completados\n${lines.join('\n')}`;
  }).join('\n\n');
}

function systemPrompt(user) {
  return `Eres el asistente de Radio NIJEPRA, la radio pedagógica comunitaria digital del Colegio Niño Jesús de Praga (Girón, Santander, Colombia), un proyecto acompañado por la Universidad Santo Tomás de Bucaramanga.

Hablas con ${user.name} (rol: ${user.role}). Responde en español, claro, amable y breve (uno o dos párrafos, o una lista corta). Usa lenguaje sencillo para estudiantes y docentes.

Tu alcance:
1. La hoja de ruta de Radio NIJEPRA, sus fases, pasos y entregables (abajo tienes el estado actual).
2. Temas técnicos del proyecto: AzuraCast, BUTT, OBS, streaming a 128 kbps, cabina y acústica, fibra óptica con Innovation Telecomunicaciones, radioenlace de respaldo de 5,8 GHz de uso libre, UPS y autonomía, podcast.
3. Marco legal colombiano de la radio: la FM requiere concesión de MinTIC (Resolución 2614 de 2022). Las emisoras educativas de interés público solo se otorgan a colegios oficiales; el colegio es privado, así que la vía hacia la FM es una alianza (Fase 2) y luego una entidad sin ánimo de lucro propia que se presente a una convocatoria comunitaria (Fase 3). Emitir en FM sin concesión tiene consecuencias legales. La música comercial requiere licencia de SAYCO y ACINPRO. El espectro de uso libre está en la Resolución ANE 105 de 2020.
4. Cómo usar esta plataforma: los estudiantes y coordinadores marcan un paso como completado; un coordinador o administrador lo verifica. En cada paso se puede dejar una nota y un enlace a la evidencia.

Si te preguntan algo fuera de este alcance, dilo con amabilidad y ofrece volver al proyecto. Si no estás seguro de un dato puntual (montos, fechas de convocatorias), dilo y recomienda verificarlo en mintic.gov.co o con la coordinación. No inventes estados del avance: usa solo el resumen de abajo.

Estado actual de la hoja de ruta:
${progressSummary()}`;
}

async function askClaude(user, history) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      system: systemPrompt(user),
      messages: history
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}

// ---------- Respaldo sin conexión: preguntas frecuentes ----------
const FAQ = [
  {
    keys: ['chulear', 'marcar', 'completado', 'verificar', 'verifica', 'plataforma', 'usar', 'como funciona'],
    answer: 'En "Hoja de ruta" cada paso tiene una casilla. Quien termina el trabajo la marca como completado y puede dejar una nota y el enlace a la evidencia (por ejemplo, el acta en Drive). Después, un coordinador o el administrador revisa el entregable y pulsa "Verificar". Un paso cuenta como cerrado cuando está verificado.'
  },
  {
    keys: ['fase 1', 'digital', 'primera fase', 'primer paso', 'empezar'],
    answer: 'La Fase 1 deja la emisora sonando 24/7 por internet en unas 12 semanas. Empieza con la aprobación del Consejo Directivo, el respaldo de los videos de Twitch y la decisión sobre la música. Luego vienen la fibra, el servidor AzuraCast, la cabina, la UPS, la parrilla, el reproductor web, la formación, el piloto y el lanzamiento.'
  },
  {
    keys: ['fase 2', 'alianza', 'franja', 'aliada'],
    answer: 'La Fase 2 busca sonar en FM sin concesión propia: se propone un programa semanal a una emisora comunitaria de Girón o a una emisora universitaria, se firma un convenio y se documenta cada emisión como evidencia para la Fase 3.'
  },
  {
    keys: ['fase 3', 'independencia', 'fundacion', 'fundación', 'corporacion', 'constituir', 'entidad'],
    answer: 'La Fase 3 crea una fundación o corporación sin ánimo de lucro con domicilio en Girón. Esa entidad acumula trabajo comunitario y se presenta a una convocatoria de emisoras comunitarias de MinTIC. El colegio no puede ser el titular por ser privado, pero sí su aliado y su estudio.'
  },
  {
    keys: ['licencia', 'frecuencia', 'fm', 'concesion', 'concesión', 'mintic', 'pedagogica', 'pedagógica'],
    answer: 'Para emitir en FM se necesita una concesión de MinTIC (Resolución 2614 de 2022). Las emisoras educativas de interés público solo se otorgan a colegios oficiales; como NIJEPRA es privado, la ruta es la alianza (Fase 2) y luego una entidad propia en una convocatoria comunitaria (Fase 3). Emitir en FM sin concesión es ilegal. Conviene confirmar los detalles con MinTIC.'
  },
  {
    keys: ['musica', 'música', 'sayco', 'acinpro', 'derechos', 'canciones'],
    answer: 'Emitir música comercial por internet requiere una licencia de comunicación pública con SAYCO y ACINPRO. La alternativa es usar música libre de derechos (por ejemplo Jamendo o Free Music Archive) y producción propia de los estudiantes.'
  },
  {
    keys: ['azuracast', 'servidor', 'vps', 'streaming', 'icecast'],
    answer: 'AzuraCast es el servidor de la emisora: reúne Icecast, la programación automática, las cuentas de locutores y el reproductor web. Se instala en un VPS con Ubuntu y al menos 2 GB de RAM, con el script oficial. La señal sale en MP3 a 128 kbps. Si falla la luz en el colegio, la programación automática sigue sonando desde la nube.'
  },
  {
    keys: ['butt', 'obs', 'en vivo', 'transmitir', 'consola'],
    answer: 'Para salir en vivo, la consola se conecta al PC de cabina y BUTT envía el audio a AzuraCast con el usuario de DJ. Si se quiere video, OBS puede enviar el audio a AzuraCast y el video a YouTube al mismo tiempo.'
  },
  {
    keys: ['fibra', 'innovation', 'internet', 'velocidad', 'conectividad'],
    answer: 'La fibra de Innovation Telecomunicaciones es el enlace principal. La medición en el colegio dio 844 Mbps de bajada, 719 de subida y 9 ms de ping; una señal de 128 kbps usa menos del 1 % de esa capacidad. Hay que dejar el convenio por escrito con tarifa, velocidad y tiempo de respuesta ante fallas.'
  },
  {
    keys: ['radioenlace', 'antena', '5,8', '5.8', 'fresnel', 'respaldo', 'enlace'],
    answer: 'El radioenlace de 5,8 GHz de uso libre es el respaldo de la fibra y no necesita permiso si respeta los límites de la Resolución ANE 105 de 2020. Requiere línea de vista, zona de Fresnel despejada al 60 % y un margen de enlace de al menos 15 dB. Un router de doble conexión pasa de la fibra al radioenlace si la fibra falla.'
  },
  {
    keys: ['ups', 'energia', 'energía', 'luz', 'corte', 'bateria', 'batería', 'autonomia', 'autonomía'],
    answer: 'La cabina usa una UPS de 1000 VA. Con unos 258 W de carga, la autonomía estimada es de 34 minutos, o 43 minutos dejando solo lo esencial. Una vez al mes se prueba desconectando la red en horario sin emisión.'
  },
  {
    keys: ['cabina', 'ruido', 'acustica', 'acústica', 'drywall', 'panel', 'aislamiento'],
    answer: 'La cabina se divide en control y locución con un tabique de drywall con lana de roca, una ventana de doble vidrio y puertas con burletes. Adentro van paneles absorbentes y trampas de graves. La meta es bajar de 68-70 dB a menos de 40 dB en la locución. Las cubetas de huevo no sirven.'
  },
  {
    keys: ['presupuesto', 'costo', 'cuanto', 'cuánto', 'precio', 'inversion', 'inversión'],
    answer: 'La inversión de la Fase 1 está entre $4,8 y $7,6 millones de pesos, o entre $5,2 y $8,4 millones con imprevistos. Si se reutilizan los equipos de audio de Twitch, baja a entre $2,9 y $4,9 millones. Son valores aproximados que se deben cotizar.'
  },
  {
    keys: ['podcast', 'spotify', 'reproductor', 'web', 'pagina', 'página'],
    answer: 'AzuraCast incluye un reproductor que se incrusta en el sitio del colegio. Los programas grabados se publican como podcast con un feed RSS para Spotify, Apple Podcasts y YouTube Music.'
  },
  {
    keys: ['twitch', 'videos', 'grabaciones'],
    answer: 'Twitch borra los videos guardados pasado un tiempo, así que hay que descargarlos cuanto antes (paso 2 de la Fase 1). Durante el lanzamiento, Twitch se mantiene 2 a 4 semanas en paralelo con un enlace a la nueva emisora.'
  }
];

function normalize(t) {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function faqAnswer(question) {
  const q = normalize(question);
  let best = null;
  let bestScore = 0;
  for (const item of FAQ) {
    const score = item.keys.reduce((acc, k) => acc + (q.includes(normalize(k)) ? k.length : 0), 0);
    if (score > bestScore) { best = item; bestScore = score; }
  }
  if (best) return best.answer;
  return 'Puedo ayudarte con la hoja de ruta de Radio NIJEPRA: las fases, los entregables, la cabina, la fibra, el radioenlace, la UPS, la música y la licencia FM. Prueba preguntando, por ejemplo, "¿cómo marco un paso como completado?" o "¿qué necesito para la licencia FM?".';
}

async function answer(user, history) {
  const question = history[history.length - 1].content;
  if (!process.env.ANTHROPIC_API_KEY) {
    return { text: faqAnswer(question), source: 'faq' };
  }
  try {
    const text = await askClaude(user, history);
    return { text: text || faqAnswer(question), source: text ? 'claude' : 'faq' };
  } catch (err) {
    console.error('[chat] Error con la API de Claude:', err.message);
    return { text: faqAnswer(question), source: 'faq' };
  }
}

module.exports = { answer };
