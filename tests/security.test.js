'use strict';
/* Pruebas de seguridad de la API. Usan la app real con MySQL y Cloudinary simulados,
 * así que no tocan ninguna base de datos ni cuenta real.  Ejecutar: npm test */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');
const { spawnSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const CLAVE = 'clave-de-pruebas-larga-y-unica-123';

// Se fijan ANTES de cargar el servidor (dotenv nunca pisa variables ya definidas).
Object.assign(process.env, {
  ADMIN_SECRET_KEY: CLAVE, SESSION_SECRET: 's'.repeat(32), NODE_ENV: 'test',
  CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 's',
  DB_HOST: 'localhost', DATABASE_URL: '', ALLOWED_ORIGINS: ''
});

/* ---------- Simulaciones ---------- */
const estado = { consultas: [], subidas: 0, borradas: [], fallarDb: false };

const dbFalsa = {
  async query(sql, params = []) {
    estado.consultas.push({ sql, params });
    if (estado.fallarDb) throw new Error('connect ECONNREFUSED db-secreta.interna:4000 (using password: YES)');
    if (/^SELECT \* FROM productos/.test(sql)) return [[{ id: 1, nombre: 'Test', precio: 100, imagen_url: '[]' }]];
    if (/^SELECT 1 FROM productos/.test(sql)) return [params[0] === 999 ? [] : [{ 1: 1 }]];
    if (/^INSERT INTO productos/.test(sql)) return [{ insertId: 7 }];
    if (/^INSERT INTO resenas/.test(sql)) return [{ insertId: 3 }];
    if (/^UPDATE/.test(sql)) return [{ affectedRows: params[params.length - 1] === 999 ? 0 : 1 }];
    if (/^DELETE/.test(sql)) return [{ affectedRows: params[0] === 999 ? 0 : 1 }];
    return [[]];
  }
};

const cloudinaryFalso = {
  v2: {
    config() {},
    uploader: {
      upload_stream(opciones, cb) {
        return {
          end() {
            estado.subidas += 1;
            const n = estado.subidas;
            setImmediate(() => cb(null, { secure_url: `https://res.cloudinary.com/demo/image/upload/f${n}.png`, public_id: `p${n}` }));
          }
        };
      },
      async destroy(id) { estado.borradas.push(id); }
    }
  }
};

const cargarOriginal = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'mysql2') return { createPool: () => ({ promise: () => dbFalsa }) };
  if (request === 'cloudinary') return cloudinaryFalso;
  return cargarOriginal.call(this, request, parent, isMain);
};

const { app } = require('../backend/server.js');

/* ---------- Utilidades ---------- */
let servidor, base, contadorIp = 0;
const nuevaIp = () => `10.${Math.floor(++contadorIp / 250)}.${(contadorIp % 250) + 1}.9`;

async function api(ruta, { metodo = 'GET', token, json, form, headers = {}, ip = nuevaIp() } = {}) {
  const h = { 'X-Forwarded-For': ip, ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) { h['Content-Type'] = 'application/json'; body = typeof json === 'string' ? json : JSON.stringify(json); }
  if (form) body = form;
  const res = await fetch(base + ruta, { method: metodo, headers: h, body, redirect: 'manual' });
  const texto = await res.text();
  let datos; try { datos = JSON.parse(texto); } catch (e) { datos = texto; }
  return { status: res.status, headers: res.headers, datos };
}

const loginToken = async () => (await api('/api/admin/login', { metodo: 'POST', json: { clave: CLAVE } })).datos.token;

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

function formProducto(extra = {}, archivos = [{ buf: PNG, tipo: 'image/png' }]) {
  const fd = new FormData();
  const campos = { nombre: 'Nuevo', familia: 'Amaderado', precio: '25000', estado_stock: '5', ...extra };
  for (const [k, v] of Object.entries(campos)) if (v !== undefined) fd.append(k, v);
  archivos.forEach((a, i) => fd.append('imagenes', new Blob([a.buf], { type: a.tipo }), `f${i}.png`));
  return fd;
}

