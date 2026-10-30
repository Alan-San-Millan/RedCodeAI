/* ReqCode AI — interfaz del prototipo. Todo el estado vive en memoria. */

const $ = (id) => document.getElementById(id);

const state = {
  config: null,
  languages: [],
  history: [],
  activeId: null,
  busy: false
};

const LOADING_STEPS = [
  'Comprendiendo el requerimiento.',
  'Identificando estructuras de datos y condiciones.',
  'Generando el código en el lenguaje destino.',
  'Redactando la explicación y la prueba sugerida.'
];

let loadingTimer = null;
let toastTimer = null;

init();

async function init() {
  bindEvents();
  updateCharCount();
  updateTemperatureHint();

  try {
    const response = await fetch('/api/config');
    if (!response.ok) throw new Error('config');
    state.config = await response.json();
    applyConfig(state.config);
  } catch {
    setStatus('error', 'Servidor no disponible');
  }
}

function applyConfig(config) {
  state.languages = config.languages;

  $('language').innerHTML = config.languages
    .map((language) => `<option value="${language.id}">${escapeHtml(language.label)}</option>`)
    .join('');
  $('language').value = config.defaultLanguage;

  $('temperature').value = config.defaultTemperature;
  updateTemperatureHint();

  $('statusModel').textContent = config.model;
  $('requirement').maxLength = config.limits.maxRequirementLength;

  if (config.apiKeyConfigured) {
    setStatus('ready', 'Gemini conectado');
  } else {
    setStatus('error', 'Falta la API key');
    showError(
      'El servidor no tiene una API key de Gemini.',
      'Copia .env.example como .env y coloca tu clave gratuita de aistudio.google.com/apikey en GEMINI_API_KEY. Después reinicia el servidor.'
    );
  }
}

function bindEvents() {
  $('generateBtn').addEventListener('click', generate);
  $('retryBtn').addEventListener('click', generate);
  $('clearBtn').addEventListener('click', () => {
    $('requirement').value = '';
    updateCharCount();
    $('requirement').focus();
  });

  $('requirement').addEventListener('input', updateCharCount);
  $('requirement').addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') generate();
  });

  $('temperature').addEventListener('input', updateTemperatureHint);

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => selectTab(tab.dataset.tab));
  });

  $('copyCodeBtn').addEventListener('click', () => copy($('codeBlock').textContent, 'Código copiado.'));
  $('copyTestBtn').addEventListener('click', () => copy($('testBlock').textContent, 'Prueba copiada.'));
}

/* ── Composer ─────────────────────────────────────────────── */

function updateCharCount() {
  const length = $('requirement').value.trim().length;
  const min = state.config?.limits.minRequirementLength ?? 15;
  const counter = $('charCount');

  counter.textContent = length === 0
    ? '0 caracteres'
    : `${length} caracteres${length < min ? ` · faltan ${min - length}` : ''}`;
  counter.classList.toggle('warn', length > 0 && length < min);
}

function updateTemperatureHint() {
  const value = Number($('temperature').value);
  $('temperatureValue').textContent = value.toFixed(2);

  // Los tres regímenes de la tabla de parámetros de inferencia.
  let hint = 'Creativa: alta variabilidad y más riesgo de errores de sintaxis.';
  if (value <= 0.3) hint = 'Conservadora: código determinista y consistente entre ejecuciones.';
  else if (value <= 0.7) hint = 'Equilibrada: algo de variedad; útil para la explicación, no para el código.';
  $('temperatureHint').textContent = hint;
}

/* ── Generación ───────────────────────────────────────────── */

async function generate() {
  if (state.busy) return;

  const requirement = $('requirement').value.trim();
  const min = state.config?.limits.minRequirementLength ?? 15;

  if (!requirement) {
    toast('Escribe primero el requerimiento.', 'error');
    $('requirement').focus();
    return;
  }
  if (requirement.length < min) {
    toast(`Describe el requerimiento con al menos ${min} caracteres.`, 'error');
    $('requirement').focus();
    return;
  }

  setBusy(true);
  showLoading();

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requirement,
        language: $('language').value,
        temperature: Number($('temperature').value)
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      showError(data.error || 'La solicitud no pudo completarse.', data.hint);
      return;
    }

    const entry = {
      id: `req-${Date.now()}`,
      requirement,
      createdAt: new Date(),
      result: data
    };
    state.history.unshift(entry);
    renderHistory();
    showResult(entry);
  } catch {
    showError(
      'No se pudo contactar al servidor.',
      'Comprueba que el proceso de Node siga en ejecución en la terminal donde iniciaste el proyecto.'
    );
  } finally {
    setBusy(false);
  }
}

