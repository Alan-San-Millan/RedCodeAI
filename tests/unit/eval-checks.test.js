import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sqlChecks, stringLiterals, NO_INFO } from '../../scripts/lib/eval-checks.js';

test('stringLiterals separa literales, incluidas comillas triples y prefijos', () => {
  const lits = stringLiterals('a = f"x{y}"\nb = """SELECT 1\nFROM t"""\nc = \'z\'');
  assert.deepEqual(lits.map((l) => l.prefix), ['f', '', '']);
  assert.match(lits[1].body, /SELECT 1\nFROM t/);
});

test('consulta parametrizada segura: sin concatenación y con marcador', () => {
  const code = `def login(conn, user, pw):
    cur = conn.execute("SELECT hash FROM users WHERE username = ?", (user,))
    logger.info(f"intento de acceso de {user}")
    return check_password_hash(cur.fetchone()[0], pw)`;
  const s = sqlChecks(code);
  assert.equal(s.noConcatenation, true, 'el f-string del log no debe contar como SQL');
  assert.equal(s.hasPlaceholder, true);
  assert.equal(s.comparesAgainstHash, true);
});

test('detecta las cuatro formas de armar SQL con datos del usuario', () => {
  const unsafe = [
    'q = f"SELECT * FROM users WHERE name = \'{user}\'"',
    'q = "SELECT * FROM users WHERE name = \'" + user + "\'"',
    'q = "SELECT * FROM users WHERE name = \'%s\'" % user',
    'q = "SELECT * FROM users WHERE name = \'{}\'".format(user)'
  ];
  for (const code of unsafe) assert.equal(sqlChecks(code).noConcatenation, false, code);
});

test('sin ninguna sentencia SQL no se da por buena la prueba', () => {
  assert.equal(sqlChecks('def f():\n    return 1').noConcatenation, false);
});

test('NO_INFO reconoce descargos típicos', () => {
  assert.ok(NO_INFO.test('Las fuentes disponibles no cubren COBOL.'));
  assert.ok(NO_INFO.test('No tengo información sobre una edición de 2027.'));
  assert.ok(!NO_INFO.test('Usa MAYÚSCULAS con guiones bajos para las constantes.'));
});
