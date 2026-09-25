    // Contiene un TOKEN de sesión firmado por el servidor (caduca a las 2 h), nunca la contraseña.
// Se purga la clave antigua 'admin_token', que en versiones previas guardaba la contraseña en texto plano.
sessionStorage.removeItem('admin_token');
let adminClave = sessionStorage.getItem('admin_session') || '';
    let productosCargados = [];
    
    let listaArchivosCrear = [];
    let listaFotosEditar = [];

    document.addEventListener('DOMContentLoaded', () => {
      cargarTemaVisualAdmin();
      if (adminClave) mostrarPanel();
    });

    function agregarCampoDescripcion(texto = '') {
      const container = document.getElementById('contenedor-descripciones');
      const div = document.createElement('div');
      div.className = 'desc-item-box';
      div.style.cssText = 'display: flex; gap: 0.5rem; align-items: start;';
      div.innerHTML = `
        <textarea class="input-field desc-input" placeholder="Descripción del perfume..." style="margin-bottom: 0;" required>${texto}</textarea>
        <button type="button" class="btn-action btn-delete" onclick="this.parentElement.remove()" style="padding: 0.8rem;">✕</button>
      `;
      container.appendChild(div);
    }

    function agregarCampoDescripcionEditar(texto = '') {
      const container = document.getElementById('contenedor-descripciones-editar');
      const div = document.createElement('div');
      div.className = 'desc-item-box-edit';
      div.style.cssText = 'display: flex; gap: 0.5rem; align-items: start;';
      div.innerHTML = `
        <textarea class="input-field desc-input-edit" placeholder="Descripción del perfume..." style="margin-bottom: 0;" required>${texto}</textarea>
        <button type="button" class="btn-action btn-delete" onclick="this.parentElement.remove()" style="padding: 0.8rem;">✕</button>
      `;
      container.appendChild(div);
    }

    function obtenerDescripcionesConcatenadas(selector) {
      const inputs = document.querySelectorAll(selector);
      const textos = Array.from(inputs).map(i => i.value.trim()).filter(t => t.length > 0);
      return textos.join(' ||| ');
    }

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

    async function loginAdmin() {
      const claveInput = document.getElementById('clave-admin').value.trim();
      const errBox = document.getElementById('login-error');
      errBox.style.display = 'none';

      if (!claveInput) {
        errBox.textContent = 'Por favor ingresá la contraseña';
        errBox.style.display = 'block';
        return;
      }

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clave: claveInput })
        });

        const data = await res.json();
        if (res.ok && data.ok) {
          adminClave = data.token;
          sessionStorage.setItem('admin_session', adminClave);
          document.getElementById('clave-admin').value = '';
          mostrarPanel();
        } else {
          errBox.textContent = data.error || 'Contraseña incorrecta';
          errBox.style.display = 'block';
        }
      } catch (err) {
        errBox.textContent = 'Error de conexión con el servidor.';
        errBox.style.display = 'block';
      }
    }

    function mostrarPanel() {
      document.getElementById('seccion-login').style.display = 'none';
      document.getElementById('seccion-panel').style.display = 'block';
      document.getElementById('btn-cerrar-sesion').style.display = 'inline-block';
      cargarTablaProductos();
    }

    function sesionExpirada(res) {
      if (res.status !== 401) return false;
      alert('Tu sesión expiró. Volvé a ingresar.');
      cerrarSesion();
      return true;
    }

    function cerrarSesion() {
      sessionStorage.removeItem('admin_session');
      adminClave = '';
      window.location.reload();
    }

    function manejarSeleccionArchivos(event, modo) {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      if (modo === 'crear') {
        listaArchivosCrear = Array.from(files);
        if (listaArchivosCrear.length > 5) {
          alert('Podés subir un máximo de 5 fotos.');
          listaArchivosCrear = listaArchivosCrear.slice(0, 5);
        }
        renderizarPreviewsCrear();
      } else if (modo === 'editar') {
        const nuevosFiles = Array.from(files);
        if (listaFotosEditar.length + nuevosFiles.length > 5) {
          alert('El límite máximo es de 5 fotos en total.');
          return;
        }
        nuevosFiles.forEach(file => {
          const reader = new FileReader();
          reader.onload = (e) => {
            listaFotosEditar.push({ tipo: 'nuevo', file: file, url: e.target.result });
            renderizarPreviewsEditar();
          };
          reader.readAsDataURL(file);
        });
        event.target.value = '';
      }
    }

    function renderizarPreviewsCrear() {
      const container = document.getElementById('preview-container-crear');
      const section = document.getElementById('preview-section-crear');
      container.innerHTML = '';

      if (listaArchivosCrear.length === 0) {
        section.style.display = 'none';
        return;
      }

      section.style.display = 'block';
      listaArchivosCrear.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const card = document.createElement('div');
          card.className = 'preview-card';
          card.innerHTML = `
            ${index === 0 ? '<span class="badge-cover-order">Portada</span>' : ''}
            <img src="${escapeHtml(urlImagenSegura(e.target.result))}" alt="Preview">
            <div class="preview-card-controls">
              <button type="button" class="preview-ctrl-btn" onclick="moverFotoCrear(${index}, -1)" ${index === 0 ? 'disabled' : ''}>◀</button>
              <button type="button" class="preview-ctrl-btn" onclick="moverFotoCrear(${index}, 1)" ${index === listaArchivosCrear.length - 1 ? 'disabled' : ''}>▶</button>
            </div>
          `;
          container.appendChild(card);
        };
        reader.readAsDataURL(file);
      });
    }

    window.moverFotoCrear = function(index, dir) {
      const nuevoIndex = index + dir;
      if (nuevoIndex < 0 || nuevoIndex >= listaArchivosCrear.length) return;
      const temp = listaArchivosCrear[index];
      listaArchivosCrear[index] = listaArchivosCrear[nuevoIndex];
      listaArchivosCrear[nuevoIndex] = temp;
      renderizarPreviewsCrear();
    };

    function renderizarPreviewsEditar() {
      const container = document.getElementById('preview-section-editar');
      container.innerHTML = '';

      listaFotosEditar.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'preview-card';
        card.innerHTML = `
          ${index === 0 ? '<span class="badge-cover-order">Portada</span>' : ''}
          <img src="${escapeHtml(urlImagenSegura(item.url))}" alt="Preview">
          <div class="preview-card-controls">
            <button type="button" class="preview-ctrl-btn" onclick="moverFotoEditar(${index}, -1)" ${index === 0 ? 'disabled' : ''}>◀</button>
            <button type="button" class="preview-ctrl-btn" onclick="quitarFotoEditar(${index})" title="Eliminar">✕</button>
            <button type="button" class="preview-ctrl-btn" onclick="moverFotoEditar(${index}, 1)" ${index === listaFotosEditar.length - 1 ? 'disabled' : ''}>▶</button>
          </div>
        `;
        container.appendChild(card);
      });
    }

    window.moverFotoEditar = function(index, dir) {
      const nuevoIndex = index + dir;
      if (nuevoIndex < 0 || nuevoIndex >= listaFotosEditar.length) return;
      const temp = listaFotosEditar[index];
      listaFotosEditar[index] = listaFotosEditar[nuevoIndex];
      listaFotosEditar[nuevoIndex] = temp;
      renderizarPreviewsEditar();
    };

    window.quitarFotoEditar = function(index) {
      if (listaFotosEditar.length <= 1) {
        alert('El perfume debe tener al menos una fotografía.');
        return;
      }
      listaFotosEditar.splice(index, 1);
      renderizarPreviewsEditar();
    };

    function extraerFotos(imagen_url) {
      try {
        const parsed = JSON.parse(imagen_url);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { portada: parsed[0], total: parsed.length, todas: parsed };
        }
      } catch (e) {}
      return { portada: imagen_url || '', total: 1, todas: [imagen_url || ''] };
    }

    async function cargarTablaProductos() {
      const tbody = document.getElementById('tabla-productos');
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Cargando catálogo...</td></tr>';

      try {
        const res = await fetch('/api/productos');
        productosCargados = await res.json();

        if (productosCargados.length === 0) {
          tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No hay perfumes cargados todavía.</td></tr>';
          return;
        }

        tbody.innerHTML = '';
        productosCargados.forEach(prod => {
          const { portada, total } = extraerFotos(prod.imagen_url);
          const stockCantidad = Number(prod.estado_stock) || 0;
          let stockText = `Stock: ${stockCantidad}`;
          let stockClass = 'stock-en';

          if (stockCantidad === 0) {
            stockText = 'Sin Stock';
            stockClass = 'stock-sin';
          } else if (stockCantidad <= 3) {
            stockText = `Pocas Unidades (${stockCantidad})`;
            stockClass = 'stock-pocas';
          }

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>
              <div class="td-img-wrapper">
                <img src="${escapeHtml(urlImagenSegura(portada))}" class="td-img" alt="${escapeHtml(prod.nombre)}" onerror="this.onerror=null;this.src=PLACEHOLDER_IMG">
                ${total > 1 ? `<span class="td-img-count">+${total}</span>` : ''}
              </div>
            </td>
            <td>
              <div class="td-title">
                ${escapeHtml(prod.nombre)}
                <span class="td-tipo-tag">${escapeHtml(prod.tipo || 'Diseñador')}</span>
                ${prod.destacado_hero ? '<span class="td-hero-tag">En Hero 🚀</span>' : ''}
              </div>
              <div class="td-family">${escapeHtml(prod.familia)}</div>
              <div class="td-badges">${escapeHtml(prod.genero || 'Unisex')} • ${escapeHtml(prod.estacion || 'General')}</div>
              <div><span class="td-stock-tag ${stockClass}">${stockText}</span></div>
            </td>
            <td>
              <span class="td-price">$${Number(prod.precio).toLocaleString('es-AR')}</span>
            </td>
            <td>
              <div class="table-actions">
                <button class="btn-action btn-edit" onclick="abrirModalEditar(${enteroSeguro(prod.id)})">Editar</button>
                <button class="btn-action btn-delete" onclick="eliminarProducto(${enteroSeguro(prod.id)})">Borrar</button>
              </div>
            </td>
          `;
          tbody.appendChild(tr);
        });
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--c-red);">Error al cargar productos.</td></tr>';
      }
    }

    async function crearPerfume(e) {
      e.preventDefault();
      if (listaArchivosCrear.length === 0) {
        alert('Tenés que seleccionar al menos una foto.');
        return;
      }

      const epocasSeleccionadas = Array.from(document.querySelectorAll('input[name="epocas-crear"]:checked')).map(cb => cb.value);
      const momentoSeleccionado = document.getElementById('prod-momento').value;
      const estacionCombinada = [...epocasSeleccionadas, momentoSeleccionado].join(' | ');
      const descripcionesConcatenadas = obtenerDescripcionesConcatenadas('.desc-input');

      const btn = document.getElementById('btn-submit-perfume');
      btn.disabled = true;
      btn.textContent = 'Subiendo...';

      const formData = new FormData();
      formData.append('nombre', document.getElementById('prod-nombre').value.trim());
      formData.append('tipo', document.getElementById('prod-tipo').value);
      formData.append('estado_stock', document.getElementById('prod-stock').value);
      formData.append('familia', document.getElementById('prod-familia').value);
      formData.append('genero', document.getElementById('prod-genero').value);
      formData.append('estacion', estacionCombinada || 'Versátil');
      formData.append('precio', document.getElementById('prod-precio').value);
      formData.append('descripcion', descripcionesConcatenadas);
      formData.append('notas_salida', document.getElementById('prod-salida').value.trim());
      formData.append('notas_corazon', document.getElementById('prod-corazon').value.trim());
      formData.append('notas_fondo', document.getElementById('prod-fondo').value.trim());
      formData.append('destacado_hero', document.getElementById('prod-hero').checked ? '1' : '0');

      listaArchivosCrear.forEach(file => {
        formData.append('imagenes', file);
      });

      try {
        const res = await fetch('/api/productos', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + adminClave },
          body: formData
        });
        if (sesionExpirada(res)) return;

        const data = await res.json();
        if (res.ok) {
          alert('¡Perfume agregado con éxito!');
          document.getElementById('form-nuevo-perfume').reset();
          document.getElementById('contenedor-descripciones').innerHTML = '<div class="desc-item-box" style="display: flex; gap: 0.5rem; align-items: start;"><textarea class="input-field desc-input" placeholder="Descripción del Perfume 1..." style="margin-bottom: 0;" required></textarea></div>';
          document.getElementById('preview-section-crear').style.display = 'none';
          listaArchivosCrear = [];
          cargarTablaProductos();
        } else {
          alert('Error: ' + (data.error || 'No se pudo agregar'));
        }
      } catch (err) {
        alert('Error de conexión al cargar producto.');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Cargar al Catálogo';
      }
    }

    window.abrirModalEditar = function(id) {
      const prod = productosCargados.find(p => p.id === id);
      if (!prod) return;

      document.getElementById('edit-id').value = prod.id;
      document.getElementById('edit-nombre').value = prod.nombre || '';
      document.getElementById('edit-tipo').value = prod.tipo || 'Diseñador';
      document.getElementById('edit-stock').value = prod.estado_stock !== undefined ? prod.estado_stock : 10;
      document.getElementById('edit-familia').value = prod.familia || 'Cítrico / Acuático';
      document.getElementById('edit-genero').value = prod.genero || 'Unisex';
      document.getElementById('edit-precio').value = prod.precio || '';
      document.getElementById('edit-hero').checked = prod.destacado_hero === 1 || prod.destacado_hero === '1';
      document.getElementById('edit-salida').value = prod.notas_salida || '';
      document.getElementById('edit-corazon').value = prod.notas_corazon || '';
      document.getElementById('edit-fondo').value = prod.notas_fondo || '';

      // Cargar descripciones dinámicas en edición
      const contenedorEdit = document.getElementById('contenedor-descripciones-editar');
      contenedorEdit.innerHTML = '';
      const descripcionesGuardadas = (prod.descripcion || '').split(' ||| ');
      descripcionesGuardadas.forEach(textoDesc => {
        agregarCampoDescripcionEditar(textoDesc);
      });

      // Marcar checkboxes y momento guardados
      const estacionTexto = prod.estacion || '';
      document.querySelectorAll('input[name="epocas-editar"]').forEach(cb => {
        cb.checked = estacionTexto.includes(cb.value);
      });
      if (estacionTexto.includes('Noche')) document.getElementById('edit-momento').value = 'Noche';
      else if (estacionTexto.includes('Día')) document.getElementById('edit-momento').value = 'Día';
      else if (estacionTexto.includes('Cita')) document.getElementById('edit-momento').value = 'Cita / Evento';
      else document.getElementById('edit-momento').value = 'Versátil';

      const { todas } = extraerFotos(prod.imagen_url);
      listaFotosEditar = todas.map(url => ({ tipo: 'existente', url: url }));

      renderizarPreviewsEditar();
      document.getElementById('edit-imagen').value = '';
      document.getElementById('modal-editar').classList.add('active');
    };

    window.cerrarModalEditar = function() {
      document.getElementById('modal-editar').classList.remove('active');
    };

    async function guardarEdicionPerfume(e) {
      e.preventDefault();
      const id = document.getElementById('edit-id').value;
      
      const epocasSeleccionadas = Array.from(document.querySelectorAll('input[name="epocas-editar"]:checked')).map(cb => cb.value);
      const momentoSeleccionado = document.getElementById('edit-momento').value;
      const estacionCombinada = [...epocasSeleccionadas, momentoSeleccionado].join(' | ');
      const descripcionesConcatenadas = obtenerDescripcionesConcatenadas('.desc-input-edit');

      const btn = document.getElementById('btn-save-edit');
      btn.disabled = true;
      btn.textContent = 'Guardando cambios...';

      const formData = new FormData();
      formData.append('nombre', document.getElementById('edit-nombre').value.trim());
      formData.append('tipo', document.getElementById('edit-tipo').value);
      formData.append('estado_stock', document.getElementById('edit-stock').value);
      formData.append('familia', document.getElementById('edit-familia').value);
      formData.append('genero', document.getElementById('edit-genero').value);
      formData.append('estacion', estacionCombinada || 'Versátil');
      formData.append('precio', document.getElementById('edit-precio').value);
      formData.append('descripcion', descripcionesConcatenadas);
      formData.append('notas_salida', document.getElementById('edit-salida').value.trim());
      formData.append('notas_corazon', document.getElementById('edit-corazon').value.trim());
      formData.append('notas_fondo', document.getElementById('edit-fondo').value.trim());
      formData.append('destacado_hero', document.getElementById('edit-hero').checked ? '1' : '0');

      const urlsExistentes = [];
      listaFotosEditar.forEach(item => {
        if (item.tipo === 'existente') {
          urlsExistentes.push(item.url);
        } else if (item.tipo === 'nuevo') {
          formData.append('imagenes', item.file);
        }
      });

      formData.append('fotos_existentes', JSON.stringify(urlsExistentes));

      try {
        const res = await fetch(`/api/productos/${id}`, {
          method: 'PUT',
          headers: { 'Authorization': 'Bearer ' + adminClave },
          body: formData
        });
        if (sesionExpirada(res)) return;

        const data = await res.json();
        if (res.ok) {
          alert('¡Perfume actualizado con éxito!');
          cerrarModalEditar();
          cargarTablaProductos();
        } else {
          alert('Error: ' + (data.error || 'No se pudo actualizar'));
        }
      } catch (err) {
        alert('Error de red al actualizar perfume.');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar Cambios';
      }
    }

    async function eliminarProducto(id) {
      if (!confirm('¿Estás seguro de que querés eliminar este perfume?')) return;

      try {
        const res = await fetch(`/api/productos/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + adminClave }
        });
        if (sesionExpirada(res)) return;

        const data = await res.json();
        if (res.ok) {
          cargarTablaProductos();
        } else {
          alert('Error: ' + (data.error || 'No se pudo eliminar'));
        }
      } catch (err) {
        alert('Error de red al eliminar.');
      }
    }
