'use strict';

const path = require('path');
// Carga backend/.env y luego ./.env, sin importar desde dónde se ejecute.
// dotenv NO pisa variables ya definidas (ej. las del panel de Render).
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const IS_PROD = process.env.NODE_ENV === 'production';
const FRONTEND_DIR = path.resolve(__dirname, '../frontend');

/* ============================================================
 * 1. CONFIGURACIÓN OBLIGATORIA (falla rápido si es insegura)
 * ============================================================ */

// Claves que alguna vez estuvieron publicadas en el repositorio.
const CLAVES_FILTRADAS = new Set(['perfumeAdmin2026']);

function configInvalida(mensaje) {
  console.error(`[config] ${mensaje}`);
  process.exit(1);
}

const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || '';
if (!ADMIN_SECRET_KEY) {
  configInvalida('Falta ADMIN_SECRET_KEY. Definila en las variables de entorno (ver .env.example).');
}
if (CLAVES_FILTRADAS.has(ADMIN_SECRET_KEY)) {
  configInvalida('ADMIN_SECRET_KEY es una clave que estuvo publicada en el repositorio. Generá una nueva.');
}
if (ADMIN_SECRET_KEY.length < 12) {
  configInvalida('ADMIN_SECRET_KEY es demasiado corta (mínimo 12 caracteres; recomendado 24+).');
}

// La clave de firma de sesiones se ata también a ADMIN_SECRET_KEY:
// si rotás la clave de admin, todas las sesiones abiertas quedan invalidadas.
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_KEY = crypto.createHash('sha256').update(`${SESSION_SECRET}|${ADMIN_SECRET_KEY}`).digest();
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.warn('[config] Faltan variables de Cloudinary: la subida de imágenes fallará.');
}

/* ============================================================
 * 2. BASE DE DATOS
 * ============================================================ */

function configSSL() {
  const remoto = process.env.DATABASE_URL || (process.env.DB_HOST && process.env.DB_HOST !== 'localhost');
  if (!remoto || process.env.DB_SSL === 'false') return undefined;
  const ssl = {
    minVersion: 'TLSv1.2',
    // Verifica el certificado del servidor (evita ataques man-in-the-middle).
    // Solo desactivar si el proveedor usa un certificado propio: DB_SSL_REJECT_UNAUTHORIZED=false
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
  };
  if (process.env.DB_SSL_CA) ssl.ca = process.env.DB_SSL_CA.replace(/\\n/g, '\n');
  return ssl;
}

const poolOpciones = { waitForConnections: true, connectionLimit: 10, queueLimit: 0, ssl: configSSL() };
const dbConfig = process.env.DATABASE_URL
  ? { uri: process.env.DATABASE_URL, ...poolOpciones }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'test',
      ...poolOpciones
    };

const db = mysql.createPool(dbConfig).promise();

/* ============================================================
 * 3. AUTENTICACIÓN (token firmado, corta duración)
 * ============================================================ */

// Comparación en tiempo constante (no filtra información por tiempos de respuesta).
function igualesSeguro(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

const firmar = (dato) => crypto.createHmac('sha256', TOKEN_KEY).update(dato).digest('base64url');

function emitirToken() {
  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() + SESSION_TTL_MS, n: crypto.randomBytes(8).toString('hex') })
  ).toString('base64url');
  return `${payload}.${firmar(payload)}`;
}

function tokenValido(token) {
  if (typeof token !== 'string' || token.length > 400) return false;
  const partes = token.split('.');
  if (partes.length !== 2) return false;
  const [payload, firma] = partes;
  if (!igualesSeguro(firma, firmar(payload))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isFinite(exp) && Date.now() < exp;
  } catch (e) {
    return false;
  }
}

function verificarAdmin(req, res, next) {
  const cabecera = req.headers.authorization || '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : '';
  if (!tokenValido(token)) {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
  next();
}

/* ============================================================
 * 4. VALIDACIÓN DE ENTRADAS
 * ============================================================ */

const httpError = (status, mensaje) => Object.assign(new Error(mensaje), { status, expuesto: true });
const invalido = (mensaje) => httpError(400, mensaje);

function texto(valor, campo, { max, requerido = false } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    if (requerido) throw invalido(`El campo "${campo}" es obligatorio`);
    return '';
  }
  if (typeof valor !== 'string') throw invalido(`El campo "${campo}" no es válido`);
  // Quita caracteres de control (conserva saltos de línea y tabulaciones).
  const limpio = valor.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (requerido && !limpio) throw invalido(`El campo "${campo}" es obligatorio`);
  if (limpio.length > max) throw invalido(`El campo "${campo}" supera el máximo de ${max} caracteres`);
  return limpio;
}

