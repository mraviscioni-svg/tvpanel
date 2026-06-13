const SLIDE_MS = 13000;
const INTRO_MS = 7000;
const PLACEHOLDER_IMG = '/IMG/Logo.png';
const PRELOAD_MEDIA_MAX_MS = 18000;
const PRELOAD_BATCH_SIZE = 5;
const PROMOS_JSON = '/JSON/ofertas.json';
const FIXTURES_API = '/backend/mundial-fixtures.php';
const FIXTURES_POLL_MS = 10 * 60 * 1000;
const REFRESH_MIN_MS = 450;

let slides = [];
let current = 0;
let timer = null;
let promosPollTimer = null;
let fixturesPollTimer = null;
let countdownTimer = null;
let promosJsonPath = PROMOS_JSON;
let nextArgentinaKickoff = null;
let nextArgentinaLive = false;

function promosRefreshUi() {
  return window.LiveJsonSync && window.LiveJsonSync.TvRefreshUI
    ? window.LiveJsonSync.TvRefreshUI
    : null;
}

function yieldToPaint() {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function itemActivoEnPromo(item) {
  if (!item || typeof item !== 'object') return true;
  if (!('estado' in item)) return true;
  return item.estado !== 0 && item.estado !== false && item.estado !== '0';
}

function resolveAssetUrl(src) {
  const u = String(src || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  try {
    const path = u.startsWith('/') ? u : '/' + u.replace(/^\.\//, '');
    return new URL(path, location.origin).href;
  } catch (_) {
    return u;
  }
}

function collectPromoMediaUrls(data) {
  const urls = new Set([
    '/IMG/Logo.png',
    '/IMG/qrcode.jpg',
    '/IMG/promo-descuento-efectivo-10.png',
    PLACEHOLDER_IMG,
  ]);
  const categorias = Array.isArray(data?.categorias) ? data.categorias : [];
  categorias.forEach(cat => {
    (Array.isArray(cat?.items) ? cat.items : []).forEach(item => {
      if (!itemActivoEnPromo(item)) return;
      getValidMediaList(item?.imagen1, item?.imagen2).forEach(u => urls.add(u));
    });
  });
  return Array.from(urls);
}

function preloadImageUrl(src) {
  const url = resolveAssetUrl(src);
  if (!url) return Promise.resolve();
  return new Promise(resolve => {
    const img = new Image();
    const finish = () => {
      if (img.decode) img.decode().then(resolve).catch(resolve);
      else resolve();
    };
    img.onload = finish;
    img.onerror = resolve;
    img.src = url;
  });
}

async function preloadPromoMedia(urls, onProgress) {
  const list = Array.from(new Set((urls || []).map(resolveAssetUrl).filter(Boolean)))
    .filter(src => !isVideo(src));
  const total = list.length;
  let loaded = 0;
  const tick = () => {
    loaded += 1;
    if (typeof onProgress === 'function') onProgress(loaded, total);
  };
  if (!total) return;
  const work = (async () => {
    for (let i = 0; i < list.length; i += PRELOAD_BATCH_SIZE) {
      const batch = list.slice(i, i + PRELOAD_BATCH_SIZE);
      await Promise.all(batch.map(src => preloadImageUrl(src).finally(tick)));
      await yieldToPaint();
    }
  })();
  const cap = new Promise(resolve => setTimeout(resolve, PRELOAD_MEDIA_MAX_MS));
  await Promise.race([work, cap]);
}

async function applyPromosUpdate(data, opts = {}) {
  const ui = promosRefreshUi();
  const showOverlay = !opts.silent && ui;
  const started = Date.now();
  if (showOverlay) ui.show(opts.message || 'Actualizando promociones…');
  try {
    if (timer) clearTimeout(timer);
    await yieldToPaint();
    const mediaUrls = collectPromoMediaUrls(data);
    if (mediaUrls.length) {
      if (showOverlay) {
        ui.show('Preparando promociones…');
        await preloadPromoMedia(mediaUrls, (n, total) => {
          if (total <= PRELOAD_BATCH_SIZE) return;
          if (n % PRELOAD_BATCH_SIZE === 0 || n === total) {
            ui.show(`Cargando recursos ${n}/${total}…`);
          }
        });
      } else {
        await preloadPromoMedia(mediaUrls);
      }
    }
    init(data);
    await yieldToPaint();
  } finally {
    if (showOverlay) {
      const wait = Math.max(0, REFRESH_MIN_MS - (Date.now() - started));
      if (wait) await new Promise(r => setTimeout(r, wait));
      ui.hide();
    }
  }
}

function init(data) {
  const root = document.getElementById('carousel');
  if (!root) return;
  root.innerHTML = '';
  slides = [];
  current = 0;

  const categorias = Array.isArray(data?.categorias) ? data.categorias : [];
  if (!categorias.length) return;

  const blocks = [];

  categorias.forEach(cat => {
    blocks.push(createIntermediateWhatsApp());

    const productSlides = [];
    const items = Array.isArray(cat?.items) ? cat.items : [];
    items.forEach(item => {
      if (!itemActivoEnPromo(item)) return;
      const slide = createProductSlide(item);
      if (slide) productSlides.push(slide);
    });

    if (productSlides.length > 0) {
      const insertAt = Math.floor(Math.random() * (productSlides.length + 1));
      productSlides.splice(insertAt, 0, createIntermediateEfectivo10());
    }

    blocks.push(...productSlides);
  });

  blocks.forEach(el => {
    root.appendChild(el);
    slides.push(el);
  });

  if (!slides.length) return;

  showSlide(0);
  scheduleNext();
}

function createProductSlide(item) {
  const name = (item?.nombre || '').trim();
  const price = Number(item?.precio);
  if (!name || !Number.isFinite(price)) return null;

  const medias = getValidMediaList(item?.imagen1, item?.imagen2);
  const slide = document.createElement('div');
  slide.className = 'slide';
  slide.dataset.duration = String(SLIDE_MS);
  slide.innerHTML = `
    <div class="mediaWrap ${medias.length === 1 ? 'one' : 'two'}"></div>
    <div class="promo-overlay">
      <div class="promo-name">${escapeHtml(name)}</div>
      <div class="promo-price"><span class="cur">$</span><span class="amt">${price.toLocaleString('es-AR')}</span></div>
    </div>
  `;
  renderMedia(slide.querySelector('.mediaWrap'), medias);
  return slide;
}

function createIntermediateWhatsApp() {
  const intro = document.createElement('div');
  intro.className = 'intermediate';
  intro.dataset.duration = String(INTRO_MS);
  intro.innerHTML = `
    <img class="logo" src="/IMG/Logo.png" alt="Logo Carnicería">
    <div class="headline">Pedidos por WhatsApp</div>
    <div class="copy">
      Escaneá el QR y hacé tu pedido en segundos.<br>
      Te respondemos a la brevedad.
    </div>
    <div class="qrCenter">
      <div class="qrCard">
        <img src="/IMG/qrcode.jpg" alt="QR WhatsApp">
      </div>
      <div class="chip">📲 WhatsApp</div>
    </div>
  `;
  return intro;
}

function createIntermediateEfectivo10() {
  const intro = document.createElement('div');
  intro.className = 'intermediate intermediate-poster';
  intro.dataset.duration = String(INTRO_MS);
  intro.innerHTML = `
    <img
      class="poster-full"
      src="/IMG/promo-descuento-efectivo-10.png"
      alt="10% de descuento para pagos en efectivo en todas las ofertas"
    >
  `;
  return intro;
}

function getValidMediaList(m1, m2) {
  const list = [];
  const a = normalizeMediaPath(m1);
  const b = normalizeMediaPath(m2);
  if (a) list.push(a);
  if (b) list.push(b);
  if (!list.length) list.push(PLACEHOLDER_IMG);
  return list.slice(0, 2);
}

function normalizeMediaPath(value) {
  const v = (value || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith('/')) return v;
  if (v.includes('/')) return '/' + v.replace(/^\/+/, '');
  return `/IMG/CORTES/${v}`;
}

function isVideo(path) {
  const p = (path || '').toLowerCase();
  return p.endsWith('.mp4') || p.endsWith('.webm') || p.endsWith('.ogg') || p.endsWith('.mov');
}

function createMediaElement(src) {
  if (isVideo(src)) {
    const v = document.createElement('video');
    v.src = src;
    v.autoplay = true;
    v.loop = false;
    v.muted = true;
    v.playsInline = true;
    v.preload = 'metadata';
    v.className = 'media media-video';
    v.addEventListener('error', () => {
      const img = document.createElement('img');
      img.src = PLACEHOLDER_IMG;
      img.className = 'media media-img';
      v.replaceWith(img);
    }, { once: true });
    return v;
  }

  const img = document.createElement('img');
  img.src = src || PLACEHOLDER_IMG;
  img.className = 'media media-img';
  img.addEventListener('error', () => {
    img.src = PLACEHOLDER_IMG;
  }, { once: true });
  return img;
}

function renderMedia(container, medias) {
  container.innerHTML = '';
  if (medias.length === 1) {
    const el = createMediaElement(medias[0]);
    el.classList.add('slot', 'slot-single');
    container.appendChild(el);
    return;
  }
  const top = createMediaElement(medias[0]);
  top.classList.add('slot', 'slot-top');
  const bottom = createMediaElement(medias[1]);
  bottom.classList.add('slot', 'slot-bottom');
  container.appendChild(top);
  container.appendChild(bottom);
}

function showSlide(index) {
  slides.forEach(s => s.classList.remove('active'));
  slides[index].classList.add('active');
  slides[index].querySelectorAll('video').forEach(v => {
    try { v.play().catch(() => {}); } catch (_) {}
  });
}

function scheduleNext() {
  if (timer) clearTimeout(timer);
  const dur = Number(slides[current]?.dataset?.duration || SLIDE_MS);
  timer = setTimeout(() => {
    current = (current + 1) % slides.length;
    showSlide(current);
    scheduleNext();
  }, dur);
}

function escapeHtml(str) {
  const s = String(str);
  return s
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;')
    .split("'").join('&#039;');
}

/* ===== Partidos Mundial ===== */

function renderFixtureChip(g) {
  const liveCls = g.live ? ' live' : '';
  const group = g.groupLabel ? `<span class="group">${escapeHtml(g.groupLabel)}</span>` : '';
  return `<span class="fixture-chip${liveCls}"><span class="time">${escapeHtml(g.timeLabel)}</span><span class="teams">${escapeHtml(g.teamsLabel)}</span>${group}</span>`;
}

function renderFixtures(data) {
  const track = document.getElementById('fixtures-track');
  const modeLabel = document.getElementById('ticker-mode-label');
  const dateEl = document.getElementById('today-date');
  if (!track) return;

  if (dateEl) dateEl.textContent = data.todayLabelShort || '—';
  if (modeLabel) {
    modeLabel.textContent = data.tickerMode === 'today' ? 'Hoy' : 'Próximos';
  }

  const list = Array.isArray(data.ticker) ? data.ticker : [];
  if (!list.length) {
    track.classList.add('is-static');
    track.innerHTML = '<span class="fixture-chip">Sin partidos programados</span>';
    return;
  }

  const html = list.map(renderFixtureChip).join('');
  if (list.length <= 2) {
    track.classList.add('is-static');
    track.innerHTML = html;
  } else {
    track.classList.remove('is-static');
    track.innerHTML = html + html;
  }
}

function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

function updateCountdownDisplay() {
  const el = document.getElementById('match-countdown');
  if (!el) return;

  if (nextArgentinaLive) {
    el.textContent = 'EN JUEGO';
    el.classList.add('is-live');
    return;
  }

  el.classList.remove('is-live');
  if (!nextArgentinaKickoff) {
    el.textContent = '—';
    return;
  }

  const diff = nextArgentinaKickoff - Date.now();
  if (diff <= 0) {
    el.textContent = '00:00:00';
    return;
  }
  el.textContent = formatCountdown(diff);
}

function renderNextArgentina(next) {
  const teamsEl = document.getElementById('match-teams');
  const metaEl = document.getElementById('match-meta');
  const titleEl = document.getElementById('match-title');
  if (!teamsEl || !metaEl) return;

  if (!next) {
    if (titleEl) titleEl.textContent = 'Próximo · Argentina';
    teamsEl.textContent = 'Sin partidos programados';
    metaEl.textContent = 'Mundial 2026';
    nextArgentinaKickoff = null;
    nextArgentinaLive = false;
    updateCountdownDisplay();
    return;
  }

  const home = next.home || {};
  const away = next.away || {};
  if (titleEl) {
    titleEl.textContent = next.live ? 'Argentina · En juego' : 'Próximo · Argentina';
  }
  teamsEl.innerHTML = `${home.flag || ''} ${escapeHtml(home.code || '')} <span class="vs">vs</span> ${away.flag || ''} ${escapeHtml(away.code || '')}`;
  const parts = [];
  if (next.groupLabel) parts.push(next.groupLabel);
  parts.push(`${next.dateLabel || ''} · ${next.timeLabel || ''} hs`);
  metaEl.textContent = parts.filter(Boolean).join(' · ');

  nextArgentinaLive = !!next.live;
  nextArgentinaKickoff = next.kickoffIso ? new Date(next.kickoffIso).getTime() : null;
  updateCountdownDisplay();
}

function startCountdownTicker() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(updateCountdownDisplay, 1000);
}

async function loadMundialFixtures() {
  try {
    const r = await fetch(FIXTURES_API, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || 'API error');
    renderFixtures(data);
    renderNextArgentina(data.nextArgentina);
  } catch (err) {
    console.error('[MUNDIAL] Error cargando partidos:', err);
    const track = document.getElementById('fixtures-track');
    if (track && track.querySelector('.fixture-loading')) {
      track.classList.add('is-static');
      track.innerHTML = '<span class="fixture-chip">Partidos no disponibles</span>';
    }
  }
}

function startFixturesPolling() {
  loadMundialFixtures();
  startCountdownTicker();
  if (fixturesPollTimer) clearInterval(fixturesPollTimer);
  fixturesPollTimer = setInterval(loadMundialFixtures, FIXTURES_POLL_MS);
}

async function bootPromocionesMundial() {
  promosJsonPath = window.LiveJsonSync
    ? window.LiveJsonSync.resolveJsonUrl(PROMOS_JSON)
    : PROMOS_JSON;

  if (window.LiveJsonSync && window.LiveJsonSync.preloadJson) {
    window.LiveJsonSync.preloadJson(promosJsonPath);
  }

  startFixturesPolling();

  const ui = promosRefreshUi();
  let data;
  try {
    if (window.LiveJsonSync && window.LiveJsonSync.fetchJson) {
      data = await window.LiveJsonSync.fetchJson(promosJsonPath);
    } else {
      const r = await fetch(promosJsonPath, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      data = await r.json();
    }
    await applyPromosUpdate(data, { silent: false, message: 'Cargando promociones…' });
  } catch (err) {
    console.error('[PROMOS-MUNDIAL] Error cargando JSON:', err);
  } finally {
    if (ui) ui.hide();
  }

  if (!window.LiveJsonSync || !data) return;

  if (promosPollTimer) clearInterval(promosPollTimer);
  promosPollTimer = window.LiveJsonSync.start({
    path: promosJsonPath,
    intervalMs: window.LiveJsonSync.getPollIntervalMs(),
    initialStamp: window.LiveJsonSync.stampFromJson(data),
    onUpdate: (fresh) => applyPromosUpdate(fresh, { silent: true }),
  });
}

function requestFullscreenSafe() {
  try {
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (!fn) return;
    const res = fn.call(el);
    if (res && typeof res.catch === 'function') res.catch(() => {});
  } catch (_) {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootPromocionesMundial());
} else {
  bootPromocionesMundial();
}

document.addEventListener('click', requestFullscreenSafe, { once: true });
document.addEventListener('touchstart', requestFullscreenSafe, { once: true });
document.addEventListener('keydown', requestFullscreenSafe, { once: true });