function setBusy(busy) {
  state.busy = busy;
  $('generateBtn').disabled = busy;
  $('generateBtn').querySelector('span').textContent = busy ? 'Generando…' : 'Generar código';
}

/* ── Estados de la salida ─────────────────────────────────── */

function showState(id) {
  ['stateIdle', 'stateLoading', 'stateError', 'result'].forEach((candidate) => {
    $(candidate).classList.toggle('hidden', candidate !== id);
  });
  if (loadingTimer && id !== 'stateLoading') {
    clearInterval(loadingTimer);
    loadingTimer = null;
  }
}

function showLoading() {
  showState('stateLoading');
  let step = 0;
  $('loadingText').textContent = LOADING_STEPS[0];
  loadingTimer = setInterval(() => {
    step = (step + 1) % LOADING_STEPS.length;
    $('loadingText').textContent = LOADING_STEPS[step];
  }, 2600);
}

function showError(message, hint, title = 'No se pudo generar el código') {
  showState('stateError');
  $('errorTitle').textContent = title;
  $('errorText').textContent = message;
  $('errorHint').textContent = hint || '';
  $('errorHint').classList.toggle('hidden', !hint);
}

function showResult(entry) {
  const result = entry.result;
  state.activeId = entry.id;
  renderHistory();

  // Requerimiento demasiado vago para resolverse: el modelo lo dice explícitamente.
  if (result.status === 'unclear') {
    showError('El requerimiento no es suficiente para generar código.', result.explanation, 'Falta información');
    notifySecrets(result);
    return;
  }
  // Fuera de alcance o no autorizado (revelar el prompt, credenciales, etc.).
  if (result.status === 'refused') {
    showError('La solicitud está fuera de lo que ReqCode AI puede hacer.', result.explanation, 'Solicitud rechazada');
    notifySecrets(result);
    return;
  }

  showState('result');
  $('resultTitle').textContent = result.title;
  $('resultArtifact').textContent = [result.artifact, result.languageLabel].filter(Boolean).join(' · ');

  const meta = [
    result.meta.model,
    `temp ${result.meta.temperature}`,
    `${(result.meta.elapsedMs / 1000).toFixed(1)} s`
  ];
  if (result.meta.tokens) meta.push(`${result.meta.tokens} tokens`);
  $('resultMeta').innerHTML = meta.map((item) => `<li>${escapeHtml(item)}</li>`).join('');

  renderGrounding(result);
  renderSecretsNotice(result);
  renderComprehension(result);
  renderCode($('codeBlock'), result.code, result.highlight);
  $('codeLang').textContent = result.languageLabel;
  // Una respuesta a una pregunta de convenciones puede no traer código.
  const hasCode = Boolean(result.code);
  document.querySelector('.tab[data-tab="code"]').classList.toggle('hidden', !hasCode);

  $('explanationText').textContent = result.explanation;
  const hasAssumptions = result.assumptions.length > 0;
  $('assumptionsBox').classList.toggle('hidden', !hasAssumptions);
  if (hasAssumptions) {
    $('assumptionsList').innerHTML = result.assumptions.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  }

  const hasTest = Boolean(result.suggestedTest);
  $('testEmpty').classList.toggle('hidden', hasTest);
  $('panelTest').querySelector('.code-bar').classList.toggle('hidden', !hasTest);
  $('panelTest').querySelector('pre').classList.toggle('hidden', !hasTest);
  if (hasTest) {
    renderCode($('testBlock'), result.suggestedTest, result.highlight);
    $('testLang').textContent = `Prueba · ${result.languageLabel}`;
  }
  document.querySelector('.tab[data-tab="test"]').classList.toggle('hidden', !hasTest && result.status === 'answer');

  renderReferences(result.references || []);
  selectTab(hasCode ? 'code' : 'explanation');
}

function renderGrounding(result) {
  const box = $('grounding');
  box.replaceChildren();
  const badge = document.createElement('span');
  const count = (result.references || []).length;
  if (result.grounded === false) {
    badge.className = 'badge ungrounded';
    badge.textContent = 'Sin respaldo documental';
    badge.title = result.retrieval?.error || 'Ningún fragmento de las fuentes superó el umbral de similitud: la respuesta se basa solo en el conocimiento general del modelo.';
  } else {
    badge.className = 'badge grounded';
    badge.textContent = count ? `Respaldo documental · ${count} fuente${count === 1 ? '' : 's'} citada${count === 1 ? '' : 's'}` : 'Fuentes recuperadas, ninguna citada';
  }
  box.append(badge);
}

