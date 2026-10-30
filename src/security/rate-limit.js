import { AppError } from '../lib/errors.js';

/**
 * Límite de solicitudes por IP en memoria, con ventana fija (OWASP LLM10, consumo sin
 * límite). Suficiente para un solo proceso; con varios procesos haría falta un almacén
 * compartido.
 */
export function createRateLimiter({ max, windowMs, now = () => Date.now() }) {
  const hits = new Map();

  return function check(key) {
    const t = now();
    let entry = hits.get(key);
    if (!entry || t >= entry.resetAt) {
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    // Limpieza ocasional para que el mapa no crezca sin control.
    if (hits.size > 5000) for (const [k, v] of hits) if (t >= v.resetAt) hits.delete(k);
    return { allowed: entry.count <= max, remaining: Math.max(0, max - entry.count), retryAfterMs: entry.resetAt - t };
  };
}

export function rateLimitMiddleware(options) {
  const check = createRateLimiter(options);
  return (req, res, next) => {
    const result = check(req.ip || 'desconocida');
    res.setHeader('RateLimit-Remaining', String(result.remaining));
    if (result.allowed) return next();
    const seconds = Math.ceil(result.retryAfterMs / 1000);
    res.setHeader('Retry-After', String(seconds));
    const error = new AppError(`Hiciste demasiadas solicitudes seguidas. Espera ${seconds} s y vuelve a intentarlo.`, {
      status: 429,
      code: 'rate_limited',
      hint: `Este prototipo permite ${options.max} solicitudes cada ${Math.round(options.windowMs / 1000)} s por usuario para no agotar la cuota gratuita de Gemini.`
    });
    return res.status(429).json({ error: error.message, hint: error.hint, code: error.code });
  };
}
