const SLIDE_MS = 13000;
const INTRO_MS = 7000;
const PLACEHOLDER_IMG = '/IMG/CORTES/placeholder.png';

let slides = [];
let current = 0;
let timer = null;

fetch('/JSON/ofertas.json')
  .then(r => r.json())
  .then(init)
  .catch(err => console.error('[PROMOS] Error cargando JSON:', err));

function init(data) {
  const root = document.getElementById('carousel');
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
      const slide = createProductSlide(item);
      if (slide) productSlides.push(slide);
    });

    // 10% efectivo: posición aleatoria entre productos (no al cambio de categoría)
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
    <div class="header">
      <img class="header-logo" src="/IMG/Logo.png" alt="Logo">
    </div>
    <div class="stage">
      <div class="mediaWrap ${medias.length === 1 ? 'one' : 'two'}"></div>
      <div class="overlay">
        <div class="name">${escapeHtml(name)}</div>
        <div class="price">
          <span class="currency">$</span>
          <span class="amount">${price.toLocaleString('es-AR')}</span>
        </div>
      </div>
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
    <div class="headline">PEDIDOS POR WHATSAPP</div>
    <div class="copy">
      Escaneá el QR y hacé tu pedido en segundos.<br>
      Te respondemos a la brevedad.
    </div>
    <div class="qrCenter">
      <div class="qrCard">
        <img src="/IMG/qrcode.jpg" alt="QR WhatsApp">
      </div>
      <div class="chip">📲 WHATSAPP</div>
    </div>
  `;
  return intro;
}

/** Slide intermedio: 10% descuento pagos en efectivo (gráfica fija). */
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
  if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('/')) return v;
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
    v.loop = false;         // ✅ para panel TV
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

  const vids = slides[index].querySelectorAll('video');
  vids.forEach(v => {
    try { v.play().catch(() => {}); } catch(_) {}
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
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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
document.addEventListener('click', requestFullscreenSafe, { once: true });
document.addEventListener('touchstart', requestFullscreenSafe, { once: true });
document.addEventListener('keydown', requestFullscreenSafe, { once: true });
