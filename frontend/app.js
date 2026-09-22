let todosLosProductos = [];
let filtroFamilia = 'todos';
let filtroGenero = 'todos';
let filtroEstacion = 'todos';

// Elementos de UI
const gridProductos = document.getElementById('grid-productos');
const inputBuscador = document.getElementById('buscador');
const selectOrden = document.getElementById('select-orden');
const sliderPrecio = document.getElementById('slider-precio');
const labelPrecioMax = document.getElementById('label-precio-max');

const chipsFamilia = document.querySelectorAll('#chips-familia .chip');
const chipsGenero = document.querySelectorAll('#chips-genero .chip');
const chipsEstacion = document.querySelectorAll('#chips-estacion .chip');

// Sección Detalle
const seccionDetalle = document.getElementById('detalle');
const detalleImgPrincipal = document.getElementById('detalle-img-principal');
const detalleThumbnails = document.getElementById('detalle-thumbnails');
const detalleFamilia = document.getElementById('detalle-familia');
const detalleNombre = document.getElementById('detalle-nombre');
const detallePrecio = document.getElementById('detalle-precio');
const detalleDescripcion = document.getElementById('detalle-descripcion');
const detalleSalida = document.getElementById('detalle-salida');
const detalleCorazon = document.getElementById('detalle-corazon');
const detalleFondo = document.getElementById('detalle-fondo');
const detalleBtnWsp = document.getElementById('detalle-btn-wsp');

let fotosDetalleActuales = [];
let indiceFotoDetalle = 0;
const imagenFallback = 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=600&q=80';

// ================= CARRUSEL HERO =================
let slideHeroActual = 0;
const slidesHero = document.querySelectorAll('.carousel-slide');
const dotsContainer = document.getElementById('hero-carousel-dots');

function inicializarCarruselHero() {
  if (!dotsContainer || slidesHero.length === 0) return;
  dotsContainer.innerHTML = '';
  slidesHero.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = `dot ${i === 0 ? 'active' : ''}`;
    dot.onclick = () => irASlideHero(i);
    dotsContainer.appendChild(dot);
  });
  setInterval(() => moverCarruselHero(1), 4500);
}

window.moverCarruselHero = function(dir) {
  if (slidesHero.length === 0) return;
  slideHeroActual = (slideHeroActual + dir + slidesHero.length) % slidesHero.length;
  slidesHero.forEach((s, i) => s.classList.toggle('active', i === slideHeroActual));
  document.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === slideHeroActual));
};

function irASlideHero(idx) {
  slideHeroActual = idx;
  slidesHero.forEach((s, i) => s.classList.toggle('active', i === slideHeroActual));
  document.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === slideHeroActual));
}

