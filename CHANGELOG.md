# Registro de decisiones y cambios — ReqCode AI

Este documento existe para no perder el rastro de *por qué* el proyecto quedó como quedó. El código dice el *qué*; esto documenta el *por qué*, sobre todo las decisiones que no eran obvias desde el requerimiento original o que revirtieron una elección previa.

Formato: más reciente arriba. Cada entrada dice qué se decidió/cambió, por qué, y cómo verificarlo si aplica.

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
