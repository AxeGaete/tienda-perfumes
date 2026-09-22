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

// POST productos (con manejo de errores de Multer para evitar el 500 no controlado)
// POST productos (acepta tanto 'imagenes' como 'imagen', múltiple o individual)
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

    const { nombre, familia, descripcion, precio } = req.body;
    
    // Obtener los archivos sin importar cuál de las dos claves envió el frontend
    const archivos = (req.files && (req.files['imagenes'] || req.files['imagen'])) || [];

    if (!nombre || !familia || !precio || archivos.length === 0) {
      return res.status(400).json({ error: 'Todos los campos y al menos una imagen son obligatorios' });
    }

    // Guardar rutas relativas serializadas en formato JSON
    const rutasImagenes = archivos.map(file => `/uploads/${file.filename}`);
    const imagen_url = JSON.stringify(rutasImagenes);

    const sql = `INSERT INTO productos (nombre, familia, descripcion, precio, imagen_url) VALUES (?, ?, ?, ?, ?)`;

    db.query(sql, [nombre, familia, descripcion, precio, imagen_url], (dbErr, result) => {
      if (dbErr) {
        console.error('Error en base de datos al insertar:', dbErr);
        return res.status(500).json({ error: 'Error en la base de datos: ' + dbErr.message });
      }
      res.status(201).json({ mensaje: 'Perfume agregado con éxito', id: result.insertId });
    });
  });
});

// PUT precio
app.put('/api/productos/:id', verificarAdmin, (req, res) => {
  const { id } = req.params;
  const { precio } = req.body;
  if (precio === undefined || isNaN(precio)) return res.status(400).json({ error: 'Precio inválido' });

  db.query('UPDATE productos SET precio = ? WHERE id = ?', [precio, id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error al actualizar' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ mensaje: 'Precio actualizado con éxito' });
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