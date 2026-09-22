let todosLosProductos = [];
let categoriaSeleccionada = 'todos';

const gridProductos = document.getElementById('grid-productos');
const inputBuscador = document.getElementById('buscador');
const botonesCategorias = document.querySelectorAll('.chip');

const seccionDetalle = document.getElementById('detalle');
const detalleImgPrincipal = document.getElementById('detalle-img-principal');
const detalleThumbnails = document.getElementById('detalle-thumbnails');
const detalleFamilia = document.getElementById('detalle-familia');
const detalleNombre = document.getElementById('detalle-nombre');
const detallePrecio = document.getElementById('detalle-precio');
const detalleDescripcion = document.getElementById('detalle-descripcion');
const detalleBtnWsp = document.getElementById('detalle-btn-wsp');

const imagenFallback = 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=600&q=80';

// Función auxiliar para parsear URLs (soporta string simple o array JSON)
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
    renderizarProductos(todosLosProductos);
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
    gridProductos.innerHTML = '<p style="color: #666; grid-column: 1/-1; text-align: center; padding: 2rem;">No se encontraron perfumes con ese criterio.</p>';
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

  // Foto principal por defecto
  detalleImgPrincipal.src = fotos[0];
  detalleImgPrincipal.onerror = function() {
    this.onerror = null;
    this.src = imagenFallback;
  };

  // Crear miniaturas interactivas
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
  detalleDescripcion.textContent = perfume.descripcion || 'Sin descripción adicional.';

  const mensajeWsp = encodeURIComponent(`¡Hola! Quisiera consultar por el perfume ${perfume.nombre} ($${precioNumero.toLocaleString('es-AR')}).`);
  detalleBtnWsp.href = `https://wa.me/5491112345678?text=${mensajeWsp}`;

  seccionDetalle.style.display = 'block';
};

function aplicarFiltros() {
  const texto = inputBuscador ? inputBuscador.value.toLowerCase().trim() : '';

  const filtrados = todosLosProductos.filter(perfume => {
    const coincideNombre = perfume.nombre ? perfume.nombre.toLowerCase().includes(texto) : false;
    const coincideCategoria = categoriaSeleccionada === 'todos' || perfume.familia === categoriaSeleccionada;
    return coincideNombre && coincideCategoria;
  });

  renderizarProductos(filtrados);
}

if (inputBuscador) inputBuscador.addEventListener('input', aplicarFiltros);

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