function precio(valor) {
  if (typeof valor !== 'string' && typeof valor !== 'number') throw invalido('El precio no es válido');
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0 || n > 100000000) throw invalido('El precio debe ser un número mayor a 0');
  return Math.round(n * 100) / 100;
}

function stock(valor) {
  if (valor === undefined || valor === null || valor === '') return 10;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 0 || n > 100000) throw invalido('El stock debe ser un entero entre 0 y 100000');
  return n;
}

function idValido(valor) {
  if (!/^\d{1,10}$/.test(String(valor)) || Number(valor) < 1) throw invalido('ID inválido');
  return Number(valor);
}

function leerProducto(body) {
  return {
    nombre: texto(body.nombre, 'nombre', { max: 120, requerido: true }),
    familia: texto(body.familia, 'familia', { max: 60, requerido: true }),
    // El admin puede concatenar varias descripciones separadas por " ||| ": se deja margen amplio.
    descripcion: texto(body.descripcion, 'descripcion', { max: 4000 }),
    precio: precio(body.precio),
    tipo: texto(body.tipo, 'tipo', { max: 40 }) || 'Diseñador',
    genero: texto(body.genero, 'genero', { max: 40 }) || 'Unisex',
    // El admin combina varias épocas + un momento (ej. "Verano | Otoño | Cita / Evento"): se amplía el máximo.
    estacion: texto(body.estacion, 'estacion', { max: 120 }) || 'Todo el año',
    notas_salida: texto(body.notas_salida, 'notas_salida', { max: 300 }),
    notas_corazon: texto(body.notas_corazon, 'notas_corazon', { max: 300 }),
    notas_fondo: texto(body.notas_fondo, 'notas_fondo', { max: 300 }),
    destacado_hero: ['1', 'true'].includes(String(body.destacado_hero)) ? 1 : 0,
    estado_stock: stock(body.estado_stock)
  };
}

/* ============================================================
 * 5. IMÁGENES: validación por contenido + subida a Cloudinary
 * ============================================================ */

const MAX_IMAGENES = 5;
const MAX_BYTES_IMAGEN = 5 * 1024 * 1024; // 5 MB
const MIMES_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const HOSTS_IMAGEN_PERMITIDOS = new Set(['res.cloudinary.com', 'images.unsplash.com']);

// El "mimetype" lo declara el cliente y se puede falsificar: se verifica la firma real del archivo.
function esImagenReal(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return false;
  const jpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
  const avif = buf.toString('ascii', 4, 8) === 'ftyp' && ['avif', 'avis', 'mif1'].includes(buf.toString('ascii', 8, 12));
  return jpg || png || webp || avif;
}

function urlImagenPermitida(u) {
  if (typeof u !== 'string' || u.length > 500) return false;
  if (/^\/uploads\/[\w.-]+$/.test(u)) return true; // rutas antiguas del catálogo
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && HOSTS_IMAGEN_PERMITIDOS.has(x.hostname) && !x.username && !x.password;
  } catch (e) {
    return false;
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES_IMAGEN, files: MAX_IMAGENES, fields: 30, fieldSize: 20 * 1024, parts: 40 },
  fileFilter: (req, file, cb) => {
    if (MIMES_PERMITIDOS.has(file.mimetype)) return cb(null, true);
    cb(invalido('Formato de imagen no permitido (usá JPG, PNG, WEBP o AVIF)'));
  }
});
const camposSubida = upload.fields([
  { name: 'imagenes', maxCount: MAX_IMAGENES },
  { name: 'imagen', maxCount: MAX_IMAGENES }
]);

const procesarSubida = (req, res) =>
  new Promise((resolve, reject) => camposSubida(req, res, (err) => (err ? reject(err) : resolve())));

const archivosDe = (req) => (req.files && (req.files.imagenes || req.files.imagen)) || [];

function validarArchivos(archivos) {
  for (const f of archivos) {
    if (!esImagenReal(f.buffer)) throw invalido('Uno de los archivos no es una imagen válida (JPG, PNG, WEBP o AVIF)');
  }
}

function subirACloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'parfum-studio', resource_type: 'image', allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'avif'] },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

async function borrarSubidas(subidas) {
  await Promise.allSettled(subidas.map((s) => cloudinary.uploader.destroy(s.public_id)));
}

// Sube en orden (la primera es la portada). Si algo falla, borra lo ya subido.
async function subirImagenes(archivos) {
  const subidas = [];
  try {
    for (const f of archivos) subidas.push(await subirACloudinary(f.buffer));
  } catch (err) {
    await borrarSubidas(subidas);
    console.error('[cloudinary] Error al subir imagen:', err && err.message);
    throw httpError(502, 'No se pudo subir la imagen. Intentá nuevamente.');
  }
  return subidas;
}

