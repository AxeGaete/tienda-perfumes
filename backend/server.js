require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json());

const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'perfumeAdmin2026';

// Configuración de conexión MySQL (soporta DATABASE_URL o variables individuales)
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

// Carpeta uploads con ruta absoluta y creación garantizada
const uploadsDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Servir archivos estáticos del frontend
app.use(express.static(path.resolve(__dirname, '../frontend')));

// Configuración de almacenamiento Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const sufijoUnico = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'perfume-' + sufijoUnico + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

function verificarAdmin(req, res, next) {
  const claveEnviada = req.headers['x-admin-key'];
  if (!claveEnviada || claveEnviada !== ADMIN_SECRET_KEY) {
    return res.status(403).json({ error: 'Acceso no autorizado' });
  }
  next();
}

// Endpoint de login
app.post('/api/admin/login', (req, res) => {
  const { clave } = req.body;
  if (clave === ADMIN_SECRET_KEY) return res.json({ ok: true });
  res.status(401).json({ error: 'Contraseña incorrecta' });
});

// GET productos
app.get('/api/productos', (req, res) => {
  db.query('SELECT * FROM productos ORDER BY id DESC', (err, results) => {
    if (err) {
      console.error('Error al consultar:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// POST productos (con foto principal ordenada y destacado para hero)
app.post('/api/productos', verificarAdmin, (req, res) => {
  const uploadHandler = upload.fields([
    { name: 'imagenes', maxCount: 5 },
    { name: 'imagen', maxCount: 5 }
  ]);

  uploadHandler(req, res, (err) => {
    if (err) {
      console.error('Error Multer al procesar archivos:', err);
      return res.status(400).json({ error: `Error en la subida de fotos: ${err.message}` });
    }

    const { 
      nombre, 
      familia, 
      descripcion, 
      precio, 
      tipo,
      genero, 
      estacion, 
      notas_salida, 
      notas_corazon, 
      notas_fondo,
      foto_principal_idx,
      destacado_hero
    } = req.body;

    const archivos = (req.files && (req.files['imagenes'] || req.files['imagen'])) || [];

    if (!nombre || !familia || !precio || archivos.length === 0) {
      return res.status(400).json({ error: 'Todos los campos básicos y al menos una imagen son obligatorios' });
    }

    // Ordenar las imágenes para que la seleccionada como principal quede en el índice 0
    let idxPrincipal = parseInt(foto_principal_idx) || 0;
    if (idxPrincipal < 0 || idxPrincipal >= archivos.length) idxPrincipal = 0;

    const archivosOrdenados = [...archivos];
    const [fotoElegida] = archivosOrdenados.splice(idxPrincipal, 1);
    archivosOrdenados.unshift(fotoElegida);

    const rutasImagenes = archivosOrdenados.map(file => `/uploads/${file.filename}`);
    const imagen_url = JSON.stringify(rutasImagenes);
    const esHero = (destacado_hero === '1' || destacado_hero === true || destacado_hero === 'true') ? 1 : 0;

    const sql = `INSERT INTO productos 
      (nombre, familia, descripcion, precio, imagen_url, tipo, genero, estacion, notas_salida, notas_corazon, notas_fondo, destacado_hero) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.query(sql, [
      nombre, 
      familia, 
      descripcion || '', 
      precio, 
      imagen_url, 
      tipo || 'Diseñador',
      genero || 'Unisex',
      estacion || 'Todo el año',
      notas_salida || '', 
      notas_corazon || '', 
      notas_fondo || '',
      esHero
    ], (dbErr, result) => {
      if (dbErr) {
        console.error('Error en base de datos al insertar:', dbErr);
        return res.status(500).json({ error: 'Error en la base de datos: ' + dbErr.message });
      }
      res.status(201).json({ mensaje: 'Perfume agregado con éxito', id: result.insertId });
    });
  });
});

// PUT producto completo (información, fotos opcionales y destacado)
app.put('/api/productos/:id', verificarAdmin, (req, res) => {
  const uploadHandler = upload.fields([
    { name: 'imagenes', maxCount: 5 },
    { name: 'imagen', maxCount: 5 }
  ]);

  uploadHandler(req, res, (err) => {
    if (err) {
      console.error('Error Multer al procesar fotos en edición:', err);
      return res.status(400).json({ error: `Error en la subida de fotos: ${err.message}` });
    }

    const { id } = req.params;
    const { 
      nombre, 
      familia, 
      descripcion, 
      precio, 
      tipo,
      genero, 
      estacion, 
      notas_salida, 
      notas_corazon, 
      notas_fondo,
      foto_principal_idx,
      destacado_hero
    } = req.body;

    if (!nombre || !familia || !precio) {
      return res.status(400).json({ error: 'Nombre, familia y precio son obligatorios' });
    }

    const archivos = (req.files && (req.files['imagenes'] || req.files['imagen'])) || [];
    const esHero = (destacado_hero === '1' || destacado_hero === true || destacado_hero === 'true') ? 1 : 0;

    // Si se subieron fotos nuevas, las procesamos y ordenamos
    if (archivos.length > 0) {
      let idxPrincipal = parseInt(foto_principal_idx) || 0;
      if (idxPrincipal < 0 || idxPrincipal >= archivos.length) idxPrincipal = 0;

      const archivosOrdenados = [...archivos];
      const [fotoElegida] = archivosOrdenados.splice(idxPrincipal, 1);
      archivosOrdenados.unshift(fotoElegida);

      const rutasImagenes = archivosOrdenados.map(file => `/uploads/${file.filename}`);
      const imagen_url = JSON.stringify(rutasImagenes);

      const sql = `UPDATE productos SET 
        nombre = ?, familia = ?, descripcion = ?, precio = ?, tipo = ?, 
        genero = ?, estacion = ?, notas_salida = ?, notas_corazon = ?, 
        notas_fondo = ?, destacado_hero = ?, imagen_url = ? 
        WHERE id = ?`;

      db.query(sql, [
        nombre, familia, descripcion || '', precio, tipo || 'Diseñador',
        genero || 'Unisex', estacion || 'Todo el año', notas_salida || '',
        notas_corazon || '', notas_fondo || '', esHero, imagen_url, id
      ], (dbErr, result) => {
        if (dbErr) {
          console.error('Error al actualizar perfume con fotos:', dbErr);
          return res.status(500).json({ error: 'Error en la base de datos' });
        }
        res.json({ mensaje: 'Perfume y fotos actualizados con éxito' });
      });
    } else {
      // Si no se enviaron fotos nuevas, se conservan las existentes
      const sql = `UPDATE productos SET 
        nombre = ?, familia = ?, descripcion = ?, precio = ?, tipo = ?, 
        genero = ?, estacion = ?, notas_salida = ?, notas_corazon = ?, 
        notas_fondo = ?, destacado_hero = ? 
        WHERE id = ?`;

      db.query(sql, [
        nombre, familia, descripcion || '', precio, tipo || 'Diseñador',
        genero || 'Unisex', estacion || 'Todo el año', notas_salida || '',
        notas_corazon || '', notas_fondo || '', esHero, id
      ], (dbErr, result) => {
        if (dbErr) {
          console.error('Error al actualizar perfume:', dbErr);
          return res.status(500).json({ error: 'Error en la base de datos' });
        }
        res.json({ mensaje: 'Información del perfume actualizada con éxito' });
      });
    }
  });
});

// DELETE producto
app.delete('/api/productos/:id', verificarAdmin, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM productos WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error al eliminar' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ mensaje: 'Perfume eliminado con éxito' });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor activo en el puerto ${PORT}`);
});