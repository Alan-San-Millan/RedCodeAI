---
source: "Registro de decisiones del proyecto (CHANGELOG.md)"
version: "Entrada del 2026-09-04"
url: "https://github.com/Alan-San-Millan/RedCodeAI/blob/main/CHANGELOG.md"
license: "Fuente interna del proyecto"
retrieved_at: "2026-10-30"
category: "lessons-learned"
cwe: []
languages: ["all"]
---

# Observación: cambios no solicitados al extender código

**Otras observaciones (no son bugs):**
- La app no tiene memoria conversacional: cada llamada a `/api/generate` es independiente. Para "extender" una función anterior hay que pegar el código anterior dentro del nuevo requerimiento a mano. Sería una mejora útil a futuro (ver sección "Pendientes").
- Al pedir agregar una función, el modelo a veces modifica también la función original como efecto colateral de un refactor (ej. le agregó soporte de acentos a `es_palindromo` sin que se pidiera), sin declararlo como una desviación de lo solicitado. No rompió nada en los casos probados, pero conviene revisar el diff cuando se pide "agregar" en vez de "reemplazar".
