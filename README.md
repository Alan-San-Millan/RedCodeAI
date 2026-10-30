# ReqCode AI

Prototipo funcional de un servicio que traduce **requerimientos de software escritos en lenguaje natural** a **código funcional**, usando Google Gemini como motor generativo.

Escribes un requerimiento como *"necesito una función que reciba una lista de números y calcule el promedio, ignorando los valores negativos"*, eliges el lenguaje destino y el servicio devuelve el código con resaltado de sintaxis, una explicación en lenguaje natural de la lógica implementada y una prueba unitaria sugerida.

> Para el historial de decisiones de diseño, bugs encontrados y cambios realizados, ver [CHANGELOG.md](CHANGELOG.md).

---

## Cómo obtener una API key gratuita de Gemini

1. Entra a **<https://aistudio.google.com/apikey>** e inicia sesión con tu cuenta de Google.
2. Pulsa **Create API key** (crear clave de API). Si te pide un proyecto de Google Cloud, deja el que te ofrece por defecto.
3. Copia la clave. Las claves de Google AI Studio empiezan con `AIza`.
4. Pégala en el archivo `.env` de este proyecto:

   ```env
   GEMINI_API_KEY=AIza...tu_clave...
   ```

No hace falta tarjeta de crédito ni activar facturación: la [capa gratuita](https://ai.google.dev/gemini-api/docs/pricing) cubre de sobra el uso de este prototipo. Sí tiene límites de solicitudes por minuto y por día; si los alcanzas, la aplicación te lo dirá con un mensaje claro.

> La clave es personal y secreta. Nunca la escribas dentro del código ni la subas a un repositorio: `.env` está incluido en `.gitignore`.

---

## Instalación y ejecución en local

Necesitas **Node.js 20 o superior** (probado con Node 22).

```bash
npm install
```

Copia la plantilla de variables de entorno y coloca tu clave:

```bash
copy .env.example .env
```

Arranca el servidor:

```bash
npm start
```

Abre <http://localhost:3000>.

Para desarrollo, con recarga automática al guardar:

```bash
npm run dev
```

En Windows también puedes hacer doble clic en **`INICIAR_WINDOWS.bat`**: verifica el `.env`, instala dependencias si faltan, abre el navegador y levanta el servidor.

---

## Variables de entorno

| Variable | Por defecto | Para qué sirve |
|---|---|---|
| `GEMINI_API_KEY` | *(vacía)* | Tu clave de Google AI Studio. **Obligatoria.** |
| `GEMINI_MODEL` | `gemini-3.6-flash` | Modelo de Gemini. Es el que respondió de forma estable en las pruebas end-to-end de este proyecto con salida estructurada. Alternativas en capa gratuita: `gemini-3.7-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite` (durante las pruebas devolvieron 503 "high demand" con `responseSchema`; suele ser temporal). |
| `GEMINI_TEMPERATURE` | `0.2` | Temperature por defecto del generador. Se puede ajustar desde la interfaz sin reiniciar. |
| `GEMINI_TIMEOUT_MS` | `90000` | Milisegundos antes de cancelar una solicitud que no responde. |
| `PORT` | `3000` | Puerto del servidor web. |
| `RAG_ENABLED` | `true` | Activa la recuperación documental. Con `false`, todas las respuestas salen "sin respaldo documental". |
| `GEMINI_EMBEDDING_MODEL` | `gemini-embedding-001` | Modelo de embeddings. Debe ser el mismo con el que se generó `data/rag-index.json`. |
| `RAG_TOP_K` | `5` | Máximo de fragmentos que llegan al prompt. |
| `RAG_MIN_SCORE` | `0.60` | Similitud coseno mínima para usar un fragmento. Calibrada con `npm run calibrate` (ver CHANGELOG). |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | `10` / `60000` | Solicitudes permitidas a `/api/generate` por IP y ventana. |
| `RAG_TEST_CAPTURE`, `RAG_TEST_MODE`, `RAG_TEST_FORCE_IDS` | *(apagados)* | **Solo para `npm run eval`.** Nunca los actives en uso normal. |

> **Los nombres de modelo cambian con frecuencia.** `gemini-1.5-flash` y `gemini-2.0-flash` ya fueron retirados, y `gemini-2.5-flash` dejó de estar disponible para API keys nuevas (los tres devuelven 404). La lista vigente está en <https://ai.google.dev/gemini-api/docs/models>. Si `GEMINI_MODEL` devuelve 503 "high demand" de forma persistente, es un problema de capacidad temporal de Google, no de tu configuración: espera unos minutos o prueba con otro modelo de la lista.

---

## Cómo funciona

```
Requerimiento en lenguaje natural
          ↓
   Validación en el servidor        (longitud, lenguaje del catálogo, temperature, límite por IP)
          ↓
   Detector de secretos             (claves, contraseñas y correos → [REDACTED:...])
          ↓
   Recuperación RAG                 (embedding + palabras clave → fusión → umbral → 3-5 fragmentos)
          ↓
   Prompt de sistema + fuentes      (<fuente id="..."> como material de referencia, nunca como órdenes)
          ↓
   Gemini                           (responseSchema: salida estructurada en JSON)
          ↓
   Verificación de citas            (se descarta toda cita que no corresponda a un fragmento recuperado)
          ↓
   Interfaz: código, explicación, fuentes citadas, "sin respaldo documental", avisos
```

### El prompt de sistema y las tres funciones del modelo

El prompt de sistema (en [`src/prompts/system-prompt.js`](src/prompts/system-prompt.js)) está dividido explícitamente en las tres funciones que la arquitectura conceptual del servicio le asigna al LLM:

1. **Comprensión del requerimiento (NLU).** Identifica el artefacto pedido, las estructuras de datos de entrada y salida, las condiciones y filtros, y los casos borde implícitos. Se le indica explícitamente que dos elementos nunca pueden perderse: el **lenguaje objetivo** y las **condiciones de filtrado**, porque omitir cualquiera produce código incorrecto aunque el resto parezca razonable. El resultado de esta función se muestra en la interfaz, en el bloque *Comprensión del requerimiento*.
2. **Generación de código.** Código completo y ejecutable en el lenguaje elegido, siguiendo las convenciones de ese lenguaje (PEP 8 en Python, gofmt en Go, PSR-12 en PHP…), resolviendo los casos borde detectados en el paso anterior.
3. **Documentación y explicación.** De 2 a 4 frases sobre la lógica implementada, más una prueba unitaria mínima en el framework idiomático del lenguaje.

Si el texto no describe un requerimiento resoluble, el modelo devuelve `status: "unclear"` y explica qué información falta, en lugar de inventar un requerimiento plausible.

### Formato de respuesta

En vez de pedir markdown y partirlo con expresiones regulares, la respuesta se fija con un **`responseSchema`** de Gemini: el modelo devuelve siempre un JSON con los mismos campos (`code`, `explanation`, `suggestedTest`, `dataStructures`, `conditions`, `edgeCases`, `assumptions`…). El frontend nunca tiene que adivinar dónde termina el código y dónde empieza la prosa. `propertyOrdering` obliga además a resolver la comprensión antes de escribir el código, que es el orden en el que el modelo razona mejor.

Se conserva un parser de markdown como respaldo por si se configura un modelo sin soporte de salida estructurada.

### Parámetro de inferencia: `temperature`

La temperature es ajustable desde la interfaz, con un valor por defecto **bajo (0.2)**. Es una decisión de ingeniería, no un detalle: el propósito del servicio es producir código **correcto y reproducible**, y una temperature alta introduce variabilidad indeseada que afecta la confiabilidad.

| Configuración | Rango | Comportamiento | ¿Sirve para este servicio? |
|---|---|---|---|
| Conservadora | 0.1 – 0.3 | Determinista, coherente, poca variedad entre ejecuciones | **Sí** — es lo que usamos para generar código |
| Equilibrada | 0.5 – 0.7 | Balance entre coherencia y variedad | Parcial — solo tendría sentido para la explicación |
| Creativa | 0.9 – 1.2 | Alta variabilidad, riesgo de errores sintácticos | No — poco confiable para código |

El deslizador de la interfaz muestra en qué régimen estás en cada momento.

> **Nota sobre los modelos Gemini 3.x.** Google [recomienda mantener `temperature` en 1.0](https://ai.google.dev/gemini-api/docs/gemini-3) para la familia Gemini 3, porque bajarla puede provocar bucles o degradar el rendimiento en tareas de razonamiento. En las pruebas de este proyecto, `gemini-3.6-flash` con `temperature: 0.2` generó código correcto y consistente en cada intento, así que se mantuvo como valor por defecto — pero si notas resultados erráticos con otro modelo Gemini 3.x, prueba a subir la temperature.

---

## RAG: recuperación documental

Para que el código generado se apoye en guías verificables y no solo en lo que el modelo aprendió, cada solicitud recupera hasta 5 fragmentos de un corpus versionado en [`knowledge/`](knowledge/):

| Fuente | Qué aporta |
|---|---|
| OWASP Secure Coding Practices v2.1 | 214 prácticas de codificación segura en 14 categorías |
| CWE Top 25 2025 | Descripción y mitigaciones de las 25 debilidades más peligrosas |
| PEP 8 | Convenciones de estilo de Python |
| CHANGELOG del proyecto | Errores reales del código generado (p. ej., la tabla UTF-8 escrita a mano en C) |

Las licencias y atribuciones están en [`knowledge/README.md`](knowledge/README.md).

**Cómo funciona.** Los documentos se fragmentan por estructura (no por número de caracteres), se convierten en embeddings con `gemini-embedding-001` a 768 dimensiones (normalizados) y se guardan en `data/rag-index.json`, que viene incluido en el repositorio. En cada solicitud se combinan la similitud coseno y una búsqueda por palabras clave (BM25, con un glosario técnico español→inglés porque el corpus está en inglés), se fusionan con *reciprocal rank fusion* y se descartan los fragmentos bajo el umbral. Si ninguno lo supera, la respuesta se marca **"sin respaldo documental"**.

**Comandos.**

```bash
npm run ingest
```

Regenera el índice. Hace falta después de cambiar `knowledge/` o `GEMINI_EMBEDDING_MODEL`. Reutiliza los embeddings de los fragmentos que no cambiaron, así que una actualización pequeña cuesta pocas llamadas.

```bash
npm run calibrate
```

Solo recuperación, sin generar: imprime los puntajes de las consultas de la matriz de pruebas para calibrar `RAG_MIN_SCORE`.

Para regenerar `knowledge/` desde las fuentes oficiales: `node scripts/build-corpus.js` (requiere `pdftotext`, incluido en Git para Windows).

**Límites conocidos del RAG** (detalle y datos en el CHANGELOG):

- El umbral mide **parecido de tema**, no si las fuentes responden la pregunta. Una consulta sobre "nombres de variables en COBOL" se parece mucho a PEP 8 y supera el umbral. Que el modelo reconozca que sus fuentes no cubren algo depende del prompt, no de la recuperación.
- El corpus está en inglés y la interfaz en español; la búsqueda por palabras clave depende de un glosario fijo.
- La cuota gratuita de embeddings respondió 429 tras ~100 textos en menos de un minuto; la ingesta reintenta con pausas.

---

## Seguridad y publicación

- **Detector de secretos.** Antes de enviar nada a Gemini (ni el embedding de la consulta ni la generación), el servidor enmascara claves de API (`AIza…`, `AQ.…`, `sk-…`, `AKIA…`, `gh*_…`), llaves privadas, asignaciones del tipo `password = "..."`, `secret: '...'`, `token=...` y correos electrónicos. La interfaz avisa qué se enmascaró. Es una red de seguridad, no una garantía: **no pegues secretos reales**.
- **Límite de solicitudes** por IP en `/api/generate` (en memoria).
- **Las fuentes son datos, no órdenes.** El prompt lo dice explícitamente, y la ingesta excluye los fragmentos con frases imperativas dirigidas al modelo.
- **No se registran cuerpos de solicitud** en la consola.
- **HSTS y `upgrade-insecure-requests` están desactivados** porque el prototipo corre en HTTP local. **Al desplegarlo detrás de HTTPS hay que reactivarlos** en `server.js` (`hsts: true` y quitar `upgradeInsecureRequests: null`).

---

## Pruebas automatizadas

```bash
npm test
```

Pruebas unitarias con `node:test`, sin dependencias, de las partes deterministas: fragmentación, normalización, similitud coseno, BM25, fusión, glosario, filtro de inyección, detector de secretos, límite de solicitudes, verificador de citas y las propias verificaciones de la evaluación.

```bash
npm run eval
```

Ejecuta la matriz de 10 pruebas del Anexo A (normales, ambiguas, sin evidencia, maliciosas y no autorizadas), 3 veces cada una, contra el endpoint real. Levanta sus propias instancias del servidor, guarda los resultados crudos en `tests/rag-eval/results/` y escribe el informe en [`docs/matriz-resultados.md`](docs/matriz-resultados.md). Consume ~30 llamadas de generación de tu cuota.

---

## Manejo de errores

Ningún error crudo de la API llega a la interfaz. Todos se traducen en [`src/lib/errors.js`](src/lib/errors.js) a un mensaje accionable, con una pista sobre cómo resolverlo:

| Situación | Qué ve el usuario |
|---|---|
| Requerimiento vacío o de menos de 15 caracteres | Cuántos caracteres faltan y un ejemplo de requerimiento bien redactado |
| Falta `GEMINI_API_KEY` en el servidor | Instrucción para copiar `.env.example` y de dónde sacar la clave |
| API key inválida o revocada (401/403) | Aviso de clave rechazada y enlace a AI Studio para generar otra |
| Modelo inexistente (404) | Recordatorio de que los nombres de modelo cambian, con el enlace a la lista vigente |
| Cuota gratuita agotada (429) | Explicación de los límites por minuto y por día, y qué modelo usar mientras tanto |
| Gemini caído o error interno (5xx) | Aviso de interrupción temporal del lado de Google |
| Sin conexión o proxy bloqueando | Sugerencia de revisar red, proxy o firewall |
| Tiempo de espera agotado | Sugerencia de acortar el requerimiento |
| Respuesta bloqueada por filtros de contenido | Sugerencia de reformular |
| Requerimiento demasiado ambiguo | El propio modelo explica qué información falta |

---

## Estructura del proyecto

```
.
├── server.js                        Servidor Express: estáticos, rutas API y respuestas de error
├── src/
│   ├── config.js                    Variables de entorno y catálogo de lenguajes soportados
│   ├── lib/errors.js                Traducción de cualquier fallo a un mensaje accionable
│   ├── prompts/system-prompt.js     Prompt de sistema: tres funciones, fuentes y solicitudes no autorizadas
│   ├── rag/                         Fragmentación, embeddings, BM25, fusión, recuperador, citas, filtro de inyección
│   ├── security/                    Detector de secretos, límite de solicitudes, modo captura de la evaluación
│   └── services/
│       ├── generate.service.js      Flujo de una solicitud: secretos → recuperación → generación → citas
│       └── gemini.service.js        Único punto de contacto con la generación de Gemini
├── knowledge/                       Corpus documental (Markdown con metadatos) y atribuciones
├── data/rag-index.json              Índice de embeddings (npm run ingest)
├── scripts/                         build-corpus, ingest, calibrate, eval
├── tests/unit/                      Pruebas unitarias (npm test)
├── tests/rag-eval/                  Casos, calibración y resultados de la matriz (npm run eval)
├── docs/matriz-resultados.md        Informe de la última evaluación
├── public/
│   ├── index.html
│   ├── css/styles.css
│   └── js/app.js                    Estado en memoria, historial de sesión y render del resultado
├── .env.example
└── INICIAR_WINDOWS.bat
```

### API interna

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/config` | Modelo configurado, si hay API key, lenguajes disponibles y límites. Es la única fuente de verdad del selector de lenguajes. |
| `POST` | `/api/generate` | Recibe `{ requirement, language, temperature }` y devuelve `status` (`ok`, `answer`, `unclear`, `refused`), el código, la explicación, la prueba sugerida, la comprensión del requerimiento, las `references` verificadas, `grounded` y el detalle de la recuperación. |

La API key **solo existe en el servidor**. El navegador nunca la ve, así que no aparece en las herramientas de desarrollo ni en el código fuente de la página.

`highlight.js` se sirve desde el propio servidor (`/vendor/hljs`) y no desde un CDN: la política de seguridad de contenido de `helmet` sigue siendo estricta (`script-src 'self'`) y la interfaz funciona sin conexión a internet.

---

## Lenguajes soportados

Python (por defecto), JavaScript, TypeScript, Java, C#, Go, Rust, C, C++, PHP, Ruby, Kotlin, Swift, SQL y Bash.

Para agregar uno más, basta con añadirlo al arreglo `LANGUAGES` de [`src/config.js`](src/config.js); el selector de la interfaz y la validación del servidor se actualizan solos.

---

## Pruebas realizadas

El flujo completo (requerimiento → Gemini → código + explicación) se probó de punta a punta con una API key real de Google AI Studio:

1. **El caso de la presentación** ("una función en Python que reciba una lista de números y calcule el promedio, ignorando los valores negativos"): generó una función que filtra negativos, devuelve `0.0` en lista vacía o sin elementos válidos, y una prueba con 4 aserciones cubriendo el caso general, ceros, todos negativos y lista vacía.
2. **Un requerimiento más complejo en otro lenguaje** (una clase `Carrito` en TypeScript con alta/baja de productos por id y descuento porcentual opcional): generó una clase completa con validaciones de precio y descuento, y una prueba con `node:test`.
3. **Un requerimiento deliberadamente ambiguo** ("quiero que funcione mejor y sea más rápido"): el modelo devolvió `status: "unclear"` sin inventar un requerimiento, explicando qué información hacía falta — validando el manejo de esta situación en la interfaz.

También se verificó en el navegador: el flujo completo de generación con la interfaz real, el cambio entre las pestañas Código/Explicación/Prueba sugerida, el resaltado de sintaxis, y la recuperación automática de un error transitorio de Gemini (503 "high demand") con el botón **Reintentar**.

## Alcance de este prototipo

**Incluido:** entrada del requerimiento, selección de lenguaje, temperature ajustable, recuperación documental (RAG) con citas verificadas, detector de secretos, límite de solicitudes, código con resaltado de sintaxis, explicación, prueba unitaria sugerida, historial de la sesión y manejo de errores.

**Fuera de alcance (posible fase 2):**

- Visualización de tokens, embeddings y mapas de atención en la interfaz.
- Autenticación de usuarios o roles (el documento técnico los propone para publicar; este prototipo sigue siendo local).
- Base de datos vectorial (el índice JSON en memoria basta para unos cientos de fragmentos).
- Historial persistente en base de datos (hoy vive en memoria y se pierde al recargar).
- Selección entre varios modelos o proveedores de IA.
- Llamada separada para la explicación con una temperature más alta (~0.4–0.5): duplicaría la latencia y el consumo de la cuota gratuita, así que el prototipo usa una sola llamada.
- Ejecución o validación automática del código generado en un entorno aislado.

**El código generado no está verificado.** Es el primer borrador funcional de un requerimiento, no un artefacto listo para producción: revísalo y ejecuta la prueba sugerida antes de usarlo.