before(async () => {
  servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  base = `http://127.0.0.1:${servidor.address().port}`;
});
after(() => servidor.close());

/* ============================================================ */
describe('Cabeceras y exposición', () => {
  it('envía CSP restrictiva, HSTS, nosniff y no revela Express', async () => {
    const r = await api('/');
    const csp = r.headers.get('content-security-policy');
    assert.ok(csp, 'falta Content-Security-Policy');
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /base-uri 'self'/);
    const scriptSrc = csp.split(';').map((s) => s.trim()).find((s) => s.startsWith('script-src '));
    assert.equal(scriptSrc, "script-src 'self'", 'script-src no debe permitir inline ni terceros');
    assert.match(r.headers.get('strict-transport-security'), /max-age=31536000/);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('x-powered-by'), null);
    assert.match(r.headers.get('permissions-policy'), /camera=\(\)/);
  });

  it('CORS cerrado: un origen ajeno no recibe Access-Control-Allow-Origin', async () => {
    const r = await api('/api/productos', { headers: { Origin: 'https://sitio-malicioso.com' } });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('access-control-allow-origin'), null);
  });

  it('no sirve archivos ocultos ni permite path traversal', async () => {
    for (const ruta of ['/.env', '/.git/config', '/..%2fbackend%2f.env', '/%2e%2e/backend/.env', '/../backend/server.js']) {
      const r = await api(ruta);
      assert.ok([400, 403, 404].includes(r.status), `${ruta} devolvió ${r.status}`);
      assert.doesNotMatch(String(r.datos), /ADMIN_SECRET_KEY|CLOUDINARY_API_SECRET/);
    }
  });

  it('admin.html no se cachea ni se indexa', async () => {
    const r = await api('/admin.html');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.match(r.headers.get('x-robots-tag'), /noindex/);
  });

  it('el catálogo público sigue funcionando', async () => {
    const r = await api('/api/productos');
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.datos));
  });
});

/* ============================================================ */
describe('Autenticación', () => {
  it('rechaza operaciones de admin sin credenciales, con basura o con token falsificado', async () => {
    const falso = `${Buffer.from(JSON.stringify({ exp: Date.now() + 1e9 })).toString('base64url')}.firmainventada`;
    for (const token of [undefined, 'abc', 'a.b.c', falso, CLAVE]) {
      const r = await api('/api/productos/1', { metodo: 'DELETE', token });
      assert.equal(r.status, 401, `token ${token} debía ser rechazado`);
    }
  });

  it('ya no acepta la contraseña cruda en el header x-admin-key (esquema viejo)', async () => {
    const r = await api('/api/productos/1', { metodo: 'DELETE', headers: { 'x-admin-key': CLAVE } });
    assert.equal(r.status, 401);
  });

  it('login correcto entrega un token que sirve; el incorrecto no', async () => {
    const mal = await api('/api/admin/login', { metodo: 'POST', json: { clave: 'incorrecta' } });
    assert.equal(mal.status, 401);
    assert.equal(mal.datos.token, undefined);

    const bien = await api('/api/admin/login', { metodo: 'POST', json: { clave: CLAVE } });
    assert.equal(bien.status, 200);
    assert.equal(typeof bien.datos.token, 'string');
    assert.ok(!JSON.stringify(bien.datos).includes(CLAVE), 'la respuesta no debe contener la contraseña');

    const borrar = await api('/api/productos/1', { metodo: 'DELETE', token: bien.datos.token });
    assert.equal(borrar.status, 200);
  });

  it('el login resiste cuerpos raros (objetos, arrays, vacío, sin Content-Type)', async () => {
    for (const json of [{ clave: { $ne: 1 } }, { clave: [CLAVE] }, { clave: 12345 }, {}]) {
      const r = await api('/api/admin/login', { metodo: 'POST', json });
      assert.equal(r.status, 401, JSON.stringify(json));
    }
    // Un JSON que no es objeto ni array (ej. `null`) lo rechaza el parser: 400, nunca un crash ni un 200.
    assert.equal((await api('/api/admin/login', { metodo: 'POST', json: 'null' })).status, 400);
    const sinCuerpo = await api('/api/admin/login', { metodo: 'POST' });
    assert.equal(sinCuerpo.status, 401);
  });

  it('bloquea fuerza bruta tras 5 fallos, y los logins correctos NO consumen el cupo', async () => {
    const ip = nuevaIp();
    for (let i = 0; i < 3; i++) {
      assert.equal((await api('/api/admin/login', { metodo: 'POST', json: { clave: CLAVE }, ip })).status, 200);
    }
    for (let i = 0; i < 5; i++) {
      assert.equal((await api('/api/admin/login', { metodo: 'POST', json: { clave: 'x' + i }, ip })).status, 401);
    }
    const bloqueado = await api('/api/admin/login', { metodo: 'POST', json: { clave: CLAVE }, ip });
    assert.equal(bloqueado.status, 429, 'el 6.º intento debe bloquearse, incluso con la clave correcta');
    // Otra IP no se ve afectada
    assert.equal((await api('/api/admin/login', { metodo: 'POST', json: { clave: CLAVE } })).status, 200);
  });
});

