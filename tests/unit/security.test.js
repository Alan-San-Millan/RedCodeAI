import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskSecrets } from '../../src/security/secrets.js';
import { createRateLimiter } from '../../src/security/rate-limit.js';

test('enmascara claves de API con formato real', () => {
  const input = [
    'google = "AIzaSyD-FAKEKEY-DO-NOT-USE-0123456789ab"',
    'nueva = AQ.Ab8RN6I2-FAKE-FAKE-FAKE-FAKE-FAKE-FAKE-FAKE-1234',
    'openai = sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
    'aws = AKIAIOSFODNN7EXAMPLE'
  ].join('\n');
  const { text, findings } = maskSecrets(input);
  assert.doesNotMatch(text, /AIzaSy|AQ\.Ab8|sk-proj|AKIAIOSFODNN7EXAMPLE/);
  assert.ok(findings.some((f) => f.type === 'google-api-key' && f.count === 2));
});

test('enmascara asignaciones de contraseñas, secretos y tokens', () => {
  const cases = [
    ['password = "Sup3rS3cret!"', 'Sup3rS3cret!'],
    ["secret = 'mi-secreto-123'", 'mi-secreto-123'],
    ['"api_key": "abc123xyz"', 'abc123xyz'],
    ['DB_PASSWORD=hunter2hunter2', 'hunter2hunter2'],
    ['token: s3cr3tT0kenValue', 's3cr3tT0kenValue']
  ];
  for (const [input, secret] of cases) {
    const { text, masked } = maskSecrets(input);
    assert.ok(masked, input);
    assert.ok(!text.includes(secret), `${input} → ${text}`);
  }
});

test('no toca código legítimo que nombra contraseñas sin contener una', () => {
  for (const input of ['def login(password: str) -> bool:', 'password = get_password()', 'token: str', 'if password is None:']) {
    const { text, masked } = maskSecrets(input);
    assert.equal(masked, false, input);
    assert.equal(text, input);
  }
});

test('enmascara llaves privadas y correos', () => {
  const key = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA\n-----END RSA PRIVATE KEY-----';
  const { text } = maskSecrets(`${key}\ncontacto: ana.perez@ejemplo.com`);
  assert.doesNotMatch(text, /MIIEpAIBAAKCAQEA|ana\.perez/);
  assert.match(text, /\[REDACTED:private-key\]/);
  assert.match(text, /\[REDACTED:email\]/);
});

test('el límite de solicitudes bloquea al pasar el máximo y se reinicia con la ventana', () => {
  let t = 0;
  const check = createRateLimiter({ max: 2, windowMs: 1000, now: () => t });
  assert.equal(check('ip').allowed, true);
  assert.equal(check('ip').allowed, true);
  assert.equal(check('ip').allowed, false);
  assert.equal(check('otra-ip').allowed, true);
  t = 1000;
  assert.equal(check('ip').allowed, true);
});
