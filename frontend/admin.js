let listaProductosAdmin = [];
let productoEnEdicionId = null;
let fotosExistentesActuales = [];

document.addEventListener('DOMContentLoaded', () => {
  verificarSesion();
  cargarTemaVisualAdmin();
  inicializarAdminEventos();
});

function verificarSesion() {
  const token = localStorage.getItem('parfum_admin_key');
  if (!token) {
    const clave = prompt('Introduce la contraseña de Administrador:');
    if (!clave) {
      window.location.href = 'index.html';
      return;
    }
    // Verificar clave con el backend
    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clave })
    })
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        localStorage.setItem('parfum_admin_key', clave);
        cargarProductosAdmin();
      } else {
        alert('Contraseña incorrecta');
        window.location.href = 'index.html';
      }
    })
    .catch(() => {
      alert('Error de conexión con el servidor');
      window.location.href = 'index.html';
    });
  } else {
    cargarProductosAdmin();
  }
}

function cerrarSesionAdmin() {
  localStorage.removeItem('parfum_admin_key');
  window.location.href = 'index.html';
}

async function cargarProductosAdmin() {
  try {
    const res = await fetch('/api/productos');
    listaProductosAdmin = await res.json();
    renderizarTablaAdmin(listaProductosAdmin);
  } catch (err) {
    console.error('Error al cargar productos:', err);
  }
}

function renderizarTablaAdmin(productos) {
  const contenedor = document.getElementById('admin-productos-lista');
  if (!contenedor) return;

  if (productos.length === 0) {
    contenedor.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 2rem;">No hay perfumes cargados.</p>';
    return;
  }

  contenedor.innerHTML = productos.map(prod => {
    let fotos = [];
    try {
      fotos = JSON.parse(prod.imagen_url);
    } catch(e) {
      fotos = [prod.imagen_url];
    }
    const fotoPrincipal = fotos[0] || 'https://via.placeholder.com/100';

    return `
      <div class="admin-product-row" style="display: flex; align-items: center; justify-content: space-between; padding: 10px; border-bottom: 1px solid var(--border-color); gap: 15px;">
        <img src="${fotoPrincipal}" alt="${prod.nombre}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px;">
        <div style="flex: 1;">
          <h4 style="margin: 0; font-size: 1rem; color: var(--text-main);">${prod.nombre}</h4>
          <span style="font-size: 0.8rem; color: var(--text-muted);">${prod.familia} | $${Number(prod.precio).toLocaleString('es-AR')}</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button onclick="prepararEdicion(${prod.id})" class="btn-secondary" style="padding: 5px 10px; font-size: 0.8rem;">Editar</button>
          <button onclick="eliminarProducto(${prod.id})" class="btn-secondary" style="padding: 5px 10px; font-size: 0.8rem; background: #C62828; color: #fff; border: none;">Borrar</button>
        </div>
      </div>
    `;
  }).join('');
}