/* ============================================================ */
describe('Validación y subida de productos', () => {
  it('crea un producto válido y sube la imagen', async () => {
    const token = await loginToken();
    const antes = estado.subidas;
    const r = await api('/api/productos', { metodo: 'POST', token, form: formProducto() });
    assert.equal(r.status, 201, JSON.stringify(r.datos));
    assert.equal(estado.subidas, antes + 1);
    const insert = estado.consultas.filter((c) => /^INSERT INTO productos/.test(c.sql)).pop();
    assert.match(insert.params[4], /res\.cloudinary\.com/);
  });

  it('rechaza campos inválidos y NO sube nada a Cloudinary', async () => {
    const token = await loginToken();
    const casos = [
      { nombre: '' }, { nombre: 'x'.repeat(121) }, { familia: undefined },
      { precio: '-5' }, { precio: 'abc' }, { precio: '0' }, { precio: '1e12' },
      { estado_stock: '-1' }, { estado_stock: '1.5' }, { estado_stock: '999999' }
    ];
    for (const extra of casos) {
      const antes = estado.subidas;
      const r = await api('/api/productos', { metodo: 'POST', token, form: formProducto(extra) });
      assert.equal(r.status, 400, JSON.stringify(extra));
      assert.equal(estado.subidas, antes, `no debía subir imágenes con ${JSON.stringify(extra)}`);
    }
  });

  it('rechaza archivos que fingen ser imagen (MIME falso) o formatos no permitidos', async () => {
    const token = await loginToken();
    const antes = estado.subidas;
    const html = Buffer.from('<script>alert(1)</script>'.padEnd(64, ' '));
    const falsoPng = await api('/api/productos', { metodo: 'POST', token, form: formProducto({}, [{ buf: html, tipo: 'image/png' }]) });
    assert.equal(falsoPng.status, 400);
    const svg = await api('/api/productos', { metodo: 'POST', token, form: formProducto({}, [{ buf: html, tipo: 'image/svg+xml' }]) });
    assert.equal(svg.status, 400);
    const sinImagen = await api('/api/productos', { metodo: 'POST', token, form: formProducto({}, []) });
    assert.equal(sinImagen.status, 400);
    assert.equal(estado.subidas, antes);
  });

  it('limita cantidad y tamaño de las imágenes', async () => {
    const token = await loginToken();
    const seis = Array.from({ length: 6 }, () => ({ buf: PNG, tipo: 'image/png' }));
    assert.equal((await api('/api/productos', { metodo: 'POST', token, form: formProducto({}, seis) })).status, 400);
    const grande = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
    const r = await api('/api/productos', { metodo: 'POST', token, form: formProducto({}, [{ buf: grande, tipo: 'image/png' }]) });
    assert.equal(r.status, 413);
  });

  it('PUT: solo acepta URLs de imagen de hosts permitidos', async () => {
    const token = await loginToken();
    const ok = 'https://res.cloudinary.com/demo/image/upload/a.png';
    for (const mala of ['javascript:alert(1)', 'https://evil.com/x.png', 'http://res.cloudinary.com/a.png', 'data:text/html,<script>', '//evil.com/a.png']) {
      const r = await api('/api/productos/1', {
        metodo: 'PUT', token, form: formProducto({ fotos_existentes: JSON.stringify([ok, mala]) }, [])
      });
      assert.equal(r.status, 400, `debía rechazar ${mala}`);
    }
    const bien = await api('/api/productos/1', {
      metodo: 'PUT', token, form: formProducto({ fotos_existentes: JSON.stringify([ok, '/uploads/viejo.png']) }, [])
    });
    assert.equal(bien.status, 200, JSON.stringify(bien.datos));
  });

  it('PUT: exige al menos una imagen y no permite más de 5', async () => {
    const token = await loginToken();
    const sin = await api('/api/productos/1', { metodo: 'PUT', token, form: formProducto({ fotos_existentes: '[]' }, []) });
    assert.equal(sin.status, 400);
    const ok = 'https://res.cloudinary.com/demo/image/upload/a.png';
    const seis = await api('/api/productos/1', {
      metodo: 'PUT', token, form: formProducto({ fotos_existentes: JSON.stringify(Array(6).fill(ok)) }, [])
    });
    assert.equal(seis.status, 400);
  });

  it('IDs maliciosos se rechazan sin llegar a la base de datos; inexistentes dan 404', async () => {
    const token = await loginToken();
    const consultasAntes = estado.consultas.length;
    for (const id of ['abc', '1%20OR%201%3D1', '-1', '0', '1;DROP%20TABLE%20productos', '99999999999']) {
      const r = await api(`/api/productos/${id}`, { metodo: 'DELETE', token });
      assert.equal(r.status, 400, `id ${id}`);
    }
    assert.equal(estado.consultas.length, consultasAntes, 'ninguna consulta debió ejecutarse');
    assert.equal((await api('/api/productos/999', { metodo: 'DELETE', token })).status, 404);
  });

  it('todas las consultas usan parámetros (?), nunca valores concatenados', async () => {
    const token = await loginToken();
    const payload = "x'); DROP TABLE productos;--";
    await api('/api/productos', { metodo: 'POST', token, form: formProducto({ nombre: payload }) });
    const insert = estado.consultas.filter((c) => /^INSERT INTO productos/.test(c.sql)).pop();
    assert.ok(!insert.sql.includes('DROP TABLE'));
    assert.equal(insert.params[0], payload);
  });
});

