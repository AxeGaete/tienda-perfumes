let todosLosProductos = [];
let productosFiltrados = [];
let carrito = [];
let slideActualIndex = 0;
let slideInterval = null;
let descuentoActivo = 0; // 0 o 0.10 por el cupón

document.addEventListener('DOMContentLoaded', () => {
  cargarProductos();
  cargarCarritoDesdeStorage();
});

async function cargarProductos() {
  try {
    const res = await fetch('/api/productos');
    todosLosProductos = await res.json();
    productosFiltrados = [...todosLosProductos];
    
    renderizarHeroSlider();
    renderizarCatalogo();
  } catch (err) {
    console.error('Error al cargar productos:', err);
  }
}

// ================= HERO CAROUSEL =================
function renderizarHeroSlider() {
  const track = document.getElementById('carousel-track');
  const dotsContainer = document.getElementById('carousel-dots');
  if (!track || !dotsContainer) return;

  const destacados = todosLosProductos.filter(p => p.destacado_hero === 1 || p.destacado_hero === '1');
  const slidesData = destacados.length > 0 ? destacados : todosLosProductos.slice(0, 4);

  track.innerHTML = '';
  dotsContainer.innerHTML = '';

  if (slidesData.length === 0) {
    track.innerHTML = '<div class="carousel-slide active"><p>No hay perfumes disponibles</p></div>';
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
    dot.onclick = () => irASlide(index);
    dotsContainer.appendChild(dot);
  });

  iniciarAutoplaySlider();
}

function cambiarSlide(direccion) {
  const slides = document.querySelectorAll('.carousel-slide');
  const dots = document.querySelectorAll('.dot');
  if (slides.length === 0) return;

  slides[slideActualIndex].classList.remove('active');
  dots[slideActualIndex].classList.remove('active');

  slideActualIndex = (slideActualIndex + direccion + slides.length) % slides.length;

  slides[slideActualIndex].classList.add('active');
  dots[slideActualIndex].classList.add('active');
  reiniciarAutoplaySlider();
}

function irASlide(index) {
  const slides = document.querySelectorAll('.carousel-slide');
  const dots = document.querySelectorAll('.dot');
  if (slides.length === 0) return;

  slides[slideActualIndex].classList.remove('active');
  dots[slideActualIndex].classList.remove('active');

  slideActualIndex = index;

  slides[slideActualIndex].classList.add('active');
  dots[slideActualIndex].classList.add('active');
  reiniciarAutoplaySlider();
}

function iniciarAutoplaySlider() {
  if (slideInterval) clearInterval(slideInterval);
  slideInterval = setInterval(() => cambiarSlide(1), 4500);
}

function reiniciarAutoplaySlider() {
  clearInterval(slideInterval);
  iniciarAutoplaySlider();
}

// ================= FILTROS INTELIGENTES Y BÚSQUEDA =================
let filtroFamiliaActivo = 'todos';
let filtroNotaActivo = 'todos';
let precioMaximoFiltro = 500000;

function toggleFiltrosColapsables() {
  const box = document.getElementById('filtros-collapsible');
  const arrow = document.getElementById('toggle-arrow');
  if (box.style.display === 'none') {
    box.style.display = 'flex';
    arrow.style.transform = 'rotate(180deg)';
  } else {
    box.style.display = 'none';
    arrow.style.transform = 'rotate(0deg)';
  }
}

function actualizarRangoPrecio(val) {
  precioMaximoFiltro = Number(val);
  document.getElementById('precio-valor-label').textContent = `$${precioMaximoFiltro.toLocaleString('es-AR')}`;
  filtrarProductos();
}

function seleccionarFiltroChip(tipo, valor, elemento) {
  const contenedor = tipo === 'familia' ? document.getElementById('chips-familia') : document.getElementById('chips-nota');
  contenedor.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  elemento.classList.add('active');

  if (tipo === 'familia') filtroFamiliaActivo = valor;
  if (tipo === 'nota') filtroNotaActivo = valor;

  filtrarProductos();
}

