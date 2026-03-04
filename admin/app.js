(function () {
  'use strict';

  const API = '/backend';
  const views = { productos: 'Productos', ofertas: 'Ofertas', tvs: 'Televisores', usuarios: 'Usuarios' };

  let currentView = 'productos';
  let user = null;
  let productosData = null;
  let ofertasData = null;
  let productosCategoriaFilter = 'ALL';
  const gridState = {
    productos: { page: 1, pageSize: 10, search: '' },
    ofertas: { page: 1, pageSize: 10, search: '' },
    tvs: { page: 1, pageSize: 10, search: '' },
    usuarios: { page: 1, pageSize: 10, search: '' }
  };

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => el.querySelectorAll(sel);

  /** Parsea fecha "dd-mm-yyyy" o "dd-mm-yyyy HH:ii" y devuelve texto relativo: "hace 2 h", "hace 3 días", etc. */
  function formatRelativeDate(str) {
    if (!str || typeof str !== 'string') return '—';
    const s = str.trim();
    const parts = s.split(/\s+/);
    const datePart = parts[0];
    const timePart = parts[1] || '';
    const [d, m, y] = (datePart || '').split(/[-\/]/).map(Number);
    if (!d || !m || !y) return s;
    const monthNames = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    let date = new Date(y, m - 1, d);
    if (timePart && /^\d{1,2}:\d{2}$/.test(timePart)) {
      const [h, i] = timePart.split(':').map(Number);
      date.setHours(h, i, 0, 0);
    }
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return 'hace un momento';
    if (diffMin < 60) return `hace ${diffMin} min`;
    if (diffH < 24) return `hace ${diffH} h`;
    if (diffDays === 1) return 'ayer';
    if (diffDays < 7) return `hace ${diffDays} días`;
    if (diffDays < 30) return `hace ${Math.floor(diffDays / 7)} sem`;
    return `${d} ${monthNames[m - 1]}`;
  }

  function filterAndPaginate(rows, searchText, textFields, page, pageSize) {
    const q = (searchText || '').trim().toLowerCase();
    const filtered = q
      ? rows.filter(r => textFields.some(f => String(r[f] || '').toLowerCase().includes(q)))
      : rows;
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const p = Math.min(Math.max(1, page), totalPages);
    const start = (p - 1) * pageSize;
    return { rows: filtered.slice(start, start + pageSize), total, page: p, totalPages, pageSize };
  }

  function renderPagination(container, stateKey, total, page, totalPages, pageSize, onRefresh) {
    const st = gridState[stateKey];
    const html = `
      <div class="pagination">
        <div class="pagination-info">
          <span class="pill">${total} resultado${total !== 1 ? 's' : ''}</span>
          <label class="pagination-size">
            Mostrar
            <select class="select select-sm" data-page-size>
              <option value="10" ${pageSize === 10 ? 'selected' : ''}>10</option>
              <option value="25" ${pageSize === 25 ? 'selected' : ''}>25</option>
              <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
              <option value="100" ${pageSize === 100 ? 'selected' : ''}>100</option>
            </select>
          </label>
        </div>
        <div class="pagination-nav">
          <button type="button" class="btn btn-ghost btn-sm" data-page-prev ${page <= 1 ? 'disabled' : ''}>← Anterior</button>
          <span class="pagination-pages">Página <strong>${page}</strong> de <strong>${totalPages}</strong></span>
          <button type="button" class="btn btn-ghost btn-sm" data-page-next ${page >= totalPages ? 'disabled' : ''}>Siguiente →</button>
        </div>
      </div>`;
    container.insertAdjacentHTML('beforeend', html);
    const wrap = container.querySelector('.pagination');
    wrap.querySelector('[data-page-prev]').onclick = () => { st.page = Math.max(1, st.page - 1); onRefresh(); };
    wrap.querySelector('[data-page-next]').onclick = () => { st.page = Math.min(totalPages, st.page + 1); onRefresh(); };
    wrap.querySelector('[data-page-size]').onchange = function () {
      st.pageSize = Number(this.value);
      st.page = 1;
      onRefresh();
    };
  }

  function api(path, options = {}) {
    const url = path.startsWith('http') ? path : API + path;
    return fetch(url, { credentials: 'include', ...options })
      .then(r => r.json().then(data => ({ ok: r.ok, status: r.status, data })))
      .then(({ ok, status, data }) => {
        if (!ok && data && data.error) throw new Error(data.error);
        if (!ok) throw new Error('Error ' + status);
        return data;
      });
  }

  function apiPost(path, body, isFormData = false) {
    const options = { method: 'POST' };
    if (isFormData) options.body = body;
    else {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(body);
    }
    return api(path, options);
  }

  function checkSession() {
    return api('/session.php').then(data => {
      if (data.ok && data.usuario) {
        user = { usuario: data.usuario, perfil: data.perfil };
        return true;
      }
      return false;
    }).catch(() => false);
  }

  function showScreen(screen) {
    $('#login-screen').classList.toggle('hidden', screen !== 'login');
    $('#dashboard').classList.toggle('hidden', screen !== 'dashboard');
  }

  function setView(view) {
    currentView = view;
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
    $('#view-title').textContent = views[view];
    const canCreate = ['productos', 'ofertas', 'tvs'].includes(view) || (view === 'usuarios' && user && user.perfil === 'Admin');
    $('#btn-nuevo').hidden = !canCreate;
    $('#btn-nuevo').onclick = () => openModal(view, 'create', {});
    loadView(view);
  }

  function loadView(view) {
    const content = $('#view-content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div>Cargando…</div>';
    if (view === 'productos') loadProductos(content);
    else if (view === 'ofertas') loadOfertas(content);
    else if (view === 'tvs') loadTVs(content);
    else if (view === 'usuarios') loadUsuarios(content);
  }

  function loadProductos(content) {
    api('/productos.php?action=list').then(({ data }) => {
      productosData = data;
      if (!data.categorias || data.categorias.length === 0) {
        content.innerHTML = '<div class="empty-state"><p>No hay productos. Cargá categorías desde el backend o agregá uno.</p></div>';
        return;
      }
      const categorias = data.categorias || [];
      const categoriaNames = categorias.map(c => c.nombre).filter(Boolean);
      const selected = (productosCategoriaFilter === 'ALL' || categoriaNames.includes(productosCategoriaFilter))
        ? productosCategoriaFilter
        : 'ALL';
      productosCategoriaFilter = selected;

      const flatRows = [];
      categorias
        .filter(cat => selected === 'ALL' ? true : cat.nombre === selected)
        .forEach(cat => {
          (cat.items || []).forEach(it => flatRows.push({ ...it, _categoria: cat.nombre }));
        });

      const st = gridState.productos;
      const { rows, total, page, totalPages, pageSize } = filterAndPaginate(
        flatRows,
        st.search,
        ['nombre', 'unidad', 'tag', '_categoria'],
        st.page,
        st.pageSize
      );
      st.page = page;

      const header = `
        <div class="toolbar">
          <div class="toolbar-bar">
            <div class="search-wrap">
              <span class="search-icon" aria-hidden="true">🔍</span>
              <input type="text" id="productos-search" class="search-input" placeholder="Buscar por nombre, unidad, tag..." value="${escapeAttr(st.search)}">
            </div>
            <div class="filter-wrap">
              <label for="productos-filter">Categoría</label>
              <select id="productos-filter" class="select">
                <option value="ALL">Todas</option>
                ${categoriaNames.map(n => `<option value="${escapeAttr(n)}" ${n === selected ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="toolbar-meta">
            <span class="tag-updated" title="${escapeAttr(String(data.updated || ''))}">${escapeHtml(formatRelativeDate(data.updated || ''))}</span>
          </div>
        </div>
      `;

      let html = header + `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Nombre</th>
                <th>Unidad</th>
                <th>Precio</th>
                <th>Modificado</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>`;
      rows.forEach(it => {
        const modRaw = it.updated_at || data.updated || '';
        const modLabel = formatRelativeDate(modRaw);
        html += `<tr>
          <td><span class="pill">${escapeHtml(it._categoria || '')}</span></td>
          <td>${escapeHtml(it.nombre)}</td>
          <td>${escapeHtml(it.unidad)}</td>
          <td><code>${escapeHtml(String(it.precio))}</code></td>
          <td><span class="tag-time" title="${escapeAttr(String(modRaw))}">${escapeHtml(modLabel)}</span></td>
          <td>${it.estado ? '<span class="badge success">Activo</span>' : '<span class="badge danger">Inactivo</span>'}</td>
          <td class="table-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-edit-product="${escapeAttr(it.id)}" data-cat="${escapeAttr(it._categoria)}">Editar</button>
            <button type="button" class="btn btn-danger btn-sm" data-delete-product="${escapeAttr(it.id)}">Eliminar</button>
          </td>
        </tr>`;
      });
      html += '</tbody></table></div>';
      content.innerHTML = html;
      renderPagination(content, 'productos', total, page, totalPages, pageSize, () => loadProductos(content));

      $('#productos-filter', content).onchange = function () {
        productosCategoriaFilter = this.value;
        gridState.productos.page = 1;
        loadProductos(content);
      };
      const searchEl = $('#productos-search', content);
      if (searchEl) {
        let searchTimeout;
        searchEl.oninput = function () {
          clearTimeout(searchTimeout);
          searchTimeout = setTimeout(() => {
            st.search = this.value;
            st.page = 1;
            loadProductos(content);
          }, 280);
        };
      }
      content.querySelectorAll('[data-edit-product]').forEach(btn => {
        btn.onclick = () => openModalProductoEdit(btn.dataset.editProduct, btn.dataset.cat);
      });
      content.querySelectorAll('[data-delete-product]').forEach(btn => {
        btn.onclick = () => deleteProducto(btn.dataset.deleteProduct);
      });
    }).catch(err => {
      content.innerHTML = '<div class="empty-state"><p class="error-msg">' + escapeHtml(err.message) + '</p></div>';
    });
  }

  function loadOfertas(content) {
    api('/ofertas.php?action=list').then(({ data }) => {
      ofertasData = data;
      if (!data.categorias || data.categorias.length === 0) {
        content.innerHTML = '<div class="empty-state"><p>No hay ofertas.</p></div>';
        return;
      }
      const flatRows = [];
      data.categorias.forEach(cat => {
        (cat.items || []).forEach(it => flatRows.push({ ...it, _categoria: cat.nombre }));
      });
      const st = gridState.ofertas;
      const { rows, total, page, totalPages, pageSize } = filterAndPaginate(
        flatRows, st.search, ['nombre', 'unidad', '_categoria'], st.page, st.pageSize
      );
      st.page = page;

      const header = `
        <div class="toolbar">
          <div class="toolbar-bar">
            <div class="search-wrap">
              <span class="search-icon" aria-hidden="true">🔍</span>
              <input type="text" id="ofertas-search" class="search-input" placeholder="Buscar por nombre, unidad, categoría..." value="${escapeAttr(st.search)}">
            </div>
          </div>
        </div>
      `;
      let html = header + `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Categoría</th><th>Nombre</th><th>Unidad</th><th>Precio</th><th>Imagen/Vídeo</th><th></th></tr></thead>
            <tbody>`;
      rows.forEach(it => {
        const media = (it.imagen1 || it.imagen2 || '-');
        html += `<tr>
          <td><span class="pill">${escapeHtml(it._categoria || '')}</span></td>
          <td>${escapeHtml(it.nombre)}</td>
          <td>${escapeHtml(it.unidad)}</td>
          <td><code>${escapeHtml(String(it.precio))}</code></td>
          <td><span class="text-muted">${escapeHtml(String(media).slice(0, 30))}</span></td>
          <td class="table-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-edit-oferta="${escapeAttr(it.id)}" data-cat="${escapeAttr(it._categoria)}">Editar</button>
            <button type="button" class="btn btn-danger btn-sm" data-delete-oferta="${escapeAttr(it.id)}">Eliminar</button>
          </td>
        </tr>`;
      });
      html += '</tbody></table></div>';
      content.innerHTML = html;
      renderPagination(content, 'ofertas', total, page, totalPages, pageSize, () => loadOfertas(content));
      const searchEl = $('#ofertas-search', content);
      if (searchEl) {
        let searchTimeout;
        searchEl.oninput = function () {
          clearTimeout(searchTimeout);
          searchTimeout = setTimeout(() => { st.search = this.value; st.page = 1; loadOfertas(content); }, 280);
        };
      }
      content.querySelectorAll('[data-edit-oferta]').forEach(btn => {
        btn.onclick = () => openModalOfertaEdit(btn.dataset.editOferta, btn.dataset.cat);
      });
      content.querySelectorAll('[data-delete-oferta]').forEach(btn => {
        btn.onclick = () => deleteOferta(btn.dataset.deleteOferta);
      });
    }).catch(err => {
      content.innerHTML = '<div class="empty-state"><p class="error-msg">' + escapeHtml(err.message) + '</p></div>';
    });
  }

  function loadTVs(content) {
    api('/tvs.php?action=list').then(({ data }) => {
      const list = data.tvs || [];
      if (list.length === 0) {
        content.innerHTML = '<div class="empty-state"><p>No hay televisores configurados.</p></div>';
        return;
      }
      const st = gridState.tvs;
      const { rows, total, page, totalPages, pageSize } = filterAndPaginate(
        list, st.search, ['id', 'title', 'description'], st.page, st.pageSize
      );
      st.page = page;
      const header = `
        <div class="toolbar">
          <div class="toolbar-bar">
            <div class="search-wrap">
              <span class="search-icon" aria-hidden="true">🔍</span>
              <input type="text" id="tvs-search" class="search-input" placeholder="Buscar por ID, título, descripción..." value="${escapeAttr(st.search)}">
            </div>
          </div>
        </div>
      `;
      let html = header + '<div class="table-wrap"><table><thead><tr><th>ID</th><th>Título</th><th>Descripción</th><th>Activo</th><th></th></tr></thead><tbody>';
      rows.forEach(t => {
        html += `<tr>
          <td><code>${escapeHtml(t.id)}</code></td>
          <td>${escapeHtml(t.title)}</td>
          <td><span class="text-muted">${escapeHtml((t.description || '').slice(0, 40))}</span></td>
          <td>${t.active ? '<span class="badge success">Sí</span>' : '<span class="badge danger">No</span>'}</td>
          <td class="table-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-edit-tv="${escapeAttr(t.id)}">Editar</button>
            <button type="button" class="btn btn-danger btn-sm" data-delete-tv="${escapeAttr(t.id)}">Eliminar</button>
          </td>
        </tr>`;
      });
      html += '</tbody></table></div>';
      content.innerHTML = html;
      renderPagination(content, 'tvs', total, page, totalPages, pageSize, () => loadTVs(content));
      const searchEl = $('#tvs-search', content);
      if (searchEl) {
        let searchTimeout;
        searchEl.oninput = function () {
          clearTimeout(searchTimeout);
          searchTimeout = setTimeout(() => { st.search = this.value; st.page = 1; loadTVs(content); }, 280);
        };
      }
      content.querySelectorAll('[data-edit-tv]').forEach(btn => {
        btn.onclick = () => openModalTVEdit(btn.dataset.editTv);
      });
      content.querySelectorAll('[data-delete-tv]').forEach(btn => {
        btn.onclick = () => deleteTV(btn.dataset.deleteTv);
      });
    }).catch(err => {
      content.innerHTML = '<div class="empty-state"><p class="error-msg">' + escapeHtml(err.message) + '</p></div>';
    });
  }

  function loadUsuarios(content) {
    api('/usuarios.php?action=list').then(({ data }) => {
      const raw = Array.isArray(data) ? data : (data && data.data ? data.data : []);
      const list = raw.map(u => ({ ...u, _username: u.username || u.usuario || '' }));
      if (list.length === 0) {
        content.innerHTML = '<div class="empty-state"><p>No hay usuarios (solo Admin puede gestionarlos).</p></div>';
        return;
      }
      const st = gridState.usuarios;
      const { rows, total, page, totalPages, pageSize } = filterAndPaginate(
        list, st.search, ['_username', 'name', 'role'], st.page, st.pageSize
      );
      st.page = page;
      const header = `
        <div class="toolbar">
          <div class="toolbar-bar">
            <div class="search-wrap">
              <span class="search-icon" aria-hidden="true">🔍</span>
              <input type="text" id="usuarios-search" class="search-input" placeholder="Buscar por usuario, nombre, rol..." value="${escapeAttr(st.search)}">
            </div>
          </div>
        </div>
      `;
      let html = header + '<div class="table-wrap"><table><thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Activo</th><th></th></tr></thead><tbody>';
      rows.forEach(u => {
        html += `<tr>
          <td><code>${escapeHtml(u._username)}</code></td>
          <td>${escapeHtml(u.name || '-')}</td>
          <td><span class="badge">${escapeHtml(u.role || '')}</span></td>
          <td>${u.active ? '<span class="badge success">Sí</span>' : '<span class="badge danger">No</span>'}</td>
          <td class="table-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-edit-user="${escapeAttr(u.id)}">Editar</button>
            <button type="button" class="btn btn-danger btn-sm" data-delete-user="${escapeAttr(u.id)}">Eliminar</button>
          </td>
        </tr>`;
      });
      html += '</tbody></table></div>';
      content.innerHTML = html;
      renderPagination(content, 'usuarios', total, page, totalPages, pageSize, () => loadUsuarios(content));
      const searchEl = $('#usuarios-search', content);
      if (searchEl) {
        let searchTimeout;
        searchEl.oninput = function () {
          clearTimeout(searchTimeout);
          searchTimeout = setTimeout(() => { st.search = this.value; st.page = 1; loadUsuarios(content); }, 280);
        };
      }
      content.querySelectorAll('[data-edit-user]').forEach(btn => {
        btn.onclick = () => openModalUsuarioEdit(btn.dataset.editUser);
      });
      content.querySelectorAll('[data-delete-user]').forEach(btn => {
        btn.onclick = () => deleteUsuario(btn.dataset.deleteUser);
      });
    }).catch(err => {
      content.innerHTML = '<div class="empty-state"><p class="error-msg">' + escapeHtml(err.message) + '</p></div>';
    });
  }

  function closeModal() {
    $('#modal').classList.add('hidden');
    $('#modal').setAttribute('aria-hidden', 'true');
  }

  function getFormData(ids) {
    const o = {};
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) o[id.replace('f-', '')] = el.type === 'number' ? Number(el.value) : el.value;
    });
    return o;
  }

  function saveProducto(mode, id) {
    const d = getFormData(['f-categoria', 'f-nombre', 'f-unidad', 'f-precio', 'f-tag', 'f-estado']);
    d.estado = Number(d.estado);
    const catEl = document.getElementById('f-categoria');
    const catNuevaEl = document.getElementById('f-categoria-nueva');
    d.categoria = (catEl && catEl.value === '__nueva__' && catNuevaEl) ? (catNuevaEl.value || '').trim() : (d.categoria || '');
    if (!d.categoria) { alert('Elegí o ingresá una categoría.'); return; }
    const body = { action: mode === 'create' ? 'create' : 'update', categoria: d.categoria, nombre: d.nombre, unidad: d.unidad, precio: d.precio, tag: d.tag, estado: d.estado };
    if (mode === 'edit') body.id = id;
    apiPost('/productos.php', body).then(() => { closeModal(); setView('productos'); }).catch(err => alert(err.message));
  }

  function saveOferta(mode, id) {
    const d = getFormData(['f-categoria', 'f-nombre', 'f-unidad', 'f-precio']);
    const catEl = document.getElementById('f-categoria');
    const catNuevaEl = document.getElementById('f-categoria-nueva');
    d.categoria = (catEl && catEl.value === '__nueva__' && catNuevaEl) ? (catNuevaEl.value || '').trim() : (d.categoria || '');
    if (!d.categoria) { alert('Elegí o ingresá una categoría.'); return; }
    const form = new FormData();
    form.append('action', mode === 'create' ? 'create' : 'update');
    form.append('categoria', d.categoria);
    form.append('nombre', d.nombre);
    form.append('unidad', d.unidad);
    form.append('precio', d.precio);
    if (mode === 'edit') form.append('id', id);
    const f1 = document.getElementById('f-imagen1');
    const f2 = document.getElementById('f-imagen2');
    if (f1 && f1.files[0]) form.append('imagen1', f1.files[0]);
    if (f2 && f2.files[0]) form.append('imagen2', f2.files[0]);
    api('/ofertas.php', { method: 'POST', body: form, credentials: 'include' }).then(r => r.json()).then(data => {
      if (data.error) throw new Error(data.error);
      closeModal();
      setView('ofertas');
    }).catch(err => alert(err.message));
  }

  function saveTV(mode, id) {
    const d = getFormData(['f-id', 'f-title', 'f-tag', 'f-description', 'f-url', 'f-active']);
    const body = { action: mode === 'create' ? 'create' : 'update', id: d.id, title: d.title, tag: d.tag, description: d.description, url: d.url, active: d.active === 1 || d.active === '1' };
    if (mode === 'edit') body.id = id;
    apiPost('/tvs.php', body).then(() => { closeModal(); setView('tvs'); }).catch(err => alert(err.message));
  }

  function saveUsuario(mode, id) {
    const d = getFormData(['f-username', 'f-name', 'f-password', 'f-role', 'f-active']);
    const body = { action: mode === 'create' ? 'create' : 'update', username: d.username, name: d.name, role: d.role, active: Number(d.active) };
    if (d.password) body.password = d.password;
    if (mode === 'edit') body.id = id;
    apiPost('/usuarios.php', body).then(() => { closeModal(); setView('usuarios'); }).catch(err => alert(err.message));
  }

  function deleteProducto(id) {
    if (!confirm('¿Eliminar este producto?')) return;
    apiPost('/productos.php', { action: 'delete', id }).then(() => setView('productos')).catch(err => alert(err.message));
  }

  function deleteOferta(id) {
    if (!confirm('¿Eliminar esta oferta?')) return;
    apiPost('/ofertas.php', { action: 'delete', id }).then(() => setView('ofertas')).catch(err => alert(err.message));
  }

  function deleteTV(id) {
    if (!confirm('¿Eliminar este televisor?')) return;
    apiPost('/tvs.php', { action: 'delete', id }).then(() => setView('tvs')).catch(err => alert(err.message));
  }

  function deleteUsuario(id) {
    if (!confirm('¿Eliminar este usuario?')) return;
    apiPost('/usuarios.php', { action: 'delete', id }).then(() => setView('usuarios')).catch(err => alert(err.message));
  }

  function escapeHtml(s) {
    if (s == null) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
  function escapeAttr(s) {
    if (s == null) return '';
    return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Modals para editar: cargar datos del item
  function openModal(view, mode, row = {}) {
    const modal = $('#modal');
    const title = $('#modal-title');
    const body = $('#modal-body');
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');

    if (view === 'productos') {
      const catList = (productosData && productosData.categorias) ? productosData.categorias.map(c => c.nombre).filter(Boolean) : [];
      const catSet = new Set(catList);
      const currentCat = (row.categoria || row._categoria || '').trim();
      if (currentCat && !catSet.has(currentCat)) catList.push(currentCat);
      const catOptionsHtml = catList.map(n => `<button type="button" class="custom-categoria-option" data-value="${escapeAttr(n)}">${escapeHtml(n)}</button>`).join('');
      title.textContent = mode === 'create' ? 'Nuevo producto' : 'Editar producto';
      body.innerHTML = `
        <div class="form-grid">
          <div class="field span-2">
            <label>Categoría</label>
            <div class="custom-categoria">
              <input type="hidden" id="f-categoria" value="${escapeAttr(currentCat)}">
              <button type="button" class="custom-categoria-trigger" id="trigger-categoria">${escapeHtml(currentCat || 'Elegir categoría')}</button>
              <div class="custom-categoria-dropdown hidden" id="dropdown-categoria">
                <div class="custom-categoria-list">
                  ${catOptionsHtml}
                  <button type="button" class="custom-categoria-option nueva" data-value="__nueva__">+ Nueva categoría...</button>
                </div>
                <div class="field-nueva-cat hidden" id="wrap-categoria-nueva">
                  <input type="text" id="f-categoria-nueva" placeholder="Nombre de la nueva categoría" autocomplete="off">
                </div>
              </div>
            </div>
            <div class="help">Elegí una del listado o creá una nueva.</div>
          </div>
          <div class="field">
            <label>Estado</label>
            <select id="f-estado" class="select">
              <option value="1">Activo</option>
              <option value="0">Inactivo</option>
            </select>
          </div>
          <div class="field span-2">
            <label>Nombre</label>
            <input type="text" id="f-nombre" value="${escapeAttr(mode === 'create' ? '' : (row.nombre || ''))}" required autocomplete="off">
          </div>
          <div class="field">
            <label>Unidad</label>
            <input type="text" id="f-unidad" value="${escapeAttr(mode === 'create' ? '' : (row.unidad || ''))}" placeholder="kg, unidad..." autocomplete="off">
          </div>
          <div class="field">
            <label>Precio</label>
            <input type="number" id="f-precio" value="${mode === 'create' ? '' : (row.precio ?? '')}" min="0" inputmode="numeric">
          </div>
          <div class="field span-2">
            <label>Tag</label>
            <input type="text" id="f-tag" value="${escapeAttr(mode === 'create' ? '' : (row.tag || ''))}" placeholder="Opcional (ej: NUEVO, DESTACADO)" autocomplete="off">
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" data-modal-cancel>Cancelar</button>
          <button type="button" class="btn btn-primary" data-modal-save>Guardar</button>
        </div>`;
      const selEstado = body.querySelector('#f-estado');
      if (selEstado) selEstado.value = row.estado === 0 ? '0' : '1';
      const triggerCat = body.querySelector('#trigger-categoria');
      const dropdownCat = body.querySelector('#dropdown-categoria');
      const hiddenCat = body.querySelector('#f-categoria');
      const wrapNueva = body.querySelector('#wrap-categoria-nueva');
      const inputNueva = body.querySelector('#f-categoria-nueva');
      if (triggerCat && dropdownCat && hiddenCat) {
        const closeDropdown = () => {
          dropdownCat.classList.add('hidden');
          triggerCat.classList.remove('open');
          document.removeEventListener('click', closeDropdown);
        };
        triggerCat.onclick = function (e) {
          e.stopPropagation();
          const open = dropdownCat.classList.toggle('hidden');
          triggerCat.classList.toggle('open', !open);
          if (!open) document.addEventListener('click', closeDropdown);
          else document.removeEventListener('click', closeDropdown);
        };
        body.querySelectorAll('.custom-categoria-option').forEach(opt => {
          opt.onclick = function (e) {
            e.stopPropagation();
            const val = this.dataset.value;
            hiddenCat.value = val;
            if (val === '__nueva__') {
              wrapNueva.classList.remove('hidden');
              triggerCat.textContent = 'Nueva categoría...';
              inputNueva.focus();
            } else {
              wrapNueva.classList.add('hidden');
              triggerCat.textContent = this.textContent.trim();
            }
            closeDropdown();
          };
        });
      }
      body.querySelector('[data-modal-save]').onclick = () => saveProducto(mode, row.id);
    } else if (view === 'ofertas') {
      const catList = (ofertasData && ofertasData.categorias) ? ofertasData.categorias.map(c => c.nombre).filter(Boolean) : [];
      const catSet = new Set(catList);
      const currentCat = (row.categoria || row._categoria || '').trim();
      if (currentCat && !catSet.has(currentCat)) catList.push(currentCat);
      const catOptionsHtml = catList.map(n => `<button type="button" class="custom-categoria-option" data-value="${escapeAttr(n)}">${escapeHtml(n)}</button>`).join('');
      title.textContent = mode === 'create' ? 'Nueva oferta' : 'Editar oferta';
      body.innerHTML = `
        <div class="form-grid">
          <div class="field span-2">
            <label>Categoría</label>
            <div class="custom-categoria">
              <input type="hidden" id="f-categoria" value="${escapeAttr(currentCat)}">
              <button type="button" class="custom-categoria-trigger" id="trigger-categoria">${escapeHtml(currentCat || 'Elegir categoría')}</button>
              <div class="custom-categoria-dropdown hidden" id="dropdown-categoria">
                <div class="custom-categoria-list">
                  ${catOptionsHtml}
                  <button type="button" class="custom-categoria-option nueva" data-value="__nueva__">+ Nueva categoría...</button>
                </div>
                <div class="field-nueva-cat hidden" id="wrap-categoria-nueva">
                  <input type="text" id="f-categoria-nueva" placeholder="Nombre de la nueva categoría" autocomplete="off">
                </div>
              </div>
            </div>
            <div class="help">Elegí una del listado o creá una nueva.</div>
          </div>
          <div class="field span-2">
            <label>Nombre</label>
            <input type="text" id="f-nombre" value="${escapeAttr(row.nombre || '')}" required autocomplete="off">
          </div>
          <div class="field">
            <label>Unidad</label>
            <input type="text" id="f-unidad" value="${escapeAttr(row.unidad || '')}" placeholder="kg, unidad..." autocomplete="off">
          </div>
          <div class="field">
            <label>Precio</label>
            <input type="number" id="f-precio" value="${row.precio ?? ''}" min="0" inputmode="numeric">
          </div>
          <div class="field span-2">
            <label>Imagen 1 / Video</label>
            <div class="file-upload" id="wrap-imagen1"><input type="file" id="f-imagen1" accept="image/*,video/*"></div>
          </div>
          <div class="field span-2">
            <label>Imagen 2</label>
            <div class="file-upload" id="wrap-imagen2"><input type="file" id="f-imagen2" accept="image/*"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" data-modal-cancel>Cancelar</button>
          <button type="button" class="btn btn-primary" data-modal-save>Guardar</button>
        </div>`;
      const triggerCat = body.querySelector('#trigger-categoria');
      const dropdownCat = body.querySelector('#dropdown-categoria');
      const hiddenCat = body.querySelector('#f-categoria');
      const wrapNueva = body.querySelector('#wrap-categoria-nueva');
      const inputNueva = body.querySelector('#f-categoria-nueva');
      if (triggerCat && dropdownCat && hiddenCat) {
        const closeDropdown = () => {
          dropdownCat.classList.add('hidden');
          triggerCat.classList.remove('open');
          document.removeEventListener('click', closeDropdown);
        };
        triggerCat.onclick = function (e) {
          e.stopPropagation();
          const open = dropdownCat.classList.toggle('hidden');
          triggerCat.classList.toggle('open', !open);
          if (!open) document.addEventListener('click', closeDropdown);
          else document.removeEventListener('click', closeDropdown);
        };
        body.querySelectorAll('.custom-categoria-option').forEach(opt => {
          opt.onclick = function (e) {
            e.stopPropagation();
            const val = this.dataset.value;
            hiddenCat.value = val;
            if (val === '__nueva__') { wrapNueva.classList.remove('hidden'); triggerCat.textContent = 'Nueva categoría...'; inputNueva.focus(); }
            else { wrapNueva.classList.add('hidden'); triggerCat.textContent = this.textContent.trim(); }
            closeDropdown();
          };
        });
      }
      body.querySelector('[data-modal-save]').onclick = () => saveOferta(mode, row.id);
    } else if (view === 'tvs') {
      title.textContent = mode === 'create' ? 'Nuevo televisor' : 'Editar televisor';
      body.innerHTML = `
        <div class="form-grid">
          <div class="field"><label>ID</label><input type="text" id="f-id" value="${escapeAttr(row.id || '')}" placeholder="tv1" ${mode === 'edit' ? 'readonly' : ''}></div>
          <div class="field"><label>Activo</label><select id="f-active" class="select"><option value="1">Sí</option><option value="0">No</option></select></div>
          <div class="field span-2"><label>Título</label><input type="text" id="f-title" value="${escapeAttr(row.title || '')}" required></div>
          <div class="field span-2"><label>Tag</label><input type="text" id="f-tag" value="${escapeAttr(row.tag || 'TV')}" placeholder="TV"></div>
          <div class="field span-2"><label>Descripción</label><textarea id="f-description" placeholder="Descripción opcional">${escapeHtml(row.description || '')}</textarea></div>
          <div class="field span-2"><label>URL</label><input type="text" id="f-url" value="${escapeAttr(row.url || '')}" placeholder="index2.html?j=JSON/productos.json"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" data-modal-cancel>Cancelar</button>
          <button type="button" class="btn btn-primary" data-modal-save>Guardar</button>
        </div>`;
      body.querySelector('#f-active').value = row.active === false ? '0' : '1';
      body.querySelector('[data-modal-save]').onclick = () => saveTV(mode, row.id);
    } else if (view === 'usuarios') {
      title.textContent = mode === 'create' ? 'Nuevo usuario' : 'Editar usuario';
      body.innerHTML = `
        <div class="form-grid">
          <div class="field"><label>Usuario (login)</label><input type="text" id="f-username" value="${escapeAttr(row.username || row._username || '')}" required autocomplete="off"></div>
          <div class="field"><label>Nombre</label><input type="text" id="f-name" value="${escapeAttr(row.name || '')}" placeholder="Nombre completo"></div>
          <div class="field span-2"><label>Contraseña</label><input type="password" id="f-password" placeholder="${mode === 'edit' ? 'Dejar en blanco para no cambiar' : 'Requerida'}"></div>
          <div class="field"><label>Rol</label><select id="f-role" class="select"><option value="admin">admin</option><option value="editor">editor</option></select></div>
          <div class="field"><label>Activo</label><select id="f-active" class="select"><option value="1">Sí</option><option value="0">No</option></select></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" data-modal-cancel>Cancelar</button>
          <button type="button" class="btn btn-primary" data-modal-save>Guardar</button>
        </div>`;
      body.querySelector('#f-role').value = row.role || 'editor';
      body.querySelector('#f-active').value = row.active === 0 ? '0' : '1';
      body.querySelector('[data-modal-save]').onclick = () => saveUsuario(mode, row.id);
    }

    body.querySelector('[data-modal-cancel]').onclick = closeModal;
  }

  // Para editar productos/ofertas necesitamos cargar el item y abrir modal
  const openModalProductoEdit = (id, categoria) => {
    api('/productos.php?action=get&id=' + encodeURIComponent(id)).then(({ data }) => {
      openModal('productos', 'edit', { ...data, categoria });
    }).catch(err => alert(err.message));
  };
  const openModalOfertaEdit = (id, categoria) => {
    api('/ofertas.php?action=get&id=' + encodeURIComponent(id)).then(({ data }) => {
      openModal('ofertas', 'edit', { ...data, categoria });
    }).catch(err => alert(err.message));
  };
  const openModalTVEdit = (id) => {
    api('/tvs.php?action=get&id=' + encodeURIComponent(id)).then(({ data }) => {
      openModal('tvs', 'edit', data);
    }).catch(err => alert(err.message));
  };
  const openModalUsuarioEdit = (id) => {
    api('/usuarios.php?action=get&id=' + id).then(({ data }) => {
      openModal('usuarios', 'edit', data);
    }).catch(err => alert(err.message));
  };

  // Init
  checkSession().then(loggedIn => {
    if (loggedIn) {
      showScreen('dashboard');
      $('#user-badge').textContent = user.usuario;
      setView('productos');
    } else {
      showScreen('login');
    }
  });

  // Login solo por POST con cuerpo (nunca usuario/contraseña en URL ni en query string)
  $('#login-form').onsubmit = function (e) {
    e.preventDefault();
    const errEl = $('#login-error');
    errEl.hidden = true;
    const usuario = $('#login-usuario').value.trim();
    const password = $('#login-password').value;
    if (!usuario || !password) return;
    // Credenciales solo en body JSON; no se usan en URL ni en cabeceras de autenticación
    apiPost('/login.php', { usuario, password })
      .then(() => checkSession())
      .then((ok) => {
        if (ok) {
          showScreen('dashboard');
          $('#user-badge').textContent = user.usuario;
          setView('productos');
        }
      })
      .catch(err => {
        errEl.textContent = err.message || 'Error al iniciar sesión';
        errEl.hidden = false;
      });
  };

  $$('.nav-item[data-view]').forEach(n => {
    n.onclick = function (e) {
      e.preventDefault();
      setView(n.dataset.view);
    };
  });

  $('#logout-btn').onclick = function (e) {
    e.preventDefault();
    api('/logout.php').then(() => { showScreen('login'); }).catch(() => { showScreen('login'); });
  };

  $('#modal-close').onclick = closeModal;
  $('#modal-backdrop').onclick = closeModal;
})();