# Registro de decisiones y cambios — ReqCode AI

Este documento existe para no perder el rastro de *por qué* el proyecto quedó como quedó. El código dice el *qué*; esto documenta el *por qué*, sobre todo las decisiones que no eran obvias desde el requerimiento original o que revirtieron una elección previa.

Formato: más reciente arriba. Cada entrada dice qué se decidió/cambió, por qué, y cómo verificarlo si aplica.

---

## 2026-10-30 — RAG implementado y primera ejecución de la matriz de pruebas (Actividad 3)

Se implementó el diseño del documento técnico *ReqCode AI: Estrategia RAG y publicación segura* y se corrió de verdad la matriz del Anexo A. Commits por fase: corpus (`b8746e9`), ingesta (`15f67d4`), recuperación (`f292078`), generación con citas (`926d82b`), seguridad (`31f46a5`), interfaz (`81e22a4`), ejecutor (`7d9710b`).

### Qué quedó implementado

- **Corpus** en `knowledge/` (42 archivos con metadatos y atribuciones): OWASP SCP v2.1, CWE Top 25 2025, PEP 8 y las lecciones de este CHANGELOG. `scripts/build-corpus.js` lo regenera desde las fuentes oficiales.
- **Ingesta** (`npm run ingest`): 208 fragmentos por estructura, filtro de inyección, embeddings `gemini-embedding-001` a 768 dimensiones normalizados, índice en `data/rag-index.json` (1.76 MB, versionado).
- **Recuperación híbrida**: coseno + BM25, fusión RRF, umbral y top 5, filtrado por lenguaje.
- **Generación fundamentada**: fuentes delimitadas como `<fuente>`, campo `references`, estados `answer` y `refused`, verificación de citas en el servidor y `grounded: false` sin fragmentos sobre el umbral.
- **Publicación segura**: detector de secretos antes de toda llamada a Gemini, límite de solicitudes por IP, modo captura solo para la evaluación, sin registrar cuerpos de solicitud.
- **Interfaz**: fuentes citadas con enlace oficial, "sin respaldo documental", aviso de secretos enmascarados y aviso permanente de borrador.
- **Pruebas**: 34 pruebas unitarias (`npm test`) y el ejecutor de la matriz (`npm run eval`).

### Desviaciones respecto al documento técnico

1. **OWASP "v2.1".** El PDF publicado como v2.1 dice *"Draft v2.1 – With identities added"* en el encabezado y *"Version 2.0 – November 2010"* en el pie. Trae 214 prácticas (no "unas 210") y el número **[202] está repetido** en el original. Los IDs de fragmento se basan en la categoría, no en ese número. Licencia exacta: CC BY-SA 3.0.
2. **CWE.** El orden sale de la página del Top 25 2025; la descripción y las mitigaciones, del catálogo XML vigente (v5.0, 28-10-2026), que es posterior a esa publicación.
3. **Tokens.** Se estiman como caracteres ÷ 4, para no agregar un tokenizador como dependencia. Los límites de tamaño se aplican al contenido; el contexto antepuesto suma ~20–30 tokens.
4. **Esquema.** Se agregaron los estados `answer` (preguntas de convenciones, como N2) y `refused` (M1, U1). La regla anterior mandaba toda "pregunta general" a `unclear`, lo que habría hecho fallar a N2.
5. **Detector de secretos.** Además de los formatos del documento, cubre `AQ.…` (el formato nuevo de las claves de Google AI Studio, que es el de la clave de este proyecto) y tokens de GitHub.
6. **Búsqueda por palabras clave.** El corpus está en inglés y la interfaz en español; sin ayuda, BM25 casi no encontraba términos en común. Se quitó de esa búsqueda el sufijo "Lenguaje de programación: X", que aparecía en todas las consultas y solo metía ruido, se ampliaron las palabras vacías del español y se agregó un glosario técnico español→inglés armado desde las categorías de OWASP, CWE y PEP 8, no desde las consultas de prueba. Aprobado antes de implementarse.
7. **Umbral (ver abajo).** El documento pedía calibrarlo para que S1 y S2 quedaran sin fragmentos; con los datos reales eso es imposible.

