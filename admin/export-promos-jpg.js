/**
 * Exporta slides de promociones como JPG (1080×1920) para estados de WhatsApp.
 * Depende de html2canvas + JSZip (CDN, carga bajo demanda).
 */
(function (global) {
  const WA_W = 1080;
  const WA_H = 1920;
  const JPG_QUALITY = 0.92;
  const PLACEHOLDER = '/IMG/Logo.png';

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function resolveUrl(path) {
    if (!path) return '';
    const p = String(path).trim();
    if (/^https?:\/\//i.test(p)) return p;
    if (p.startsWith('/')) return new URL(p, location.origin).href;
    return new URL('/' + p.replace(/^\.\//, ''), location.origin).href;
  }

  function isVideo(path) {
    return /\.(mp4|webm|mov|ogg)$/i.test(path || '');
  }

  function itemActivo(item) {
    if (!item || typeof item !== 'object') return true;
    if (!('estado' in item)) return true;
    return item.estado !== 0 && item.estado !== false && item.estado !== '0';
  }

  function normalizeMediaPath(value) {
    const v = (value || '').trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v) || v.startsWith('/')) return resolveUrl(v);
    return resolveUrl('/IMG/CORTES/' + v.replace(/^IMG\/CORTES\//i, ''));
  }

  function getValidMediaList(m1, m2) {
    const list = [];
    const a = normalizeMediaPath(m1);
    const b = normalizeMediaPath(m2);
    if (a) list.push(a);
    if (b) list.push(b);
    if (!list.length) list.push(resolveUrl(PLACEHOLDER));
    return list.slice(0, 2);
  }

  function safeFilename(name, id, prefix) {
    const base = String(name || 'oferta')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50) || `item-${id || '0'}`;
    return `${prefix}${base}.jpg`;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('No se pudo cargar ' + src));
      document.head.appendChild(s);
    });
  }

  async function ensureLibs() {
    await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
    if (!global.html2canvas || !global.JSZip) {
      throw new Error('Librerías de exportación no disponibles');
    }
  }

  function ensureHost() {
    let host = document.getElementById('promo-jpg-export-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'promo-jpg-export-host';
      document.body.appendChild(host);
    }
    if (!document.getElementById('promo-jpg-export-styles')) {
      const link = document.createElement('link');
      link.id = 'promo-jpg-export-styles';
      link.rel = 'stylesheet';
      link.href = 'export-promos-jpg.css?v=4';
      document.head.appendChild(link);
    }
    if (!document.getElementById('promo-export-montserrat')) {
      const font = document.createElement('link');
      font.id = 'promo-export-montserrat';
      font.rel = 'stylesheet';
      font.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700;800;900&display=swap';
      document.head.appendChild(font);
    }
    return host;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Imagen: ' + src));
      img.src = src;
    });
  }

  /**
   * Captura el último frame del video (como al terminar en la vidriera).
   * Primero intenta seek al final; si falla, reproduce hasta ended.
   */
  async function videoFrameToDataUrl(src, timeoutMs = 120000) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      let settled = false;
      /** @type {'idle'|'seek'|'play'|'done'} */
      let mode = 'idle';

      const finish = (ok, val) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { video.pause(); } catch (_) {}
        video.removeAttribute('src');
        video.load();
        ok ? resolve(val) : reject(val);
      };

      const timer = setTimeout(() => finish(false, new Error('timeout video')), timeoutMs);

      function captureFrame() {
        try {
          const w = video.videoWidth || 0;
          const h = video.videoHeight || 0;
          if (!w || !h) {
            finish(false, new Error('video sin dimensiones'));
            return;
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(video, 0, 0, w, h);
          finish(true, canvas.toDataURL('image/jpeg', 0.92));
        } catch (e) {
          finish(false, e);
        }
      }

      function captureAfterPaint() {
        requestAnimationFrame(() => requestAnimationFrame(captureFrame));
      }

      function trySeekToEnd() {
        const d = video.duration;
        if (!Number.isFinite(d) || d <= 0) {
          playToEnd();
          return;
        }
        mode = 'seek';
        const pad = Math.min(0.2, Math.max(0.05, d * 0.02));
        try {
          video.currentTime = Math.max(0, d - pad);
        } catch (_) {
          playToEnd();
        }
      }

      function playToEnd() {
        if (mode === 'done' || settled) return;
        mode = 'play';
        video.currentTime = 0;
        video.play().catch(() => finish(false, new Error('no se pudo reproducir el video')));
      }

      video.addEventListener('error', () => finish(false, new Error('video error')), { once: true });

      video.addEventListener('loadedmetadata', () => {
        trySeekToEnd();
      }, { once: true });

      video.addEventListener('seeked', () => {
        if (mode !== 'seek' || settled) return;
        const d = video.duration || 0;
        if (d > 0 && video.currentTime >= d * 0.85) {
          mode = 'done';
          captureAfterPaint();
        }
      });

      video.addEventListener('ended', () => {
        if (settled) return;
        mode = 'done';
        captureAfterPaint();
      }, { once: true });

      video.addEventListener('timeupdate', () => {
        if (mode !== 'play' || settled) return;
        const d = video.duration;
        if (d > 0 && video.currentTime >= d - 0.2) {
          mode = 'done';
          try { video.pause(); } catch (_) {}
          captureAfterPaint();
        }
      });

      video.src = src;
    });
  }

  async function mediaToDataUrl(src) {
    const url = resolveUrl(src);
    if (!url) return resolveUrl(PLACEHOLDER);
    if (!isVideo(url)) {
      try {
        const img = await loadImage(url);
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || 800;
        c.height = img.naturalHeight || 600;
        c.getContext('2d').drawImage(img, 0, 0);
        return c.toDataURL('image/jpeg', 0.9);
      } catch (_) {
        return resolveUrl(PLACEHOLDER);
      }
    }
    try {
      return await videoFrameToDataUrl(url);
    } catch (_) {
      return resolveUrl(PLACEHOLDER);
    }
  }

  function buildExportQueue(data) {
    const queue = [];
    queue.push({ type: 'whatsapp', filename: '00-pedidos-whatsapp.jpg' });
    queue.push({ type: 'efectivo10', filename: '01-descuento-10-efectivo.jpg' });

    const categorias = Array.isArray(data?.categorias) ? data.categorias : [];
    let idx = 2;
    categorias.forEach(cat => {
      (cat.items || []).forEach(item => {
        if (!itemActivo(item)) return;
        const name = (item.nombre || '').trim();
        const price = Number(item.precio);
        if (!name || !Number.isFinite(price)) return;
        const num = String(idx++).padStart(2, '0');
        queue.push({
          type: 'product',
          item,
          filename: `${num}-${safeFilename(name, item.id, '').replace(/\.jpg$/, '')}.jpg`,
        });
      });
    });
    return queue;
  }

  function createSlideElement(entry) {
    const wrap = document.createElement('div');
    wrap.className = 'promo-capture';

    if (entry.type === 'whatsapp') {
      wrap.innerHTML = `
        <div class="intermediate active">
          <img class="logo" src="/IMG/Logo.png" alt="Logo">
          <div class="headline">PEDIDOS POR WHATSAPP</div>
          <div class="copy">Escaneá el QR y hacé tu pedido en segundos.<br>Te respondemos a la brevedad.</div>
          <div class="qrCenter">
            <div class="qrCard"><img src="/IMG/qrcode.jpg" alt="QR"></div>
            <div class="chip">📲 WHATSAPP</div>
          </div>
        </div>`;
      return wrap;
    }

    if (entry.type === 'efectivo10') {
      wrap.innerHTML = `
        <div class="intermediate intermediate-poster active">
          <img class="poster-full" src="/IMG/promo-descuento-efectivo-10.png" alt="10% efectivo">
        </div>`;
      return wrap;
    }

    const item = entry.item;
    const name = escapeHtml(item.nombre);
    const price = Number(item.precio);
    const medias = entry._medias || getValidMediaList(item.imagen1, item.imagen2);
    const slide = document.createElement('div');
    slide.className = 'slide active';
    slide.innerHTML = `
      <div class="header"><img class="header-logo" src="/IMG/Logo.png" alt="Logo"></div>
      <div class="stage">
        <div class="mediaWrap ${medias.length === 1 ? 'one' : 'two'}"></div>
        <div class="overlay">
          <div class="name">${name}</div>
          <div class="price">
            <span class="currency">$</span>
            <span class="amount">${price.toLocaleString('es-AR')}</span>
          </div>
        </div>
      </div>`;
    const mediaWrap = slide.querySelector('.mediaWrap');
    medias.forEach((src, i) => {
      const img = document.createElement('img');
      img.className = 'media';
      img.src = src;
      img.alt = '';
      if (medias.length === 1) img.classList.add('slot', 'slot-single');
      else img.classList.add('slot', i === 0 ? 'slot-top' : 'slot-bottom');
      mediaWrap.appendChild(img);
    });
    wrap.appendChild(slide);
    return wrap;
  }

  /**
   * html2canvas no respeta bien object-fit; fijamos tamaño y centramos en la zona media.
   */
  function layoutMediaForCapture(root) {
    const stage = root.querySelector('.stage');
    if (!stage) return;
    const stageW = stage.clientWidth || 984;
    const stageH = stage.clientHeight || 1520;
    const overlayReserve = 248;
    const padX = 56;
    const mediaZoneH = stageH - overlayReserve;
    const mediaZoneW = stageW - padX;

    root.querySelectorAll('.mediaWrap').forEach(wrap => {
      const isOne = wrap.classList.contains('one');
      const wrapRect = wrap.getBoundingClientRect();
      const zoneW = wrapRect.width > 0 ? wrapRect.width - 40 : mediaZoneW;
      const zoneH = wrapRect.height > 0 ? wrapRect.height - 40 : mediaZoneH;

      wrap.querySelectorAll('img.media').forEach(img => {
        const nw = img.naturalWidth || 1;
        const nh = img.naturalHeight || 1;
        let boxW = zoneW;
        let boxH = zoneH;
        let topPct = '50%';
        let leftPct = '50%';
        let translate = 'translate(-50%, -50%)';

        if (!isOne) {
          img.style.position = 'absolute';
          img.style.margin = '0';
          if (img.classList.contains('slot-top')) {
            boxW = Math.min(700, zoneW);
            boxH = Math.round(zoneH * 0.44);
            topPct = '26%';
            translate = 'translate(-50%, -50%)';
          } else {
            boxW = Math.min(660, zoneW);
            boxH = Math.round(zoneH * 0.38);
            topPct = '72%';
            translate = 'translate(-50%, -50%)';
          }
        } else {
          img.style.position = 'relative';
          img.style.top = '';
          img.style.left = '';
          img.style.transform = '';
          img.style.margin = 'auto';
        }

        const scale = Math.min(boxW / nw, boxH / nh);
        const w = Math.max(1, Math.round(nw * scale));
        const h = Math.max(1, Math.round(nh * scale));
        img.style.width = `${w}px`;
        img.style.height = `${h}px`;
        img.style.maxWidth = 'none';
        img.style.maxHeight = 'none';
        img.style.objectFit = 'fill';

        if (!isOne) {
          img.style.left = leftPct;
          img.style.top = topPct;
          img.style.transform = translate;
        }
      });
    });
  }

  async function prepareEntryMedia(entry) {
    if (entry.type === 'product') {
      const raw = getValidMediaList(entry.item.imagen1, entry.item.imagen2);
      const resolved = [];
      for (const src of raw) {
        resolved.push(await mediaToDataUrl(src));
      }
      entry._medias = resolved;
    }
  }

  async function captureEntry(host, entry) {
    host.innerHTML = '';
    const el = createSlideElement(entry);
    host.appendChild(el);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const imgs = el.querySelectorAll('img');
    await Promise.all(Array.from(imgs).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(res => {
        img.onload = res;
        img.onerror = res;
      });
    }));
    layoutMediaForCapture(el);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const canvas = await html2canvas(el, {
      width: WA_W,
      height: WA_H,
      scale: 1,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#070707',
      logging: false,
    });
    return canvas.toDataURL('image/jpeg', JPG_QUALITY);
  }

  function dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const bin = atob(parts[1]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  /**
   * @param {object} ofertasData - mismo JSON que ofertas.php list
   * @param {{ onProgress?: (current: number, total: number, label: string) => void }} hooks
   */
  async function run(ofertasData, hooks = {}) {
    await ensureLibs();
    const queue = buildExportQueue(ofertasData);
    if (queue.length <= 2) {
      throw new Error('No hay ofertas activas para exportar');
    }
    const host = ensureHost();
    const zip = new JSZip();
    const total = queue.length;

    for (let i = 0; i < queue.length; i++) {
      const entry = queue[i];
      const label = entry.type === 'product'
        ? (entry.item?.nombre || entry.filename)
        : entry.type;
      if (hooks.onProgress) hooks.onProgress(i + 1, total, label);
      if (entry.type === 'product') await prepareEntryMedia(entry);
      const dataUrl = await captureEntry(host, entry);
      zip.file(entry.filename, dataUrlToBlob(dataUrl));
    }

    host.innerHTML = '';
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `promociones-whatsapp-${stamp}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
    return { count: total };
  }

  global.exportPromosJpg = { run, WA_W, WA_H };
})(window);
