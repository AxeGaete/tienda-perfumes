let todosLosProductos = [];
let categoriaSeleccionada = 'todos';

const gridProductos = document.getElementById('grid-productos');
const inputBuscador = document.getElementById('buscador');
const selectOrden = document.getElementById('select-orden');
const sliderPrecio = document.getElementById('slider-precio');
const labelPrecioMax = document.getElementById('label-precio-max');
const botonesCategorias = document.querySelectorAll('.chip');

// Elementos de la sección detalle
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

const imagenFallback = 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=600&q=80';

function obtenerFotos(imagen_url) {
  try {
    const parsed = JSON.parse(imagen_url);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (e) {}
  return [imagen_url || imagenFallback];
}

async function cargarCatalogo() {
  try {
    const respuesta = await fetch('/api/productos');
    if (!respuesta.ok) throw new Error('Error al consultar productos');
    todosLosProductos = await respuesta.json();
    
    // Si hay productos con precio superior al default, ajustar el máximo del slider
    if (todosLosProductos.length > 0) {
      const maximo = Math.max(...todosLosProductos.map(p => Number(p.precio) || 0));
      if (maximo > 150000 && sliderPrecio) {
        sliderPrecio.max = maximo;
        sliderPrecio.value = maximo;
        labelPrecioMax.textContent = `$${maximo.toLocaleString('es-AR')}`;
      }
    }
    
    aplicarFiltrosYOrden();
  } catch (error) {
    console.error('Error al cargar:', error);
    if (gridProductos) {
      gridProductos.innerHTML = '<p style="color: #FF4949; grid-column: 1/-1; text-align: center;">Error al cargar las fragancias.</p>';
    }
  }
}

function renderizarProductos(productos) {
  if (!gridProductos) return;
  gridProductos.innerHTML = '';

  if (productos.length === 0) {
    gridProductos.innerHTML = '<p style="color: #666; grid-column: 1/-1; text-align: center; padding: 2rem;">No se encontraron fragancias con esos filtros.</p>';
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
            Ver Detalles (${fotos.length} ${fotos.length > 1 ? 'fotos' : 'foto'})
          </a>
        </div>
      </div>
    `;
    gridProductos.appendChild(tarjeta);
  });
}

window.mostrarDetalle = function(id) {
  const perfume = todosLosProductos.find(p => p.id === id);
  if (!perfume) return;

  const fotos = obtenerFotos(perfume.imagen_url);
  const precioNumero = Number(perfume.precio) || 0;

  detalleImgPrincipal.src = fotos[0];
  detalleImgPrincipal.onerror = function() {
    this.onerror = null;
    this.src = imagenFallback;
  };

  detalleThumbnails.innerHTML = '';
  fotos.forEach((fotoUrl, index) => {
    const thumb = document.createElement('img');
    thumb.src = fotoUrl;
    thumb.className = `detail-thumb ${index === 0 ? 'active' : ''}`;
    thumb.onerror = function() { this.src = imagenFallback; };
    
    thumb.addEventListener('click', () => {
      detalleImgPrincipal.src = fotoUrl;
      document.querySelectorAll('.detail-thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    });

    detalleThumbnails.appendChild(thumb);
  });

  detalleFamilia.textContent = perfume.familia;
  detalleNombre.textContent = perfume.nombre;
  detallePrecio.textContent = `$${precioNumero.toLocaleString('es-AR')}`;
  detalleDescripcion.textContent = perfume.descripcion || '';

  // Notas estructuradas
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

function aplicarFiltrosYOrden() {
  const texto = inputBuscador ? inputBuscador.value.toLowerCase().trim() : '';
  const precioMax = sliderPrecio ? Number(sliderPrecio.value) : Infinity;
  const criterioOrden = selectOrden ? selectOrden.value : 'recientes';

  let filtrados = todosLosProductos.filter(perfume => {
    const coincideNombre = perfume.nombre ? perfume.nombre.toLowerCase().includes(texto) : false;
    const coincideCategoria = categoriaSeleccionada === 'todos' || perfume.familia === categoriaSeleccionada;
    const coincidePrecio = (Number(perfume.precio) || 0) <= precioMax;
    return coincideNombre && coincideCategoria && coincidePrecio;
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

// Event Listeners
if (inputBuscador) inputBuscador.addEventListener('input', aplicarFiltrosYOrden);
if (selectOrden) selectOrden.addEventListener('change', aplicarFiltrosYOrden);

if (sliderPrecio) {
  sliderPrecio.addEventListener('input', (e) => {
    labelPrecioMax.textContent = `$${Number(e.target.value).toLocaleString('es-AR')}`;
    aplicarFiltrosYOrden();
  });
}

botonesCategorias.forEach(boton => {
  boton.addEventListener('click', () => {
    botonesCategorias.forEach(b => b.classList.remove('active'));
    boton.classList.add('active');
    categoriaSeleccionada = boton.dataset.categoria;
    aplicarFiltrosYOrden();
  });
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', cargarCatalogo);
} else {
  cargarCatalogo();
}