function limpiarFiltros() {
  document.getElementById('buscador').value = '';
  document.getElementById('precio-range').value = 500000;
  precioMaximoFiltro = 500000;
  document.getElementById('precio-valor-label').textContent = '$500.000';
  
  filtroFamiliaActivo = 'todos';
  filtroNotaActivo = 'todos';

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
  const orden = document.getElementById('orden-select').value;

  productosFiltrados = todosLosProductos.filter(prod => {
    const nombreMatch = prod.nombre.toLowerCase().includes(texto);
    const familiaMatch = prod.familia.toLowerCase().includes(texto);
    const descMatch = (prod.descripcion || '').toLowerCase().includes(texto);
    const notasMatch = (prod.notas_salida + ' ' + prod.notas_corazon + ' ' + prod.notas_fondo).toLowerCase().includes(texto);
    
    const coincideTexto = nombreMatch || familiaMatch || descMatch || notasMatch;
    const coincidePrecio = Number(prod.precio) <= precioMaximoFiltro;
    
    const coincideFamilia = filtroFamiliaActivo === 'todos' || prod.familia === filtroFamiliaActivo;
    const coincideNota = filtroNotaActivo === 'todos' || notasMatch;

    return coincideTexto && coincidePrecio && coincideFamilia && coincideNota;
  });

  // Ordenamiento
  if (orden === 'menor-precio') productosFiltrados.sort((a, b) => a.precio - b.precio);
  if (orden === 'mayor-precio') productosFiltrados.sort((a, b) => b.precio - a.precio);
  if (orden === 'alfabetico') productosFiltrados.sort((a, b) => a.nombre.localeCompare(b.nombre));
  if (orden === 'recientes') productosFiltrados.sort((a, b) => b.id - a.id);

  renderizarCatalogo();
}

