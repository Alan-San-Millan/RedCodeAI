---
source: "Registro de decisiones del proyecto (CHANGELOG.md)"
version: "Entrada del 2026-09-04"
url: "https://github.com/Alan-San-Millan/RedCodeAI/blob/main/CHANGELOG.md"
license: "Fuente interna del proyecto"
retrieved_at: "2026-10-30"
category: "lessons-learned"
cwe: ["CWE-787", "CWE-125"]
languages: ["c", "cpp"]
---

# Error real: tabla UTF-8 escrita a mano en C

**Hallazgo importante (no es bug de la app, es del modelo generador):**
Al traducir a C una función de palíndromos que en Python usaba `unicodedata` para quitar acentos, Gemini escribió a mano una tabla de mapeo de bytes UTF-8 para las vocales acentuadas del español — y la tabla tiene errores reales. Confirmado compilando y ejecutando:

```
café  -> caf      ("é" desaparece)
día   -> da       ("í" desaparece)
Ñoño  -> ono      ("Ñ" mayúscula desaparece)
```

La prueba que la propia app sugirió (con la frase `¡Ánita láva la tina!`) hace fallar un `assert()` al compilar y correr el binario.
**Por qué importa y qué hacer con esto:** no se "arregló" en el código de la app porque no es un bug de ReqCode AI — es una limitación del modelo al generar manipulación manual de bytes sin poder ejecutar y verificar su propia salida. Queda documentado aquí como advertencia: **cualquier código generado que haga decodificación manual de UTF-8, aritmética de bytes o tablas de codificación debe probarse siempre antes de confiar en él**, en especial en C.
