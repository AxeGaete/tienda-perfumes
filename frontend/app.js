let todosLosProductos = [];
let productosFiltrados = [];
let carrito = [];
let slideActualIndex = 0;
let slideInterval = null;
let descuentoActivo = 0; // 0 o 0.10 por el cupón

document.addEventListener('DOMContentLoaded', () => {
  cargarProductos();
  cargarCarritoDesdeStorage();
  inicializarFiltrosEventos();
  cargarTemaVisual();
  inicializarNavegacionLimpia();
});

async function cargarProductos() {
  try {
    const res = await fetch('/api/productos');
    todosLosProductos = await res.json();
    
    // Ordenar por defecto alfabéticamente por nombre (A-Z)
    todosLosProductos.sort((a, b) => a.nombre.localeCompare(b.nombre));
    productosFiltrados = [...todosLosProductos];
    
    renderizarHeroSlider();
    renderizarCatalogo();
  } catch (err) {
    console.error('Error al cargar productos:', err);
  }
}

// ================= NAVEGACIÓN LIMPIA (SIN HASH EN URL) =================
function inicializarNavegacionLimpia() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault(); // Evita que se agregue el # a la URL
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth' // Desplazamiento suave
        });
      }
    });
  });
}

// ================= MENÚ MÓVIL DESPLEGABLE =================
function toggleMobileMenu() {
  const dropdown = document.getElementById('mobile-dropdown-menu');
  if (dropdown) {
    dropdown.classList.toggle('active');
  }
}

// ================= MODO OSCURO / CLARO =================
function alternarTemaVisual() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('parfum_theme', newTheme);
  actualizarIconoTema(newTheme);
}