function renderizarCatalogo() {
  const grilla = document.getElementById('grilla-productos');
  if (!grilla) return;

  if (productosFiltrados.length === 0) {
    grilla.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">No se encontraron perfumes con esos filtros.</p>';
    return;
  }

  grilla.innerHTML = '';
  productosFiltrados.forEach(prod => {
    const fotos = extraerListaFotos(prod.imagen_url);
    const stockVal = prod.estado_stock || 'En Stock';
    let badgeStockHTML = '';
    if (stockVal === 'Pocas Unidades') badgeStockHTML = '<span class="stock-badge-pocas">Pocas Unidades</span>';
    if (stockVal === 'Sin Stock') badgeStockHTML = '<span class="stock-badge-sin" style="background:#FFEBEE; color:#C62828; font-size:0.65rem; font-weight:800; padding:0.2rem 0.6rem; border-radius:10px;">Sin Stock</span>';

    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <a href="#" onclick="verDetalle(${prod.id}); return false;" class="card-image-link">
        <img src="${fotos[0]}" alt="${prod.nombre}" onerror="this.src='https://via.placeholder.com/280?text=Perfume'">
      </a>
      <div class="product-info">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
          <span class="product-family">${prod.familia}</span>
          ${badgeStockHTML}
        </div>
        <h3 class="product-title"><a href="#" onclick="verDetalle(${prod.id}); return false;" class="card-title-link">${prod.nombre}</a></h3>
        <p class="product-desc">${prod.descripcion || 'Fragancia exclusiva de alta gama.'}</p>
        <div class="product-price">$${Number(prod.precio).toLocaleString('es-AR')}</div>
        <div class="card-actions-row">
          <a href="#" onclick="verDetalle(${prod.id}); return false;" class="btn-ver-detalle">Ver Detalle</a>
          ${stockVal === 'Sin Stock' 
            ? `<a href="https://wa.me/5491100000000?text=Hola,%20quiero%20saber%20cuándo%20reingresa%20el%20perfume%20${encodeURIComponent(prod.nombre)}" target="_blank" class="btn-card-add-cart" style="background:#1565C0; text-decoration:none;" title="Avisarme cuando haya stock">📲 Avisar</a>`
            : `<button class="btn-card-add-cart" onclick="agregarAlCarrito(${prod.id})" title="Añadir al Carrito"><svg class="ui-icon-btn" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>`
          }
        </div>
      </div>
    `;
    grilla.appendChild(card);
  });
}

function enfocarBuscador() {
  const input = document.getElementById('buscador');
  input.focus();
  input.classList.add('highlight');
  setTimeout(() => input.classList.remove('highlight'), 1200);
}

function mostrarCatalogo(e) {
  if (e) e.preventDefault();
  document.getElementById('vista-principal').style.display = 'block';
  document.getElementById('vista-detalle').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ================= VISTA DETALLE DE PRODUCTO & RESEÑAS =================
async function verDetalle(id) {
  const prod = todosLosProductos.find(p => p.id === id);
  if (!prod) return;

  document.getElementById('vista-principal').style.display = 'none';
  const seccionDetalle = document.getElementById('vista-detalle');
  seccionDetalle.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const fotos = extraerListaFotos(prod.imagen_url);

  // Cargar reseñas desde el backend
  let resenas = [];
  try {
    const res = await fetch(`/api/productos/${id}/resenas`);
    resenas = await res.json();
  } catch(err) {}

  let promedioEstrellas = 5;
  if (resenas.length > 0) {
    const suma = resenas.reduce((acc, r) => acc + Number(r.estrellas), 0);
    promedioEstrellas = (suma / resenas.length).toFixed(1);
  }

  seccionDetalle.innerHTML = `
    <div style="margin-bottom: 2rem;">
      <a href="#" onclick="mostrarCatalogo(event)" class="btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.8rem;">← Volver al Catálogo</a>
    </div>
    <div class="detail-card">
      <div class="detail-gallery">
        <div class="detail-main-image" id="main-image-container">
          <button class="detail-nav-btn prev" onclick="rotarFotoDetalle(-1)">❮</button>
          <img id="imagen-principal-detalle" src="${fotos[0]}" alt="${prod.nombre}">
          <button class="detail-nav-btn next" onclick="rotarFotoDetalle(1)">❯</button>
        </div>
        <div class="detail-thumbnails" id="thumbnails-container">
          ${fotos.map((f, idx) => `
            <img src="${f}" class="detail-thumb ${idx === 0 ? 'active' : ''}" onclick="cambiarFotoPrincipal(${idx}, '${f}')" alt="Miniatura">
          `).join('')}
        </div>
      </div>

      <div class="detail-info-box">
        <div class="detail-tags">
          <span class="detail-family">${prod.familia}</span>
          <span class="badge-tag">${prod.tipo || 'Diseñador'}</span>
          <span class="badge-tag">⭐ ${promedioEstrellas} (${resenas.length} reseñas)</span>
        </div>
        <h1 class="detail-title">${prod.nombre}</h1>
        <div class="detail-price">$${Number(prod.precio).toLocaleString('es-AR')}</div>

        <div class="notes-pyramid">
          <div class="note-row"><span class="note-label">Salida:</span><span class="note-value">${prod.notas_salida || 'No especificado'}</span></div>
          <div class="note-row"><span class="note-label">Corazón:</span><span class="note-value">${prod.notas_corazon || 'No especificado'}</span></div>
          <div class="note-row"><span class="note-label">Fondo:</span><span class="note-value">${prod.notas_fondo || 'No especificado'}</span></div>
        </div>

        <p class="detail-description">${prod.descripcion || 'Sin descripción adicional.'}</p>

        <div class="detail-actions">
          ${prod.estado_stock === 'Sin Stock'
            ? `<a href="https://wa.me/5491100000000?text=Hola,%20quiero%20saber%20cuándo%20reingresa%20${encodeURIComponent(prod.nombre)}" target="_blank" class="btn-primary" style="background:#1565C0; width:100%;">📲 Avisarme por WhatsApp cuando haya stock</a>`
            : `<button class="btn-primary" onclick="agregarAlCarritoDesdeDetalle(${prod.id})">Añadir al Carrito</button>`
          }
        </div>
      </div>
    </div>

    <!-- Sección de Reseñas de Clientes -->
    <div style="max-width: 1100px; margin: 3rem auto 0; background: var(--bg-main); border: 1px solid var(--c-border); border-radius: var(--radius-lg); padding: 2.5rem; box-shadow: var(--shadow-subtle);">
      <h3 style="font-size: 1.5rem; font-weight: 800; margin-bottom: 1.5rem;">Opiniones y Calificaciones</h3>
      
      <div id="lista-resenas" style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2.5rem;">
        ${resenas.length === 0 ? '<p style="color: var(--text-muted);">Sé el primero en dejar una reseña para este perfume.</p>' : 
          resenas.map(r => `
            <div style="background: var(--bg-soft); padding: 1.2rem; border-radius: var(--radius-sm); border: 1px solid var(--c-border);">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.4rem;">
                <strong>${r.autor}</strong>
                <span style="color: #f59e0b;">${'★'.repeat(r.estrellas)}${'☆'.repeat(5 - r.estrellas)}</span>
              </div>
              <p style="color: var(--text-muted); font-size: 0.9rem;">${r.comentario}</p>
            </div>
          `).join('')}
      </div>

      <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem;">Dejanos tu opinión</h4>
      <form onsubmit="enviarResena(event, ${prod.id})" style="display: grid; gap: 1rem; max-width: 600px;">
        <input type="text" id="resena-autor" placeholder="Tu Nombre" class="input-field" required style="margin-bottom:0;">
        <select id="resena-estrellas" class="input-field" required style="margin-bottom:0;">
          <option value="5">⭐⭐⭐⭐⭐ Excelente (5/5)</option>
          <option value="4">⭐⭐⭐⭐ Muy Bueno (4/5)</option>
          <option value="3">⭐⭐⭐ Bueno (3/5)</option>
          <option value="2">⭐⭐ Regular (2/5)</option>
          <option value="1">⭐ Malo (1/5)</option>
        </select>
        <textarea id="resena-comentario" placeholder="¿Qué te pareció la fijación y el aroma?" class="input-field" required style="margin-bottom:0; min-height:80px;"></textarea>
        <button type="submit" class="btn-primary" style="width: fit-content;">Publicar Reseña</button>
      </form>
    </div>
  `;
}

let fotoDetalleIndexActual = 0;
let fotosDetalleActuales = [];

function cambiarFotoPrincipal(idx, url) {
  fotoDetalleIndexActual = idx;
  document.getElementById('imagen-principal-detalle').src = url;
  document.querySelectorAll('.detail-thumb').forEach((t, i) => {
    if (i === idx) t.classList.add('active');
    else t.classList.remove('active');
  });
}

function rotarFotoDetalle(dir) {
  const prodIdActual = document.querySelector('.detail-title'); // referencia visual si hace falta
  // Tomamos las fotos del producto activo actual buscando en la galería
  const thumbs = document.querySelectorAll('.detail-thumb');
  if (thumbs.length <= 1) return;
  fotoDetalleIndexActual = (fotoDetalleIndexActual + dir + thumbs.length) % thumbs.length;
  thumbs[fotoDetalleIndexActual].click();
}

async function enviarResena(e, productoId) {
  e.preventDefault();
  const autor = document.getElementById('resena-autor').value.trim();
  const estrellas = document.getElementById('resena-estrellas').value;
  const comentario = document.getElementById('resena-comentario').value.trim();

  try {
    const res = await fetch(`/api/productos/${productoId}/resenas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autor, estrellas, comentario })
    });
    if (res.ok) {
      alert('¡Gracias por tu reseña!');
      verDetalle(productoId);
    } else {
      alert('Error al enviar reseña');
    }
  } catch(err) {
    alert('Error de conexión');
  }
}