// ================= CARGA Y RENDER =================
function obtenerFotos(imagen_url) {
  try {
    const parsed = JSON.parse(imagen_url);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (e) {}
  return [imagen_url || imagenFallback];
}

async function cargarCatalogo() {
  try {
    const res = await fetch('/api/productos');
    if (!res.ok) throw new Error('Error al cargar productos');
    todosLosProductos = await res.json();

    if (todosLosProductos.length > 0 && sliderPrecio) {
      const maximo = Math.max(...todosLosProductos.map(p => Number(p.precio) || 0));
      if (maximo > 150000) {
        sliderPrecio.max = maximo;
        sliderPrecio.value = maximo;
        labelPrecioMax.textContent = `$${maximo.toLocaleString('es-AR')}`;
      }
    }
    aplicarFiltrosYOrden();
  } catch (err) {
    console.error(err);
    if (gridProductos) gridProductos.innerHTML = '<p style="color: #FF4949; text-align: center; grid-column: 1/-1;">Error al cargar las fragancias.</p>';
  }
}

function renderizarProductos(productos) {
  if (!gridProductos) return;
  gridProductos.innerHTML = '';

  if (productos.length === 0) {
    gridProductos.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem; color: #6C727F;">
        <p style="font-size: 1.1rem; font-weight: 700; color: #1A1A1E; margin-bottom: 0.5rem;">No se encontraron perfumes con esos filtros exactos.</p>
        <p style="font-size: 0.9rem;">Probá combinando menos opciones o limpiá los filtros con el botón superior.</p>
      </div>`;
    return;
  }

  productos.forEach(perfume => {
    const tarjeta = document.createElement('div');
    tarjeta.className = 'product-card';

    const fotos = obtenerFotos(perfume.imagen_url);
    const fotoPortada = fotos[0];
    const precioNumero = Number(perfume.precio) || 0;

    tarjeta.innerHTML = `
      <a href="#detalle" class="card-image-link" onclick="mostrarDetalle(${perfume.id})">
        <img src="${fotoPortada}" alt="${perfume.nombre}" onerror="this.onerror=null; this.src='${imagenFallback}';">
      </a>
      <div class="product-info">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem;">
          <span class="product-family">${perfume.familia}</span>
          <span style="font-size: 0.68rem; font-weight: 700; color: #9E9EA4; text-transform: uppercase;">${perfume.genero || 'Unisex'}</span>
        </div>
        <h3 class="product-title">
          <a href="#detalle" class="card-title-link" onclick="mostrarDetalle(${perfume.id})">${perfume.nombre}</a>
        </h3>
        <p class="product-desc">${perfume.descripcion || ''}</p>
        <div class="product-price">$${precioNumero.toLocaleString('es-AR')}</div>
        <a href="#detalle" class="btn-ver-detalle" onclick="mostrarDetalle(${perfume.id})">
          Ver Detalles (${fotos.length} ${fotos.length > 1 ? 'fotos' : 'foto'})
        </a>
      </div>
    `;
    gridProductos.appendChild(tarjeta);
  });
}

// ================= DETALLE =================
window.mostrarDetalle = function(id) {
  const perfume = todosLosProductos.find(p => p.id === id);
  if (!perfume) return;

  fotosDetalleActuales = obtenerFotos(perfume.imagen_url);
  indiceFotoDetalle = 0;
  const precioNumero = Number(perfume.precio) || 0;

  actualizarFotoPrincipalDetalle();

  detalleThumbnails.innerHTML = '';
  fotosDetalleActuales.forEach((fotoUrl, index) => {
    const thumb = document.createElement('img');
    thumb.src = fotoUrl;
    thumb.className = `detail-thumb ${index === 0 ? 'active' : ''}`;
    thumb.onclick = () => {
      indiceFotoDetalle = index;
      actualizarFotoPrincipalDetalle();
    };
    detalleThumbnails.appendChild(thumb);
  });

  detalleFamilia.textContent = `${perfume.familia} • ${perfume.genero || 'Unisex'}`;
  detalleNombre.textContent = perfume.nombre;
  detallePrecio.textContent = `$${precioNumero.toLocaleString('es-AR')}`;
  detalleDescripcion.textContent = perfume.descripcion || '';

  document.getElementById('row-salida').style.display = perfume.notas_salida ? 'flex' : 'none';
  detalleSalida.textContent = perfume.notas_salida || '';

  document.getElementById('row-corazon').style.display = perfume.notas_corazon ? 'flex' : 'none';
  detalleCorazon.textContent = perfume.notas_corazon || '';

  document.getElementById('row-fondo').style.display = perfume.notas_fondo ? 'flex' : 'none';
  detalleFondo.textContent = perfume.notas_fondo || '';

  const mensajeWsp = encodeURIComponent(`¡Hola! Quisiera comprar el perfume ${perfume.nombre} ($${precioNumero.toLocaleString('es-AR')}).`);
  detalleBtnWsp.href = `https://wa.me/5491112345678?text=${mensajeWsp}`;

  seccionDetalle.style.display = 'block';
};

window.cambiarFotoDetalle = function(dir) {
  if (fotosDetalleActuales.length <= 1) return;
  indiceFotoDetalle = (indiceFotoDetalle + dir + fotosDetalleActuales.length) % fotosDetalleActuales.length;
  actualizarFotoPrincipalDetalle();
};

function actualizarFotoPrincipalDetalle() {
  detalleImgPrincipal.src = fotosDetalleActuales[indiceFotoDetalle];
  detalleImgPrincipal.onerror = () => { detalleImgPrincipal.src = imagenFallback; };
  document.querySelectorAll('.detail-thumb').forEach((t, i) => {
    t.classList.toggle('active', i === indiceFotoDetalle);
  });
}

// ================= MOTOR DE FILTROS ESPECÍFICOS =================
function aplicarFiltrosYOrden() {
  const query = inputBuscador ? inputBuscador.value.toLowerCase().trim() : '';
  const precioMax = sliderPrecio ? Number(sliderPrecio.value) : Infinity;
  const criterioOrden = selectOrden ? selectOrden.value : 'recientes';

  let filtrados = todosLosProductos.filter(p => {
    // 1. Coincidencia por texto en nombre, familia, descripción o notas olfativas
    const enNombre = (p.nombre || '').toLowerCase().includes(query);
    const enDesc = (p.descripcion || '').toLowerCase().includes(query);
    const enSalida = (p.notas_salida || '').toLowerCase().includes(query);
    const enCorazon = (p.notas_corazon || '').toLowerCase().includes(query);
    const enFondo = (p.notas_fondo || '').toLowerCase().includes(query);
    const coincideTexto = !query || enNombre || enDesc || enSalida || enCorazon || enFondo;

    // 2. Coincidencia por familia
    const coincideFamilia = filtroFamilia === 'todos' || p.familia === filtroFamilia;

    // 3. Coincidencia por género
    const coincideGenero = filtroGenero === 'todos' || (p.genero || 'Unisex') === filtroGenero;

    // 4. Coincidencia por ocasión / estación
    const coincideEstacion = filtroEstacion === 'todos' || (p.estacion || 'Todo el año') === filtroEstacion;

    // 5. Coincidencia de precio
    const coincidePrecio = (Number(p.precio) || 0) <= precioMax;

    return coincideTexto && coincideFamilia && coincideGenero && coincideEstacion && coincidePrecio;
  });

  // Ordenamiento
  if (criterioOrden === 'precio-menor') {
    filtrados.sort((a, b) => (Number(a.precio) || 0) - (Number(b.precio) || 0));
  } else if (criterioOrden === 'precio-mayor') {
    filtrados.sort((a, b) => (Number(b.precio) || 0) - (Number(a.precio) || 0));
  } else {
    filtrados.sort((a, b) => b.id - a.id);
  }

  renderizarProductos(filtrados);
}

window.resetearFiltros = function() {
  filtroFamilia = 'todos';
  filtroGenero = 'todos';
  filtroEstacion = 'todos';
  if (inputBuscador) inputBuscador.value = '';
  if (sliderPrecio) {
    sliderPrecio.value = sliderPrecio.max;
    labelPrecioMax.textContent = `$${Number(sliderPrecio.max).toLocaleString('es-AR')}`;
  }
  if (selectOrden) selectOrden.value = 'recientes';

  document.querySelectorAll('.filter-chips-row .chip').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.filter-chips-row .chip[data-categoria="todos"], .filter-chips-row .chip[data-genero="todos"], .filter-chips-row .chip[data-estacion="todos"]').forEach(c => c.classList.add('active'));

  aplicarFiltrosYOrden();
};

// Eventos
if (inputBuscador) inputBuscador.addEventListener('input', aplicarFiltrosYOrden);
if (selectOrden) selectOrden.addEventListener('change', aplicarFiltrosYOrden);

if (sliderPrecio) {
  sliderPrecio.addEventListener('input', (e) => {
    labelPrecioMax.textContent = `$${Number(e.target.value).toLocaleString('es-AR')}`;
    aplicarFiltrosYOrden();
  });
}

chipsFamilia.forEach(b => {
  b.addEventListener('click', () => {
    chipsFamilia.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    filtroFamilia = b.dataset.categoria;
    aplicarFiltrosYOrden();
  });
});

chipsGenero.forEach(b => {
  b.addEventListener('click', () => {
    chipsGenero.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    filtroGenero = b.dataset.genero;
    aplicarFiltrosYOrden();
  });
});

chipsEstacion.forEach(b => {
  b.addEventListener('click', () => {
    chipsEstacion.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    filtroEstacion = b.dataset.estacion;
    aplicarFiltrosYOrden();
  });
});

document.addEventListener('DOMContentLoaded', () => {
  inicializarCarruselHero();
  cargarCatalogo();
});