/* ============================================================ */
describe('Reseñas públicas', () => {
  const ok = { autor: 'Ana', estrellas: 5, comentario: 'Excelente' };

  it('acepta una reseña válida', async () => {
    const r = await api('/api/productos/1/resenas', { metodo: 'POST', json: ok });
    assert.equal(r.status, 201);
  });

  it('valida estrellas, largo de textos y tipos', async () => {
    for (const mala of [
      { ...ok, estrellas: 0 }, { ...ok, estrellas: 6 }, { ...ok, estrellas: 'cinco' }, { ...ok, estrellas: 4.5 },
      { ...ok, autor: '' }, { ...ok, autor: 'a'.repeat(61) }, { ...ok, comentario: 'c'.repeat(1001) },
      { ...ok, autor: { $gt: '' } }, { ...ok, comentario: ['x'] }
    ]) {
      const r = await api('/api/productos/1/resenas', { metodo: 'POST', json: mala });
      assert.equal(r.status, 400, JSON.stringify(mala));
    }
  });

  it('404 si el producto no existe', async () => {
    assert.equal((await api('/api/productos/999/resenas', { metodo: 'POST', json: ok })).status, 404);
  });

  it('limita el spam: máximo 5 reseñas por hora por IP', async () => {
    const ip = nuevaIp();
    for (let i = 0; i < 5; i++) assert.equal((await api('/api/productos/1/resenas', { metodo: 'POST', json: ok, ip })).status, 201);
    assert.equal((await api('/api/productos/1/resenas', { metodo: 'POST', json: ok, ip })).status, 429);
  });

  it('borrar reseñas requiere admin', async () => {
    assert.equal((await api('/api/admin/resenas/1', { metodo: 'DELETE' })).status, 401);
  });
});