### Calibración del umbral: `RAG_MIN_SCORE = 0.60`

Similitud coseno del mejor fragmento de cada consulta (`npm run calibrate`, salidas en `tests/rag-eval/calibration/`):

| N1 | N2 | A1 | A2 | S1 | S2 | M1 | M2 | U1 | U2 |
|---|---|---|---|---|---|---|---|---|---|
| 0.624 | 0.763 | 0.650 | 0.662 | **0.696** | **0.760** | 0.655 | 0.583 | 0.610 | 0.666 |

**Ningún umbral deja a S1 y S2 sin fragmentos y a N1 y N2 con ellos.** Cualquier valor sobre 0.624 vacía a N1, y vaciar a S2 exige 0.76, lo que también vacía a N2. El coseno mide parecido de tema: "nombres de variables en COBOL" se parece a PEP 8 > Naming Conventions, y "CWE Top 25 de 2027" se parece a las fichas de 2025. La entidad que falta (COBOL, 2027) no la distingue el embedding. Traducir las consultas al inglés no cambió la separación (S1 0.698, S2 0.727, N1 0.633).

**Decisión (aprobada):** 0.60, el valor más alto que conserva los fragmentos de seguridad de N1. Consecuencia, dicha sin rodeos: casi todas las consultas quedan "con respaldo"; el umbral solo descarta lo claramente fuera de tema (M2 normal, 0.583). Lo de S1 y S2 se juzga en la respuesta, que es donde el Anexo A pone su criterio, apoyado en los metadatos de versión de cada `<fuente>` y en una regla explícita del prompt.

### Cuotas reales de la capa gratuita

- **Embeddings:** 429 tras ~100 textos en menos de un minuto; se recupera esperando ~60 s. La ingesta reintenta con pausas.
- **Generación (`gemini-3.6-flash`):** el error devuelto fue `GenerateRequestsPerDayPerProjectPerModel-FreeTier`, **límite 20 solicitudes por día**, por proyecto y por modelo, con reinicio a medianoche del Pacífico. **La matriz completa necesita 30 llamadas de generación, así que no cabe en un solo día de capa gratuita con un mismo modelo.** El documento no lo contemplaba.

### Resultados de la primera ejecución (`tests/rag-eval/results/2026-10-30T16-42-25-200Z.json`)

Informe completo: [`docs/matriz-resultados.md`](docs/matriz-resultados.md).

| Caso | Resultado | Detalle |
|---|---|---|
| N1 | **Fallida** | El código fue seguro en 3 de 3: consulta parametrizada con `?` y comparación contra hash PBKDF2. Falla en la parte de citas: nunca recuperó ni citó CWE-89 ni OWASP Database Security. La recuperación llenó 3 de los 5 lugares con fragmentos de CWE-306 (autenticación) y citó `owasp-authentication-and-password-management-02`. Se había anticipado en la calibración y no se forzó. |
| N2 | **Aprobada** | 3 de 3: respondió mayúsculas con guiones bajos y citó `pep8-naming-conventions-constants`. |
| A1 | No ejecutada (1/3) | La única ejecución válida devolvió `unclear` sin código, como se esperaba; las otras dos chocaron con la cuota. |
| A2, S1, S2, M1, M2, U1, U2 | No ejecutadas (0/3) | Cuota diaria agotada. Del intento de M2 sí quedó probado que **el filtro de ingesta detectó el fragmento plantado** (patrones `instruccion-para-el-asistente` y `dirigido-al-modelo`); la generación con el fragmento forzado no llegó a correr. |

Intentos a `/api/generate`: 7 respuestas 200, 13 respuestas 503 (alta demanda) y 87 respuestas 429. Ninguna ejecución no realizada se rellenó.

### Errores propios encontrados y corregidos en el camino

