# PARFUM STUDIO — Tienda de perfumes

Tienda online con panel de administración (Node.js + Express + MySQL + Cloudinary).

## ⚠️ Acción requerida antes de usar este código

Este repositorio tuvo **su contraseña de administrador publicada en el historial de Git**
(`ADMIN_SECRET_KEY=perfumeAdmin2026`, commit visible en GitHub). El servidor ahora **se niega a
iniciar** si detecta esa clave o cualquiera con menos de 12 caracteres, pero además hay que:

1. **Rotar todos los secretos** que estaban en `backend/.env` (aunque ese archivo nunca se subió
   a Git, es buena práctica rotarlos igual si hubo dudas de exposición): `ADMIN_SECRET_KEY`,
   `DB_PASSWORD`, `CLOUDINARY_API_SECRET`. Panel de Render → Environment → editar variables.
2. Si el repositorio es público, considerar limpiar el historial de Git de la clave filtrada con
   `git filter-repo` (la clave ya fue invalidada en el punto 1, pero seguirá visible en commits viejos).
3. Copiar `.env.example` a `backend/.env` y completar los valores reales (o cargarlos directo en
   las variables de entorno de Render).

## Instalación

```bash
npm install
cp .env.example backend/.env   # completar con valores reales
npm start
```

## Variables de entorno

Ver [`.env.example`](.env.example) para la lista completa y comentada. Las obligatorias son:
`ADMIN_SECRET_KEY`, y (`DATABASE_URL`) o (`DB_HOST`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`), y las tres
de Cloudinary.

## Esquema de base de datos

El servidor no crea las tablas automáticamente. Ejecutar una sola vez:

```sql
CREATE TABLE productos (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  nombre           VARCHAR(120)  NOT NULL,
  familia          VARCHAR(60)   NOT NULL,
  descripcion      TEXT,
  precio           DECIMAL(10,2) NOT NULL,
  imagen_url       TEXT          NOT NULL,   -- JSON con hasta 5 URLs de Cloudinary
  tipo             VARCHAR(40)   DEFAULT 'Diseñador',
  genero           VARCHAR(40)   DEFAULT 'Unisex',
  estacion         VARCHAR(40)   DEFAULT 'Todo el año',
  notas_salida     VARCHAR(300),
  notas_corazon    VARCHAR(300),
  notas_fondo      VARCHAR(300),
  destacado_hero   TINYINT(1)    DEFAULT 0,
  estado_stock     INT           DEFAULT 10,
  creado_en        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE resenas (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  producto_id  INT NOT NULL,
  autor        VARCHAR(60)  NOT NULL,
  estrellas    TINYINT      NOT NULL,
  comentario   VARCHAR(1000) NOT NULL,
  creado_en    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## Pruebas

```bash
npm test          # 31 pruebas de seguridad (auth, validación, XSS, rate limiting, cabeceras...)
npm run audit:prod
```

Corren automáticamente en cada push/PR y todos los lunes vía GitHub Actions
(`.github/workflows/security.yml`).

## Seguridad — resumen de lo implementado

- **Autenticación**: token de sesión firmado (HMAC) y con expiración de 2 h, en vez de la
  contraseña viajando en cada request. Comparación en tiempo constante. Rate limit de 5 intentos
  fallidos / 15 min por IP.
- **Cabeceras**: Helmet con CSP restrictiva (`script-src 'self'`, sin `unsafe-inline` en scripts),
  HSTS, `X-Content-Type-Options`, `Permissions-Policy`. Redirección forzada a HTTPS en producción.
- **XSS**: toda variable insertada con `innerHTML` pasa por `escapeHtml()`; las URLs de imagen
  por `urlImagenSegura()` (solo `https:` de hosts conocidos, o `data:` embebido).
- **Inyección SQL**: 100% de las consultas parametrizadas (`?`), nunca concatenadas.
- **Subida de archivos**: el tipo se valida por la firma real del archivo (magic bytes), no por el
  `Content-Type` declarado por el cliente; límite de 5 MB y 5 imágenes por producto; si algo falla
  a mitad de camino, se borran de Cloudinary las imágenes ya subidas.
- **CORS**: cerrado por defecto (frontend y backend en el mismo origen).
- **Rate limiting**: general (100 req / 15 min) y específico para login y reseñas.
- **Manejo de errores**: nunca se filtran mensajes internos, rutas de archivos ni credenciales al
  cliente; sí quedan en los logs del servidor.
- **Arranque seguro**: el proceso no inicia si falta `ADMIN_SECRET_KEY`, si es la clave que estuvo
  filtrada en GitHub, o si es demasiado corta.

Ver el historial de commits de la rama `seguridad` para el detalle línea por línea.
