let todosLosProductos = [];
let filtroTipo = 'todos';
let filtroFamilia = 'todos';
let filtroGenero = 'todos';
let filtroEstacion = 'todos';

// Carrito cargado de localStorage
let carrito = JSON.parse(localStorage.getItem('parfum_carrito')) || [];

// Elementos de UI
const gridProductos = document.getElementById('grid-productos');
const inputBuscador = document.getElementById('buscador');
const selectOrden = document.getElementById('select-orden');
const sliderPrecio = document.getElementById('slider-precio');
const labelPrecioMax = document.getElementById('label-precio-max');

const panelFiltrosDesplegables = document.getElementById('filtros-desplegables');
const toggleArrow = document.getElementById('toggle-arrow');
const btnToggleFiltros = document.getElementById('btn-toggle-filtros');

const chipsTipo = document.querySelectorAll('#chips-tipo .chip');
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

let idPerfumeDetalleActual = null;
let fotosDetalleActuales = [];
let indiceFotoDetalle = 0;
const imagenFallback = 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=600&q=80';

// ================= LUPA EN EL HEADER =================
window.activarBuscadorHeader = function() {
  cerrarDetalle();
  const catalogo = document.getElementById('catalogo');
  if (catalogo) {
    catalogo.scrollIntoView({ behavior: 'smooth' });
  }
  if (inputBuscador) {
    setTimeout(() => {
      inputBuscador.focus();
      inputBuscador.classList.add('highlight');
      setTimeout(() => inputBuscador.classList.remove('highlight'), 1200);
    }, 400);
  }
};

// ================= CARRITO DE COMPRAS =================
function guardarCarrito() {
  localStorage.setItem('parfum_carrito', JSON.stringify(carrito));
  actualizarVistaCarrito();
}

window.abrirCarrito = function() {
  document.getElementById('cart-sidebar').classList.add('active');
  document.getElementById('cart-overlay').classList.add('active');
};

window.cerrarCarrito = function() {
  document.getElementById('cart-sidebar').classList.remove('active');
  document.getElementById('cart-overlay').classList.remove('active');
};

window.agregarAlCarrito = function(id) {
  const prod = todosLosProductos.find(p => p.id === id);
  if (!prod) return;

  const itemExistente = carrito.find(item => item.id === id);
  if (itemExistente) {
    itemExistente.cantidad += 1;
  } else {
    const fotos = obtenerFotos(prod.imagen_url);
    carrito.push({
      id: prod.id,
      nombre: prod.nombre,
      familia: prod.familia,
      tipo: prod.tipo || 'Diseñador',
      precio: Number(prod.precio) || 0,
      imagen: fotos[0],
      cantidad: 1
    });
  }
  guardarCarrito();
  abrirCarrito();
};

window.agregarAlCarritoDesdeDetalle = function() {
  if (idPerfumeDetalleActual) {
    agregarAlCarrito(idPerfumeDetalleActual);
  }
};

window.cambiarCantidadCarrito = function(id, delta) {
  const item = carrito.find(p => p.id === id);
  if (!item) return;

  item.cantidad += delta;
  if (item.cantidad <= 0) {
    carrito = carrito.filter(p => p.id !== id);
  }
  guardarCarrito();
};

window.vaciarCarrito = function() {
  if (carrito.length === 0) return;
  if (confirm('¿Querés vaciar todos los productos del carrito?')) {
    carrito = [];
    guardarCarrito();
  }
};