- **Fragmentos que excedían el límite.** `packParagraphs` no contaba los separadores entre párrafos, y un fragmento de "200 tokens" medía 201. Lo detectó una prueba unitaria; se corrigió midiendo el texto ya unido.
- **Notas engañosas en el informe.** La primera versión del informe decía que en M2 "se forzó la inclusión" y que U2 "quedó en captures", aunque ninguna de las dos se ejecutó. Se corrigió el generador para que las notas dependan de lo ocurrido, y se regeneró el informe desde los resultados crudos (`npm run eval -- --report <archivo>`), sin volver a llamar a Gemini.

### Pendiente (requiere decisión)

- Completar la matriz: faltan 23 ejecuciones, que caben en dos días de cuota con el mismo modelo, o en uno con el plan de pago.
- El ejecutor debería detenerse al primer 429 de cuota **diaria** en lugar de reintentar durante 40 minutos.
- N1: limitar a un fragmento por documento haría entrar a CWE-89 (simulado: `cwe-89-mitigations-2` pasa al quinto lugar), pero OWASP Database Security sigue sin superar el umbral en esa consulta.

---

## 2026-09-04 — Auditoría funcional: bugs encontrados y corregidos

Se ejecutó un flujo de prueba completo (generar → probar ejemplo de la app → probar caso propio → pedir extensión → cambiar a C) sobre 3 problemas de dificultad creciente, para verificar que la app genera código realmente funcional y no solo texto con buena forma.

**Bug 1 — Falta el lenguaje "C" en el catálogo.**
Solo existía "C++" (`cpp`). Se agregó `{ id: 'c', ... }` en `src/config.js`. `highlight.js` ya soporta `c` en el bundle instalado, así que no hizo falta tocar el frontend.

**Bug 2 — Un `language` inválido caía en Python en silencio.**
`findLanguage(id) || findLanguage(DEFAULT_LANGUAGE)` en `server.js` sustituía cualquier id no reconocido por Python sin decírselo al usuario ni devolver error. Se descubrió pidiendo `language: "c"` *antes* de que existiera esa opción: la respuesta llegó con `"language": "python"` como si el usuario lo hubiera pedido así.
**Por qué importa:** un fallback silencioso que cambia la intención del usuario sin avisar es peor que un error — el usuario cree que obtuvo lo que pidió.
**Fix:** si `language` viene vacío se usa el default (comportamiento correcto, documentado); si viene con un valor que no existe en el catálogo, ahora se responde `400 invalid_language` con la lista de lenguajes válidos.

**Bug 3 — Headers de `helmet` pensados para HTTPS de producción, rotos en HTTP local.**
`hsts` y `upgrade-insecure-requests` (activado por defecto en el CSP de helmet) le indican al navegador que reintente todo por HTTPS. En un prototipo servido en `http://localhost`, eso rompe la carga de `/css/styles.css` y `/js/app.js`. Se desactivaron ambos en `server.js`.
**Si esto se despliega detrás de HTTPS real algún día, hay que revertir este cambio** — así quedó anotado en un comentario justo encima de la config de `helmet`.

**Hallazgo importante (no es bug de la app, es del modelo generador):**
Al traducir a C una función de palíndromos que en Python usaba `unicodedata` para quitar acentos, Gemini escribió a mano una tabla de mapeo de bytes UTF-8 para las vocales acentuadas del español — y la tabla tiene errores reales. Confirmado compilando y ejecutando:

```
café  -> caf      ("é" desaparece)
día   -> da       ("í" desaparece)
Ñoño  -> ono      ("Ñ" mayúscula desaparece)
```

La prueba que la propia app sugirió (con la frase `¡Ánita láva la tina!`) hace fallar un `assert()` al compilar y correr el binario.
**Por qué importa y qué hacer con esto:** no se "arregló" en el código de la app porque no es un bug de ReqCode AI — es una limitación del modelo al generar manipulación manual de bytes sin poder ejecutar y verificar su propia salida. Queda documentado aquí como advertencia: **cualquier código generado que haga decodificación manual de UTF-8, aritmética de bytes o tablas de codificación debe probarse siempre antes de confiar en él**, en especial en C.

