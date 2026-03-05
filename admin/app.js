(function () {
  'use strict';

  const API = '/backend';
  const views = { productos: 'Productos', ofertas: 'Ofertas', tvs: 'Televisores', usuarios: 'Usuarios', config: 'Configuración' };
  const STORAGE_VIEW_KEY = 'tvpanel_admin_last_view';

  function getInitialView() {
    try {
      const v = window.localStorage ? localStorage.getItem(STORAGE_VIEW_KEY) : null;
      return (v && views[v]) ? v : 'productos';
    } catch (e) {
      return 'productos';
    }
  }

  let currentView = getInitialView();
  let user = null;
  let productosData = null;
  let ofertasData = null;
  let tvsData = null;
  let usuariosData = null;
  let mediaConfig = { mediaImagesPath: 'IMG/CORTES', mediaVideosPath: 'IMG/CORTES/VIDEO' };
  let productosCategoriaFilter = 'ALL';
  const gridState = {
    productos: { page: 1, pageSize: 10, search: '', sortKey: '_categoria', sortDir: 'asc' },
    ofertas: { page: 1, pageSize: 10, search: '', sortKey: '_categoria', sortDir: 'asc' },
    tvs: { page: 1, pageSize: 10, search: '' },
    usuarios: { page: 1, pageSize: 10, search: '', supervisorFilter: 'ALL', viewMode: 'supervisors' }
  };

  function formatPrecio(num) {
    const n = Number(num);
    if (isNaN(n)) return '—';
    return '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => el.querySelectorAll(sel);

  /** Parsea fecha "dd-mm-yyyy" o "dd-mm-yyyy HH:ii" y devuelve { label, isToday }. */
  function formatRelativeDate(str) {
    const out = { label: '—', isToday: false };
    if (!str || typeof str !== 'string') return out;
    const s = str.trim();
    const parts = s.split(/\s+/);
    const datePart = parts[0];
    const timePart = parts[1] || '';
    const [d, m, y] = (datePart || '').split(/[-\/]/).map(Number);
    if (!d || !m || !y) { out.label = s; return out; }
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
    out.isToday = diffDays === 0 && diffMs >= 0;
    if (diffMin < 1) out.label = 'hace un momento';
    else if (diffMin < 60) out.label = `hace ${diffMin} min`;
    else if (diffH < 24) out.label = `hace ${diffH} h`;
    else if (diffDays === 1) out.label = 'ayer';
    else if (diffDays < 7) out.label = `hace ${diffDays} días`;
    else if (diffDays < 30) out.label = `hace ${Math.floor(diffDays / 7)} sem`;
    else out.label = `${d} ${monthNames[m - 1]}`;
    return out;
  }

  /** Parsea "dd-mm-yyyy" o "dd-mm-yyyy HH:ii" y devuelve timestamp (o 0 si inválido). */
  function parseUpdatedAt(str) {
    if (!str || typeof str !== 'string') return 0;
    const s = str.trim();
    const parts = s.split(/\s+/);
    const [d, m, y] = (parts[0] || '').split(/[-\/]/).map(Number);
    if (!d || !m || !y) return 0;
    const date = new Date(y, m - 1, d);
    if (parts[1] && /^\d{1,2}:\d{2}$/.test(parts[1])) {
      const [h, i] = parts[1].split(':').map(Number);
      date.setHours(h, i, 0, 0);
    }
    return date.getTime();
  }

  function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + (type || 'info');
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function showConfirmDelete(options) {
    const {
      title = '¿Eliminar?',
      message = 'Esta acción no se puede deshacer.',
      onConfirm,
      confirmLabel = 'Eliminar',
      cancelLabel = 'Cancelar'
    } = options;
    const modal = $('#confirm-modal');
    const titleEl = $('#confirm-title');
    const messageEl = $('#confirm-message');
    const btnCancel = $('#confirm-cancel');
    const btnOk = $('#confirm-ok');
    const backdrop = $('#confirm-backdrop');
    if (!modal || !titleEl || !messageEl || !btnCancel || !btnOk) return;
    titleEl.textContent = title;
    messageEl.textContent = message;
    btnOk.textContent = confirmLabel;
    btnCancel.textContent = cancelLabel;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    const close = () => {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
      btnOk.onclick = null;
      btnCancel.onclick = null;
      backdrop.onclick = null;
    };
    btnOk.onclick = () => { close(); if (onConfirm) onConfirm(); };
    btnCancel.onclick = close;
    backdrop.onclick = close;
  }

  function bindSearchWithClear(content, searchId, stateKey, onRefresh) {
    const st = gridState[stateKey];
    const input = document.getElementById(searchId);
    const clearBtn = input && input.closest('.search-input-wrap') && input.closest('.search-input-wrap').querySelector('.search-clear');
    if (!input) return;
    const updateClearVisibility = () => {
      if (clearBtn) clearBtn.classList.toggle('hidden', !input.value.trim());
    };
    let searchTimeout;
    input.oninput = function () {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        st.search = this.value;
        st.page = 1;
        onRefresh();
      }, 280);
      updateClearVisibility();
    };
    if (clearBtn) {
      clearBtn.onclick = () => {
        input.value = '';
        st.search = '';
        st.page = 1;
        clearBtn.classList.add('hidden');
        onRefresh();
        input.focus();
      };
    }
    updateClearVisibility();
  }

  function normalizeText(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function filterAndPaginate(rows, searchText, textFields, page, pageSize) {
    const q = normalizeText((searchText || '').trim());
    const filtered = q
      ? rows.filter(r => textFields.some(f => normalizeText(r[f]).includes(q)))
      : rows;
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const p = Math.min(Math.max(1, page), totalPages);
    const start = (p - 1) * pageSize;
    return { rows: filtered.slice(start, start + pageSize), total, page: p, totalPages, pageSize };
  }

  function csvEscape(val) {
    const s = String(val == null ? '' : val);
    if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function buildCSV(rows, columns) {
    const header = columns.map(c => csvEscape(c.label)).join(',');
    const body = rows.map(r => columns.map(c => csvEscape(r[c.key])).join(','));
    return [header, ...body].join('\r\n');
  }

  function downloadCSV(csvContent, filename) {
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function sortProductosLikeGrid(flatRows, st) {
    const sortKey = st.sortKey || '_categoria';
    const sortDir = st.sortDir || 'asc';
    flatRows.sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (sortKey === 'precio') {
        va = Number(va); vb = Number(vb);
        const cmp = sortDir === 'asc' ? va - vb : vb - va;
        if (cmp !== 0) return cmp;
      } else if (sortKey === 'updated_at') {
        va = parseUpdatedAt(va); vb = parseUpdatedAt(vb);
        const cmp = sortDir === 'asc' ? va - vb : vb - va;
        if (cmp !== 0) return cmp;
      } else {
        if (sortKey === 'estado') { va = String(va || ''); vb = String(vb || ''); }
        else { va = String(va || '').toLowerCase(); vb = String(vb || '').toLowerCase(); }
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        if (cmp !== 0) return sortDir === 'asc' ? cmp : -cmp;
      }
      const na = String(a.nombre || '').toLowerCase(), nb = String(b.nombre || '').toLowerCase();
      return na < nb ? -1 : na > nb ? 1 : 0;
    });
  }

  function sortOfertasLikeGrid(flatRows, st) {
    const sortKey = st.sortKey || '_categoria';
    const sortDir = st.sortDir || 'asc';
    flatRows.sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (sortKey === 'precio') {
        va = Number(va); vb = Number(vb);
        const cmp = sortDir === 'asc' ? va - vb : vb - va;
        if (cmp !== 0) return cmp;
      } else if (sortKey === 'updated_at') {
        va = parseUpdatedAt(va); vb = parseUpdatedAt(vb);
        const cmp = sortDir === 'asc' ? va - vb : vb - va;
        if (cmp !== 0) return cmp;
      } else {
        if (sortKey === 'estado') { va = String(va || ''); vb = String(vb || ''); }
        else { va = String(va || '').toLowerCase(); vb = String(vb || '').toLowerCase(); }
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        if (cmp !== 0) return sortDir === 'asc' ? cmp : -cmp;
      }
      const na = String(a.nombre || '').toLowerCase(), nb = String(b.nombre || '').toLowerCase();
      return na < nb ? -1 : na > nb ? 1 : 0;
    });
  }

  function getProductosExportRows() {
    if (!productosData?.categorias) return [];
    const categorias = productosData.categorias || [];
    const selected = productosCategoriaFilter;
    const flatRows = [];
    categorias.filter(cat => selected === 'ALL' ? true : cat.nombre === selected).forEach(cat => {
      (cat.items || []).forEach(it => flatRows.push({ ...it, _categoria: cat.nombre }));
    });
    const st = gridState.productos;
    sortProductosLikeGrid(flatRows, st);
    return filterAndPaginate(flatRows, st.search, ['nombre', 'unidad', 'tag', '_categoria'], 1, 999999).rows;
  }

  function getOfertasExportRows() {
    if (!ofertasData?.categorias) return [];
    const flatRows = [];
    ofertasData.categorias.forEach(cat => {
      (cat.items || []).forEach(it => flatRows.push({ ...it, _categoria: cat.nombre }));
    });
    const st = gridState.ofertas;
    sortOfertasLikeGrid(flatRows, st);
    return filterAndPaginate(flatRows, st.search, ['nombre', 'unidad', '_categoria'], 1, 999999).rows;
  }

  function getTVsExportRows() {
    const list = Array.isArray(tvsData?.tvs) ? tvsData.tvs : [];
    const st = gridState.tvs;
    return filterAndPaginate(list, st.search, ['id', 'title', 'description'], 1, 999999).rows;
  }

  function getUsuariosExportRows() {
    const raw = Array.isArray(usuariosData) ? usuariosData : (usuariosData?.data || []);
    let list = raw.map(u => ({ ...u, _username: u.username || u.usuario || '' }));
    const st = gridState.usuarios;
    if (user && user.perfil === 'Admin' && st.supervisorFilter !== 'ALL') {
      list = list.filter(u => String(u.created_by_id ?? 0) === String(st.supervisorFilter));
    }
    return filterAndPaginate(list, st.search, ['_username', 'name', 'role'], 1, 999999).rows;
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
        user = { id: data.id, usuario: data.usuario, nombre: data.nombre, perfil: data.perfil };
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
    try {
      if (window.localStorage) localStorage.setItem(STORAGE_VIEW_KEY, view);
    } catch (e) {}
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
    $('#view-title').textContent = (views[view] || '').toUpperCase();
    const canCreate = ['productos', 'ofertas', 'tvs'].includes(view) || (view === 'usuarios' && user && (user.perfil === 'Admin' || user.perfil === 'Supervisor'));
    $('#btn-nuevo').hidden = !canCreate;
    const configNav = document.querySelector('.nav-item-config');
    if (configNav) configNav.style.display = (user && user.perfil === 'Admin') ? '' : 'none';
    const tvsNav = document.querySelector('.nav-item-tvs');
    if (tvsNav) tvsNav.style.display = (user && user.perfil === 'Admin') ? '' : 'none';
    const adminGroup = document.getElementById('nav-group-admin');
    if (adminGroup) adminGroup.style.display = (user && (user.perfil === 'Admin' || user.perfil === 'Supervisor')) ? '' : 'none';
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
    else if (view === 'config') loadConfig(content);
  }

  function loadConfig(content) {
    api('/config-media.php')
      .then(data => {
        const imagesPath = data.mediaImagesPath || 'IMG/CORTES';
        const videosPath = data.mediaVideosPath || 'IMG/CORTES/VIDEO';
        content.innerHTML = `
          <div class="config-panel">
            <p class="config-desc">Rutas donde se guardan las imágenes y videos de ofertas (relativas a la raíz del proyecto).</p>
            <form id="config-media-form" class="config-form">
              <div class="field">
                <label for="config-images-path">Carpeta de imágenes</label>
                <input type="text" id="config-images-path" class="input" value="${escapeAttr(imagesPath)}" placeholder="IMG/CORTES">
              </div>
              <div class="field">
                <label for="config-videos-path">Carpeta de videos</label>
                <input type="text" id="config-videos-path" class="input" value="${escapeAttr(videosPath)}" placeholder="IMG/CORTES/VIDEO">
              </div>
              <div class="form-actions">
                <button type="submit" class="btn btn-primary">Guardar</button>
              </div>
            </form>
          </div>`;
        const form = document.getElementById('config-media-form');
        if (form) {
          form.onsubmit = (e) => {
            e.preventDefault();
            const images = (document.getElementById('config-images-path') || {}).value.trim() || 'IMG/CORTES';
            const videos = (document.getElementById('config-videos-path') || {}).value.trim() || 'IMG/CORTES/VIDEO';
            apiPost('/config-media.php', { mediaImagesPath: images, mediaVideosPath: videos })
              .then(() => showToast('Configuración guardada.', 'success'))
              .catch(err => showToast(err.message || 'Error al guardar', 'error'));
          };
        }
      })
      .catch(err => {
        content.innerHTML = '<div class="empty-state"><p>' + (err.message || 'No se pudo cargar la configuración.') + '</p></div>';
      });
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
      const sortKey = st.sortKey || '_categoria';
      const sortDir = st.sortDir || 'asc';
      flatRows.sort((a, b) => {
        let va = a[sortKey];
        let vb = b[sortKey];
        if (sortKey === 'precio') {
          va = Number(va);
          vb = Number(vb);
          const cmp = sortDir === 'asc' ? va - vb : vb - va;
          if (cmp !== 0) return cmp;
        } else if (sortKey === 'updated_at') {
          va = parseUpdatedAt(va);
          vb = parseUpdatedAt(vb);
          const cmp = sortDir === 'asc' ? va - vb : vb - va;
          if (cmp !== 0) return cmp;
        } else {
          if (sortKey === 'estado') {
            va = String(va || '');
            vb = String(vb || '');
          } else {
            va = String(va || '').toLowerCase();
            vb = String(vb || '').toLowerCase();
          }
          const cmp = va < vb ? -1 : va > vb ? 1 : 0;
          if (cmp !== 0) return sortDir === 'asc' ? cmp : -cmp;
        }
        const na = String(a.nombre || '').toLowerCase();
        const nb = String(b.nombre || '').toLowerCase();
        return na < nb ? -1 : na > nb ? 1 : 0;
      });

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
          <div class="toolbar-bar toolbar-productos">
            <div class="search-group">
              <label class="search-label">Buscar</label>
              <div class="search-input-wrap">
                <span class="search-icon" aria-hidden="true">🔍</span>
                <input type="text" id="productos-search" class="search-input" placeholder="nombre, unidad, tag..." value="${escapeAttr(st.search)}">
                <button type="button" class="search-clear hidden" aria-label="Vaciar búsqueda" title="Vaciar">×</button>
              </div>
            </div>
            <div class="filter-categoria-wrap">
              <label class="filter-categoria-label">Categoría</label>
              <div class="filter-categoria">
                <input type="hidden" id="productos-filter-value" value="${escapeAttr(selected)}">
                <button type="button" class="filter-categoria-trigger" id="productos-filter-trigger">${escapeHtml(selected === 'ALL' ? 'Todas' : selected)}</button>
                <div class="filter-categoria-dropdown hidden" id="productos-filter-dropdown">
                  <button type="button" class="filter-categoria-option" data-value="ALL">Todas</button>
                  ${categoriaNames.map(n => `<button type="button" class="filter-categoria-option" data-value="${escapeAttr(n)}">${escapeHtml(n)}</button>`).join('')}
                </div>
              </div>
            </div>
          </div>
          <div class="toolbar-meta">
            <span class="tag-updated" title="${escapeAttr(String(data.updated || ''))}">${escapeHtml(formatRelativeDate(data.updated || '').label)}</span>
            <button type="button" class="btn btn-ghost btn-sm btn-export-excel btn-excel" data-export-view="productos"><span class="btn-excel-icon" aria-hidden="true"></span> Excel</button>
          </div>
        </div>
      `;

      const thSort = (key, label) => {
        const isActive = sortKey === key;
        const dir = isActive ? sortDir : '';
        return `<th class="th-sort ${isActive ? 'th-sort-active' : ''}" data-sort="${escapeAttr(key)}" title="Ordenar por ${escapeAttr(label)}">${escapeHtml(label)} <span class="th-sort-icon">${dir === 'asc' ? '↑' : dir === 'desc' ? '↓' : ''}</span></th>`;
      };
      let html = header + `
        <div class="table-scroll-wrap">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                ${thSort('_categoria', 'Categoría')}
                ${thSort('nombre', 'Nombre')}
                ${thSort('unidad', 'Unidad')}
                ${thSort('precio', 'Precio')}
                ${thSort('updated_at', 'Modificado')}
                ${thSort('estado', 'Estado')}
                <th></th>
              </tr>
            </thead>
            <tbody>`;
      rows.forEach(it => {
        const modRaw = it.updated_at || '';
        const modRel = formatRelativeDate(modRaw);
        const tagTimeClass = 'tag-time' + (modRel.isToday ? ' tag-today' : '');
        html += `<tr>
          <td><span class="pill">${escapeHtml(it._categoria || '')}</span></td>
          <td>${escapeHtml(it.nombre)}</td>
          <td>${escapeHtml(it.unidad)}</td>
          <td><code class="precio">${escapeHtml(formatPrecio(it.precio))}</code></td>
          <td><span class="${tagTimeClass}" title="${escapeAttr(String(modRaw))}">${escapeHtml(modRel.label)}</span></td>
          <td>${it.estado ? '<span class="badge success">Activo</span>' : '<span class="badge danger">Inactivo</span>'}</td>
          <td class="table-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-edit-product="${escapeAttr(it.id)}" data-cat="${escapeAttr(it._categoria)}">Editar</button>
            <button type="button" class="btn btn-secondary btn-sm" data-toggle-product="${escapeAttr(it.id)}" data-estado="${it.estado ? '1' : '0'}">${it.estado ? 'Desactivar' : 'Activar'}</button>
            <button type="button" class="btn btn-danger btn-sm" data-delete-product="${escapeAttr(it.id)}">Eliminar</button>
          </td>
        </tr>`;
      });
      html += '</tbody></table></div></div>';
      content.innerHTML = html;
      renderPagination(content, 'productos', total, page, totalPages, pageSize, () => loadProductos(content));
      content.querySelector('[data-export-view="productos"]')?.addEventListener('click', () => {
        const rows = getProductosExportRows();
        const cols = [{ key: '_categoria', label: 'Categoría' }, { key: 'nombre', label: 'Nombre' }, { key: 'unidad', label: 'Unidad' }, { key: 'precio', label: 'Precio' }, { key: 'updated_at', label: 'Modificado' }, { key: 'estado', label: 'Estado' }];
        downloadCSV(buildCSV(rows.map(r => ({ ...r, estado: r.estado ? 'Activo' : 'Inactivo' })), cols), 'productos.csv');
        showToast('Exportado correctamente.', 'success');
      });
      content.querySelectorAll('.th-sort[data-sort]').forEach(th => {
        th.onclick = function () {
          const key = this.dataset.sort;
          if (st.sortKey === key) st.sortDir = st.sortDir === 'asc' ? 'desc' : 'asc';
          else { st.sortKey = key; st.sortDir = 'asc'; }
          st.page = 1;
          loadProductos(content);
        };
      });

      const filterTrigger = $('#productos-filter-trigger', content);
      const filterDropdown = $('#productos-filter-dropdown', content);
      const filterHidden = $('#productos-filter-value', content);
      if (filterTrigger && filterDropdown && filterHidden) {
        let portalEl = null;
        const closeFilter = () => {
          if (portalEl && portalEl.parentNode) portalEl.parentNode.removeChild(portalEl);
          portalEl = null;
          filterTrigger.classList.remove('open');
          document.removeEventListener('click', closeFilter);
        };
        filterTrigger.onclick = function (e) {
          e.stopPropagation();
          if (portalEl) {
            closeFilter();
            return;
          }
          const rect = filterTrigger.getBoundingClientRect();
          portalEl = document.createElement('div');
          portalEl.className = 'filter-categoria-dropdown-portal';
          portalEl.style.top = (rect.bottom + 4) + 'px';
          portalEl.style.left = rect.left + 'px';
          portalEl.style.minWidth = rect.width + 'px';
          Array.from(filterDropdown.querySelectorAll('.filter-categoria-option')).forEach(opt => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'filter-categoria-option';
            btn.dataset.value = opt.dataset.value;
            btn.textContent = opt.textContent;
            btn.onclick = function (e) {
              e.stopPropagation();
              const val = this.dataset.value;
              filterHidden.value = val;
              filterTrigger.textContent = val === 'ALL' ? 'Todas' : val;
              productosCategoriaFilter = val;
              gridState.productos.page = 1;
              closeFilter();
              loadProductos(content);
            };
            portalEl.appendChild(btn);
          });
          document.body.appendChild(portalEl);
          filterTrigger.classList.add('open');
          requestAnimationFrame(() => document.addEventListener('click', closeFilter));
        };
        content.querySelectorAll('.filter-categoria-option').forEach(opt => {
          opt.onclick = function (e) {
            e.stopPropagation();
            const val = this.dataset.value;
            filterHidden.value = val;
            filterTrigger.textContent = val === 'ALL' ? 'Todas' : val;
            productosCategoriaFilter = val;
            gridState.productos.page = 1;
            closeFilter();
            loadProductos(content);
          };
        });
      }
      bindSearchWithClear(content, 'productos-search', 'productos', () => loadProductos(content));
      content.querySelectorAll('[data-edit-product]').forEach(btn => {
        btn.onclick = () => openModalProductoEdit(btn.dataset.editProduct, btn.dataset.cat);
      });
      content.querySelectorAll('[data-toggle-product]').forEach(btn => {
        btn.onclick = () => {
          const id = btn.dataset.toggleProduct;
          const estadoActual = btn.dataset.estado === '1';
          const nuevoEstado = estadoActual ? 0 : 1;
          showConfirmDelete({
            title: 'Cambiar estado',
            message: `¿Seguro que querés ${estadoActual ? 'desactivar' : 'activar'} este producto?`,
            confirmLabel: 'Sí',
            cancelLabel: 'No',
            onConfirm: () => {
              apiPost('/productos.php', { action: 'update', id: String(id), estado: nuevoEstado })
                .then(() => { showToast('Estado actualizado.', 'success'); loadProductos(content); })
                .catch(err => showToast(err.message || 'Error al cambiar estado', 'error'));
            }
          });
        };
      });
      content.querySelectorAll('[data-delete-product]').forEach(btn => {
        btn.onclick = () => deleteProducto(btn.dataset.deleteProduct);
      });
    }).catch(err => {
      content.innerHTML = '<div class="empty-state"><p class="error-msg">' + escapeHtml(err.message) + '</p></div>';
    });
  }

  function loadOfertas(content) {
    api('/config-media.php').then(data => {
      mediaConfig.mediaImagesPath = data.mediaImagesPath || 'IMG/CORTES';
      mediaConfig.mediaVideosPath = data.mediaVideosPath || 'IMG/CORTES/VIDEO';
    }).catch(() => {}).then(() => api('/ofertas.php?action=list')).then(({ data }) => {
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
      const sortKey = st.sortKey || '_categoria';
      const sortDir = st.sortDir || 'asc';
      flatRows.sort((a, b) => {
        let va = a[sortKey];
        let vb = b[sortKey];
        if (sortKey === 'precio') {
          va = Number(va);
          vb = Number(vb);
          const cmp = sortDir === 'asc' ? va - vb : vb - va;
          if (cmp !== 0) return cmp;
        } else if (sortKey === 'updated_at') {
          va = parseUpdatedAt(va);
          vb = parseUpdatedAt(vb);
          const cmp = sortDir === 'asc' ? va - vb : vb - va;
          if (cmp !== 0) return cmp;
        } else {
          if (sortKey === 'estado') {
            va = String(va || '');
            vb = String(vb || '');
          } else {
            va = String(va || '').toLowerCase();
            vb = String(vb || '').toLowerCase();
          }
          const cmp = va < vb ? -1 : va > vb ? 1 : 0;
          if (cmp !== 0) return sortDir === 'asc' ? cmp : -cmp;
        }
        const na = String(a.nombre || '').toLowerCase();
        const nb = String(b.nombre || '').toLowerCase();
        return na < nb ? -1 : na > nb ? 1 : 0;
      });
      const { rows, total, page, totalPages, pageSize } = filterAndPaginate(
        flatRows, st.search, ['nombre', 'unidad', '_categoria'], st.page, st.pageSize
      );
      st.page = page;

      const thSortOferta = (key, label) => {
        const isActive = sortKey === key;
        const dir = isActive ? sortDir : '';
        return `<th class="th-sort ${isActive ? 'th-sort-active' : ''}" data-sort="${escapeAttr(key)}" title="Ordenar por ${escapeAttr(label)}">${escapeHtml(label)} <span class="th-sort-icon">${dir === 'asc' ? '↑' : dir === 'desc' ? '↓' : ''}</span></th>`;
      };
      const header = `
        <div class="toolbar">
          <div class="toolbar-bar toolbar-productos toolbar-search">
            <div class="search-group">
              <label class="search-label">Buscar</label>
              <div class="search-input-wrap">
                <span class="search-icon" aria-hidden="true">🔍</span>
                <input type="text" id="ofertas-search" class="search-input" placeholder="nombre, unidad, categoría..." value="${escapeAttr(st.search)}">
                <button type="button" class="search-clear hidden" aria-label="Vaciar búsqueda" title="Vaciar">×</button>
              </div>
            </div>
            <button type="button" class="btn btn-ghost btn-sm btn-export-excel btn-excel" data-export-view="ofertas"><span class="btn-excel-icon" aria-hidden="true"></span> Excel</button>
          </div>
        </div>
      `;
      let html = header + `
        <div class="table-wrap">
          <table>
            <thead><tr>${thSortOferta('_categoria', 'Categoría')}${thSortOferta('nombre', 'Nombre')}${thSortOferta('unidad', 'Unidad')}${thSortOferta('precio', 'Precio')}<th>Imagen/Vídeo</th>${thSortOferta('estado', 'Estado')}<th></th></tr></thead>
            <tbody>`;
      rows.forEach(it => {
        const media1 = it.imagen1 || '';
        const media2 = it.imagen2 || '';
        const hasMedia = !!(media1 || media2);
        const isVideo = /(\.mp4|\.webm|\.mov)$/i.test(media1 || media2 || '');
        const mediaIcon = isVideo ? '▶' : '🖼';
        html += `<tr>
          <td><span class="pill">${escapeHtml(it._categoria || '')}</span></td>
          <td>${escapeHtml(it.nombre)}</td>
          <td>${escapeHtml(it.unidad)}</td>
          <td><code class="precio">${escapeHtml(formatPrecio(it.precio))}</code></td>
          <td class="media-cell">${hasMedia ? `<button type="button" class="btn btn-ghost btn-sm media-preview-btn" data-media1="${escapeAttr(media1)}" data-media2="${escapeAttr(media2)}" title="Ver imagen/vídeo">${mediaIcon}</button>` : '<span class="text-muted">—</span>'}</td>
          <td>${it.estado ? '<span class="badge success">Activo</span>' : '<span class="badge danger">Inactivo</span>'}</td>
          <td class="table-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-edit-oferta="${escapeAttr(it.id)}" data-cat="${escapeAttr(it._categoria)}">Editar</button>
            <button type="button" class="btn btn-secondary btn-sm" data-toggle-oferta="${escapeAttr(it.id)}" data-estado="${it.estado ? '1' : '0'}">${it.estado ? 'Desactivar' : 'Activar'}</button>
            <button type="button" class="btn btn-danger btn-sm" data-delete-oferta="${escapeAttr(it.id)}">Eliminar</button>
          </td>
        </tr>`;
      });
      html += '</tbody></table></div>';
      content.innerHTML = html;
      renderPagination(content, 'ofertas', total, page, totalPages, pageSize, () => loadOfertas(content));
      bindSearchWithClear(content, 'ofertas-search', 'ofertas', () => loadOfertas(content));
      content.querySelector('[data-export-view="ofertas"]')?.addEventListener('click', () => {
        const rows = getOfertasExportRows();
        const cols = [{ key: '_categoria', label: 'Categoría' }, { key: 'nombre', label: 'Nombre' }, { key: 'unidad', label: 'Unidad' }, { key: 'precio', label: 'Precio' }, { key: 'estado', label: 'Estado' }];
        downloadCSV(buildCSV(rows.map(r => ({ ...r, estado: r.estado ? 'Activo' : 'Inactivo' })), cols), 'ofertas.csv');
        showToast('Exportado correctamente.', 'success');
      });
      content.querySelectorAll('.th-sort[data-sort]').forEach(th => {
        th.onclick = function () {
          const key = this.dataset.sort;
          if (st.sortKey === key) st.sortDir = st.sortDir === 'asc' ? 'desc' : 'asc';
          else { st.sortKey = key; st.sortDir = 'asc'; }
          st.page = 1;
          loadOfertas(content);
        };
      });
      content.querySelectorAll('.media-preview-btn').forEach(btn => {
        btn.onclick = () => {
          const m1 = btn.dataset.media1 || '';
          const m2 = btn.dataset.media2 || '';
          openMediaPreview(m1 || m2);
        };
      });
      content.querySelectorAll('[data-edit-oferta]').forEach(btn => {
        btn.onclick = () => openModalOfertaEdit(btn.dataset.editOferta, btn.dataset.cat);
      });
      content.querySelectorAll('[data-toggle-oferta]').forEach(btn => {
        btn.onclick = () => {
          const id = btn.dataset.toggleOferta;
          const estadoActual = btn.dataset.estado === '1';
          const nuevoEstado = estadoActual ? 0 : 1;
          showConfirmDelete({
            title: 'Cambiar estado',
            message: `¿Seguro que querés ${estadoActual ? 'desactivar' : 'activar'} esta oferta?`,
            confirmLabel: 'Sí',
            cancelLabel: 'No',
            onConfirm: () => {
              apiPost('/ofertas.php', { action: 'update', id: String(id), estado: nuevoEstado })
                .then(() => { showToast('Estado actualizado.', 'success'); loadOfertas(content); })
                .catch(err => showToast(err.message || 'Error al cambiar estado', 'error'));
            }
          });
        };
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
      tvsData = data;
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
          <div class="toolbar-bar toolbar-productos toolbar-search">
            <div class="search-group">
              <label class="search-label">Buscar</label>
              <div class="search-input-wrap">
                <span class="search-icon" aria-hidden="true">🔍</span>
                <input type="text" id="tvs-search" class="search-input" placeholder="ID, título, descripción..." value="${escapeAttr(st.search)}">
                <button type="button" class="search-clear hidden" aria-label="Vaciar búsqueda" title="Vaciar">×</button>
              </div>
            </div>
            <button type="button" class="btn btn-ghost btn-sm btn-export-excel btn-excel" data-export-view="tvs"><span class="btn-excel-icon" aria-hidden="true"></span> Excel</button>
          </div>
        </div>
      `;
      let html = header + '<div class="tv-card-grid">';
      rows.forEach(t => {
        const desc = (t.description || '').trim();
        const url = t.url || '';
        html += `
        <article class="tv-card${t.active ? ' tv-card-active' : ' tv-card-inactive'}">
          <header class="tv-card-header">
            <span class="tv-card-id">#${escapeHtml(t.id)}</span>
            <span class="tv-card-tag">${escapeHtml(t.tag || 'TV')}</span>
          </header>
          <div class="tv-card-body">
            <h3 class="tv-card-title">${escapeHtml(t.title || '')}</h3>
            <p class="tv-card-desc">${escapeHtml(desc || 'Sin descripción')}</p>
          </div>
          <footer class="tv-card-footer">
            <div class="tv-card-footer-left">
              <button type="button"
                      class="tv-status-pill ${t.active ? 'tv-status-on' : 'tv-status-off'}"
                      data-toggle-tv="${escapeAttr(t.id)}"
                      data-active="${t.active ? '1' : '0'}">
                ${t.active ? 'Activo' : 'Inactivo'}
              </button>
              ${url ? `<button type="button" class="btn btn-ghost btn-sm tv-link-btn" data-open-tv-url="${escapeAttr(url)}" aria-label="Probar link"></button>` : ''}
            </div>
            <div class="tv-card-actions">
              <button type="button" class="btn btn-ghost btn-sm" data-edit-tv="${escapeAttr(t.id)}">Editar</button>
              <button type="button" class="btn btn-danger btn-sm" data-delete-tv="${escapeAttr(t.id)}">Eliminar</button>
            </div>
          </footer>
        </article>`;
      });
      html += '</div>';
      content.innerHTML = html;
      renderPagination(content, 'tvs', total, page, totalPages, pageSize, () => loadTVs(content));
      bindSearchWithClear(content, 'tvs-search', 'tvs', () => loadTVs(content));
      content.querySelector('[data-export-view="tvs"]')?.addEventListener('click', () => {
        const rows = getTVsExportRows();
        const cols = [{ key: 'id', label: 'ID' }, { key: 'title', label: 'Título' }, { key: 'tag', label: 'Tag' }, { key: 'url', label: 'URL' }, { key: 'active', label: 'Estado' }];
        downloadCSV(buildCSV(rows.map(r => ({ ...r, active: r.active ? 'Activo' : 'Inactivo' })), cols), 'televisores.csv');
        showToast('Exportado correctamente.', 'success');
      });
      content.querySelectorAll('[data-open-tv-url]').forEach(btn => {
        btn.onclick = () => {
          const url = btn.dataset.openTvUrl;
          if (url) window.open(url, '_blank');
        };
      });
      content.querySelectorAll('[data-edit-tv]').forEach(btn => {
        btn.onclick = () => openModalTVEdit(btn.dataset.editTv);
      });
      content.querySelectorAll('[data-toggle-tv]').forEach(btn => {
        btn.onclick = () => {
          const id = btn.dataset.toggleTv;
          const activeNow = btn.dataset.active === '1';
          const newActive = activeNow ? 0 : 1;
          showConfirmDelete({
            title: 'Cambiar estado',
            message: `¿Seguro que querés ${activeNow ? 'desactivar' : 'activar'} este televisor?`,
            confirmLabel: 'Sí',
            cancelLabel: 'No',
            onConfirm: () => {
              apiPost('/tvs.php', { action: 'update', id: String(id), active: newActive })
                .then(() => { showToast('Estado actualizado.', 'success'); loadTVs(content); })
                .catch(err => showToast(err.message || 'Error al cambiar estado', 'error'));
            }
          });
        };
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
      usuariosData = data;
      const raw = Array.isArray(data) ? data : (data && data.data ? data.data : []);
      const list = raw.map(u => ({ ...u, _username: u.username || u.usuario || '' }));
      const st = gridState.usuarios;
      const isAdmin = user && user.perfil === 'Admin';

      if (isAdmin && st.viewMode === 'supervisors') {
        const uniqueSupervisors = (() => {
          const seen = new Map();
          list.forEach(u => {
            const id = u.created_by_id ?? 0;
            if (seen.has(id)) return;
            const name = u.created_by_name || 'Administración';
            const count = list.filter(x => String(x.created_by_id ?? 0) === String(id)).length;
            seen.set(id, { name, count });
          });
          return Array.from(seen.entries()).sort((a, b) => {
            if (a[0] === 0) return -1;
            if (b[0] === 0) return 1;
            return (a[1].name || '').localeCompare(b[1].name || '');
          });
        })();
        content.innerHTML = `
          <div class="usuarios-supervisors-intro">
            <p class="usuarios-supervisors-intro-text">Elegí un supervisor para ver sus usuarios.</p>
          </div>
          <div class="usuarios-supervisors-list">
            ${uniqueSupervisors.map(([id, info]) => `
              <button type="button" class="usuarios-supervisor-card" data-supervisor-id="${escapeAttr(String(id))}">
                <span class="usuarios-supervisor-card-name">${escapeHtml(info.name)}</span>
                <span class="usuarios-supervisor-card-count">${info.count} usuario${info.count !== 1 ? 's' : ''}</span>
              </button>
            `).join('')}
          </div>`;
        content.querySelectorAll('.usuarios-supervisor-card').forEach(btn => {
          btn.onclick = () => {
            st.viewMode = 'grid';
            st.supervisorFilter = btn.dataset.supervisorId;
            st.page = 1;
            loadUsuarios(content);
          };
        });
        return;
      }

      if (list.length === 0) {
        content.innerHTML = '<div class="empty-state"><p>No hay usuarios.</p></div>';
        return;
      }
      let listFiltered = list;
      if (isAdmin && st.supervisorFilter !== 'ALL') {
        listFiltered = list.filter(u => String(u.created_by_id ?? 0) === String(st.supervisorFilter));
      }
      const { rows, total, page, totalPages, pageSize } = filterAndPaginate(
        listFiltered, st.search, ['_username', 'name', 'role', 'created_by_name'], st.page, st.pageSize
      );
      st.page = page;
      const uniqueSupervisors = isAdmin ? (() => {
        const seen = new Map();
        list.forEach(u => {
          const id = u.created_by_id ?? 0;
          if (seen.has(id)) return;
          seen.set(id, u.created_by_name || 'Administración');
        });
        return Array.from(seen.entries()).sort((a, b) => {
          if (a[0] === 0) return -1;
          if (b[0] === 0) return 1;
          return (a[1] || '').localeCompare(b[1] || '');
        });
      })() : [];
      const currentSupervisorLabel = isAdmin && st.supervisorFilter !== 'ALL'
        ? (uniqueSupervisors.find(([id]) => String(id) === String(st.supervisorFilter)) || [null, 'Supervisor'])[1]
        : 'Todos';
      const supervisorOptionsHtml = isAdmin ? uniqueSupervisors.map(([id, name]) =>
        `<button type="button" class="filter-supervisor-option" data-value="${escapeAttr(String(id))}">${escapeHtml(name)}</button>`
      ).join('') : '';
      const backToSupervisorsBtn = isAdmin ? `<button type="button" class="btn btn-ghost btn-sm btn-back-supervisors">Ver listado de supervisores</button>` : '';
      const header = `
        <div class="toolbar">
          <div class="toolbar-bar toolbar-productos toolbar-search">
            <div class="search-group">
              <label class="search-label">Buscar</label>
              <div class="search-input-wrap">
                <span class="search-icon" aria-hidden="true">🔍</span>
                <input type="text" id="usuarios-search" class="search-input" placeholder="usuario, nombre, rol..." value="${escapeAttr(st.search)}">
                <button type="button" class="search-clear hidden" aria-label="Vaciar búsqueda" title="Vaciar">×</button>
              </div>
            </div>
            ${isAdmin ? `
            <div class="filter-supervisor-wrap">
              <label class="search-label">Supervisor</label>
              <div class="filter-supervisor">
                <input type="hidden" id="usuarios-supervisor-filter-value" value="${escapeAttr(st.supervisorFilter)}">
                <button type="button" class="filter-supervisor-trigger" id="usuarios-supervisor-trigger">${escapeHtml(currentSupervisorLabel)}</button>
                <div class="filter-supervisor-dropdown hidden" id="usuarios-supervisor-dropdown">
                  <button type="button" class="filter-supervisor-option" data-value="ALL">Todos</button>
                  ${supervisorOptionsHtml}
                </div>
              </div>
            </div>
            ${backToSupervisorsBtn}
            ` : ''}
            <button type="button" class="btn btn-ghost btn-sm btn-export-excel btn-excel" data-export-view="usuarios"><span class="btn-excel-icon" aria-hidden="true"></span> Excel</button>
          </div>
        </div>
      `;
      const isSupervisor = user && user.perfil === 'Supervisor';
      const canEditUser = (u) => !isSupervisor || (String(u.role || '').toLowerCase() === 'editor');
      const rowHtml = (u) => {
        const showActions = canEditUser(u);
        const actionsHtml = showActions
          ? `<button type="button" class="btn btn-ghost btn-sm" data-edit-user="${escapeAttr(u.id)}">Editar</button>
            <button type="button" class="btn btn-secondary btn-sm" data-toggle-user="${escapeAttr(u.id)}" data-active="${u.active ? '1' : '0'}">${u.active ? 'Desactivar' : 'Activar'}</button>
            <button type="button" class="btn btn-danger btn-sm" data-delete-user="${escapeAttr(u.id)}">Eliminar</button>`
          : '<span class="text-muted">—</span>';
        return `<tr>
          <td><code>${escapeHtml(u._username)}</code></td>
          <td>${escapeHtml(u.name || '-')}</td>
          <td><span class="badge">${escapeHtml(u.role || '')}</span></td>
          <td>${u.active ? '<span class="badge success">Sí</span>' : '<span class="badge danger">No</span>'}</td>
          <td class="table-actions">${actionsHtml}</td>
        </tr>`;
      };
      let html = header;
      if (isAdmin && rows.length > 0) {
        const groups = {};
        rows.forEach(u => {
          const k = String(u.created_by_id ?? 0);
          const name = u.created_by_name || 'Administración';
          if (!groups[k]) groups[k] = { name, rows: [] };
          groups[k].rows.push(u);
        });
        const groupKeys = Object.keys(groups).sort((a, b) => {
          if (a === '0') return -1;
          if (b === '0') return 1;
          return (groups[a].name || '').localeCompare(groups[b].name || '');
        });
        groupKeys.forEach(k => {
          const g = groups[k];
          html += `<div class="usuarios-group"><h3 class="usuarios-group-title">Creado por: ${escapeHtml(g.name)}</h3><div class="table-wrap"><table><thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Activo</th><th></th></tr></thead><tbody>`;
          g.rows.forEach(u => { html += rowHtml(u); });
          html += '</tbody></table></div></div>';
        });
      } else {
        html += '<div class="table-wrap"><table><thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Activo</th><th></th></tr></thead><tbody>';
        rows.forEach(u => { html += rowHtml(u); });
        html += '</tbody></table></div>';
      }
      content.innerHTML = html;
      renderPagination(content, 'usuarios', total, page, totalPages, pageSize, () => loadUsuarios(content));
      bindSearchWithClear(content, 'usuarios-search', 'usuarios', () => loadUsuarios(content));
      if (isAdmin) {
        const trigger = document.getElementById('usuarios-supervisor-trigger');
        const dropdown = document.getElementById('usuarios-supervisor-dropdown');
        const hiddenInput = document.getElementById('usuarios-supervisor-filter-value');
        if (trigger && dropdown && hiddenInput) {
          const closeDropdown = () => { trigger.classList.remove('open'); dropdown.classList.add('hidden'); };
          trigger.onclick = function (e) {
            e.stopPropagation();
            const isOpen = !dropdown.classList.contains('hidden');
            closeDropdown();
            if (!isOpen) {
              dropdown.classList.remove('hidden');
              trigger.classList.add('open');
              const portal = document.createElement('div');
              portal.className = 'filter-supervisor-portal';
              const rect = trigger.getBoundingClientRect();
              portal.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.bottom + 2}px;min-width:${rect.width}px;z-index:9999;`;
              portal.innerHTML = dropdown.innerHTML;
              document.body.appendChild(portal);
              const removePortal = () => { portal.remove(); closeDropdown(); };
              setTimeout(() => document.addEventListener('click', removePortal), 0);
              portal.querySelectorAll('.filter-supervisor-option').forEach(opt => {
                opt.onclick = (ev) => {
                  ev.preventDefault();
                  const val = opt.dataset.value;
                  st.supervisorFilter = val;
                  hiddenInput.value = val;
                  trigger.textContent = val === 'ALL' ? 'Todos' : opt.textContent;
                  removePortal();
                  document.removeEventListener('click', removePortal);
                  st.page = 1;
                  loadUsuarios(content);
                };
              });
            }
          };
        }
        content.querySelector('.btn-back-supervisors')?.addEventListener('click', () => { st.viewMode = 'supervisors'; loadUsuarios(content); });
      }
      content.querySelector('[data-export-view="usuarios"]')?.addEventListener('click', () => {
        const rows = getUsuariosExportRows();
        const cols = [{ key: '_username', label: 'Usuario' }, { key: 'name', label: 'Nombre' }, { key: 'role', label: 'Rol' }, { key: 'active', label: 'Activo' }];
        downloadCSV(buildCSV(rows.map(r => ({ ...r, active: r.active ? 'Sí' : 'No' })), cols), 'usuarios.csv');
        showToast('Exportado correctamente.', 'success');
      });
      content.querySelectorAll('[data-edit-user]').forEach(btn => {
        btn.onclick = () => openModalUsuarioEdit(btn.dataset.editUser);
      });
      content.querySelectorAll('[data-toggle-user]').forEach(btn => {
        btn.onclick = () => {
          const id = btn.dataset.toggleUser;
          const activeNow = btn.dataset.active === '1';
          const newActive = activeNow ? 0 : 1;
          showConfirmDelete({
            title: 'Cambiar estado',
            message: `¿Seguro que querés ${activeNow ? 'desactivar' : 'activar'} este usuario?`,
            confirmLabel: 'Sí',
            cancelLabel: 'No',
            onConfirm: () => {
              apiPost('/usuarios.php', { action: 'update', id: Number(id), active: newActive })
                .then(() => { showToast('Estado actualizado.', 'success'); loadUsuarios(content); })
                .catch(err => showToast(err.message || 'Error al cambiar estado', 'error'));
            }
          });
        };
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
    if (!d.categoria) { showToast('Elegí o ingresá una categoría.', 'warn'); return; }
    const body = { action: mode === 'create' ? 'create' : 'update', categoria: d.categoria, nombre: d.nombre, unidad: d.unidad, precio: d.precio, tag: d.tag, estado: d.estado };
    if (mode === 'edit') body.id = String(id);
    apiPost('/productos.php', body).then(() => { closeModal(); setView('productos'); showToast('Guardado correctamente.', 'success'); }).catch(err => showToast(err.message || 'Error al guardar', 'error'));
  }

  function saveOferta(mode, id) {
    const d = getFormData(['f-categoria', 'f-nombre', 'f-unidad', 'f-precio', 'f-estado']);
    const categoria = (d.categoria || 'Ofertas') || 'Ofertas';
    const form = new FormData();
    form.append('action', mode === 'create' ? 'create' : 'update');
    form.append('categoria', categoria);
    form.append('nombre', d.nombre);
    form.append('unidad', d.unidad);
    form.append('precio', d.precio);
    form.append('estado', d.estado != null ? d.estado : 1);
    if (mode === 'edit') form.append('id', String(id));
    const f1 = document.getElementById('f-imagen1');
    const hasFile = f1 && f1.files && f1.files[0];
    if (hasFile) form.append('imagen1', f1.files[0]);

    const progressWrap = document.getElementById('oferta-upload-progress');
    const progressBar = document.getElementById('oferta-upload-progress-bar');
    const progressLabel = document.getElementById('oferta-upload-progress-label');
    const saveBtn = document.querySelector('#modal [data-modal-save]');

    const onSuccess = () => {
      if (progressWrap) progressWrap.classList.add('hidden');
      if (saveBtn) saveBtn.disabled = false;
      closeModal();
      setView('ofertas');
      showToast('Oferta guardada correctamente.', 'success');
    };
    const onError = (err) => {
      if (progressWrap) progressWrap.classList.add('hidden');
      if (saveBtn) saveBtn.disabled = false;
      showToast(err.message || 'Error al guardar', 'error');
    };

    if (hasFile && progressWrap && progressBar) {
      progressWrap.classList.remove('hidden');
      progressBar.style.width = '0%';
      if (progressLabel) progressLabel.textContent = 'Subiendo…';
      if (saveBtn) saveBtn.disabled = true;
      const xhr = new XMLHttpRequest();
      xhr.open('POST', API + '/ofertas.php');
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && progressBar && progressLabel) {
          const pct = Math.round((e.loaded / e.total) * 100);
          progressBar.style.width = pct + '%';
          progressLabel.textContent = 'Subiendo… ' + pct + '%';
        }
      };
      xhr.onload = () => {
        let data;
        try {
          data = JSON.parse(xhr.responseText || '{}');
        } catch (_) {
          onError(new Error('Respuesta inválida del servidor'));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          if (data.error) onError(new Error(data.error));
          else onSuccess();
        } else {
          onError(new Error(data.error || 'Error ' + xhr.status));
        }
      };
      xhr.onerror = () => onError(new Error('Error de conexión'));
      xhr.send(form);
    } else {
      api('/ofertas.php', { method: 'POST', body: form }).then((data) => {
        if (data && data.error) throw new Error(data.error);
        onSuccess();
      }).catch(onError);
    }
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
    apiPost('/usuarios.php', body).then(() => { closeModal(); setView('usuarios'); showToast('Usuario guardado.', 'success'); }).catch(err => showToast(err.message || 'Error al guardar', 'error'));
  }

  function deleteProducto(id) {
    showConfirmDelete({
      title: 'Eliminar producto',
      message: '¿Eliminar este producto? Esta acción no se puede deshacer.',
      onConfirm: () => apiPost('/productos.php', { action: 'delete', id: String(id) }).then(() => { setView('productos'); showToast('Producto eliminado.', 'success'); }).catch(err => showToast(err.message || 'Error al eliminar', 'error'))
    });
  }

  function deleteOferta(id) {
    showConfirmDelete({
      title: 'Eliminar oferta',
      message: '¿Eliminar esta oferta? Esta acción no se puede deshacer.',
      onConfirm: () => apiPost('/ofertas.php', { action: 'delete', id: String(id) }).then(() => { setView('ofertas'); showToast('Oferta eliminada.', 'success'); }).catch(err => showToast(err.message || 'Error al eliminar', 'error'))
    });
  }

  function openMediaPreview(src) {
    if (!src) return;
    const resolved = (typeof src === 'string' && src.startsWith('blob:')) ? src : buildMediaUrl(src);
    const modal = $('#modal');
    const title = $('#modal-title');
    const body = $('#modal-body');
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    title.textContent = 'Previsualización';
    const pathOnly = (resolved && (resolved.split('?')[0].split('#')[0])) || '';
    const isVideo = /\.(mp4|webm|mov)$/i.test(pathOnly);
    const safeSrc = escapeAttr(resolved);
    body.innerHTML = `
      <div class="media-preview">
        ${isVideo
          ? `<video src="${safeSrc}" controls autoplay muted playsinline style="max-width:100%;border-radius:4px;"></video>`
          : `<img src="${safeSrc}" alt="Previsualización" style="max-width:100%;border-radius:4px;">`
        }
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-primary" data-modal-cancel>Cerrar</button>
      </div>`;
    body.querySelector('[data-modal-cancel]').onclick = closeModal;
  }

  function buildMediaUrl(src) {
    if (!src) return '';
    if (/^https?:\/\//i.test(src)) return src;
    const path = src.startsWith('/') ? src.slice(1) : src;
    const origin = window.location.origin || '';
    return origin ? (origin.replace(/\/$/, '') + '/' + path) : '/' + path;
  }

  /** Para ofertas: resuelve la URL usando las rutas de configuración (imágenes/videos). */
  function buildOfertaMediaUrl(src) {
    if (!src || typeof src !== 'string') return '';
    const s = src.trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (s.indexOf('/') !== -1) return buildMediaUrl(s);
    const ext = (s.split('.').pop() || '').toLowerCase();
    const isVideo = ['mp4', 'webm', 'mov'].indexOf(ext) !== -1;
    const base = isVideo ? (mediaConfig.mediaVideosPath || 'IMG/CORTES/VIDEO') : (mediaConfig.mediaImagesPath || 'IMG/CORTES');
    const path = base.replace(/\/$/, '') + '/' + s;
    return buildMediaUrl(path);
  }

  function deleteTV(id) {
    showConfirmDelete({
      title: 'Eliminar televisor',
      message: '¿Eliminar este televisor? Esta acción no se puede deshacer.',
      onConfirm: () => apiPost('/tvs.php', { action: 'delete', id: String(id) }).then(() => { setView('tvs'); showToast('Televisor eliminado.', 'success'); }).catch(err => showToast(err.message || 'Error al eliminar', 'error'))
    });
  }

  function deleteUsuario(id) {
    showConfirmDelete({
      title: 'Eliminar usuario',
      message: '¿Eliminar este usuario? Esta acción no se puede deshacer.',
      onConfirm: () => apiPost('/usuarios.php', { action: 'delete', id: String(id) }).then(() => { setView('usuarios'); showToast('Usuario eliminado.', 'success'); }).catch(err => showToast(err.message || 'Error al eliminar', 'error'))
    });
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
    body.classList.remove('no-scroll');

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
      const currentCat = (row.categoria || row._categoria || 'Ofertas').trim() || 'Ofertas';
      title.textContent = mode === 'create' ? 'Nueva oferta' : 'Editar oferta';
      body.innerHTML = `
        <div class="form-grid">
          <div class="field span-2">
            <label>Categoría</label>
            <input type="hidden" id="f-categoria" value="${escapeAttr(currentCat || 'Ofertas')}">
            <div class="pill">Ofertas</div>
            <div class="help">Todas las ofertas se muestran en la categoría Ofertas.</div>
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
            <label>Imagen / Video</label>
            <div class="oferta-upload-zone" id="oferta-upload-zone">
              <input type="file" id="f-imagen1" accept="image/*,video/*" class="oferta-upload-input">
              <div class="oferta-upload-placeholder" id="oferta-upload-placeholder">
                <span class="oferta-upload-icon" aria-hidden="true"></span>
                <span class="oferta-upload-text">Arrastrá un archivo o hacé clic para elegir</span>
                <span class="oferta-upload-hint">Imagen (JPG, PNG) o video (MP4, WebM)</span>
              </div>
              <div class="oferta-upload-chosen hidden" id="oferta-upload-chosen">
                <span class="oferta-upload-filename" id="oferta-upload-filename"></span>
                <button type="button" class="btn btn-ghost btn-sm oferta-btn-preview" id="oferta-btn-preview">Ver preview</button>
              </div>
            </div>
            <div id="oferta-upload-progress" class="upload-progress-wrap hidden">
              <div class="upload-progress-bar"><div id="oferta-upload-progress-bar" class="upload-progress-fill"></div></div>
              <span id="oferta-upload-progress-label" class="upload-progress-label">Subiendo…</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" data-modal-cancel>Cancelar</button>
          <button type="button" class="btn btn-primary" data-modal-save>Guardar</button>
        </div>`;
      body.classList.add('no-scroll');

      const zone = body.querySelector('#oferta-upload-zone');
      const placeholder = body.querySelector('#oferta-upload-placeholder');
      const chosen = body.querySelector('#oferta-upload-chosen');
      const filenameEl = body.querySelector('#oferta-upload-filename');
      const btnPreview = body.querySelector('#oferta-btn-preview');
      const fImg = body.querySelector('#f-imagen1');
      const currentMedia = row.imagen1 || '';
      let currentPreviewSrc = currentMedia || null;
      let lastBlobUrl = null;

      function getDisplayName(src) {
        if (!src || typeof src !== 'string') return '';
        if (src.startsWith('blob:')) return (fImg && fImg.files && fImg.files[0] && fImg.files[0].name) || 'Archivo';
        const parts = src.replace(/\\/g, '/').split('/');
        return parts[parts.length - 1] || 'Archivo';
      }
      function updateUploadUI() {
        const hasFile = !!(currentPreviewSrc || (fImg && fImg.files && fImg.files[0]));
        if (placeholder && chosen) {
          placeholder.classList.toggle('hidden', hasFile);
          chosen.classList.toggle('hidden', !hasFile);
        }
        if (filenameEl) filenameEl.textContent = hasFile ? (fImg && fImg.files && fImg.files[0] ? fImg.files[0].name : getDisplayName(currentMedia)) : '';
      }
      updateUploadUI();

      if (zone && fImg) {
        zone.onclick = (e) => { if (e.target !== fImg && !e.target.closest('.oferta-btn-preview')) fImg.click(); };
        fImg.onchange = () => {
          if (lastBlobUrl) { URL.revokeObjectURL(lastBlobUrl); lastBlobUrl = null; }
          const file = fImg.files && fImg.files[0];
          if (file) {
            lastBlobUrl = URL.createObjectURL(file);
            currentPreviewSrc = lastBlobUrl;
          } else {
            currentPreviewSrc = currentMedia || null;
          }
          updateUploadUI();
        };
      }
      if (btnPreview) {
        btnPreview.onclick = (e) => {
          e.stopPropagation();
          if (currentPreviewSrc) openMediaPreview(currentPreviewSrc);
        };
      }
      body.querySelector('[data-modal-cancel]')?.addEventListener('click', () => {
        if (lastBlobUrl) { URL.revokeObjectURL(lastBlobUrl); lastBlobUrl = null; }
      });
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
      const isSupervisor = user && user.perfil === 'Supervisor';
      const roleOptions = isSupervisor
        ? '<option value="editor">editor</option>'
        : '<option value="admin">admin</option><option value="supervisor">supervisor</option><option value="editor">editor</option>';
      body.innerHTML = `
        <div class="form-grid">
          <div class="field">
            <label>Usuario (login)</label>
            <input type="text" id="f-username" value="${escapeAttr(row.username || row._username || '')}" required autocomplete="off">
            <div id="f-username-msg" class="field-msg" aria-live="polite"></div>
          </div>
          <div class="field"><label>Nombre</label><input type="text" id="f-name" value="${escapeAttr(row.name || '')}" placeholder="Nombre completo"></div>
          <div class="field span-2"><label>Contraseña</label><input type="password" id="f-password" placeholder="${mode === 'edit' ? 'Dejar en blanco para no cambiar' : 'Requerida'}"></div>
          <div class="field"><label>Rol</label><select id="f-role" class="select">${roleOptions}</select></div>
          <div class="field"><label>Activo</label><select id="f-active" class="select"><option value="1">Sí</option><option value="0">No</option></select></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" data-modal-cancel>Cancelar</button>
          <button type="button" class="btn btn-primary" data-modal-save>Guardar</button>
        </div>`;
      body.querySelector('#f-role').value = isSupervisor ? 'editor' : (row.role || 'editor');
      body.querySelector('#f-active').value = row.active === 0 ? '0' : '1';
      const saveBtn = body.querySelector('[data-modal-save]');
      saveBtn.onclick = () => saveUsuario(mode, row.id);
      (function bindUsernameCheck() {
        const input = body.querySelector('#f-username');
        const msgEl = body.querySelector('#f-username-msg');
        let debounceTimer;
        function check() {
          const v = (input && input.value || '').trim();
          msgEl.textContent = '';
          msgEl.className = 'field-msg';
          if (saveBtn) saveBtn.disabled = false;
          if (!v) return;
          api('/usuarios.php?action=check_username&username=' + encodeURIComponent(v) + '&exclude_id=' + (mode === 'edit' ? (row.id || '') : '')).then((r) => {
            const exists = r && r.exists;
            if (!msgEl) return;
            msgEl.textContent = exists ? 'Usuario ya existe' : 'Disponible';
            msgEl.className = 'field-msg ' + (exists ? 'field-msg-error' : 'field-msg-ok');
            if (saveBtn) saveBtn.disabled = !!exists;
          }).catch(() => { if (msgEl) msgEl.textContent = ''; if (saveBtn) saveBtn.disabled = false; });
        }
        if (input && msgEl) {
          input.addEventListener('input', function () {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(check, 350);
          });
          input.addEventListener('blur', check);
          check();
        }
      })();
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
    }).catch(err => showToast(err.message || 'Error al cargar', 'error'));
  };

  // Init
  checkSession().then(loggedIn => {
    if (loggedIn) {
      showScreen('dashboard');
      $('#user-badge').textContent = user.nombre || user.usuario;
      if (user.perfil === 'Usuario' && ['config', 'tvs', 'usuarios'].includes(currentView)) currentView = 'productos';
      if (user.perfil === 'Supervisor' && ['config', 'tvs'].includes(currentView)) currentView = 'productos';
      setView(currentView);
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
          $('#user-badge').textContent = user.nombre || user.usuario;
          currentView = getInitialView();
          setView(currentView);
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

  function openProfileModal() {
    const modal = $('#profile-modal');
    const body = $('#profile-modal-body');
    if (!modal || !body) return;
    body.innerHTML = '<div class="loading"><div class="spinner"></div>Cargando…</div>';
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    api('/perfil.php?action=get')
      .then((data) => {
        const d = data.data || data;
        const nombre = d.name || d.nombre || user?.nombre || '';
        const usuario = d.username || d.usuario || user?.usuario || '';
        body.innerHTML = `
          <form id="profile-form" class="form-grid">
            <div class="field span-2">
              <label>Usuario (login)</label>
              <input type="text" value="${escapeAttr(usuario)}" readonly class="input" style="opacity:0.8;">
            </div>
            <div class="field span-2">
              <label>Nombre</label>
              <input type="text" id="profile-name" class="input" value="${escapeAttr(nombre)}" placeholder="Tu nombre para mostrar">
            </div>
            <div class="field span-2">
              <label>Nueva contraseña</label>
              <input type="password" id="profile-password" class="input" placeholder="Dejar en blanco para no cambiar" autocomplete="new-password">
            </div>
          </form>
          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" id="profile-cancel">Cancelar</button>
            <button type="button" class="btn btn-primary" id="profile-save">Guardar</button>
          </div>`;
        body.querySelector('#profile-cancel').onclick = closeProfileModal;
        body.querySelector('#profile-save').onclick = () => {
          const name = (body.querySelector('#profile-name') || {}).value?.trim() || '';
          const password = (body.querySelector('#profile-password') || {}).value || '';
          const payload = { action: 'update', name };
          if (password) payload.password = password;
          apiPost('/perfil.php', payload)
            .then((res) => {
              if (res.data && res.data.name !== undefined) user.nombre = res.data.name;
              if (user) $('#user-badge').textContent = user.nombre || user.usuario;
              closeProfileModal();
              showToast('Perfil actualizado.', 'success');
            })
            .catch((err) => showToast(err.message || 'Error al guardar', 'error'));
        };
      })
      .catch((err) => {
        body.innerHTML = '<div class="empty-state"><p class="error-msg">' + (err.message || 'No se pudo cargar el perfil') + '</p><button type="button" class="btn btn-ghost" id="profile-cancel">Cerrar</button></div>';
        body.querySelector('#profile-cancel').onclick = closeProfileModal;
      });
  }

  function closeProfileModal() {
    const modal = $('#profile-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  $('#user-profile-trigger').onclick = openProfileModal;
  $('#profile-modal-close').onclick = closeProfileModal;
  $('#profile-modal-backdrop').onclick = closeProfileModal;

  $('#modal-close').onclick = closeModal;
  $('#modal-backdrop').onclick = closeModal;
})();