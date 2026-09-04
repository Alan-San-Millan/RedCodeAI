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

> **Los nombres de modelo cambian con frecuencia.** `gemini-1.5-flash` y `gemini-2.0-flash` ya fueron retirados, y `gemini-2.5-flash` dejó de estar disponible para API keys nuevas (los tres devuelven 404). La lista vigente está en <https://ai.google.dev/gemini-api/docs/models>. Si `GEMINI_MODEL` devuelve 503 "high demand" de forma persistente, es un problema de capacidad temporal de Google, no de tu configuración: espera unos minutos o prueba con otro modelo de la lista.

---

## Cómo funciona

```
Requerimiento en lenguaje natural
          ↓
   Validación en el servidor  (longitud, lenguaje destino, temperature)
          ↓
   Prompt de sistema + prompt de usuario
          ↓
   Gemini  (responseSchema: salida estructurada en JSON)
          ↓
   Código · Explicación · Prueba sugerida · Comprensión del requerimiento
          ↓
   Interfaz con resaltado de sintaxis e historial de sesión
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
│   ├── prompts/system-prompt.js     Prompt de sistema con las tres funciones del modelo
│   └── services/gemini.service.js   Único punto de contacto con la API de Gemini
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
| `POST` | `/api/generate` | Recibe `{ requirement, language, temperature }` y devuelve el código, la explicación, la prueba sugerida y la comprensión del requerimiento. |

La API key **solo existe en el servidor**. El navegador nunca la ve, así que no aparece en las herramientas de desarrollo ni en el código fuente de la página.

`highlight.js` se sirve desde el propio servidor (`/vendor/hljs`) y no desde un CDN: la política de seguridad de contenido de `helmet` sigue siendo estricta (`script-src 'self'`) y la interfaz funciona sin conexión a internet.

---

## Lenguajes soportados

Python (por defecto), JavaScript, TypeScript, Java, C#, Go, Rust, C++, PHP, Ruby, Kotlin, Swift, SQL y Bash.

Para agregar uno más, basta con añadirlo al arreglo `LANGUAGES` de [`src/config.js`](src/config.js); el selector de la interfaz y la validación del servidor se actualizan solos.

---

## Pruebas realizadas

El flujo completo (requerimiento → Gemini → código + explicación) se probó de punta a punta con una API key real de Google AI Studio:

1. **El caso de la presentación** ("una función en Python que reciba una lista de números y calcule el promedio, ignorando los valores negativos"): generó una función que filtra negativos, devuelve `0.0` en lista vacía o sin elementos válidos, y una prueba con 4 aserciones cubriendo el caso general, ceros, todos negativos y lista vacía.
2. **Un requerimiento más complejo en otro lenguaje** (una clase `Carrito` en TypeScript con alta/baja de productos por id y descuento porcentual opcional): generó una clase completa con validaciones de precio y descuento, y una prueba con `node:test`.
3. **Un requerimiento deliberadamente ambiguo** ("quiero que funcione mejor y sea más rápido"): el modelo devolvió `status: "unclear"` sin inventar un requerimiento, explicando qué información hacía falta — validando el manejo de esta situación en la interfaz.

También se verificó en el navegador: el flujo completo de generación con la interfaz real, el cambio entre las pestañas Código/Explicación/Prueba sugerida, el resaltado de sintaxis, y la recuperación automática de un error transitorio de Gemini (503 "high demand") con el botón **Reintentar**.

## Alcance de este prototipo

**Incluido:** entrada del requerimiento, selección de lenguaje, temperature ajustable, llamada a Gemini, código con resaltado de sintaxis, explicación, prueba unitaria sugerida, historial de la sesión y manejo de errores.

**Fuera de alcance (posible fase 2):**

- Visualización de tokens, embeddings y mapas de atención en la interfaz.
- Autenticación de usuarios o cuentas.
- Historial persistente en base de datos (hoy vive en memoria y se pierde al recargar).
- Selección entre varios modelos o proveedores de IA.
- Llamada separada para la explicación con una temperature más alta (~0.4–0.5): duplicaría la latencia y el consumo de la cuota gratuita, así que el prototipo usa una sola llamada.
- Ejecución o validación automática del código generado en un entorno aislado.

**El código generado no está verificado.** Es el primer borrador funcional de un requerimiento, no un artefacto listo para producción: revísalo y ejecuta la prueba sugerida antes de usarlo.
