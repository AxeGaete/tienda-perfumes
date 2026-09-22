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

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

app.use(express.static(path.join(__dirname, '../frontend')));

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

app.post('/api/admin/login', (req, res) => {
  const { clave } = req.body;
  if (clave === ADMIN_SECRET_KEY) return res.json({ ok: true });
  res.status(401).json({ error: 'Contraseña incorrecta' });
});

app.get('/api/productos', (req, res) => {
  db.query('SELECT * FROM productos', (err, results) => {
    if (err) {
      console.error('Error al consultar:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

app.post('/api/productos', verificarAdmin, upload.single('imagen'), (req, res) => {
  const { nombre, familia, descripcion, precio } = req.body;
  if (!nombre || !familia || !precio || !req.file) {
    return res.status(400).json({ error: 'Todos los campos y la imagen son obligatorios' });
  }

  const imagen_url = `/uploads/${req.file.filename}`;
  const sql = `INSERT INTO productos (nombre, familia, descripcion, precio, imagen_url) VALUES (?, ?, ?, ?, ?)`;

  db.query(sql, [nombre, familia, descripcion, precio, imagen_url], (err, result) => {
    if (err) {
      console.error('Error al insertar:', err);
      return res.status(500).json({ error: 'Error en la base de datos' });
    }
    res.status(201).json({ mensaje: 'Perfume agregado', id: result.insertId });
  });
});

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