/* ============================================================ */
describe('Manejo de errores', () => {
  it('un fallo de base de datos NO filtra detalles internos', async () => {
    estado.fallarDb = true;
    try {
      const r = await api('/api/productos');
      assert.equal(r.status, 500);
      assert.deepEqual(r.datos, { error: 'Error interno del servidor' });
      assert.doesNotMatch(JSON.stringify(r.datos), /db-secreta|ECONNREFUSED|password/);
    } finally { estado.fallarDb = false; }
  });

  it('JSON inválido → 400; JSON gigante → 413; ruta API desconocida → 404 JSON', async () => {
    assert.equal((await api('/api/admin/login', { metodo: 'POST', json: '{no es json' })).status, 400);
    const grande = await api('/api/admin/login', { metodo: 'POST', json: JSON.stringify({ clave: 'a'.repeat(20000) }) });
    assert.equal(grande.status, 413);
    const r = await api('/api/no-existe');
    assert.equal(r.status, 404);
    assert.deepEqual(r.datos, { error: 'Ruta no encontrada' });
  });

  it('el limitador general corta el abuso (100 solicitudes / 15 min por IP)', async () => {
    const ip = nuevaIp();
    let ultimo;
    for (let i = 0; i < 101; i++) ultimo = await api('/api/productos', { ip });
    assert.equal(ultimo.status, 429);
  });
});

/* ============================================================ */
describe('Arranque seguro', () => {
  const arrancar = (claveAdmin) => spawnSync(process.execPath, ['-e', "require('./backend/server.js')"], {
    cwd: RAIZ, encoding: 'utf8', timeout: 20000,
    env: { PATH: process.env.PATH, NODE_ENV: 'test', ADMIN_SECRET_KEY: claveAdmin }
  });

  it('se niega a iniciar sin ADMIN_SECRET_KEY', () => {
    const r = arrancar('');
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Falta ADMIN_SECRET_KEY/);
  });

  it('se niega a iniciar con la clave que estuvo publicada en GitHub', () => {
    const r = arrancar('perfumeAdmin2026');
    assert.equal(r.status, 1);
    assert.match(r.stderr, /publicada/);
  });

  it('se niega a iniciar con una clave corta', () => {
    const r = arrancar('corta123');
    assert.equal(r.status, 1);
    assert.match(r.stderr, /demasiado corta/);
  });

  it('inicia con una clave válida', () => {
    const r = arrancar('una-clave-valida-y-larga-2026');
    assert.equal(r.status, 0, r.stderr);
  });
});

describe('Modo producción', () => {
  it('redirige HTTP→HTTPS y agrega upgrade-insecure-requests', async () => {
    const previo = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const ruta = require.resolve('../backend/server.js');
    delete require.cache[ruta];
    const { app: appProd } = require('../backend/server.js');
    process.env.NODE_ENV = previo;

    const srv = appProd.listen(0);
    await new Promise((r) => srv.once('listening', r));
    const url = `http://127.0.0.1:${srv.address().port}`;
    try {
      const http = await fetch(`${url}/x?y=1`, { redirect: 'manual', headers: { 'x-forwarded-proto': 'http' } });
      assert.equal(http.status, 301);
      assert.match(http.headers.get('location'), /^https:\/\/.+\/x\?y=1$/);
      const https = await fetch(`${url}/`, { headers: { 'x-forwarded-proto': 'https' } });
      assert.equal(https.status, 200);
      assert.match(https.headers.get('content-security-policy'), /upgrade-insecure-requests/);
    } finally { srv.close(); }
  });
});