function actualizarVistaCarrito() {
  const badge = document.getElementById('cart-badge');
  const itemsContainer = document.getElementById('cart-items-container');
  const totalItemsLabel = document.getElementById('cart-total-items');
  const totalPriceLabel = document.getElementById('cart-total-price');

  const totalProductos = carrito.reduce((sum, item) => sum + item.cantidad, 0);
  const totalInversion = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

  if (badge) badge.textContent = totalProductos;
  if (totalItemsLabel) totalItemsLabel.textContent = `(${totalProductos} ${totalProductos === 1 ? 'producto' : 'productos'})`;
  if (totalPriceLabel) totalPriceLabel.textContent = `$${totalInversion.toLocaleString('es-AR')}`;

  if (!itemsContainer) return;

  if (carrito.length === 0) {
    itemsContainer.innerHTML = `
      <div class="cart-empty-msg">
        <svg class="cart-empty-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
        <p>Tu carrito está vacío.</p>
        <button class="btn-primary" style="padding: 0.6rem 1.4rem; font-size: 0.8rem;" onclick="cerrarCarrito()">Explorar Catálogo</button>
      </div>`;
    return;
  }

  itemsContainer.innerHTML = '';
  carrito.forEach(item => {
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <img src="${item.imagen}" class="cart-item-img" alt="${item.nombre}" onerror="this.src='${imagenFallback}'">
      <div class="cart-item-details">
        <span class="cart-item-meta">${item.tipo} • ${item.familia}</span>
        <span class="cart-item-title">${item.nombre}</span>
        <span class="cart-item-price">$${(item.precio * item.cantidad).toLocaleString('es-AR')}</span>
      </div>
      <div class="cart-item-controls">
        <button class="qty-btn" onclick="cambiarCantidadCarrito(${item.id}, -1)">-</button>
        <span class="cart-item-qty">${item.cantidad}</span>
        <button class="qty-btn" onclick="cambiarCantidadCarrito(${item.id}, 1)">+</button>
      </div>
    `;
    itemsContainer.appendChild(row);
  });
}

// ================= CHECKOUT POR WHATSAPP =================
window.finalizarCompraWhatsApp = function() {
  if (carrito.length === 0) {
    alert('Tu carrito está vacío. Agregá algún perfume antes de finalizar el pedido.');
    return;
  }

  const totalInversion = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

  let mensaje = `👋 ¡Hola! Quisiera realizar el siguiente pedido en *PARFUM STUDIO*:\n\n`;
  
  carrito.forEach((item, index) => {
    mensaje += `*${index + 1}. ${item.nombre}* (${item.tipo})\n`;
    mensaje += `   • Cantidad: ${item.cantidad}\n`;
    mensaje += `   • Subtotal: $${(item.precio * item.cantidad).toLocaleString('es-AR')}\n\n`;
  });

  mensaje += `━━━━━━━━━━━━━━━━━━━━━\n`;
  mensaje += `💰 *TOTAL A ABONAR: $${totalInversion.toLocaleString('es-AR')}*\n`;
  mensaje += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
  mensaje += `¿Cómo coordinamos el pago y la entrega en Ciudadela / envío? ¡Muchas gracias!`;

  const numeroWhatsApp = '5491135890259';
  const url = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank');
};

// ================= TOGGLE FILTROS =================
window.alternarFiltros = function() {
  if (!panelFiltrosDesplegables) return;
  const estaOculto = panelFiltrosDesplegables.style.display === 'none' || panelFiltrosDesplegables.style.display === '';
  
  if (estaOculto) {
    panelFiltrosDesplegables.style.display = 'flex';
    toggleArrow.textContent = '▲';
    btnToggleFiltros.classList.add('active');
  } else {
    panelFiltrosDesplegables.style.display = 'none';
    toggleArrow.textContent = '▼';
    btnToggleFiltros.classList.remove('active');
  }
};

// ================= CERRAR DETALLE =================
window.cerrarDetalle = function() {
  if (seccionDetalle) {
    seccionDetalle.style.display = 'none';
  }
  const catalogo = document.getElementById('catalogo');
  if (catalogo) {
    catalogo.scrollIntoView({ behavior: 'smooth' });
  }
};

// ================= CARRUSEL HERO =================
let slideHeroActual = 0;
let totalSlidesHero = 0;
let intervaloHero = null;

function armarCarruselHero(productos) {
  const track = document.getElementById('hero-carousel-track');
  const dotsContainer = document.getElementById('hero-carousel-dots');
  if (!track || !dotsContainer) return;

  track.innerHTML = '';
  dotsContainer.innerHTML = '';

  let disponibles = productos.filter(p => (p.estado_stock || 'En Stock') !== 'Sin Stock');
  let perfumesParaHero = disponibles.filter(p => p.destacado_hero === 1 || p.destacado_hero === true || p.destacado_hero === '1');

  if (perfumesParaHero.length === 0) {
    perfumesParaHero = disponibles.slice(0, 5);
  }

  if (perfumesParaHero.length === 0) {
    track.innerHTML = `
      <div class="carousel-slide active">
        <img src="${imagenFallback}" alt="Perfume">
        <div class="slide-caption">Catálogo en preparación</div>
      </div>`;
    return;
  }

  totalSlidesHero = perfumesParaHero.length;

  perfumesParaHero.forEach((prod, index) => {
    const fotos = obtenerFotos(prod.imagen_url);
    const fotoPortada = fotos[0];

    const slide = document.createElement('div');
    slide.className = `carousel-slide ${index === 0 ? 'active' : ''}`;
    slide.style.cursor = 'pointer';
    slide.onclick = () => mostrarDetalle(prod.id);
    slide.innerHTML = `
      <img src="${fotoPortada}" alt="${prod.nombre}" onerror="this.src='${imagenFallback}'">
      <div class="slide-caption">${prod.nombre} — ${prod.tipo || 'Diseñador'}</div>
    `;
    track.appendChild(slide);

    const dot = document.createElement('div');
    dot.className = `dot ${index === 0 ? 'active' : ''}`;
    dot.onclick = () => irASlideHero(index);
    dotsContainer.appendChild(dot);
  });

  if (intervaloHero) clearInterval(intervaloHero);
  if (totalSlidesHero > 1) {
    intervaloHero = setInterval(() => moverCarruselHero(1), 4000);
  }
}

window.moverCarruselHero = function(dir) {
  if (totalSlidesHero <= 1) return;
  slideHeroActual = (slideHeroActual + dir + totalSlidesHero) % totalSlidesHero;
  actualizarVistaHero();
};

function irASlideHero(idx) {
  slideHeroActual = idx;
  actualizarVistaHero();
}

function actualizarVistaHero() {
  const slides = document.querySelectorAll('#hero-carousel-track .carousel-slide');
  const dots = document.querySelectorAll('#hero-carousel-dots .dot');
  slides.forEach((s, i) => s.classList.toggle('active', i === slideHeroActual));
  dots.forEach((d, i) => d.classList.toggle('active', i === slideHeroActual));
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

    armarCarruselHero(todosLosProductos);

    if (todosLosProductos.length > 0 && sliderPrecio) {
      const maximo = Math.max(...todosLosProductos.map(p => Number(p.precio) || 0));
      if (maximo > 150000) {
        sliderPrecio.max = maximo;
        sliderPrecio.value = maximo;
        labelPrecioMax.textContent = `$${maximo.toLocaleString('es-AR')}`;
      }
    }
    aplicarFiltrosYOrden();
    actualizarVistaCarrito();
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
    const tipoFragancia = perfume.tipo || 'Diseñador';
    const stockVal = perfume.estado_stock || 'En Stock';

    let badgeStockHTML = '';
    if (stockVal === 'Pocas Unidades') {
      badgeStockHTML = `<span class="stock-badge-pocas">Pocas Unidades</span>`;
    } else {
      badgeStockHTML = `<span class="stock-badge-en">En Stock</span>`;
    }

    tarjeta.innerHTML = `
      <a href="#detalle" class="card-image-link" onclick="mostrarDetalle(${perfume.id})">
        <img src="${fotoPortada}" alt="${perfume.nombre}" onerror="this.onerror=null; this.src='${imagenFallback}';">
      </a>
      <div class="product-info">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
          <span class="product-family">${perfume.familia}</span>
          <span style="font-size: 0.68rem; font-weight: 800; background-color: #FFEAEA; color: var(--c-red); padding: 0.15rem 0.6rem; border-radius: 12px; text-transform: uppercase;">
            ${tipoFragancia}
          </span>
        </div>
        <h3 class="product-title">
          <a href="#detalle" class="card-title-link" onclick="mostrarDetalle(${perfume.id})">${perfume.nombre}</a>
        </h3>
        <p class="product-desc">${perfume.descripcion || ''}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <div class="product-price" style="margin-bottom: 0;">$${precioNumero.toLocaleString('es-AR')}</div>
          ${badgeStockHTML}
        </div>
        <div class="card-actions-row">
          <a href="#detalle" class="btn-ver-detalle" onclick="mostrarDetalle(${perfume.id})">
            Ver Detalles
          </a>
          <button class="btn-card-add-cart" title="Agregar al carrito" onclick="agregarAlCarrito(${perfume.id})">
            <svg class="ui-icon-btn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
    gridProductos.appendChild(tarjeta);
  });
}