// ================= CARRITO Y CUPÓN DE DESCUENTO =================
function toggleCart() {
  const sidebar = document.getElementById('cart-sidebar');
  const overlay = document.getElementById('cart-overlay');
  sidebar.classList.toggle('active');
  overlay.classList.toggle('active');
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
  actualizarUIcarrito();
  toggleCart();
}

function agregarAlCarritoDesdeDetalle(id) {
  agregarAlCarrito(id);
}

function cambiarCantidad(id, delta) {
  const item = carrito.find(i => i.id === id);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad <= 0) {
    carrito = carrito.filter(i => i.id !== id);
  }
  guardarCarritoStorage();
  actualizarUIcarrito();
}

function vaciarCarrito() {
  carrito = [];
  descuentoActivo = 0;
  document.getElementById('cupon-msg').style.display = 'none';
  document.getElementById('cupon-input').value = '';
  guardarCarritoStorage();
  actualizarUIcarrito();
}

function aplicarCupon() {
  const codigo = document.getElementById('cupon-input').value.trim().toUpperCase();
  const msgBox = document.getElementById('cupon-msg');

  if (codigo === 'PARFUM10' || codigo === 'VERANO10') {
    descuentoActivo = 0.10;
    msgBox.textContent = '¡Cupón aplicado con éxito (-10%)!';
    msgBox.style.display = 'block';
  } else {
    descuentoActivo = 0;
    msgBox.textContent = 'Cupón inválido o expirado';
    msgBox.style.color = '#C62828';
    msgBox.style.display = 'block';
  }
  actualizarUIcarrito();
}