**Otras observaciones (no son bugs):**
- La app no tiene memoria conversacional: cada llamada a `/api/generate` es independiente. Para "extender" una función anterior hay que pegar el código anterior dentro del nuevo requerimiento a mano. Sería una mejora útil a futuro (ver sección "Pendientes").
- Al pedir agregar una función, el modelo a veces modifica también la función original como efecto colateral de un refactor (ej. le agregó soporte de acentos a `es_palindromo` sin que se pidiera), sin declararlo como una desviación de lo solicitado. No rompió nada en los casos probados, pero conviene revisar el diff cuando se pide "agregar" en vez de "reemplazar".

**Cambio de producto en el mismo commit:** se eliminó la sección "Ejemplos" del composer (HTML, el array `EXAMPLES` en `public/js/app.js`, y el CSS `.examples`/`.example`) a pedido explícito.

---

## 2026-09-04 — Reproducción y verificación de un reporte de bug del usuario

El usuario reportó que la calculadora generada "no creo que haga lo que pedí". Se reprodujo el prompt exacto (`"Generame una calculadora en python con suma, resta, multiplicación y división. Este debe poder correrse desde la terminal"`) y se ejecutó el código resultante con una batería de entradas (las 4 operaciones, división entre cero, texto inválido, `Ctrl+C`).