function cargarTemaVisual() {
  const savedTheme = localStorage.getItem('parfum_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  actualizarIconoTema(savedTheme);
}

function actualizarIconoTema(theme) {
  const icon = document.getElementById('theme-icon');
  if (!icon) return;
  
  if (theme === 'dark') {
    // Icono de Sol para volver a claro
    icon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
  } else {
    // Icono de Luna para volver a oscuro
    icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
  }
}

// ================= HERO CAROUSEL =================
function renderizarHeroSlider() {
  const track = document.getElementById('hero-carousel-track');
  const dotsContainer = document.getElementById('hero-carousel-dots');
  if (!track || !dotsContainer) return;

  const destacados = todosLosProductos.filter(p => p.destacado_hero === 1 || p.destacado_hero === '1');
  const slidesData = destacados.length > 0 ? destacados : todosLosProductos.slice(0, 4);

  track.innerHTML = '';
  dotsContainer.innerHTML = '';

  if (slidesData.length === 0) {
    track.innerHTML = '<div class="carousel-slide active"><p>No hay perfumes destacados</p></div>';
    return;
  }

  slidesData.forEach((prod, index) => {
    const fotos = extraerListaFotos(prod.imagen_url);
    const slide = document.createElement('div');
    slide.className = `carousel-slide ${index === 0 ? 'active' : ''}`;
    slide.innerHTML = `
      <img src="${fotos[0]}" alt="${prod.nombre}" onclick="verDetalle(${prod.id})" style="cursor: pointer;">
      <div class="slide-caption">${prod.nombre} — $${Number(prod.precio).toLocaleString('es-AR')}</div>
    `;
    track.appendChild(slide);

    const dot = document.createElement('div');
    dot.className = `dot ${index === 0 ? 'active' : ''}`;
    dot.onclick = () => irASlideHero(index);
    dotsContainer.appendChild(dot);
  });

  iniciarAutoplayHero();
}

function moverCarruselHero(direccion) {
  const slides = document.querySelectorAll('.carousel-slide');
  const dots = document.querySelectorAll('.dot');
  if (slides.length === 0) return;

  slides[slideActualIndex].classList.remove('active');
  dots[slideActualIndex].classList.remove('active');

  slideActualIndex = (slideActualIndex + direccion + slides.length) % slides.length;

  slides[slideActualIndex].classList.add('active');
  dots[slideActualIndex].classList.add('active');
  reiniciarAutoplayHero();
}

function irASlideHero(index) {
  const slides = document.querySelectorAll('.carousel-slide');
  const dots = document.querySelectorAll('.dot');
  if (slides.length === 0) return;

  slides[slideActualIndex].classList.remove('active');
  dots[slideActualIndex].classList.remove('active');

  slideActualIndex = index;

  slides[slideActualIndex].classList.add('active');
  dots[slideActualIndex].classList.add('active');
  reiniciarAutoplayHero();
}

function iniciarAutoplayHero() {
  if (slideInterval) clearInterval(slideInterval);
  slideInterval = setInterval(() => moverCarruselHero(1), 5000);
}

function reiniciarAutoplayHero() {
  clearInterval(slideInterval);
  iniciarAutoplayHero();
}

// ================= FILTROS Y BÚSQUEDA =================
let filtroTipoActivo = 'todos';
let filtroGeneroActivo = 'todos';
let filtroFamiliaActivo = 'todos';
let filtroNotaActivo = 'todos';
let filtroEstacionActivo = 'todos';
let precioMaximoFiltro = 150000;

function alternarFiltros() {
  const box = document.getElementById('filtros-desplegables');
  const arrow = document.getElementById('toggle-arrow');
  const btn = document.getElementById('btn-toggle-filtros');
  
  if (box.style.display === 'none') {
    box.style.display = 'block';
    arrow.style.transform = 'rotate(180deg)';
    btn.classList.add('active');
  } else {
    box.style.display = 'none';
    arrow.style.transform = 'rotate(0deg)';
    btn.classList.remove('active');
  }
}

function inicializarFiltrosEventos() {
  const buscador = document.getElementById('buscador');
  if (buscador) buscador.addEventListener('input', filtrarProductos);

  const selectOrden = document.getElementById('select-orden');
  if (selectOrden) selectOrden.addEventListener('change', filtrarProductos);

  const slider = document.getElementById('slider-precio');
  if (slider) {
    slider.addEventListener('input', (e) => {
      precioMaximoFiltro = Number(e.target.value);
      document.getElementById('label-precio-max').textContent = `$${precioMaximoFiltro.toLocaleString('es-AR')}`;
      filtrarProductos();
    });
  }

  configurarChipsGrupo('chips-tipo', 'data-tipo', (val) => { filtroTipoActivo = val; filtrarProductos(); });
  configurarChipsGrupo('chips-genero', 'data-genero', (val) => { filtroGeneroActivo = val; filtrarProductos(); });
  configurarChipsGrupo('chips-familia', 'data-categoria', (val) => { filtroFamiliaActivo = val; filtrarProductos(); });
  configurarChipsGrupo('chips-nota', 'data-nota', (val) => { filtroNotaActivo = val; filtrarProductos(); });
  configurarChipsGrupo('chips-estacion', 'data-estacion', (val) => { filtroEstacionActivo = val; filtrarProductos(); });
}

function configurarChipsGrupo(containerId, atributo, callback) {
  const contenedor = document.getElementById(containerId);
  if (!contenedor) return;
  contenedor.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      contenedor.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      callback(chip.getAttribute(atributo));
    });
  });
}

function resetearFiltros() {
  document.getElementById('buscador').value = '';
  document.getElementById('slider-precio').value = 150000;
  precioMaximoFiltro = 150000;
  document.getElementById('label-precio-max').textContent = '$150.000';

  filtroTipoActivo = 'todos';
  filtroGeneroActivo = 'todos';
  filtroFamiliaActivo = 'todos';
  filtroNotaActivo = 'todos';
  filtroEstacionActivo = 'todos';

  document.querySelectorAll('.filter-chips-row').forEach(row => {
    row.querySelectorAll('.chip').forEach((c, idx) => {
      if (idx === 0) c.classList.add('active');
      else c.classList.remove('active');
    });
  });

  filtrarProductos();
}

