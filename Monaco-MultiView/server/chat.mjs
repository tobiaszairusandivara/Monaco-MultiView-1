import { readCollection, saveCollection } from './store.mjs';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/v1';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';
const PROVIDER = (process.env.CHAT_PROVIDER || 'stub').toLowerCase();
const LEAK_THRESHOLD = 0.7;
const MAX_REGEN = 3;
const OLLAMA_TIMEOUT_MS = 30000;

export const CHAT_FUNCTIONS = ['tutor', 'evaluador', 'moderador', 'generador', 'conversacional'];

const RISK_GUIDE = {
  ALTO:
    'Nivel de riesgo ALTO (RF-IA-19): Usted no debe escribir el bloque, la línea ni el código correcto, ni con nombres de variables distintos si el contexto es identificable. Sólo puede: (a) explicar en palabras qué debería lograr esa parte del código, (b) hacer preguntas guía de tipo socrático, (c) sugerir una estrategia de debugging, (d) señalar la naturaleza del error sin indicar la línea exacta ni la corrección.',
  MEDIO:
    'Nivel de riesgo MEDIO (RF-IA-19): Usted puede sugerir enfoques conceptuales, señalar documentación relevante y comentar buenas prácticas generales, sin escribir el código de la solución ni un pseudocódigo tan específico que equivalga a dictarla.',
  BAJO:
    'Nivel de riesgo BAJO/colaborativo (RF-IA-19): Usted tiene mayor libertad conversacional porque la evaluación es de proceso y criterio, pero siempre respetando la regla general de no entregar la solución final ya armada.',
};

const GLOBAL_RULES =
  'Nunca entregue la solución final, fragmentos de código resueltos ni respuestas directas que resuelvan el ejercicio (RF-IA-04). Responda en español, en un registro formal y cortés. Si el usuario pide la solución directa, oriéntelo con preguntas o estrategia en lugar de darla.';

function systemPromptFor(riskLevel) {
  const guide = RISK_GUIDE[riskLevel] ?? RISK_GUIDE.MEDIO;
  return `Es el tutor pedagógico de desafíos prácticos. ${guide} ${GLOBAL_RULES}`;
}

export function normalizeText(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .trim();
}

function similarity(a, b) {
  const tokensA = new Set(a.split(' '));
  const tokensB = new Set(b.split(' '));
  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection += 1;
  }
  return intersection / Math.sqrt(tokensA.size * tokensB.size);
}

export function triggersAntiLeak(candidate, expectedSolution, threshold = LEAK_THRESHOLD) {
  if (!candidate || !expectedSolution) return false;
  return similarity(normalizeText(candidate), normalizeText(expectedSolution)) >= threshold;
}

function stubFor(riskLevel) {
  switch (riskLevel) {
    case 'ALTO':
      return 'Soy el tutor de este desafío (riesgo ALTO). Por la política del ejercicio no puedo escribirle el bloque que completa el código ni señalar la línea exacta. Puedo ayudarlo si me cuenta qué espera que produzca esa parte: descríbame las entradas y la salida que debería devolver, y lo guío con preguntas para que llegue a la corrección por usted mismo.';
    case 'BAJO':
      return 'Soy el tutor de este desafío (riesgo BAJO). Podemos conversar con libertad porque lo importante es el proceso y el criterio. Cuénteme qué resolvió hasta acá y qué dudas le quedan: revisamos su razonamiento sin entregarle la solución final armada.';
    default:
      return 'Soy el tutor de este desafío (riesgo MEDIO). Puedo orientarlo con enfoques conceptuales, documentación y buenas prácticas generales, pero no escribir la solución. ¿Qué parte del problema está analizando? Cuénteme su razonamiento y seguimos desde ahí.';
  }
}

function guardedReply() {
  return 'No puedo mostrarle ese contenido tal cual. Propongo revisarlo de otra forma: ¿cómo encararía el problema si lo dividiera en pasos más chicos? Descríbame dónde se trabó y lo oriento con la estrategia, sin resolver el ejercicio.';
}

async function callOllama(messages) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  try {
    const response = await fetch(`${OLLAMA_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        temperature: 0.4,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Ollama responded with ${response.status}.`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}

async function produce(systemPrompt, userMessages, attempt, riskLevel) {
  if (PROVIDER === 'ollama') {
    try {
      return await callOllama([
        { role: 'system', content: systemPrompt },
        ...userMessages,
      ]);
    } catch {
      return attempt > 0 ? guardedReply() : stubFor(riskLevel);
    }
  }
  return stubFor(riskLevel);
}

export async function askChat({ messages, riskLevel, expectedSolution }) {
  const systemPrompt = systemPromptFor(riskLevel);
  const userMessages = (messages ?? []).map((m) => ({ role: m.role, content: m.text }));
  let reply = '';
  let blocked = false;
  for (let attempt = 0; attempt < MAX_REGEN; attempt += 1) {
    reply = await produce(systemPrompt, userMessages, attempt, riskLevel);
    if (!triggersAntiLeak(reply, expectedSolution)) {
      return { reply, blocked };
    }
    blocked = true;
  }
  return { reply: guardedReply(), blocked };
}

export function chatStatus() {
  return {
    provider: PROVIDER,
    model: PROVIDER === 'ollama' ? OLLAMA_MODEL : 'stub',
    ollamaUrl: PROVIDER === 'ollama' ? OLLAMA_URL : null,
  };
}

export async function logInteraction(entry) {
  const logs = await readCollection('ia-logs');
  logs.push({ ...entry, provider: PROVIDER, model: PROVIDER === 'ollama' ? OLLAMA_MODEL : 'stub', timestamp: new Date().toISOString() });
  await saveCollection('ia-logs', logs);
}