function actualizarUIcarrito() {
  const lista = document.getElementById('cart-items-list');
  const badge = document.getElementById('cart-badge-count');
  const countLabel = document.getElementById('cart-count-label');
  const totalPriceBox = document.getElementById('cart-total-price');
  const subtotalRow = document.getElementById('fila-subtotal');
  const subtotalPriceBox = document.getElementById('cart-subtotal-price');
  const descuentoRow = document.getElementById('fila-descuento');
  const descuentoPriceBox = document.getElementById('cart-descuento-price');

  const totalItems = carrito.reduce((acc, item) => acc + item.cantidad, 0);

  if (totalItems > 0) {
    badge.style.display = 'flex';
    badge.textContent = totalItems;
    countLabel.textContent = `(${totalItems} ítems)`;
  } else {
    badge.style.display = 'none';
    countLabel.textContent = '(0 ítems)';
  }

  if (carrito.length === 0) {
    lista.innerHTML = `
      <div class="cart-empty-msg">
        <svg class="cart-empty-svg" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line></svg>
        <p>Tu carrito está vacío</p>
      </div>
    `;
    totalPriceBox.textContent = '$0';
    subtotalRow.style.display = 'none';
    descuentoRow.style.display = 'none';
    return;
  }

  lista.innerHTML = '';
  let subtotal = 0;

  carrito.forEach(item => {
    subtotal += item.precio * item.cantidad;
    const itemEl = document.createElement('div');
    itemEl.className = 'cart-item';
    itemEl.innerHTML = `
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
    lista.appendChild(itemEl);
  });

  if (descuentoActivo > 0) {
    const montoDescuento = subtotal * descuentoActivo;
    const totalFinal = subtotal - montoDescuento;

    subtotalRow.style.display = 'flex';
    subtotalPriceBox.textContent = `$${subtotal.toLocaleString('es-AR')}`;
    descuentoRow.style.display = 'flex';
    descuentoPriceBox.textContent = `-$${montoDescuento.toLocaleString('es-AR')}`;
    totalPriceBox.textContent = `$${totalFinal.toLocaleString('es-AR')}`;
  } else {
    subtotalRow.style.display = 'none';
    descuentoRow.style.display = 'none';
    totalPriceBox.textContent = `$${subtotal.toLocaleString('es-AR')}`;
  }
}

function finalizarCompraWhatsApp() {
  if (carrito.length === 0) {
    alert('Tu carrito está vacío.');
    return;
  }

  let mensaje = 'Hola! Quiero realizar el siguiente pedido en Parfum Studio:\n\n';
  let subtotal = 0;

  carrito.forEach(item => {
    subtotal += item.precio * item.cantidad;
    mensaje += `▪️ ${item.cantidad}x ${item.nombre} ($${(item.precio * item.cantidad).toLocaleString('es-AR')})\n`;
  });

  if (descuentoActivo > 0) {
    const descuento = subtotal * descuentoActivo;
    const total = subtotal - descuento;
    mensaje += `\nSubtotal: $${subtotal.toLocaleString('es-AR')}`;
    mensaje += `\nDescuento aplicado: -$${descuento.toLocaleString('es-AR')}`;
    mensaje += `\n*Total Final: $${total.toLocaleString('es-AR')}*`;
  } else {
    mensaje += `\n*Total Final: $${subtotal.toLocaleString('es-AR')}*`;
  }

  mensaje += '\n\n¿Me confirman stock y datos para coordinar el pago y envío?';

  const urlWsp = `https://wa.me/5491100000000?text=${encodeURIComponent(mensaje)}`;
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
      actualizarUIcarrito();
    } catch(e) {}
  }
}

// Utilidad para extraer fotos
function extraerListaFotos(imagen_url) {
  try {
    const parsed = JSON.parse(imagen_url);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (e) {}
  return [imagen_url || 'https://via.placeholder.com/300?text=Perfume'];
}