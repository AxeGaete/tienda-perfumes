let todosLosProductos = [];
let categoriaSeleccionada = 'todos';

const gridProductos = document.getElementById('grid-productos');
const inputBuscador = document.getElementById('buscador');
const botonesCategorias = document.querySelectorAll('.chip');

// Elementos de la sección detalle
const seccionDetalle = document.getElementById('detalle');
const detalleImg = document.getElementById('detalle-img');
const detalleFamilia = document.getElementById('detalle-familia');
const detalleNombre = document.getElementById('detalle-nombre');
const detallePrecio = document.getElementById('detalle-precio');
const detalleDescripcion = document.getElementById('detalle-descripcion');
const detalleBtnWsp = document.getElementById('detalle-btn-wsp');

// Cargar productos desde el backend
async function cargarCatalogo() {
  try {
    const respuesta = await fetch('/api/productos');
    if (!respuesta.ok) throw new Error('Error al consultar productos');
    todosLosProductos = await respuesta.json();
    renderizarProductos(todosLosProductos);
  } catch (error) {
    console.error('Error al cargar:', error);
    if (gridProductos) {
      gridProductos.innerHTML = '<p style="color: #FF4949; grid-column: 1/-1; text-align: center;">Error al cargar las fragancias.</p>';
    }
  }
}

// Renderizar tarjetas con redirección href="#detalle"
function renderizarProductos(productos) {
  if (!gridProductos) return;
  gridProductos.innerHTML = '';

  if (productos.length === 0) {
    gridProductos.innerHTML = '<p style="color: #666; grid-column: 1/-1; text-align: center; padding: 2rem;">No se encontraron perfumes con ese criterio.</p>';
    return;
  }

  productos.forEach(perfume => {
    const tarjeta = document.createElement('div');
    tarjeta.className = 'product-card';

    const precioNumero = Number(perfume.precio) || 0;
    const imagenFallback = 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=600&q=80';

    tarjeta.innerHTML = `
      <a href="#detalle" class="card-image-link" onclick="mostrarDetalle(${perfume.id})">
        <img src="${perfume.imagen_url}" alt="${perfume.nombre}" onerror="this.onerror=null; this.src='${imagenFallback}';">
      </a>
      <div class="product-info">
        <span class="product-family">${perfume.familia}</span>
        <h3 class="product-title">
          <a href="#detalle" class="card-title-link" onclick="mostrarDetalle(${perfume.id})">
            ${perfume.nombre}
          </a>
        </h3>
        <p class="product-desc">${perfume.descripcion || ''}</p>
        <div class="product-price">$${precioNumero.toLocaleString('es-AR')}</div>
        <div class="card-buttons">
          <a href="#detalle" class="btn-ver-detalle" onclick="mostrarDetalle(${perfume.id})">
            Ver Detalles
          </a>
        </div>
      </div>
    `;
    gridProductos.appendChild(tarjeta);
  });
}

// Función global que llena la sección #detalle al hacer clic
window.mostrarDetalle = function(id) {
  const perfume = todosLosProductos.find(p => p.id === id);
  if (!perfume) return;

  const precioNumero = Number(perfume.precio) || 0;
  const imagenFallback = 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=600&q=80';

  detalleImg.src = perfume.imagen_url;
  detalleImg.onerror = function() {
    this.onerror = null;
    this.src = imagenFallback;
  };

  detalleFamilia.textContent = perfume.familia;
  detalleNombre.textContent = perfume.nombre;
  detallePrecio.textContent = `$${precioNumero.toLocaleString('es-AR')}`;
  detalleDescripcion.textContent = perfume.descripcion || 'Sin descripción adicional.';

  const mensajeWsp = encodeURIComponent(`¡Hola! Quisiera comprar el perfume ${perfume.nombre} ($${precioNumero.toLocaleString('es-AR')}). ¿Cómo podemos coordinar?`);
  detalleBtnWsp.href = `https://wa.me/5491112345678?text=${mensajeWsp}`;

  // Mostrar la sección en el DOM
  seccionDetalle.style.display = 'block';
};

// Filtrar por texto y categoría
function aplicarFiltros() {
  const texto = inputBuscador ? inputBuscador.value.toLowerCase().trim() : '';

  const filtrados = todosLosProductos.filter(perfume => {
    const coincideNombre = perfume.nombre ? perfume.nombre.toLowerCase().includes(texto) : false;
    const coincideCategoria = categoriaSeleccionada === 'todos' || perfume.familia === categoriaSeleccionada;
    return coincideNombre && coincideCategoria;
  });

  renderizarProductos(filtrados);
}

if (inputBuscador) {
  inputBuscador.addEventListener('input', aplicarFiltros);
}

botonesCategorias.forEach(boton => {
  boton.addEventListener('click', () => {
    botonesCategorias.forEach(b => b.classList.remove('active'));
    boton.classList.add('active');
    categoriaSeleccionada = boton.dataset.categoria;
    aplicarFiltros();
  });
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', cargarCatalogo);
} else {
  cargarCatalogo();
}