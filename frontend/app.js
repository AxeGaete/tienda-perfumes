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
  if (totalItemsLabel) totalItemsLabel.textContent = `(${totalProductos}${totalProductos === 1 ? 'producto' : 'productos'})`;
  if (totalPriceLabel) totalPriceLabel.textContent = `$${totalInversion.toLocaleString('es-AR')}`;

  if (!itemsContainer) return;

  if (carrito.length === 0) {
    itemsContainer.innerHTML = `
      <div class="cart-empty-msg">
        <svg class="cart-empty-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23