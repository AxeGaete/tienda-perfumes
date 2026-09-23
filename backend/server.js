require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();

// Solución para Render / express-rate-limit (Trust Proxy)
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

// Activar Helmet para asegurar las cabeceras HTTP contra ataques web comunes
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'perfumeAdmin2026';

// Configuración de Rate Limiting para seguridad contra fuerza bruta y abuso
const limiterGeneral = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Límite de 100 peticiones por IP cada 15 minutos
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes desde esta IP, intente nuevamente más tarde.' }
});

const limiterLogin = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 intentos fallidos de login por IP
  message: { error: 'Demasiados intentos de acceso fallidos. Su IP fue temporalmente bloqueada.' }
});

// Aplicar limitadores a las rutas de la API
app.use('/api/', limiterGeneral);

// Configuración de Cloudinary para almacenamiento permanente
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'parfum-studio',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'avif'],
  },
});
const upload = multer({ storage });

let dbConfig;
if (process.env.DATABASE_URL) {
  dbConfig = {
    uri: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };
} else {
  dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'test',
    ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };
}

const db = mysql.createPool(dbConfig);

app.use(express.static(path.resolve(__dirname, '../frontend')));

function verificarAdmin(req, res, next) {
  const claveEnviada = req.headers['x-admin-key'];
  if (!claveEnviada || claveEnviada !== ADMIN_SECRET_KEY) {
    return res.status(403).json({ error: 'Acceso no autorizado' });
  }
  next();
}

// Aplicar el limitador estricto específicamente al login del admin
app.post('/api/admin/login', limiterLogin, (req, res) => {
  const { clave } = req.body;
  if (clave === ADMIN_SECRET_KEY) return res.json({ ok: true });
  res.status(401).json({ error: 'Contraseña incorrecta' });
});

