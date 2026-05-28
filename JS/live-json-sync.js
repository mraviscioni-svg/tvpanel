/**
 * Polling de JSON en pantallas TV: detecta cambios en el campo "updated".
 * TvRefreshUI: overlay de carga mientras se actualiza la grilla.
 */
(function (global) {
  const DEFAULT_SEC = 30;

  function getPollIntervalMs() {
    try {
      const n = parseInt(new URL(location.href).searchParams.get('poll') ?? String(DEFAULT_SEC), 10);
      const sec = Number.isFinite(n) ? n : DEFAULT_SEC;
      return Math.max(10, Math.min(300, sec)) * 1000;
    } catch (_) {
      return DEFAULT_SEC * 1000;
    }
  }

  /** Ruta absoluta al JSON (soporta JSON/productos.json relativo). */
  function resolveJsonUrl(path) {
    const raw = (path || 'JSON/productos.json').trim();
    if (/^https?:\/\//i.test(raw)) return raw;
    const rel = raw.startsWith('/') ? raw : '/' + raw.replace(/^\.\//, '');
    return new URL(rel, location.origin).href;
  }

  function stampFromJson(j) {
    if (!j || typeof j !== 'object') return '';
    return String(j.updated || '');
  }

  const JSON_FETCH_OPTS = { cache: 'no-store', credentials: 'same-origin' };
  const JSON_HEAD_OPTS = { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' };

  async function fetchJson(path) {
    const url = resolveJsonUrl(path);
    const res = await fetch(url, JSON_FETCH_OPTS);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  /** Probe liviano para evitar bajar JSON completo en cada tick. */
  async function fetchProbeStamp(path) {
    const url = resolveJsonUrl(path);
    const res = await fetch(url, JSON_HEAD_OPTS);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const etag = res.headers.get('etag') || '';
    const lm = res.headers.get('last-modified') || '';
    const len = res.headers.get('content-length') || '';
    const token = [etag, lm, len].filter(Boolean).join('|');
    return token || '';
  }

  /** Calienta caché del JSON (solo fetch; sin link preload para evitar mismatch de credentials). */
  function preloadJson(path) {
    const url = resolveJsonUrl(path);
    try {
      if ('fetch' in global) fetch(url, JSON_FETCH_OPTS).catch(() => {});
    } catch (_) {}
  }

  const TvRefreshUI = {
    _el: null,
    _msgEl: null,
    _count: 0,

    ensure() {
      if (this._el) return this._el;
      let el = document.getElementById('tv-data-refresh');
      if (!el) {
        el = document.createElement('div');
        el.id = 'tv-data-refresh';
        el.className = 'tv-data-refresh';
        el.setAttribute('aria-live', 'polite');
        el.innerHTML = `
          <div class="tv-data-refresh-card">
            <div class="tv-data-refresh-spinner" aria-hidden="true"></div>
            <p class="tv-data-refresh-msg">Cargando precios…</p>
          </div>`;
        document.body.appendChild(el);
      }
      this._el = el;
      this._msgEl = el.querySelector('.tv-data-refresh-msg');
      return el;
    },

    show(message) {
      this.ensure();
      if (this._msgEl && message) this._msgEl.textContent = message;
      const wasVisible = this._el.classList.contains('is-visible');
      if (!wasVisible) {
        this._count++;
        this._el.classList.add('is-visible');
      }
    },

    hide() {
      if (!this._el) return;
      this._count = Math.max(0, this._count - 1);
      if (this._count === 0) this._el.classList.remove('is-visible');
    },
  };

  /**
   * @param {{
   *   path: string,
   *   intervalMs?: number,
   *   initialStamp?: string,
   *   onUpdate: (data: object) => void | Promise<void>,
   *   onRefreshStart?: () => void,
   *   onRefreshEnd?: () => void,
   * }} opts
   */
  function start(opts) {
    const path = opts.path;
    const intervalMs = opts.intervalMs ?? getPollIntervalMs();
    let lastStamp = opts.initialStamp ?? '';
    let lastProbeStamp = '';
    let first = true;
    let busy = false;
    let probeFailed = false;

    async function tick() {
      if (busy) return;
      busy = true;
      try {
        if (!first && !probeFailed) {
          try {
            const probeStamp = await fetchProbeStamp(path);
            if (probeStamp && probeStamp === lastProbeStamp) return;
            if (probeStamp) lastProbeStamp = probeStamp;
          } catch (_) {
            probeFailed = true;
          }
        }

        const data = await fetchJson(path);
        const stamp = stampFromJson(data);
        if (!first && stamp && stamp === lastStamp) return;
        first = false;
        if (stamp) lastStamp = stamp;
        probeFailed = false;

        if (opts.onRefreshStart) opts.onRefreshStart();
        try {
          const result = opts.onUpdate(data);
          if (result && typeof result.then === 'function') await result;
        } finally {
          if (opts.onRefreshEnd) opts.onRefreshEnd();
        }
      } catch (e) {
        console.warn('[LiveJsonSync]', path, e);
        if (opts.onRefreshEnd) opts.onRefreshEnd();
      } finally {
        busy = false;
      }
    }

    tick();
    return setInterval(tick, intervalMs);
  }

  global.LiveJsonSync = {
    start,
    fetchJson,
    preloadJson,
    resolveJsonUrl,
    stampFromJson,
    getPollIntervalMs,
    TvRefreshUI,
    DEFAULT_SEC,
  };
})(window);
