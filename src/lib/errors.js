/**
 * Traduce cualquier fallo (validación, red, API de Gemini) a un mensaje que una persona
 * pueda accionar. El frontend nunca debe ver un error crudo del SDK.
 */
export class AppError extends Error {
  constructor(message, { status = 400, code = 'bad_request', hint = null } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.hint = hint;
  }
}

const QUOTA_HINT = 'La capa gratuita de Gemini limita las solicitudes por minuto y por día. Espera un momento y vuelve a intentarlo, o cambia GEMINI_MODEL en .env por uno con más cuota (por ejemplo gemini-2.5-flash).';

export function toUserError(error) {
  if (error instanceof AppError) return error;

  // Timeout propio (AbortSignal.timeout) o cancelación de la petición.
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
    return new AppError('Gemini tardó demasiado en responder y se canceló la solicitud.', {
      status: 504,
      code: 'timeout',
      hint: 'Prueba con un requerimiento más corto o vuelve a intentarlo en unos segundos.'
    });
  }

  const status = Number(error?.status ?? error?.response?.status ?? 0);
  const raw = String(error?.message || '');

  if (status === 400 && /API key not valid|API_KEY_INVALID/i.test(raw)) {
    return new AppError('La API key de Gemini no es válida.', {
      status: 401,
      code: 'invalid_key',
      hint: 'Genera una nueva en aistudio.google.com/apikey y colócala en .env como GEMINI_API_KEY.'
    });
  }
  if (status === 401 || status === 403) {
    return new AppError('Gemini rechazó la API key configurada.', {
      status: 401,
      code: 'invalid_key',
      hint: 'La clave puede estar vencida, revocada o ser de otro tipo. Genera una nueva en aistudio.google.com/apikey.'
    });
  }
  if (status === 404) {
    return new AppError('El modelo configurado no existe o no está disponible para esta API key.', {
      status: 404,
      code: 'model_not_found',
      hint: 'Revisa GEMINI_MODEL en .env. Los nombres de modelo cambian con frecuencia; consulta ai.google.dev/gemini-api/docs/models.'
    });
  }
  if (status === 429) {
    return new AppError('Se alcanzó el límite de la capa gratuita de Gemini.', {
      status: 429,
      code: 'quota_exceeded',
      hint: QUOTA_HINT
    });
  }
  if (status === 503 || status === 502) {
    return new AppError('El servicio de Gemini no está disponible en este momento.', {
      status: 503,
      code: 'upstream_unavailable',
      hint: 'Es una interrupción temporal del lado de Google. Vuelve a intentarlo en unos minutos.'
    });
  }
  if (status >= 500) {
    return new AppError('Gemini respondió con un error interno.', {
      status: 502,
      code: 'upstream_error',
      hint: 'Vuelve a intentarlo. Si persiste, prueba con otro modelo en GEMINI_MODEL.'
    });
  }

  // Fallos de red antes de llegar a la API.
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN|network/i.test(raw)) {
    return new AppError('No se pudo contactar a la API de Gemini.', {
      status: 503,
      code: 'network_error',
      hint: 'Revisa tu conexión a internet o si un proxy o firewall bloquea generativelanguage.googleapis.com.'
    });
  }

  return new AppError('Ocurrió un error inesperado al generar el código.', {
    status: 500,
    code: 'unexpected',
    hint: raw ? `Detalle técnico: ${raw.slice(0, 200)}` : null
  });
}
