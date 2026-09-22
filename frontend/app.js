let todosLosProductos = [];
let categoriaSeleccionada = 'todos';

const gridProductos = document.getElementById('grid-productos');
const inputBuscador = document.getElementById('buscador');
const botonesCategorias = document.querySelectorAll('.chip');

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
      gridProductos.innerHTML = '<p style="color: #ff6b6b; grid-column: 1/-1; text-align: center;">Error al cargar las fragancias.</p>';
    }
  }
}

// Renderizar tarjetas en el HTML
function renderizarProductos(productos) {
  if (!gridProductos) return;
  gridProductos.innerHTML = '';

  if (productos.length === 0) {
    gridProductos.innerHTML = '<p style="color: #888; grid-column: 1/-1; text-align: center; padding: 2rem;">No hay perfumes disponibles en este momento.</p>';
    return;
  }

  productos.forEach(perfume => {
    const tarjeta = document.createElement('div');
    tarjeta.className = 'product-card';

    const precioNumero = Number(perfume.precio) || 0;
    const mensajeWsp = encodeURIComponent(`¡Hola! Me interesa comprar el perfume ${perfume.nombre} ($${precioNumero.toLocaleString('es-AR')}). ¿Tienen disponibilidad?`);

    tarjeta.innerHTML = `
          <img src="${perfume.imagen_url}" alt="${perfume.nombre}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=600&q=80';">
          <div class="product-info">
            <span class="product-family">${perfume.familia}</span>
            <h3 class="product-title">${perfume.nombre}</h3>
            <p class="product-desc">${perfume.descripcion || ''}</p>
            <div class="product-price">$${precioNumero.toLocaleString('es-AR')}</div>
            <a href="https://wa.me/5491112345678?text=${mensajeWsp}" target="_blank" class="btn-comprar">
              Consultar / Pedir
            </a>
          </div>
        `;
    gridProductos.appendChild(tarjeta);
  });
}

// Filtrar por nombre y categoría
function aplicarFiltros() {
  const texto = inputBuscador ? inputBuscador.value.toLowerCase().trim() : '';

  const filtrados = todosLosProductos.filter(perfume => {
    const coincideNombre = perfume.nombre ? perfume.nombre.toLowerCase().includes(texto) : false;
    const coincideCategoria = categoriaSeleccionada === 'todos' || perfume.familia === categoriaSeleccionada;
    return coincideNombre && coincideCategoria;
  });

  renderizarProductos(filtrados);
}

// Escuchar eventos de buscador y botones
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

// Ejecutar al iniciar la página
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', cargarCatalogo);
} else {
  cargarCatalogo();
}