function filtrarProductos() {
  const texto = document.getElementById('buscador').value.toLowerCase().trim();
  const orden = document.getElementById('select-orden').value;

  productosFiltrados = todosLosProductos.filter(prod => {
    const nombreMatch = prod.nombre.toLowerCase().includes(texto);
    const familiaMatch = prod.familia.toLowerCase().includes(texto);
    const descMatch = (prod.descripcion || '').toLowerCase().includes(texto);
    const notasTexto = ((prod.notas_salida || '') + ' ' + (prod.notas_corazon || '') + ' ' + (prod.notas_fondo || '')).toLowerCase();
    
    const coincideTexto = nombreMatch || familiaMatch || descMatch || notasTexto.includes(texto);
    const coincidePrecio = Number(prod.precio) <= precioMaximoFiltro;
    
    const coincideTipo = filtroTipoActivo === 'todos' || prod.tipo === filtroTipoActivo;
    const coincideGenero = filtroGeneroActivo === 'todos' || prod.genero === filtroGeneroActivo;
    const coincideFamilia = filtroFamiliaActivo === 'todos' || prod.familia === filtroFamiliaActivo;
    const coincideNota = filtroNotaActivo === 'todos' || notasTexto.includes(filtroNotaActivo.toLowerCase());
    const coincideEstacion = filtroEstacionActivo === 'todos' || prod.estacion === filtroEstacionActivo;

    return coincideTexto && coincidePrecio && coincideTipo && coincideGenero && coincideFamilia && coincideNota && coincideEstacion;
  });

  // Ordenamiento
  if (orden === 'precio-menor') {
    productosFiltrados.sort((a, b) => a.precio - b.precio);
  } else if (orden === 'precio-mayor') {
    productosFiltrados.sort((a, b) => b.precio - a.precio);
  } else if (orden === 'recientes') {
    productosFiltrados.sort((a, b) => b.id - a.id);
  } else {
    // Orden predeterminado: Alfabéticamente por nombre (A-Z)
    productosFiltrados.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  renderizarCatalogo();
}

function renderizarCatalogo() {
  const grid = document.getElementById('grid-productos');
  if (!grid) return;

  if (productosFiltrados.length === 0) {
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">No se encontraron perfumes con esos filtros.</p>';
    return;
  }

  grid.innerHTML = '';
  productosFiltrados.forEach(prod => {
    const fotos = extraerListaFotos(prod.imagen_url);
    const stockCantidad = Number(prod.estado_stock) || 0;
    let stockBadgeHTML = '';

    if (stockCantidad === 0) {
      stockBadgeHTML = '<span class="stock-badge-sin" style="background:#FFEBEE; color:#C62828; font-size:0.65rem; font-weight:800; padding:0.2rem 0.6rem; border-radius:10px;">Sin Stock</span>';
    } else if (stockCantidad <= 3) {
      stockBadgeHTML = `<span class="stock-badge-pocas">Pocas Unidades (${stockCantidad})</span>`;
    } else {
      stockBadgeHTML = `<span class="stock-badge-en" style="font-size:0.65rem; font-weight:800; padding:0.2rem 0.6rem; border-radius:10px;">Stock: ${stockCantidad}</span>`;
    }

    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <a href="#" onclick="verDetalle(${prod.id}); return false;" class="card-image-link">
        <img src="${fotos[0]}" alt="${prod.nombre}" onerror="this.src='https://via.placeholder.com/280?text=Perfume'">
      </a>
      <div class="product-info">
        <div style="display: flex; justify-content: flex-end; align-items: center; margin-bottom: 0.2rem;">
          ${stockBadgeHTML}
        </div>
        <h3 class="product-title"><a href="#" onclick="verDetalle(${prod.id}); return false;" class="card-title-link">${prod.nombre}</a></h3>
        <p class="product-desc">${prod.descripcion || 'Fragancia exclusiva de alta gama.'}</p>
        <div class="product-price">$${Number(prod.precio).toLocaleString('es-AR')}</div>
        <div class="card-actions-row">
          <a href="#" onclick="verDetalle(${prod.id}); return false;" class="btn-ver-detalle">Ver Detalle</a>
          ${stockCantidad === 0
            ? `<a href="https://wa.me/5491135890259?text=Hola,%20quiero%20saber%20cuándo%20reingresa%20el%20perfume%20${encodeURIComponent(prod.nombre)}" target="_blank" class="btn-card-add-cart" style="background:#1565C0; text-decoration:none;" title="Avisarme cuando haya stock">📲 Avisar</a>`
            : `<button class="btn-card-add-cart" onclick="agregarAlCarrito(${prod.id})" title="Añadir al Carrito"><svg class="ui-icon-btn" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>`
          }
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function activarBuscadorHeader() {
  const input = document.getElementById('buscador');
  document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth' });
  input.focus();
  input.classList.add('highlight');
  setTimeout(() => input.classList.remove('highlight'), 1200);
}

// ================= VISTA DETALLE =================
let productoActualId = null;
let listaFotosDetalleActuales = [];
let fotoDetalleIndex = 0;

async function verDetalle(id) {
  const prod = todosLosProductos.find(p => p.id === id);
  if (!prod) return;
  productoActualId = id;

  document.getElementById('hero').style.display = 'none';
  document.getElementById('catalogo').style.display = 'none';
  document.getElementById('pagos').style.display = 'none';
  document.getElementById('nosotros').style.display = 'none';
  document.getElementById('contacto').style.display = 'none';

  const seccionDetalle = document.getElementById('detalle');
  seccionDetalle.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });

  listaFotosDetalleActuales = extraerListaFotos(prod.imagen_url);
  fotoDetalleIndex = 0;

  const imgPrincipal = document.getElementById('detalle-img-principal');
  imgPrincipal.src = listaFotosDetalleActuales[0];
  imgPrincipal.onclick = () => abrirZoomImagen(listaFotosDetalleActuales[fotoDetalleIndex]);

  document.getElementById('detalle-familia').textContent = prod.familia;
  document.getElementById('detalle-nombre').textContent = prod.nombre;
  document.getElementById('detalle-precio').textContent = `$${Number(prod.precio).toLocaleString('es-AR')}`;
  document.getElementById('detalle-salida').textContent = prod.notas_salida || 'No especificado';
  document.getElementById('detalle-corazon').textContent = prod.notas_corazon || 'No especificado';
  document.getElementById('detalle-fondo').textContent = prod.notas_fondo || 'No especificado';
  document.getElementById('detalle-descripcion').textContent = prod.descripcion || 'Sin descripción adicional.';

  const thumbContainer = document.getElementById('detalle-thumbnails');
  thumbContainer.innerHTML = listaFotosDetalleActuales.map((f, idx) => `
    <img src="${f}" class="detail-thumb ${idx === 0 ? 'active' : ''}" onclick="seleccionarMiniaturaDetalle(${idx})" alt="Miniatura">
  `).join('');

  const stockCantidad = Number(prod.estado_stock) || 0;
  const actionsBox = document.getElementById('detalle-actions-box');
  if (stockCantidad === 0) {
    actionsBox.innerHTML = `
      <a href="https://wa.me/5491135890259?text=Hola,%20quiero%20saber%20cuándo%20reingresa%20${encodeURIComponent(prod.nombre)}" target="_blank" class="btn-primary" style="background:#1565C0; width:100%; text-decoration:none; text-align:center;">📲 Avisarme por WhatsApp cuando haya stock</a>
      <button type="button" class="btn-secondary" onclick="cerrarDetalle()">← Volver al Catálogo</button>
    `;
  } else {
    actionsBox.innerHTML = `
      <button type="button" class="btn-primary" onclick="agregarAlCarritoDesdeDetalle(${prod.id})">Agregar al Carrito</button>
      <button type="button" class="btn-secondary" onclick="cerrarDetalle()">← Volver al Catálogo</button>
    `;
  }

  cargarRelacionados(prod);
}

function cerrarDetalle() {
  document.getElementById('detalle').style.display = 'none';
  document.getElementById('hero').style.display = 'block';
  document.getElementById('catalogo').style.display = 'block';
  document.getElementById('pagos').style.display = 'block';
  document.getElementById('nosotros').style.display = 'block';
  document.getElementById('contacto').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function seleccionarMiniaturaDetalle(idx) {
  fotoDetalleIndex = idx;
  const imgPrincipal = document.getElementById('detalle-img-principal');
  imgPrincipal.src = listaFotosDetalleActuales[idx];
  imgPrincipal.onclick = () => abrirZoomImagen(listaFotosDetalleActuales[fotoDetalleIndex]);

  document.querySelectorAll('.detail-thumb').forEach((t, i) => {
    if (i === idx) t.classList.add('active');
    else t.classList.remove('active');
  });
}

function cambiarFotoDetalle(dir) {
  if (listaFotosDetalleActuales.length <= 1) return;
  fotoDetalleIndex = (fotoDetalleIndex + dir + listaFotosDetalleActuales.length) % listaFotosDetalleActuales.length;
  seleccionarMiniaturaDetalle(fotoDetalleIndex);
}

// ================= ZOOM / LIGHTBOX DE IMÁGENES =================
function abrirZoomImagen(urlSrc) {
  let modal = document.getElementById('image-zoom-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'image-zoom-modal';
    modal.className = 'image-zoom-modal';
    modal.innerHTML = `
      <button class="image-zoom-close" onclick="cerrarZoomImagen()">✕</button>
      <img id="image-zoom-target" src="" alt="Zoom Imagen">
    `;
    modal.onclick = (e) => {
      if (e.target === modal) cerrarZoomImagen();
    };
    document.body.appendChild(modal);
  }

  document.getElementById('image-zoom-target').src = urlSrc;
  modal.classList.add('active');
}

function cerrarZoomImagen() {
  const modal = document.getElementById('image-zoom-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// ================= PERFUMES RELACIONADOS =================
function cargarRelacionados(productoActual) {
  const container = document.getElementById('grid-relacionados');
  if (!container) return;
  container.innerHTML = '';

  let relacionados = todosLosProductos.filter(p => p.familia === productoActual.familia && p.id !== productoActual.id);

  if (relacionados.length < 3) {
    const otros = todosLosProductos.filter(p => p.id !== productoActual.id && !relacionados.includes(p));
    relacionados = [...relacionados, ...otros];
  }

  relacionados = relacionados.slice(0, 4);

  if (relacionados.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1;">No hay perfumes relacionados por el momento.</p>';
    return;
  }

  relacionados.forEach(prod => {
    const fotos = extraerListaFotos(prod.imagen_url);
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <a href="#" onclick="verDetalle(${prod.id}); return false;" class="card-image-link">
        <img src="${fotos[0]}" alt="${prod.nombre}" loading="lazy" onerror="this.src='https://via.placeholder.com/280?text=Perfume'">
      </a>
      <div class="product-info">
        <span class="product-family">${prod.familia}</span>
        <h3 class="product-title">
          <a href="#" onclick="verDetalle(${prod.id}); return false;" class="card-title-link">${prod.nombre}</a>
        </h3>
        <p class="product-desc">${prod.descripcion || 'Fragancia exclusiva de alta duración.'}</p>
        <div class="product-price">$${Number(prod.precio).toLocaleString('es-AR')}</div>
        <div class="card-actions-row">
          <a href="#" onclick="verDetalle(${prod.id}); return false;" class="btn-ver-detalle">Ver Detalle</a>
          <button class="btn-card-add-cart" onclick="agregarAlCarrito(${prod.id})" title="Añadir al carrito">
            <svg class="ui-icon-btn" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// ================= COMPARTIR PERFUME =================
function compartirPerfumeActual() {
  const prod = todosLosProductos.find(p => p.id === productoActualId);
  if (!prod) return;

  const textoCompartir = `¡Mirá este perfume en Parfum Studio! ${prod.nombre} (${prod.familia}) a solo $${Number(prod.precio).toLocaleString('es-AR')}.`;
  const urlActual = window.location.href;

  if (navigator.share) {
    navigator.share({
      title: prod.nombre + ' — Parfum Studio',
      text: textoCompartir,
      url: urlActual,
    }).catch(() => {});
  } else {
    const mensajeWsp = `¡Hola! Te comparto esta fragancia que encontré en Parfum Studio: *${prod.nombre}* (${prod.familia}) a $${Number(prod.precio).toLocaleString('es-AR')}. ¡Mirala acá!`;
    const urlWsp = `https://wa.me/?text=${encodeURIComponent(mensajeWsp)}`;
    window.open(urlWsp, '_blank');
  }
}

// ================= NOTIFICACIÓN TOAST FLOTANTE =================
function mostrarToast(mensaje) {
  let toast = document.getElementById('toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-notification';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `🛍️ <span>${mensaje}</span>`;
  toast.classList.add('active');

  setTimeout(() => {
    toast.classList.remove('active');
  }, 2500);
}

// ================= CARRITO Y CUPÓN =================
function abrirCarrito() {
  document.getElementById('cart-sidebar').classList.add('active');
  document.getElementById('cart-overlay').classList.add('active');
}

function cerrarCarrito() {
  document.getElementById('cart-sidebar').classList.remove('active');
  document.getElementById('cart-overlay').classList.remove('active');
}

function agregarAlCarrito(id) {
  const prod = todosLosProductos.find(p => p.id === id);
  if (!prod) return;

  const existente = carrito.find(item => item.id === id);
  if (existente) {
    existente.cantidad += 1;
  } else {
    const fotos = extraerListaFotos(prod.imagen_url);
    carrito.push({
      id: prod.id,
      nombre: prod.nombre,
      precio: Number(prod.precio),
      imagen: fotos[0],
      familia: prod.familia,
      cantidad: 1
    });
  }

  guardarCarritoStorage();
  actualizarUICarrito();
  mostrarToast(`¡Agregaste "${prod.nombre}" al carrito!`);
  abrirCarrito();
}

function agregarAlCarritoDesdeDetalle() {
  if (productoActualId) agregarAlCarrito(productoActualId);
}

function cambiarCantidad(id, delta) {
  const item = carrito.find(i => i.id === id);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad <= 0) {
    carrito = carrito.filter(i => i.id !== id);
  }
  guardarCarritoStorage();
  actualizarUICarrito();
}

function vaciarCarrito() {
  carrito = [];
  descuentoActivo = 0;
  document.getElementById('cupon-msg').style.display = 'none';
  document.getElementById('cupon-input').value = '';
  guardarCarritoStorage();
  actualizarUICarrito();
}

function aplicarCupon() {
  const codigo = document.getElementById('cupon-input').value.trim().toUpperCase();
  const msgBox = document.getElementById('cupon-msg');

  const cuponesSecretos = {
    'PARFUM10': 0.10,
    'VERANO10': 0.10,
    'VIP20': 0.20,
    'REGALO15': 0.15
  };

  if (cuponesSecretos.hasOwnProperty(codigo)) {
    descuentoActivo = cuponesSecretos[codigo];
    const porcentajeTexto = (descuentoActivo * 100) + '%';
    msgBox.textContent = `¡Cupón secreto aplicado con éxito (-${porcentajeTexto})!`;
    msgBox.style.color = '#2E7D32';
    msgBox.style.display = 'block';
  } else {
    descuentoActivo = 0;
    msgBox.textContent = 'Cupón inválido o expirado';
    msgBox.style.color = '#C62828';
    msgBox.style.display = 'block';
  }
  actualizarUICarrito();
}

function actualizarUICarrito() {
  const contenedor = document.getElementById('cart-items-container');
  const badge = document.getElementById('cart-badge');
  const countLabel = document.getElementById('cart-total-items');
  const totalPriceBox = document.getElementById('cart-total-price');
  const subtotalRow = document.getElementById('fila-subtotal');
  const subtotalPriceBox = document.getElementById('cart-subtotal-price');
  const descuentoRow = document.getElementById('fila-descuento');
  const descuentoPriceBox = document.getElementById('cart-descuento-price');
  const envioRow = document.getElementById('fila-envio');
  const envioPriceBox = document.getElementById('cart-envio-price');
  const selectEnvio = document.getElementById('select-envio');

  const totalItems = carrito.reduce((acc, item) => acc + item.cantidad, 0);

  if (badge) {
    badge.textContent = totalItems;
    badge.style.display = totalItems > 0 ? 'flex' : 'none';
  }
  if (countLabel) countLabel.textContent = `(${totalItems} productos)`;

  if (carrito.length === 0) {
    contenedor.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 3rem;">Tu carrito está vacío</p>';
    if (totalPriceBox) totalPriceBox.textContent = '$0';
    if (subtotalRow) subtotalRow.style.display = 'none';
    if (descuentoRow) descuentoRow.style.display = 'none';
    if (envioRow) envioRow.style.display = 'none';
    
    const bannerEnvioGratis = document.getElementById('envio-gratis-banner');
    if (bannerEnvioGratis) bannerEnvioGratis.style.display = 'none';
    return;
  }

  contenedor.innerHTML = '';
  let subtotal = 0;

  carrito.forEach(item => {
    subtotal += item.precio * item.cantidad;
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <img src="${item.imagen}" class="cart-item-img" alt="${item.nombre}">
      <div class="cart-item-details">
        <span class="cart-item-title">${item.nombre}</span>
        <span class="cart-item-meta">${item.familia}</span>
        <span class="cart-item-price">$${(item.precio * item.cantidad).toLocaleString('es-AR')}</span>
      </div>
      <div class="cart-item-controls">
        <button class="qty-btn" onclick="cambiarCantidad(${item.id}, -1)">-</button>
        <span class="cart-item-qty">${item.cantidad}</span>
        <button class="qty-btn" onclick="cambiarCantidad(${item.id}, 1)">+</button>
      </div>
    `;
    contenedor.appendChild(div);
  });

  const bannerEnvioGratis = document.getElementById('envio-gratis-banner');
  const UMBRAL_ENVIO_GRATIS = 80000;

  if (bannerEnvioGratis) {
    if (subtotal === 0) {
      bannerEnvioGratis.style.display = 'none';
    } else if (subtotal >= UMBRAL_ENVIO_GRATIS) {
      bannerEnvioGratis.style.display = 'block';
      bannerEnvioGratis.className = 'envio-logrado';
      bannerEnvioGratis.textContent = '🎉 ¡Felicitaciones! Tenés ENVÍO GRATIS.';
    } else {
      const falta = UMBRAL_ENVIO_GRATIS - subtotal;
      bannerEnvioGratis.style.display = 'block';
      bannerEnvioGratis.className = 'envio-faltante';
      bannerEnvioGratis.textContent = `🚚 ¡Te faltan $${falta.toLocaleString('es-AR')} para obtener ENVÍO GRATIS!`;
    }
  }

  let costoEnvio = 0;

  if (selectEnvio) {
    const valEnvio = selectEnvio.value;
    if (subtotal >= UMBRAL_ENVIO_GRATIS) {
      costoEnvio = 0;
    } else {
      if (valEnvio === 'moto_oeste') costoEnvio = 3500;
      else if (valEnvio === 'moto_caba') costoEnvio = 6500;
    }
  }

  let baseCalculo = subtotal;
  if (descuentoActivo > 0) {
    const montoDescuento = subtotal * descuentoActivo;
    baseCalculo = subtotal - montoDescuento;

    if (subtotalRow) subtotalRow.style.display = 'flex';
    if (subtotalPriceBox) subtotalPriceBox.textContent = `$${subtotal.toLocaleString('es-AR')}`;
    if (descuentoRow) descuentoRow.style.display = 'flex';
    if (descuentoPriceBox) descuentoPriceBox.textContent = `-$${montoDescuento.toLocaleString('es-AR')}`;
  } else {
    if (subtotalRow) subtotalRow.style.display = 'none';
    if (descuentoRow) descuentoRow.style.display = 'none';
  }

  const totalFinal = baseCalculo + costoEnvio;

  if (envioRow && envioPriceBox) {
    envioRow.style.display = 'flex';
    if (subtotal >= UMBRAL_ENVIO_GRATIS && subtotal > 0) {
      envioPriceBox.innerHTML = '<span style="color: #2E7D32; font-weight:800;">¡Gratis! (Supera $80.000)</span>';
    } else {
      envioPriceBox.textContent = costoEnvio === 0 ? 'Gratis' : `$${costoEnvio.toLocaleString('es-AR')}`;
    }
  }

  if (totalPriceBox) totalPriceBox.textContent = `$${totalFinal.toLocaleString('es-AR')}`;
}

function finalizarCompraWhatsApp() {
  if (carrito.length === 0) {
    alert('Tu carrito está vacío.');
    return;
  }

  const selectEnvio = document.getElementById('select-envio');
  let textoEnvioSeleccionado = 'Retiro sin cargo en Ciudadela';
  let costoEnvio = 0;
  const UMBRAL_ENVIO_GRATIS = 80000;

  let subtotal = 0;
  carrito.forEach(item => {
    subtotal += item.precio * item.cantidad;
  });

  if (selectEnvio) {
    const val = selectEnvio.value;
    if (subtotal >= UMBRAL_ENVIO_GRATIS) {
      costoEnvio = 0;
      textoEnvioSeleccionado = 'Envío Bonificado / Gratis (Compra mayor a $80.000)';
    } else {
      if (val === 'moto_oeste') {
        costoEnvio = 3500;
        textoEnvioSeleccionado = 'Moto Express (Ciudadela/Ramos/Haedo) - $3.500';
      } else if (val === 'moto_caba') {
        costoEnvio = 6500;
        textoEnvioSeleccionado = 'Moto CABA - $6.500';
      }
    }
  }

  let mensaje = 'Hola! Quiero realizar el siguiente pedido en Parfum Studio:\n\n';
  carrito.forEach(item => {
    mensaje += `▪️ ${item.cantidad}x ${item.nombre} ($${(item.precio * item.cantidad).toLocaleString('es-AR')})\n`;
  });

  mensaje += `\nSubtotal productos: $${subtotal.toLocaleString('es-AR')}`;

  let baseCalculo = subtotal;
  if (descuentoActivo > 0) {
    const descuento = subtotal * descuentoActivo;
    baseCalculo = subtotal - descuento;
    mensaje += `\nDescuento aplicado: -$${descuento.toLocaleString('es-AR')}`;
  }

  mensaje += `\nEnvío: ${textoEnvioSeleccionado}`;
  const totalFinal = baseCalculo + costoEnvio;
  mensaje += `\n\n*Total Final con Envío: $${totalFinal.toLocaleString('es-AR')}*`;
  mensaje += '\n\n¿Me confirmar datos para coordinar el pago?';

  const urlWsp = `https://wa.me/5491135890259?text=${encodeURIComponent(mensaje)}`;
  window.open(urlWsp, '_blank');
}

function guardarCarritoStorage() {
  localStorage.setItem('parfum_cart', JSON.stringify(carrito));
}

function cargarCarritoDesdeStorage() {
  const guardado = localStorage.getItem('parfum_cart');
  if (guardado) {
    try {
      carrito = JSON.parse(guardado);
      actualizarUICarrito();
    } catch(e) {}
  }
}

let imagenesTemporales = [];

function extraerListaFotos(imagen_url) {
  try {
    const parsed = JSON.parse(imagen_url);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map(url => url.startsWith('/uploads/') ? 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=600&q=80' : url);
    }
  } catch (e) {}

  if (!imagen_url || imagen_url.startsWith('/uploads/')) {
    return ['https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=600&q=80'];
  }
  return [imagen_url];
}

document.addEventListener("DOMContentLoaded", () => {
  const observerOptions = {
    root: null,
    rootMargin: "0px",
    threshold: 0.15
  };

  const observer = new IntersectionObserver((entries, observerInstance) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("scroll-reveal");
        observerInstance.unobserve(entry.target);
      }
    });
  }, observerOptions);

  const seccionesAnimadas = document.querySelectorAll(".scroll-reveal");
  seccionesAnimadas.forEach(seccion => {
    seccion.style.opacity = "0";
    seccion.style.transform = "translateY(25px)";
    observer.observe(seccion);
  });
});