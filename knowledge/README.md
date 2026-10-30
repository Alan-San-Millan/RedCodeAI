# Corpus documental de ReqCode AI

Esta carpeta contiene las fuentes que el RAG puede recuperar. Cada archivo es Markdown y empieza con un *frontmatter* con `source`, `version`, `url`, `license`, `retrieved_at`, `category`, `languages` y `cwe`.

Los archivos se generan con `node scripts/build-corpus.js`, que descarga las fuentes oficiales y las convierte. No se editan a mano: si una fuente cambia, se vuelve a correr el script, se revisa el diff y se aprueba por *pull request*. Después hay que regenerar el índice con `npm run ingest`.

| Carpeta | Fuente | Contenido |
|---|---|---|
| `owasp-scp/` | OWASP Secure Coding Practices – Quick Reference Guide v2.1 | Las 14 categorías de la lista de verificación, con sus prácticas numeradas |
| `cwe-top25-2025/` | CWE Top 25 Most Dangerous Software Weaknesses 2025 | Una ficha por debilidad: descripción y mitigaciones |
| `pep8/` | PEP 8 – Style Guide for Python Code | El documento completo, con sus encabezados |
| `changelog/` | `CHANGELOG.md` de este repositorio | Errores reales detectados en el código generado |

## Notas sobre las versiones

- **OWASP.** El PDF publicado como "v2.1" tiene en el encabezado *"Draft v2.1 – With identities added"*, pero en el pie de página dice *"Version 2.0 – November 2010"*. Contiene 214 prácticas en 14 categorías. El número **[202] aparece dos veces** en el original: es la última práctica de *Memory Management* y la primera de *General Coding Practices*. Se conservó tal cual. El proyecto está archivado y su contenido migró a la OWASP Developer Guide.
- **CWE.** El ranking y el orden vienen de la página del Top 25 2025. La descripción y las mitigaciones de cada debilidad se tomaron del catálogo XML oficial vigente al momento de la descarga (la versión exacta está en el `version` de cada archivo), que puede ser posterior a la publicación del Top 25.
- **PEP 8.** Se tomó de su fuente oficial en reStructuredText (repositorio `python/peps`) y se convirtió a Markdown conservando los encabezados.

## Atribuciones y licencias

**OWASP Secure Coding Practices – Quick Reference Guide.** Copyright © 2010 The OWASP Foundation. Distribuido bajo la licencia [Creative Commons Attribution-ShareAlike 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Fuente: <https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/>. Los archivos de `owasp-scp/` son una conversión a Markdown del original, sin cambios en el texto de las prácticas, y se distribuyen bajo la misma licencia CC BY-SA 3.0.

**CWE™ Top 25 y Common Weakness Enumeration.** Copyright © 2006–2026, The MITRE Corporation. CWE y el logo de CWE son marcas registradas de The MITRE Corporation. Se usa conforme a los [CWE Terms of Use](https://cwe.mitre.org/about/termsofuse.html):

> CWE™ is free to use by any organization or individual for any research, development, and/or commercial purposes, per these CWE Terms of Use. Accordingly, The MITRE Corporation hereby grants you a non-exclusive, royalty-free license to use CWE for research, development, and commercial purposes. Any copy you make for such purposes is authorized on the condition that you reproduce MITRE's copyright designation and this license in any such copy.

**PEP 8 – Style Guide for Python Code.** Guido van Rossum, Barry Warsaw y Alyssa Coghlan. Python Software Foundation. El documento fue puesto en el dominio público. Fuente: <https://peps.python.org/pep-0008/>.

**CHANGELOG del proyecto.** Fuente interna de ReqCode AI.
