/**
 * Glosario técnico español → inglés, SOLO para la búsqueda por palabras clave.
 * La interfaz está en español y el corpus en inglés; sin esto, BM25 casi nunca encuentra
 * términos en común. Los términos salen de las 14 categorías de OWASP SCP, los temas del
 * CWE Top 25 y los apartados de PEP 8 — no de las consultas de la matriz de pruebas.
 * El embedding no lo usa: gemini-embedding-001 ya es multilingüe.
 */
const GLOSSARY = [
  // OWASP: Input Validation / Output Encoding
  [['validacion', 'validar', 'valida', 'valide', 'validaciones'], 'validation validate'],
  [['entrada', 'entradas'], 'input'],
  [['salida', 'salidas'], 'output'],
  [['codificacion', 'codificar', 'escapar', 'sanitizar'], 'encoding encode escape sanitize'],
  // Authentication and Password Management / Session Management
  [['autenticacion', 'autenticar', 'inicio de sesion', 'iniciar sesion', 'login'], 'authentication login'],
  [['contrasena', 'contrasenas', 'clave de acceso'], 'password passwords'],
  [['credencial', 'credenciales'], 'credentials'],
  [['sesion', 'sesiones'], 'session'],
  [['usuario', 'usuarios'], 'user users'],
  // Access Control
  [['control de acceso', 'permiso', 'permisos', 'autorizacion', 'autorizar'], 'access control permission authorization'],
  // Cryptographic Practices
  [['cifrado', 'cifrar', 'encriptar', 'criptografia', 'criptografico'], 'encryption encrypt cryptographic'],
  [['hash', 'hashear', 'resumen criptografico'], 'hash hashing'],
  // Error Handling and Logging
  [['error', 'errores', 'excepcion', 'excepciones'], 'error exception'],
  [['registro', 'registros', 'bitacora', 'log', 'logs'], 'logging log'],
  // Data Protection / Communication Security / System Configuration
  [['datos sensibles', 'informacion sensible'], 'sensitive data'],
  [['comunicacion', 'cifrado en transito', 'tls', 'https'], 'communication tls https'],
  [['configuracion'], 'configuration'],
  // Database Security
  [['base de datos', 'bases de datos', 'base sqlite'], 'database'],
  [['consulta', 'consultas'], 'query queries'],
  // File Management
  [['archivo', 'archivos', 'fichero', 'ficheros'], 'file files'],
  [['ruta', 'rutas', 'directorio', 'directorios', 'carpeta'], 'path directory'],
  [['subir archivo', 'subida', 'carga de archivos'], 'upload'],
  // Memory Management
  [['memoria'], 'memory'],
  [['bufer', 'buffer'], 'buffer'],
  [['puntero', 'punteros'], 'pointer'],
  [['desbordamiento'], 'overflow'],
  // General Coding Practices / CWE
  [['comando', 'comandos', 'sistema operativo', 'terminal'], 'command shell operating system'],
  [['inyeccion'], 'injection'],
  [['deserializacion', 'deserializar'], 'deserialization'],
  [['secuencias de comandos', 'xss'], 'cross-site scripting'],
  [['falsificacion de solicitudes', 'csrf'], 'request forgery csrf'],
  [['recorrido de ruta', 'path traversal'], 'path traversal'],
  [['concurrencia', 'condicion de carrera'], 'concurrency race condition'],
  // PEP 8
  [['nombre', 'nombres', 'nombrar', 'nomenclatura'], 'name names naming'],
  [['constante', 'constantes'], 'constant constants'],
  [['variable', 'variables'], 'variable variables'],
  [['clase', 'clases'], 'class classes'],
  [['funcion', 'funciones'], 'function functions'],
  [['metodo', 'metodos'], 'method methods'],
  [['modulo', 'modulos', 'paquete', 'paquetes'], 'module package'],
  [['sangria', 'indentacion'], 'indentation'],
  [['comentario', 'comentarios', 'docstring'], 'comment comments docstring'],
  [['espacio en blanco', 'espacios en blanco'], 'whitespace'],
  [['importacion', 'importaciones', 'importar'], 'import imports'],
  [['longitud de linea'], 'line length'],
  [['estilo', 'convencion', 'convenciones'], 'style convention conventions']
];

const fold = (text) => String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const ENTRIES = GLOSSARY.map(([terms, english]) => ({
  re: new RegExp(`\\b(${terms.map((t) => t.replace(/\s+/g, '\\s+')).join('|')})\\b`),
  english
}));

/** Agrega a la consulta los equivalentes en inglés de los términos técnicos que encuentre. */
export function expandQuery(text) {
  const folded = fold(text);
  const extra = [...new Set(ENTRIES.filter((e) => e.re.test(folded)).map((e) => e.english))];
  return extra.length ? `${text} ${extra.join(' ')}` : text;
}