// ================= DETALLE =================
window.mostrarDetalle = function(id) {
  const perfume = todosLosProductos.find(p => p.id === id);
  if (!perfume) return;

  idPerfumeDetalleActual = perfume.id;
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

  const tipoFragancia = perfume.tipo || 'Diseñador';
  detalleFamilia.textContent = `${perfume.familia} • ${tipoFragancia} • ${perfume.genero || 'Unisex'}`;
  detalleNombre.textContent = perfume.nombre;
  detallePrecio.textContent = `$${precioNumero.toLocaleString('es-AR')}`;
  detalleDescripcion.textContent = perfume.descripcion || '';

  document.getElementById('row-salida').style.display = perfume.notas_salida ? 'flex' : 'none';
  detalleSalida.textContent = perfume.notas_salida || '';

  document.getElementById('row-corazon').style.display = perfume.notas_corazon ? 'flex' : 'none';
  detalleCorazon.textContent = perfume.notas_corazon || '';

  document.getElementById('row-fondo').style.display = perfume.notas_fondo ? 'flex' : 'none';
  detalleFondo.textContent = perfume.notas_fondo || '';

  seccionDetalle.style.display = 'block';
  seccionDetalle.scrollIntoView({ behavior: 'smooth' });
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

// ================= MOTOR DE FILTROS =================
function aplicarFiltrosYOrden() {
  const query = inputBuscador ? inputBuscador.value.toLowerCase().trim() : '';
  const precioMax = sliderPrecio ? Number(sliderPrecio.value) : Infinity;
  const criterioOrden = selectOrden ? selectOrden.value : 'recientes';

  let filtrados = todosLosProductos.filter(p => {
    const stockVal = p.estado_stock || 'En Stock';
    if (stockVal === 'Sin Stock') return false;

    const enNombre = (p.nombre || '').toLowerCase().includes(query);
    const enDesc = (p.descripcion || '').toLowerCase().includes(query);
    const enSalida = (p.notas_salida || '').toLowerCase().includes(query);
    const enCorazon = (p.notas_corazon || '').toLowerCase().includes(query);
    const enFondo = (p.notas_fondo || '').toLowerCase().includes(query);
    const coincideTexto = !query || enNombre || enDesc || enSalida || enCorazon || enFondo;

    const tipoProducto = (p.tipo || 'Diseñador').toLowerCase();
    const coincideTipo = filtroTipo === 'todos' || tipoProducto.includes(filtroTipo.toLowerCase());

    const coincideFamilia = filtroFamilia === 'todos' || p.familia === filtroFamilia;
    const coincideGenero = filtroGenero === 'todos' || (p.genero || 'Unisex') === filtroGenero;
    const coincideEstacion = filtroEstacion === 'todos' || (p.estacion || 'Todo el año') === filtroEstacion;
    const coincidePrecio = (Number(p.precio) || 0) <= precioMax;

    return coincideTexto && coincideTipo && coincideFamilia && coincideGenero && coincideEstacion && coincidePrecio;
  });

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
  filtroTipo = 'todos';
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
  document.querySelectorAll('.filter-chips-row .chip[data-tipo="todos"], .filter-chips-row .chip[data-categoria="todos"], .filter-chips-row .chip[data-genero="todos"], .filter-chips-row .chip[data-estacion="todos"]').forEach(c => c.classList.add('active'));

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

chipsTipo.forEach(b => {
  b.addEventListener('click', () => {
    chipsTipo.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    filtroTipo = b.dataset.tipo;
    aplicarFiltrosYOrden();
  });
});

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

document.addEventListener('DOMContentLoaded', cargarCatalogo);

// ================= REPRODUCTOR DE MÚSICA AMBIENTE (ESTILO BOUTIQUE / PERFUMERÍA) =================
let reproduciendoMusica = false;
let audioAmbiente = null;

window.toggleMusicaAmbiente = function() {
  const label = document.getElementById('ambient-label');
  const btn = document.getElementById('ambient-toggle-btn');
  const slider = document.getElementById('volume-slider');

  if (!audioAmbiente) {
    // Pista de audio estilo lounge / deep house moderno optimizada para tiendas de autor y perfumería
    audioAmbiente = new Audio('https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf756.mp3?filename=stylish-deep-luxury-chill-113491.mp3');
    audioAmbiente.loop = true;
    
    audioAmbiente.onerror = function() {
      console.error("Error al cargar la pista ambiental.");
      alert("No se pudo cargar la música de fondo. Verificá tu conexión.");
    };
  }

  // Establecer el volumen según la barra deslizante (por defecto 15% para que sea sutil)
  if (slider) {
    audioAmbiente.volume = parseFloat(slider.value) / 100;
  } else {
    audioAmbiente.volume = 0.15;
  }

  if (reproduciendoMusica) {
    audioAmbiente.pause();
    reproduciendoMusica = false;
    label.textContent = 'Música Pausada';
    if (btn) {
      btn.style.backgroundColor = 'var(--c-red-subtle)';
      btn.style.color = 'var(--c-red)';
    }
  } else {
    audioAmbiente.play().then(() => {
      reproduciendoMusica = true;
      label.textContent = 'Sonando ♫';
      if (btn) {
        btn.style.backgroundColor = 'var(--c-red)';
        btn.style.color = '#fff';
      }
    }).catch(err => {
      console.log("Bloqueo de reproducción por política del navegador:", err);
      alert("Tocá de nuevo el botón para activar la música ambiental.");
    });
  }
};

window.cambiarVolumenMusica = function(valor) {
  if (audioAmbiente) {
    // Modifica el volumen en tiempo real al mover la barra de la interfaz
    audioAmbiente.volume = parseFloat(valor) / 100;
  }
};