/* ============================================================
 * 6. APP, CABECERAS Y LÍMITES
 * ============================================================ */

const app = express();
app.set('trust proxy', 1); // Render: un proxy delante
app.disable('x-powered-by');

// Fuerza HTTPS en producción (Render informa el protocolo original en X-Forwarded-Proto).
app.use((req, res, next) => {
  if (IS_PROD && req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      // CSP_REPORT_ONLY=true: no bloquea nada, solo avisa en la consola del navegador (útil para probar un despliegue nuevo).
      reportOnly: process.env.CSP_REPORT_ONLY === 'true',
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        // Solo scripts propios. Los onclick="" existentes en el HTML requieren scriptSrcAttr;
        // el paso siguiente sería migrarlos a addEventListener y quitar esta línea.
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com', 'https://images.unsplash.com'],
        connectSrc: ["'self'"],
        ...(IS_PROD ? { upgradeInsecureRequests: [] } : {})
      }
    },
    strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
    crossOriginEmbedderPolicy: false // Google Fonts no envía CORP
  })
);

app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  next();
});

// CORS cerrado por defecto: el frontend se sirve desde este mismo servidor.
// Si algún día lo separás, listá los orígenes en ALLOWED_ORIGINS (separados por coma).
const origenesPermitidos = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
if (origenesPermitidos.length > 0) {
  app.use('/api', cors({
    origin: origenesPermitidos,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600
  }));
}

app.use(express.json({ limit: '10kb' }));

const mensajeLimite = (error) => ({ error });

const limiterGeneral = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: mensajeLimite('Demasiadas solicitudes desde esta IP, intentá nuevamente más tarde.')
});

// Solo cuenta los intentos FALLIDOS: entrar bien no consume el cupo.
const limiterLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: mensajeLimite('Demasiados intentos fallidos. Esperá 15 minutos e intentá de nuevo.')
});

const limiterResenas = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: mensajeLimite('Enviaste demasiadas reseñas. Intentá más tarde.')
});

app.use('/api/', limiterGeneral);