function inicializarAdminEventos() {
  const form = document.getElementById('form-producto');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = localStorage.getItem('parfum_admin_key');

      const formData = new FormData();
      formData.append('nombre', document.getElementById('nombre').value);
      formData.append('familia', document.getElementById('familia').value);
      formData.append('descripcion', document.getElementById('descripcion').value);
      formData.append('precio', document.getElementById('precio').value);
      formData.append('tipo', document.getElementById('tipo').value);
      formData.append('genero', document.getElementById('genero').value);
      formData.append('estacion', document.getElementById('estacion').value);
      formData.append('notas_salida', document.getElementById('notas_salida').value);
      formData.append('notas_corazon', document.getElementById('notas_corazon').value);
      formData.append('notas_fondo', document.getElementById('notas_fondo').value);
      formData.append('estado_stock', document.getElementById('estado_stock').value);
      
      const esHeroCheckbox = document.getElementById('destacado_hero');
      formData.append('destacado_hero', esHeroCheckbox && esHeroCheckbox.checked ? '1' : '0');

      const inputImgs = document.getElementById('imagenes');
      if (inputImgs && inputImgs.files) {
        for (let i = 0; i < inputImgs.files.length; i++) {
          formData.append('imagenes', inputImgs.files[i]);
        }
      }

      let url = '/api/productos';
      let method = 'POST';

      if (productoEnEdicionId) {
        url = `/api/productos/${productoEnEdicionId}`;
        method = 'PUT';
        formData.append('fotos_existentes', JSON.stringify(fotosExistentesActuales));
      }

      try {
        const res = await fetch(url, {
          method: method,
          headers: { 'x-admin-key': token },
          body: formData
        });

        const data = await res.json();
        if (res.ok) {
          alert(productoEnEdicionId ? '¡Perfume actualizado con éxito!' : '¡Perfume creado con éxito!');
          cancelarEdicion();
          cargarProductosAdmin();
        } else {
          alert('Error: ' + (data.error || 'No se pudo guardar'));
        }
      } catch (err) {
        console.error(err);
        alert('Error de conexión al guardar el producto');
      }
    });
  }
}

function prepararEdicion(id) {
  const prod = listaProductosAdmin.find(p => p.id === id);
  if (!prod) return;

  productoEnEdicionId = id;
  document.getElementById('nombre').value = prod.nombre || '';
  document.getElementById('familia').value = prod.familia || 'Amaderado';
  document.getElementById('descripcion').value = prod.descripcion || '';
  document.getElementById('precio').value = prod.precio || '';
  document.getElementById('tipo').value = prod.tipo || 'Diseñador';
  document.getElementById('genero').value = prod.genero || 'Unisex';
  document.getElementById('estacion').value = prod.estacion || 'Todo el año';
  document.getElementById('notas_salida').value = prod.notas_salida || '';
  document.getElementById('notas_corazon').value = prod.notas_corazon || '';
  document.getElementById('notas_fondo').value = prod.notas_fondo || '';
  document.getElementById('estado_stock').value = prod.estado_stock || 'En Stock';

  const esHeroCheckbox = document.getElementById('destacado_hero');
  if (esHeroCheckbox) {
    esHeroCheckbox.checked = prod.destacado_hero === 1 || prod.destacado_hero === '1';
  }

  try {
    fotosExistentesActuales = JSON.parse(prod.imagen_url);
  } catch(e) {
    fotosExistentesActuales = [prod.imagen_url];
  }

  const btnSubmit = document.getElementById('btn-guardar-producto');
  if (btnSubmit) btnSubmit.textContent = 'Actualizar Perfume';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicion() {
  productoEnEdicionId = null;
  fotosExistentesActuales = [];
  const form = document.getElementById('form-producto');
  if (form) form.reset();
  const btnSubmit = document.getElementById('btn-guardar-producto');
  if (btnSubmit) btnSubmit.textContent = 'Guardar Perfume';
}

async function eliminarProducto(id) {
  if (!confirm('¿Estás seguro de eliminar este perfume?')) return;
  const token = localStorage.getItem('parfum_admin_key');

  try {
    const res = await fetch(`/api/productos/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': token }
    });
    if (res.ok) {
      alert('Perfume eliminado');
      cargarProductosAdmin();
    } else {
      alert('No se pudo eliminar el producto');
    }
  } catch (err) {
    console.error(err);
    alert('Error de conexión');
  }
}

// ================= MODO OSCURO / CLARO ADMIN =================
function alternarTemaVisual() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('parfum_theme', newTheme);
  actualizarIconoTemaAdmin(newTheme);
}

function cargarTemaVisualAdmin() {
  const savedTheme = localStorage.getItem('parfum_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  actualizarIconoTemaAdmin(savedTheme);
}

function actualizarIconoTemaAdmin(theme) {
  const icon = document.getElementById('theme-icon');
  if (!icon) return;
  
  if (theme === 'dark') {
    icon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
  } else {
    icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
  }
}