function renderSecretsNotice(result) {
  const notice = (result.notices || []).find((n) => n.type === 'secrets-masked');
  $('secretsNotice').textContent = notice ? notice.message : '';
  $('secretsNotice').classList.toggle('hidden', !notice);
}

function notifySecrets(result) {
  const notice = (result.notices || []).find((n) => n.type === 'secrets-masked');
  if (notice) toast(notice.message, 'error');
}

function renderReferences(references) {
  const list = $('referencesList');
  list.replaceChildren();
  $('referencesBox').classList.toggle('hidden', references.length === 0);
  for (const ref of references) {
    const item = document.createElement('li');
    const id = document.createElement('code');
    id.textContent = ref.id;
    const source = document.createElement('span');
    source.className = 'ref-source';
    source.textContent = [ref.source, ref.section].filter(Boolean).join(' — ');
    item.append(id, source);
    if (ref.applied) {
      const applied = document.createElement('p');
      applied.textContent = ref.applied;
      item.append(applied);
    }
    // La URL viene de los metadatos del índice, no del modelo; aun así solo se aceptan https.
    if (/^https:\/\//.test(ref.url || '')) {
      const link = document.createElement('a');
      link.href = ref.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Ver fuente oficial';
      item.append(link);
    }
    list.append(item);
  }
}

function renderComprehension(result) {
  const cards = [
    { title: 'Artefacto', items: result.artifact ? [result.artifact] : [] },
    { title: 'Estructuras de datos', items: result.dataStructures },
    { title: 'Condiciones detectadas', items: result.conditions },
    { title: 'Casos borde', items: result.edgeCases }
  ].filter((card) => card.items.length > 0);

  $('comprehension').classList.toggle('hidden', cards.length === 0);
  $('comprehensionGrid').innerHTML = cards
    .map((card) => `
      <div class="comp-card">
        <h4>${escapeHtml(card.title)}</h4>
        <ul>${card.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </div>`)
    .join('');
}

function renderCode(element, code, language) {
  element.textContent = code;
  element.className = '';
  // hljs se sirve desde el propio servidor; si faltara, el código igual se muestra en texto plano.
  if (window.hljs) {
    const supported = window.hljs.getLanguage(language) ? language : 'plaintext';
    element.innerHTML = window.hljs.highlight(code, { language: supported }).value;
    element.className = 'hljs';
  }
}

function selectTab(name) {
  document.querySelectorAll('.tab').forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  $('panelCode').classList.toggle('hidden', name !== 'code');
  $('panelExplanation').classList.toggle('hidden', name !== 'explanation');
  $('panelTest').classList.toggle('hidden', name !== 'test');
}

/* ── Historial en memoria ─────────────────────────────────── */

function renderHistory() {
  const list = $('historyList');
  $('historyEmpty').classList.toggle('hidden', state.history.length > 0);

  list.innerHTML = state.history
    .map((entry) => `
      <li>
        <button type="button" class="history-item ${entry.id === state.activeId ? 'active' : ''}" data-id="${entry.id}">
          <strong>${escapeHtml(entry.result.title)}</strong>
          <span class="tag">${escapeHtml(entry.result.language)}</span>
          <span>${formatTime(entry.createdAt)} · ${escapeHtml(truncate(entry.requirement, 64))}</span>
        </button>
      </li>`)
    .join('');

  list.querySelectorAll('.history-item').forEach((button) => {
    button.addEventListener('click', () => {
      const entry = state.history.find((item) => item.id === button.dataset.id);
      if (!entry) return;
      $('requirement').value = entry.requirement;
      $('language').value = entry.result.language;
      $('temperature').value = entry.result.meta.temperature;
      updateCharCount();
      updateTemperatureHint();
      showResult(entry);
    });
  });
}

/* ── Utilidades ───────────────────────────────────────────── */

function setStatus(stateName, text) {
  $('status').dataset.state = stateName;
  $('statusText').textContent = text;
}

async function copy(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
  } catch {
    toast('El navegador bloqueó el portapapeles.', 'error');
  }
}

function toast(message, type = '') {
  const element = $('toast');
  element.textContent = message;
  element.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.className = 'toast'; }, 3200);
}

function formatTime(date) {
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}