// El panel de admin no debe cachearse ni indexarse.
app.use('/admin.html', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

app.use(express.static(FRONTEND_DIR, { dotfiles: 'ignore', maxAge: IS_PROD ? '1h' : 0 }));

/* ============================================================
 * 7. RUTAS
 * ============================================================ */

app.post('/api/admin/login', limiterLogin, (req, res) => {
  const clave = req.body && req.body.clave;
  if (typeof clave === 'string' && clave.length <= 200 && igualesSeguro(clave, ADMIN_SECRET_KEY)) {
    return res.json({ ok: true, token: emitirToken(), expiraEnMs: SESSION_TTL_MS });
  }
  console.warn(`[auth] Intento de login fallido desde ${req.ip}`);
  res.status(401).json({ error: 'Contraseña incorrecta' });
});

app.get('/api/productos', async (req, res) => {
  const [filas] = await db.query('SELECT * FROM productos ORDER BY id DESC');
  res.json(filas);
});

app.post('/api/productos', verificarAdmin, async (req, res, next) => {
  let subidas = [];
  try {
    await procesarSubida(req, res);
    const datos = leerProducto(req.body || {});
    const archivos = archivosDe(req);
    if (archivos.length === 0) throw invalido('Debés subir al menos una imagen');
    validarArchivos(archivos);

    subidas = await subirImagenes(archivos);
    const imagen_url = JSON.stringify(subidas.map((s) => s.secure_url));

    const [resultado] = await db.query(
      `INSERT INTO productos (nombre, familia, descripcion, precio, imagen_url, tipo, genero, estacion, notas_salida, notas_corazon, notas_fondo, destacado_hero, estado_stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [datos.nombre, datos.familia, datos.descripcion, datos.precio, imagen_url, datos.tipo, datos.genero,
       datos.estacion, datos.notas_salida, datos.notas_corazon, datos.notas_fondo, datos.destacado_hero, datos.estado_stock]
    );
    res.status(201).json({ mensaje: 'Perfume agregado con éxito', id: resultado.insertId });
  } catch (err) {
    if (subidas.length) await borrarSubidas(subidas);
    next(err);
  }
});

app.put('/api/productos/:id', verificarAdmin, async (req, res, next) => {
  let subidas = [];
  try {
    const id = idValido(req.params.id);
    await procesarSubida(req, res);
    const body = req.body || {};
    const datos = leerProducto(body);

    let existentes = [];
    if (body.fotos_existentes) {
      try { existentes = JSON.parse(body.fotos_existentes); } catch (e) { throw invalido('La lista de fotos existentes no es válida'); }
    }
    if (!Array.isArray(existentes) || !existentes.every(urlImagenPermitida)) {
      throw invalido('La lista de fotos existentes contiene una URL no permitida');
    }

    const archivos = archivosDe(req);
    if (existentes.length + archivos.length === 0) throw invalido('El producto debe tener al menos una imagen');
    if (existentes.length + archivos.length > MAX_IMAGENES) throw invalido(`Máximo ${MAX_IMAGENES} imágenes por producto`);
    validarArchivos(archivos);

    subidas = await subirImagenes(archivos);
    const imagen_url = JSON.stringify([...existentes, ...subidas.map((s) => s.secure_url)]);

    const [resultado] = await db.query(
      `UPDATE productos SET nombre = ?, familia = ?, descripcion = ?, precio = ?, tipo = ?, genero = ?, estacion = ?,
       notas_salida = ?, notas_corazon = ?, notas_fondo = ?, destacado_hero = ?, estado_stock = ?, imagen_url = ? WHERE id = ?`,
      [datos.nombre, datos.familia, datos.descripcion, datos.precio, datos.tipo, datos.genero, datos.estacion,
       datos.notas_salida, datos.notas_corazon, datos.notas_fondo, datos.destacado_hero, datos.estado_stock, imagen_url, id]
    );
    if (resultado.affectedRows === 0) throw httpError(404, 'Producto no encontrado');
    res.json({ mensaje: 'Perfume actualizado con éxito' });
  } catch (err) {
    if (subidas.length) await borrarSubidas(subidas);
    next(err);
  }
});

app.delete('/api/productos/:id', verificarAdmin, async (req, res) => {
  const id = idValido(req.params.id);
  const [resultado] = await db.query('DELETE FROM productos WHERE id = ?', [id]);
  if (resultado.affectedRows === 0) throw httpError(404, 'No encontrado');
  res.json({ mensaje: 'Perfume eliminado con éxito' });
});

/* ---------- Reseñas ---------- */

app.get('/api/productos/:id/resenas', async (req, res) => {
  const id = idValido(req.params.id);
  const [filas] = await db.query('SELECT * FROM resenas WHERE producto_id = ? ORDER BY id DESC LIMIT 200', [id]);
  res.json(filas);
});

app.post('/api/productos/:id/resenas', limiterResenas, async (req, res) => {
  const id = idValido(req.params.id);
  const body = req.body || {};
  const autor = texto(body.autor, 'autor', { max: 60, requerido: true });
  const comentario = texto(body.comentario, 'comentario', { max: 1000, requerido: true });
  const estrellas = Number(body.estrellas);
  if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) {
    throw invalido('Las estrellas deben ser un número entero entre 1 y 5');
  }

  const [existe] = await db.query('SELECT 1 FROM productos WHERE id = ? LIMIT 1', [id]);
  if (existe.length === 0) throw httpError(404, 'Producto no encontrado');

  const [resultado] = await db.query(
    'INSERT INTO resenas (producto_id, autor, estrellas, comentario) VALUES (?, ?, ?, ?)',
    [id, autor, estrellas, comentario]
  );
  res.status(201).json({ mensaje: 'Reseña agregada con éxito', id: resultado.insertId });
});

app.delete('/api/admin/resenas/:id', verificarAdmin, async (req, res) => {
  const id = idValido(req.params.id);
  const [resultado] = await db.query('DELETE FROM resenas WHERE id = ?', [id]);
  if (resultado.affectedRows === 0) throw httpError(404, 'Reseña no encontrada');
  res.json({ mensaje: 'Reseña eliminada con éxito' });
});

/* ============================================================
 * 8. MANEJO DE ERRORES (nunca se filtran detalles internos)
 * ============================================================ */

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.expuesto) return res.status(err.status).json({ error: err.message });

  if (err instanceof multer.MulterError) {
    const mensajes = {
      LIMIT_FILE_SIZE: [413, 'Cada imagen puede pesar como máximo 5 MB'],
      LIMIT_FILE_COUNT: [400, `Máximo ${MAX_IMAGENES} imágenes por producto`],
      LIMIT_UNEXPECTED_FILE: [400, 'Campo de archivo no esperado']
    };
    const [status, mensaje] = mensajes[err.code] || [400, 'La solicitud de subida no es válida'];
    return res.status(status).json({ error: mensaje });
  }
  if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'La solicitud es demasiado grande' });
  if (err instanceof SyntaxError && err.status === 400) return res.status(400).json({ error: 'JSON inválido' });

  // Detalle solo en los logs del servidor, jamás en la respuesta.
  console.error('[error]', req.method, req.originalUrl, err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

process.on('unhandledRejection', (motivo) => console.error('[unhandledRejection]', motivo));

/* ============================================================
 * 9. ARRANQUE
 * ============================================================ */

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Servidor activo en el puerto ${PORT}`));
}

module.exports = { app };
