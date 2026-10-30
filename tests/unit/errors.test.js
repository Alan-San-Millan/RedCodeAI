import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toUserError } from '../../src/lib/errors.js';

// Forma del error del SDK: el cuerpo JSON de la API va dentro de message.
const apiError = (quotaId) => ({
  status: 429,
  message: `got status: 429 Too Many Requests. {"error":{"code":429,"status":"RESOURCE_EXHAUSTED","details":[{"violations":[{"quotaMetric":"generativelanguage.googleapis.com/generate_content_free_tier_requests","quotaId":"${quotaId}","quotaValue":"20"}]},{"retryDelay":"48331s"}]}}`
});

test('429 de cuota diaria se distingue con su propio código', () => {
  const e = toUserError(apiError('GenerateRequestsPerDayPerProjectPerModel-FreeTier'));
  assert.equal(e.status, 429);
  assert.equal(e.code, 'daily_quota_exceeded');
});

test('429 de cuota por minuto sigue siendo quota_exceeded (se puede reintentar)', () => {
  const e = toUserError(apiError('GenerateRequestsPerMinutePerProjectPerModel-FreeTier'));
  assert.equal(e.code, 'quota_exceeded');
});

test('429 sin detalle de cuota cae en quota_exceeded', () => {
  assert.equal(toUserError({ status: 429, message: 'Too Many Requests' }).code, 'quota_exceeded');
});

test('también reconoce el JSON con comillas escapadas', () => {
  const e = toUserError({ status: 429, message: 'ERR 429 \\"quotaId\\":\\"GenerateRequestsPerDayPerProjectPerModel-FreeTier\\"' });
  assert.equal(e.code, 'daily_quota_exceeded');
});