**Resultado:** el código generado por la app era correcto y cumplía el requerimiento. El código que el usuario tenía (con menú numerado 1-5 en vez de símbolos +/-/*//) también se probó de la misma forma y también era correcto — es una variante distinta de la misma solución, producto de la variabilidad normal del modelo incluso con `temperature` baja, no un error.
**Lección para el usuario:** cuando algo generado "se vea raro", conviene primero ejecutarlo con casos concretos antes de asumir que está mal — en este caso ambas versiones funcionaban.

---

## 2026-09-04 — Publicación en GitHub

Se subió el proyecto (carpeta `uml_web` únicamente, como raíz del repo) a `github.com/Alan-San-Millan/RedCodeAI`, rama `main`.

**Decisiones tomadas en el momento:**
- Se usó `git config user.name/email` **local al repo** (no `--global`), para no tocar la configuración global de git del usuario.
- Antes de subir se verificó explícitamente que no hubiera secretos en el diff (`.env` está excluido por `.gitignore`; solo se subió `.env.example` con placeholders).
- Solo se subió `uml_web`, no el resto de `ConsumoLLM` (que incluye `uml_python`, un proyecto Flet no relacionado y con un `.venv` roto) ni la presentación en `Downloads`.

---

## 2026-09-04 — Corrección del modelo de Gemini por defecto (capacidad real, no teoría)

El plan original (ver entrada del 2026-09-01) eligió `gemini-3.7-flash` como default por ser "el mejor para código" según la documentación. Al probarlo end-to-end con una API key real, resultó:

| Modelo | Con `responseSchema` (salida estructurada) |
|---|---|
| `gemini-3.7-flash` | `503 high demand` de forma consistente en las pruebas |
| `gemini-3.5-flash` / `gemini-3.5-flash-lite` | también `503 high demand` |
| `gemini-2.5-flash` | `404` — Google lo retiró para API keys nuevas ("no longer available to new users") |
| `gemini-3.6-flash` | ✅ respondió de forma estable |

**Decisión:** default cambiado a `gemini-3.6-flash` en `.env`, `.env.example` y `src/config.js`, con el porqué documentado en comentarios y en el README. Si la demanda de Google baja en el futuro, se puede volver a `gemini-3.7-flash` cambiando solo la variable de entorno, sin tocar código.

**Nota aparte, no accionada:** Google recomienda mantener `temperature` en 1.0 para toda la familia Gemini 3, advirtiendo que bajarla puede causar bucles o degradar el razonamiento. En la práctica, `gemini-3.6-flash` con `temperature: 0.2` generó código correcto y consistente en todas las pruebas realizadas, así que se mantuvo 0.2 como default (la presentación original lo justifica explícitamente). Si en el futuro se ve comportamiento errático, subir la temperature es el primer diagnóstico a probar.

---

## 2026-09-01 — Decisión de arquitectura: transformar `uml_web` en ReqCode AI

**Contexto:** el directorio de trabajo contenía dos proyectos sin relación con el pedido — `uml_python` (Flet + Gemini, generador de diagramas UML, con `.venv` roto apuntando a una ruta de otra máquina) y `uml_web` (Node/Express + OpenAI, mismo propósito). Ninguno de los dos hacía lo que pedía el nuevo prompt (traducir requerimientos en lenguaje natural a código funcional).

**Decisión (confirmada explícitamente por el usuario vía pregunta):** reutilizar el stack de `uml_web` (Node 22 + Express 5 + frontend vanilla, que sí arrancaba) y transformarlo por completo en ReqCode AI, en vez de crear una carpeta nueva o partir de `uml_python`. Se descartó el código de UML/PlantUML/OpenAI de `uml_web` casi en su totalidad.

**Segunda decisión (también confirmada explícitamente):** usar el SDK y modelos vigentes de Gemini en vez de lo que pedía el prompt original al pie de la letra. El prompt mencionaba `@google/generative-ai` (SDK legado, última versión 0.24.1) y `gemini-1.5-flash`/`gemini-2.0-flash` (ambos retirados, devuelven 404). Se verificó contra `ai.google.dev` antes de decidir y se usó `@google/genai` v2.20.0 con `gemini-3.7-flash` como punto de partida (ver entrada posterior donde ese modelo se reemplazó por motivos de disponibilidad real).

**Diseño del prompt de sistema:** dividido explícitamente en las tres funciones que la presentación (`arquitectura_ia_generativa.pptx`) le asigna al LLM: comprensión del requerimiento (NLU), generación de código, y documentación/explicación. Se le indicó explícitamente al modelo que nunca debe perder el lenguaje objetivo ni las condiciones de filtrado, siguiendo el análisis de relevancia de la diapositiva 12 de la presentación.

**Formato de respuesta:** se usó `responseSchema` de Gemini (salida JSON estructurada) en vez de pedir markdown y parsearlo con regex. Se mantiene un parser de markdown como respaldo por si se configura un modelo sin soporte de salida estructurada.

**`temperature` por defecto en 0.2:** decisión de ingeniería explícita, no arbitraria — el propósito del servicio es código correcto y reproducible, y la presentación justifica ese valor en su diapositiva 14 con una tabla comparativa (conservadora / equilibrada / creativa).

**Resaltado de sintaxis servido localmente, no por CDN:** se usó el paquete `@highlightjs/cdn-assets` servido desde `/vendor/hljs` en el propio Express, para mantener el CSP de `helmet` estricto (`script-src 'self'`) y que la app funcione sin conexión a internet.

---

## Pendientes / ideas para el futuro

Cosas identificadas durante el desarrollo y las auditorías que quedaron fuera de alcance a propósito:

- **Sin memoria conversacional.** No hay forma de "continuar" sobre un resultado anterior desde la UI; hay que copiar y pegar el código a mano dentro de un nuevo requerimiento. Agregar un botón "usar este resultado como base" sería la mejora de UX más directa detectada en las auditorías.
- **Visualización de tokens/embeddings/atención** — mencionado en la presentación como concepto, explícitamente fuera de alcance del MVP.
- **Autenticación de usuarios**, **historial persistente en base de datos**, y **selección entre múltiples proveedores de IA** — fuera de alcance del prototipo por decisión original.
- **Validar/ejecutar el código generado automáticamente** (en un sandbox) antes de mostrarlo — ninguna verificación de ejecución ocurre hoy; todo el código que se muestra al usuario no ha sido probado por la propia app. La auditoría del 2026-09-04 lo hizo manualmente fuera de la aplicación.