app.get('/api/productos', (req, res) => {
  db.query('SELECT * FROM productos ORDER BY id DESC', (err, results) => {
    if (err) {
      console.error('Error al consultar productos:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

app.post('/api/productos', verificarAdmin, (req, res) => {
  const uploadHandler = upload.fields([
    { name: 'imagenes', maxCount: 5 },
    { name: 'imagen', maxCount: 5 }
  ]);

  uploadHandler(req, res, (err) => {
    if (err) {
      console.error('Error en multer al subir imágenes:', err);
      return res.status(400).json({ error: `Error en subida: ${err.message}` });
    }

    const { nombre, familia, descripcion, precio, tipo, genero, estacion, notas_salida, notas_corazon, notas_fondo, destacado_hero, estado_stock } = req.body;
    const archivos = (req.files && (req.files['imagenes'] || req.files['imagen'])) || [];

    if (!nombre || !familia || !precio || archivos.length === 0) {
      return res.status(400).json({ error: 'Todos los campos básicos y al menos una imagen son obligatorios' });
    }

    // Cloudinary almacena la URL pública permanente en file.path
    const rutasImagenes = archivos.map(file => file.path);
    const imagen_url = JSON.stringify(rutasImagenes);
    const esHero = (destacado_hero === '1' || destacado_hero === true || destacado_hero === 'true') ? 1 : 0;
    const stockVal = estado_stock !== undefined && estado_stock !== '' ? parseInt(estado_stock) : 10;

    const sql = `INSERT INTO productos (nombre, familia, descripcion, precio, imagen_url, tipo, genero, estacion, notas_salida, notas_corazon, notas_fondo, destacado_hero, estado_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.query(sql, [nombre, familia, descripcion || '', precio, imagen_url, tipo || 'Diseñador', genero || 'Unisex', estacion || 'Todo el año', notas_salida || '', notas_corazon || '', notas_fondo || '', esHero, stockVal], (dbErr, result) => {
      if (dbErr) {
        console.error('ERROR CRÍTICO EN BASE DE DATOS (INSERT):', dbErr);
        return res.status(500).json({ error: 'Error en la base de datos', detalle: dbErr.message });
      }
      res.status(201).json({ mensaje: 'Perfume agregado con éxito', id: result.insertId });
    });
  });
});

app.put('/api/productos/:id', verificarAdmin, (req, res) => {
  const uploadHandler = upload.fields([
    { name: 'imagenes', maxCount: 5 },
    { name: 'imagen', maxCount: 5 }
  ]);

  uploadHandler(req, res, (err) => {
    if (err) {
      console.error('Error en multer al actualizar imágenes:', err);
      return res.status(400).json({ error: `Error en subida: ${err.message}` });
    }

    const { id } = req.params;
    const { nombre, familia, descripcion, precio, tipo, genero, estacion, notas_salida, notas_corazon, notas_fondo, destacado_hero, estado_stock, fotos_existentes } = req.body;

    if (!nombre || !familia || !precio) {
      return res.status(400).json({ error: 'Nombre, familia y precio son obligatorios' });
    }

    let fotosAntiguasOrdenadas = [];
    try {
      fotosAntiguasOrdenadas = JSON.parse(fotos_existentes || '[]');
    } catch(e) {}

    const archivosNuevos = (req.files && (req.files['imagenes'] || req.files['imagen'])) || [];
    const nuevasUrls = archivosNuevos.map(file => file.path);
    const imagen_url = JSON.stringify([...fotosAntiguasOrdenadas, ...nuevasUrls]);
    const esHero = (destacado_hero === '1' || destacado_hero === true || destacado_hero === 'true') ? 1 : 0;
    const stockVal = estado_stock !== undefined && estado_stock !== '' ? parseInt(estado_stock) : 10;

    const sql = `UPDATE productos SET nombre = ?, familia = ?, descripcion = ?, precio = ?, tipo = ?, genero = ?, estacion = ?, notas_salida = ?, notas_corazon = ?, notas_fondo = ?, destacado_hero = ?, estado_stock = ?, imagen_url = ? WHERE id = ?`;

    db.query(sql, [nombre, familia, descripcion || '', precio, tipo || 'Diseñador', genero || 'Unisex', estacion || 'Todo el año', notas_salida || '', notas_corazon || '', notas_fondo || '', esHero, stockVal, imagen_url, id], (dbErr) => {
      if (dbErr) {
        console.error('ERROR CRÍTICO EN BASE DE DATOS (UPDATE):', dbErr);
        return res.status(500).json({ error: 'Error en la base de datos', detalle: dbErr.message });
      }
      res.json({ mensaje: 'Perfume actualizado con éxito' });
    });
  });
});

app.delete('/api/productos/:id', verificarAdmin, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM productos WHERE id = ?', [id], (err, result) => {
    if (err) {
      console.error('Error al eliminar producto:', err);
      return res.status(500).json({ error: 'Error al eliminar' });
    }
    if (result.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ mensaje: 'Perfume eliminado con éxito' });
  });
});

// ================= ENDPOINTS DE RESEÑAS =================
app.get('/api/productos/:id/resenas', (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM resenas WHERE producto_id = ? ORDER BY id DESC', [id], (err, results) => {
    if (err) {
      console.error('Error al obtener reseñas:', err);
      return res.status(500).json({ error: 'Error al cargar reseñas' });
    }
    res.json(results);
  });
});

app.post('/api/productos/:id/resenas', (req, res) => {
  const { id } = req.params;
  const { autor, estrellas, comentario } = req.body;

  if (!autor || !estrellas || !comentario) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  const sql = 'INSERT INTO resenas (producto_id, autor, estrellas, comentario) VALUES (?, ?, ?, ?)';
  db.query(sql, [id, autor, parseInt(estrellas), comentario], (err, result) => {
    if (err) {
      console.error('Error al guardar reseña:', err);
      return res.status(500).json({ error: 'Error al guardar la reseña' });
    }
    res.status(201).json({ mensaje: 'Reseña agregada con éxito', id: result.insertId });
  });
});

app.delete('/api/admin/resenas/:id', verificarAdmin, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM resenas WHERE id = ?', [id], (err, result) => {
    if (err) {
      console.error('Error al eliminar reseña:', err);
      return res.status(500).json({ error: 'Error al eliminar la reseña' });
    }
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Reseña no encontrada' });
    res.json({ mensaje: 'Reseña eliminada con éxito' });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor activo en el puerto ${PORT}`);
});