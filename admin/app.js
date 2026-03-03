(function () {
  'use strict';

  const API = '/backend';
  const views = { productos: 'Productos', ofertas: 'Ofertas', tvs: 'Televisores', usuarios: 'Usuarios' };

  let currentView = 'productos';
  let user = null;

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => el.querySelectorAll(sel);

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
    $('#btn-nuevo').onclick = () => openModal(view, 'create');
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
      if (!data.categorias || data.categorias.length === 0) {
        content.innerHTML = '<div class="empty-state"><p>No hay productos. Cargá categorías desde el backend o agregá uno.</p></div>';
        return;
      }
      let html = '';
      data.categorias.forEach(cat => {
        const items = cat.items || [];
        html += `<div class="categoria-block"><h3>${escapeHtml(cat.nombre)}</h3><div class="table-wrap items-table"><table><thead><tr><th>Nombre</th><th>Unidad</th><th>Precio</th><th>Estado</th><th></th></tr></thead><tbody>`;
        items.forEach(it => {
          html += `<tr>
            <td>${escapeHtml(it.nombre)}</td>
            <td>${escapeHtml(it.unidad)}</td>
            <td><code>${escapeHtml(String(it.precio))}</code></td>
            <td>${it.estado ? '<span class="badge success">Activo</span>' : '<span class="badge danger">Inactivo</span>'}</td>
            <td class="table-actions">
              <button type="button" class="btn btn-ghost btn-sm" data-edit-product="${escapeAttr(it.id)}" data-cat="${escapeAttr(cat.nombre)}">Editar</button>
              <button type="button" class="btn btn-danger btn-sm" data-delete-product="${escapeAttr(it.id)}">Eliminar</button>
            </td>
          </tr>`;
        });
        html += '</tbody></table></div></div>';
      });
      content.innerHTML = html;
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
      if (!data.categorias || data.categorias.length === 0) {
        content.innerHTML = '<div class="empty-state"><p>No hay ofertas.</p></div>';
        return;
      }
      let html = '';
      data.categorias.forEach(cat => {
        const items = cat.items || [];
        html += `<div class="categoria-block"><h3>${escapeHtml(cat.nombre)}</h3><div class="table-wrap items-table"><table><thead><tr><th>Nombre</th><th>Unidad</th><th>Precio</th><th>Imagen/Vídeo</th><th></th></tr></thead><tbody>`;
        items.forEach(it => {
          const media = (it.imagen1 || it.imagen2 || '-');
          html += `<tr>
            <td>${escapeHtml(it.nombre)}</td>
            <td>${escapeHtml(it.unidad)}</td>
            <td><code>${escapeHtml(String(it.precio))}</code></td>
            <td><span class="text-muted">${escapeHtml(String(media).slice(0, 30))}</span></td>
            <td class="table-actions">
              <button type="button" class="btn btn-ghost btn-sm" data-edit-oferta="${escapeAttr(it.id)}" data-cat="${escapeAttr(cat.nombre)}">Editar</button>
              <button type="button" class="btn btn-danger btn-sm" data-delete-oferta="${escapeAttr(it.id)}">Eliminar</button>
            </td>
          </tr>`;
        });
        html += '</tbody></table></div></div>';
      });
      content.innerHTML = html;
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
      let html = '<div class="table-wrap"><table><thead><tr><th>ID</th><th>Título</th><th>Descripción</th><th>Activo</th><th></th></tr></thead><tbody>';
      list.forEach(t => {
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
      const list = Array.isArray(data) ? data : [];
      if (list.length === 0) {
        content.innerHTML = '<div class="empty-state"><p>No hay usuarios (solo Admin puede gestionarlos).</p></div>';
        return;
      }
      let html = '<div class="table-wrap"><table><thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Activo</th><th></th></tr></thead><tbody>';
      list.forEach(u => {
        html += `<tr>
          <td><code>${escapeHtml(u.username || u.usuario || '')}</code></td>
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
    const body = { action: mode === 'create' ? 'create' : 'update', categoria: d.categoria, nombre: d.nombre, unidad: d.unidad, precio: d.precio, tag: d.tag, estado: d.estado };
    if (mode === 'edit') body.id = id;
    apiPost('/productos.php', body).then(() => { closeModal(); setView('productos'); }).catch(err => alert(err.message));
  }

  function saveOferta(mode, id) {
    const d = getFormData(['f-categoria', 'f-nombre', 'f-unidad', 'f-precio']);
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
  function openModal(view, mode, row) {
    const modal = $('#modal');
    const title = $('#modal-title');
    const body = $('#modal-body');
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');

    if (view === 'productos') {
      title.textContent = mode === 'create' ? 'Nuevo producto' : 'Editar producto';
      body.innerHTML = `
        <div class="field"><label>Categoría</label><input type="text" id="f-categoria" value="${escapeAttr(row.categoria || '')}" placeholder="Ej: Carne"></div>
        <div class="field"><label>Nombre</label><input type="text" id="f-nombre" value="${escapeAttr(row.nombre || '')}" required></div>
        <div class="field"><label>Unidad</label><input type="text" id="f-unidad" value="${escapeAttr(row.unidad || '')}" placeholder="kg, unidad..."></div>
        <div class="field"><label>Precio</label><input type="number" id="f-precio" value="${row.precio ?? ''}" min="0"></div>
        <div class="field"><label>Tag</label><input type="text" id="f-tag" value="${escapeAttr(row.tag || '')}"></div>
        <div class="field"><label>Estado</label><select id="f-estado"><option value="1">Activo</option><option value="0">Inactivo</option></select></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" data-modal-cancel>Cancelar</button>
          <button type="button" class="btn btn-primary" data-modal-save>Guardar</button>
        </div>`;
      const sel = body.querySelector('#f-estado');
      if (sel) sel.value = row.estado === 0 ? '0' : '1';
      body.querySelector('[data-modal-save]').onclick = () => saveProducto(mode, row.id);
    } else if (view === 'ofertas') {
      title.textContent = mode === 'create' ? 'Nueva oferta' : 'Editar oferta';
      body.innerHTML = `
        <div class="field"><label>Categoría</label><input type="text" id="f-categoria" value="${escapeAttr(row.categoria || '')}" placeholder="Ej: Ofertas"></div>
        <div class="field"><label>Nombre</label><input type="text" id="f-nombre" value="${escapeAttr(row.nombre || '')}" required></div>
        <div class="field"><label>Unidad</label><input type="text" id="f-unidad" value="${escapeAttr(row.unidad || '')}"></div>
        <div class="field"><label>Precio</label><input type="number" id="f-precio" value="${row.precio ?? ''}" min="0"></div>
        <div class="field"><label>Imagen 1 / Video</label><div class="file-upload"><input type="file" id="f-imagen1" accept="image/*,video/*"></div></div>
        <div class="field"><label>Imagen 2</label><div class="file-upload"><input type="file" id="f-imagen2" accept="image/*"></div></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" data-modal-cancel>Cancelar</button>
          <button type="button" class="btn btn-primary" data-modal-save>Guardar</button>
        </div>`;
      body.querySelector('[data-modal-save]').onclick = () => saveOferta(mode, row.id);
    } else if (view === 'tvs') {
      title.textContent = mode === 'create' ? 'Nuevo televisor' : 'Editar televisor';
      body.innerHTML = `
        <div class="field"><label>ID</label><input type="text" id="f-id" value="${escapeAttr(row.id || '')}" placeholder="tv1" ${mode === 'edit' ? 'readonly' : ''}></div>
        <div class="field"><label>Título</label><input type="text" id="f-title" value="${escapeAttr(row.title || '')}" required></div>
        <div class="field"><label>Tag</label><input type="text" id="f-tag" value="${escapeAttr(row.tag || 'TV')}"></div>
        <div class="field"><label>Descripción</label><textarea id="f-description">${escapeHtml(row.description || '')}</textarea></div>
        <div class="field"><label>URL</label><input type="text" id="f-url" value="${escapeAttr(row.url || '')}" placeholder="index2.html?j=JSON/productos.json"></div>
        <div class="field"><label>Activo</label><select id="f-active"><option value="1">Sí</option><option value="0">No</option></select></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" data-modal-cancel>Cancelar</button>
          <button type="button" class="btn btn-primary" data-modal-save>Guardar</button>
        </div>`;
      body.querySelector('#f-active').value = row.active === false ? '0' : '1';
      body.querySelector('[data-modal-save]').onclick = () => saveTV(mode, row.id);
    } else if (view === 'usuarios') {
      title.textContent = mode === 'create' ? 'Nuevo usuario' : 'Editar usuario';
      body.innerHTML = `
        <div class="field"><label>Usuario (username)</label><input type="text" id="f-username" value="${escapeAttr(row.username || '')}" required></div>
        <div class="field"><label>Nombre</label><input type="text" id="f-name" value="${escapeAttr(row.name || '')}"></div>
        <div class="field"><label>Contraseña</label><input type="password" id="f-password" placeholder="${mode === 'edit' ? 'Dejar en blanco para no cambiar' : ''}"></div>
        <div class="field"><label>Rol</label><select id="f-role"><option value="admin">admin</option><option value="editor">editor</option></select></div>
        <div class="field"><label>Activo</label><select id="f-active"><option value="1">Sí</option><option value="0">No</option></select></div>
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

  // Reasignar handlers de editar para que carguen datos
  function loadProductos(content) {
    api('/productos.php?action=list').then(({ data }) => {
      if (!data.categorias || data.categorias.length === 0) {
        content.innerHTML = '<div class="empty-state"><p>No hay productos. Agregá uno con + Nuevo.</p></div>';
        return;
      }
      let html = '';
      data.categorias.forEach(cat => {
        const items = cat.items || [];
        html += `<div class="categoria-block"><h3>${escapeHtml(cat.nombre)}</h3><div class="table-wrap items-table"><table><thead><tr><th>Nombre</th><th>Unidad</th><th>Precio</th><th>Estado</th><th></th></tr></thead><tbody>`;
        items.forEach(it => {
          html += `<tr>
            <td>${escapeHtml(it.nombre)}</td>
            <td>${escapeHtml(it.unidad)}</td>
            <td><code>${escapeHtml(String(it.precio))}</code></td>
            <td>${it.estado ? '<span class="badge success">Activo</span>' : '<span class="badge danger">Inactivo</span>'}</td>
            <td class="table-actions">
              <button type="button" class="btn btn-ghost btn-sm" data-edit-product="${escapeAttr(it.id)}" data-cat="${escapeAttr(cat.nombre)}">Editar</button>
              <button type="button" class="btn btn-danger btn-sm" data-delete-product="${escapeAttr(it.id)}">Eliminar</button>
            </td>
          </tr>`;
        });
        html += '</tbody></table></div></div>';
      });
      content.innerHTML = html;
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
      if (!data.categorias || data.categorias.length === 0) {
        content.innerHTML = '<div class="empty-state"><p>No hay ofertas.</p></div>';
        return;
      }
      let html = '';
      data.categorias.forEach(cat => {
        const items = cat.items || [];
        html += `<div class="categoria-block"><h3>${escapeHtml(cat.nombre)}</h3><div class="table-wrap items-table"><table><thead><tr><th>Nombre</th><th>Unidad</th><th>Precio</th><th>Imagen/Vídeo</th><th></th></tr></thead><tbody>`;
        items.forEach(it => {
          const media = (it.imagen1 || it.imagen2 || '-');
          html += `<tr>
            <td>${escapeHtml(it.nombre)}</td>
            <td>${escapeHtml(it.unidad)}</td>
            <td><code>${escapeHtml(String(it.precio))}</code></td>
            <td><span class="text-muted">${escapeHtml(String(media).slice(0, 35))}</span></td>
            <td class="table-actions">
              <button type="button" class="btn btn-ghost btn-sm" data-edit-oferta="${escapeAttr(it.id)}" data-cat="${escapeAttr(cat.nombre)}">Editar</button>
              <button type="button" class="btn btn-danger btn-sm" data-delete-oferta="${escapeAttr(it.id)}">Eliminar</button>
            </td>
          </tr>`;
        });
        html += '</tbody></table></div></div>';
      });
      content.innerHTML = html;
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
      let html = '<div class="table-wrap"><table><thead><tr><th>ID</th><th>Título</th><th>Descripción</th><th>Activo</th><th></th></tr></thead><tbody>';
      list.forEach(t => {
        html += `<tr>
          <td><code>${escapeHtml(t.id)}</code></td>
          <td>${escapeHtml(t.title)}</td>
          <td><span class="text-muted">${escapeHtml((t.description || '').slice(0, 45))}</span></td>
          <td>${t.active ? '<span class="badge success">Sí</span>' : '<span class="badge danger">No</span>'}</td>
          <td class="table-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-edit-tv="${escapeAttr(t.id)}">Editar</button>
            <button type="button" class="btn btn-danger btn-sm" data-delete-tv="${escapeAttr(t.id)}">Eliminar</button>
          </td>
        </tr>`;
      });
      html += '</tbody></table></div>';
      content.innerHTML = html;
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
      const list = Array.isArray(data) ? data : [];
      if (list.length === 0) {
        content.innerHTML = '<div class="empty-state"><p>No hay usuarios (solo Admin puede gestionarlos).</p></div>';
        return;
      }
      let html = '<div class="table-wrap"><table><thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Activo</th><th></th></tr></thead><tbody>';
      list.forEach(u => {
        html += `<tr>
          <td><code>${escapeHtml(u.username || u.usuario || '')}</code></td>
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

  $('#login-form').onsubmit = function (e) {
    e.preventDefault();
    const errEl = $('#login-error');
    errEl.hidden = true;
    const usuario = $('#login-usuario').value.trim();
    const password = $('#login-password').value;
    if (!usuario || !password) return;
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