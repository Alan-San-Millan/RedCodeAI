import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, LANGUAGES, DEFAULT_LANGUAGE, findLanguage } from './src/config.js';
import { generateSolution } from './src/services/gemini.service.js';
import { AppError, toUserError } from './src/lib/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Este prototipo corre sobre HTTP plano en local. hsts y upgradeInsecureRequests
// asumen HTTPS y hacen que el navegador intente cargar CSS/JS por https://localhost,
// donde no hay nada escuchando: los assets fallan con ERR_FAILED y la página se ve
// sin estilos. Ambos se desactivan aquí; si esto se despliega alguna vez detrás de
// HTTPS real, hay que revertir este cambio.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: null
    }
  },
  hsts: false
}));
app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// highlight.js se sirve desde el propio servidor, no desde un CDN: así el CSP sigue
// siendo estricto (scriptSrc 'self') y la app funciona sin conexión a internet.
app.use('/vendor/hljs', express.static(path.join(__dirname, 'node_modules', '@highlightjs', 'cdn-assets')));

/** Configuración pública que el navegador necesita para construir la interfaz. */
app.get('/api/config', (_req, res) => {
  res.json({
    model: config.model,
    apiKeyConfigured: Boolean(config.apiKey),
    defaultTemperature: config.temperature,
    defaultLanguage: DEFAULT_LANGUAGE,
    languages: LANGUAGES.map(({ id, label, highlight }) => ({ id, label, highlight })),
    limits: {
      minRequirementLength: config.minRequirementLength,
      maxRequirementLength: config.maxRequirementLength
    }
  });
});

function validate(body = {}) {
  const requirement = String(body.requirement ?? '').trim();

  if (!requirement) {
    throw new AppError('Escribe el requerimiento que quieres convertir en código.', {
      code: 'empty_requirement'
    });
  }
  if (requirement.length < config.minRequirementLength) {
    throw new AppError(
      `El requerimiento es demasiado corto (${requirement.length} de ${config.minRequirementLength} caracteres mínimos).`,
      {
        code: 'short_requirement',
        hint: 'Describe qué debe recibir, qué debe devolver y bajo qué condiciones. Ejemplo: "una función que reciba una lista de números y calcule el promedio ignorando los negativos".'
      }
    );
  }
  if (requirement.length > config.maxRequirementLength) {
    throw new AppError(
      `El requerimiento supera el límite de ${config.maxRequirementLength} caracteres de este prototipo.`,
      { code: 'long_requirement', hint: 'Divídelo en requerimientos más pequeños y genéralos por separado.' }
    );
  }

  const languageId = String(body.language ?? '').trim();
  let language;
  if (!languageId) {
    language = findLanguage(DEFAULT_LANGUAGE);
  } else {
    language = findLanguage(languageId);
    if (!language) {
      throw new AppError(`El lenguaje "${languageId}" no está soportado.`, {
        code: 'invalid_language',
        hint: `Elige uno de los lenguajes disponibles: ${LANGUAGES.map((l) => l.label).join(', ')}.`
      });
    }
  }

  let temperature = Number.parseFloat(body.temperature);
  if (!Number.isFinite(temperature)) temperature = config.temperature;
  temperature = Math.min(1, Math.max(0, Math.round(temperature * 100) / 100));

  return { requirement, language, temperature };
}

app.post('/api/generate', async (req, res) => {
  try {
    const input = validate(req.body);
    res.json(await generateSolution(input));
  } catch (error) {
    const userError = toUserError(error);
    if (userError.status >= 500) console.error('[generate]', error);
    res.status(userError.status).json({ error: userError.message, hint: userError.hint, code: userError.code });
  }
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada.', code: 'not_found' }));
app.get('/{*splat}', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(config.port, () => {
  console.log(`\n  ReqCode AI · http://localhost:${config.port}`);
  console.log(`  Modelo:      ${config.model}`);
  console.log(`  Temperature: ${config.temperature}`);
  console.log(`  API key:     ${config.apiKey ? 'configurada' : 'NO configurada — copia .env.example como .env'}\n`);
});
