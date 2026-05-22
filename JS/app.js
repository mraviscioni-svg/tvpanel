/* =========================
   Helpers de URL / QS
   ========================= */
function qsParamInt(name, def){
  const u = new URL(window.location.href);
  const v = parseInt(u.searchParams.get(name) ?? def, 10);
  return Number.isFinite(v) ? v : def;
}
function qsParamStr(name, def=""){
  const u = new URL(window.location.href);
  const v = (u.searchParams.get(name) || "").trim();
  return v || def;
}

/* =========================
   Clock
   ========================= */
function updateClock(){
  const el = document.getElementById("clock"); if(!el) return;
  const DAYS=["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
  const MONTHS=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const now=new Date(); const dow=DAYS[now.getDay()], d=now.getDate(), month=MONTHS[now.getMonth()];
  let h=now.getHours(), ampm=h>=12?"PM":"AM"; h=h%12; if(h===0)h=12; const m=String(now.getMinutes()).padStart(2,'0');
  el.querySelector('.clock-date').textContent=`${dow} ${d} de ${month}`;
  el.querySelector('.clock-time .hm').textContent=`${String(h).padStart(2,'0')}:${m}`;
  el.querySelector('.clock-time .ampm').textContent=ampm;
}
setInterval(updateClock, 1000); updateClock();

/* =========================
   Formatters
   ========================= */
function unitFromDesc(desc){
  
  if(!desc) return "";
  return desc.replace(/[()]/g,'').trim();
 /*
  const d=String(desc).toLowerCase();
  if(d.includes('kg'))return'kg';
  if(d.includes('unidad'))return'unidad';
  if(d.includes('docena'))return'docena';
  return desc.replace(/[()]/g,'').trim();
*/
}
function formatARS(n){
  try{return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);}
  catch{return "$ "+(n?.toLocaleString('es-AR')??n);}
}

/* =========================
   Load & normalize productos
   ========================= */
async function loadData(jsonPath){
  try{
    const res = await fetch(jsonPath, {cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const j = await res.json();
    return normalizeJson(j);
  }catch(e){
    console.error("No se pudo cargar JSON de productos:", e);
    return {ORDER:[], data:[]};
  }
}
function itemActivoEnCartelera(it) {
  if (!it || typeof it !== 'object') return true;
  if (!('estado' in it)) return true;
  return it.estado !== 0 && it.estado !== false && it.estado !== '0';
}

function normalizeJson(j){
  // {categorias:[{nombre,items:[{nombre,unidad/precio/promo}]}]}
  if(Array.isArray(j.categorias)){
    const ORDER = j.categorias.map(c=>c.nombre);
    const data = j.categorias.map(c=>({
      categoria: c.nombre,
      items: (c.items||[]).filter(itemActivoEnCartelera).map(it=>({
        nombre: it.nombre,
        desc: it.unidad ? `(${it.unidad})` : (it.desc||""),
        precio: it.precio,
        promo: !!it.promo
      }))
    }));
    return { ORDER, data };
  }
  // {ORDER:[...], data:[...]}
  if(Array.isArray(j.ORDER) && Array.isArray(j.data)) return { ORDER: j.ORDER, data: j.data };
  return { ORDER:[], data:[] };
}

/* =========================
   Helpers productos
   ========================= */
function sortByOrder(data, ORDER){
  const idx=n=>ORDER.indexOf(n)===-1?999:ORDER.indexOf(n);
  return [...data].sort((a,b)=> idx(a.categoria)-idx(b.categoria));
}
function flattenItems(ordered){
  const out=[];
  ordered.forEach(cat=>{ (cat.items||[]).forEach(it=> out.push({...it, categoria:cat.categoria})); });
  return out;
}

/* =========================
   DOM nodes productos
   ========================= */
function createItemNode(it){
  const row=document.createElement('div'); row.className='item';
  const name=document.createElement('div'); name.className='item-name'; name.textContent=it.nombre;
  if(it.promo){const b=document.createElement('span'); b.className='badge-offer'; b.textContent='OFERTA'; name.appendChild(b)}
  const priceWrap=document.createElement('div'); priceWrap.className='price-wrap';
  const price=document.createElement('div'); price.className='item-price'; price.textContent=formatARS(it.precio);
  priceWrap.appendChild(price);
  const u=unitFromDesc(it.desc); if(u){const unit=document.createElement('div'); unit.className='item-unit'; unit.textContent=u; priceWrap.appendChild(unit)}
  row.appendChild(name); row.appendChild(priceWrap);
  return row;
}

/* =========================
   Column builder / render
   ========================= */
function buildColumns(slice, cols, productsPerColumn){
  const columns = Array.from({length: cols}, ()=>[]);
  const capacity = cols * productsPerColumn;
  const take = Math.min(slice.length, capacity);
  const effective = slice.slice(0, take);

  let lastCatPrevCol = null;
  for(let c=0; c<cols; c++){
    const start = c * productsPerColumn;
    const end   = Math.min(start + productsPerColumn, effective.length);
    const chunk = effective.slice(start, end);
    if(chunk.length === 0) continue;

    let colBlocks = [];
    let lastCat = null;

    chunk.forEach((item, idx) => {
      const cat = item.categoria;
      const isFirstInColumn = (idx === 0);
      const continuingFromPrevColumn = isFirstInColumn && lastCatPrevCol === cat;
      const mustShowTitle = (!continuingFromPrevColumn) && (isFirstInColumn || cat !== lastCat);

      if(mustShowTitle){
        const wrap = document.createElement('div'); wrap.className='category';
        const title = document.createElement('div'); title.className='category-title'; title.textContent=cat;
        const list = document.createElement('div'); list.className='items-list';
        list.appendChild(createItemNode(item));
        wrap.appendChild(title); wrap.appendChild(list);
        colBlocks.push(wrap);
      }else{
        let lastBlock = colBlocks[colBlocks.length-1];
        if(!lastBlock){
          lastBlock = document.createElement('div'); lastBlock.className='category';
          const list = document.createElement('div'); list.className='items-list';
          lastBlock.appendChild(list);
          colBlocks.push(lastBlock);
        }
        const list = lastBlock.querySelector('.items-list');
        list.appendChild(createItemNode(item));
      }

      lastCat = cat;
      if(idx === chunk.length - 1){ lastCatPrevCol = lastCat; }
    });

    columns[c] = colBlocks;
  }
  return columns;
}
function renderColumns(columns){
  const wrap = document.getElementById("columns");
  wrap.innerHTML = "";
  columns.forEach(blocks=>{
    const col = document.createElement('div'); col.className='col';
    blocks.forEach(b => col.appendChild(b));
    wrap.appendChild(col);
  });
}

/* =========================
   Fit a altura
   ========================= */
function fitMenuToHeight(){
  const body=document.getElementById("menuBody");
  const inner=document.getElementById("menuInner");
  if(!body||!inner) return;
  inner.style.transform="scale(1)";
  inner.style.width="100%";
  const SAFE=8, MIN=.55;
  const contentH = inner.scrollHeight;
  const availH   = body.clientHeight - SAFE;
  let s = Math.min(1, availH / contentH);
  s = Math.max(MIN, s);
  inner.style.transform = `translateZ(0) scale(${s})`;
  inner.style.width = s < 1 ? `${(100/s).toFixed(3)}%` : "100%";
}
function fitMenuToHeightRobust(){
  fitMenuToHeight();
  requestAnimationFrame(fitMenuToHeight);
  setTimeout(fitMenuToHeight, 60);
}

/* =========================
   Video bg
   ========================= */
function ensureVideo(){
  const v=document.getElementById('bgVideo'); if(!v)return;
  v.muted=true; const play=()=>v.play().catch(()=>{});
  if(v.readyState>=2)play(); else v.addEventListener('canplay',play,{once:true});
}

/* =========================
   Footer carousel
   ========================= */
function startFooterCarousel(){
  const track = document.getElementById('footerTrack'); if(!track) return;
  const total = track.children.length; if(total<=1) return;
  let idx = 0;
  setInterval(()=>{ idx = (idx+1)%total; track.style.transform = `translateX(-${idx*100}%)`; }, 6000);
}

/* =========================
   WhatsApp
   ========================= */
(function(){
  const WHATSAPP_NUMBER = "5491176449830";
  const WHATSAPP_DISPLAY = "+54 11 7644-9830";
  const WHATSAPP_MSG = "Hola! Quiero hacer un pedido 😋🥩";
  const url=new URL("https://wa.me/"+WHATSAPP_NUMBER); url.searchParams.set("text",WHATSAPP_MSG);
  const a=document.getElementById("waLink"); if(a){a.href=url; a.target="_blank";}
  const n=document.getElementById("waNumber"); if(n){n.textContent=" — al "+WHATSAPP_DISPLAY;}
})();

/* ======================================================
   CARRUSEL DERECHA: 1..3 stacks desde un JSON ÚNICO
   - No repite imagen entre filas en cada tick
   - Soporta JSON:
       { "images": ["IMG/...","IMG/..."] }
     o { "categorias":[{ "items":[ {"src":"IMG/..."} ]}] }
   - Config:
       APP_CONFIG.carouselJson   | ?carousel=JSON/...
       APP_CONFIG.carouselStacks | ?stacks=1..3
       APP_CONFIG.carouselInterval | ?interval=ms
   ====================================================== */
function _shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
async function _loadCarouselImages(path){
  try{
    const r = await fetch(path, {cache:'no-store'});
    if(!r.ok) throw new Error('HTTP '+r.status);
    const j = await r.json();
    if (Array.isArray(j)) return j.map(x => typeof x==='string'?x:(x?.src)).filter(Boolean);
    if (Array.isArray(j.images)) return j.images.filter(Boolean);
    if (Array.isArray(j.categorias) && j.categorias[0]?.items){
      return j.categorias[0].items.map(x=>x.src || x.url || x.path).filter(Boolean);
    }
  }catch(e){
    console.error('Error cargando carrusel:', e);
  }
  return [];
}
function setCarouselSlideImage(slide, src) {
  if (!slide) return;
  const url = String(src || '').trim();
  slide.dataset.carouselSrc = url;
  slide.style.backgroundImage = url ? `url("${url.replace(/"/g, '%22')}")` : 'none';
}

function getActiveCarouselSlideSrc(stack) {
  const active = stack?.querySelector('.slide.active');
  return active?.dataset?.carouselSrc || '';
}

function _makeStack(){ const d=document.createElement('div'); d.className='stack'; return d; }
function _makeSlide(src, active=false){
  const slide=document.createElement('div'); slide.className='slide'+(active?' active':'');
  setCarouselSlideImage(slide, src);
  return slide;
}

/** Garantiza que exista #rightPanel. Si no existe, lo crea dentro de .right */
function _ensureRightPanel(){
  let panel = document.getElementById('rightPanel');
  if (panel) return panel;
  const right = document.querySelector('.right');
  if (!right) return null;
  right.innerHTML = ''; // limpiamos stacks hardcodeados si los había
  panel = document.createElement('section');
  panel.id = 'rightPanel';
  panel.className = 'right'; // mantiene estilos .right
  // Si right ya era la sección .right, reemplazamos su clase en el panel
  // y movemos el panel dentro del main:
  right.replaceWith(panel);
  return panel;
}

// Reemplaza toda tu buildDynamicRightCarousel por esta
// ===== Carrusel derecha SIN repetidos simultáneos (round-robin, con candado) =====
async function buildDynamicRightCarousel(){
  // ---- evito instancias duplicadas (candado global) ----
  if (window.__tvCarousel && window.__tvCarousel.running) {
    try { clearInterval(window.__tvCarousel.timer); } catch {}
    window.__tvCarousel.running = false;
  }
  window.__tvCarousel = { running:false, timer:null };

  const cUi = carouselRefreshUi();
  cUi.show('Cargando imágenes…');
  try {
  const qs  = new URL(location).searchParams;
  const cfg = window.APP_CONFIG || {};

  const carouselJson = qs.get('carousel') || cfg.carouselJson || 'JSON/carrusel.json';
  const stacksCount  = Math.max(1, Math.min(3, parseInt(qs.get('stacks') ?? cfg.carouselStacks ?? 2, 10) || 2));
  const baseInterval = Math.max(2500, parseInt(qs.get('interval') || cfg.carouselInterval || 5000, 10) || 5000);

  // ---- helpers ----
  const shuffle = (arr)=>{ const a=arr.slice(); for(let i=a.length-1;i>0;i--){const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]];} return a; };
  async function loadImgs(path){
    try{
      const r = await fetch(path, {cache:'no-store'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      const j = await r.json();
      if (Array.isArray(j)) return j.map(x => typeof x==='string'?x:(x?.src)).filter(Boolean);
      if (Array.isArray(j.images)) return j.images.filter(Boolean);
      if (Array.isArray(j.categorias) && j.categorias[0]?.items) return j.categorias[0].items.map(x=>x.src||x.url||x.path).filter(Boolean);
    }catch(e){ console.error('Error cargando carrusel:', e); }
    return [];
  }
  const makeStack = ()=>{ const d=document.createElement('div'); d.className='stack'; return d; };
  const makeSlide = (src, active=false)=>{
    const s=document.createElement('div');
    s.className='slide'+(active?' active':'');
    setCarouselSlideImage(s, src);
    return s;
  };

  // ---- contenedor ----
  let rightPanel = document.getElementById('rightPanel');
  if(!rightPanel){
    const right = document.querySelector('.right');
    if(!right) return;
    rightPanel = document.createElement('section');
    rightPanel.id = 'rightPanel';
    rightPanel.className = 'right';
    right.replaceWith(rightPanel);
    const refresh = document.createElement('div');
    refresh.id = 'tv-carousel-refresh';
    refresh.className = 'tv-data-refresh tv-data-refresh--panel';
    refresh.setAttribute('aria-live', 'polite');
    refresh.setAttribute('aria-hidden', 'true');
    refresh.innerHTML = `
      <div class="tv-data-refresh-card">
        <div class="tv-data-refresh-spinner" aria-hidden="true"></div>
        <p class="tv-data-refresh-msg">Cargando imágenes…</p>
      </div>`;
    rightPanel.appendChild(refresh);
  }
  rightPanel.style.display = 'grid';
  rightPanel.style.gridTemplateRows = `repeat(${stacksCount}, 1fr)`;
  rightPanel.style.gap = '8px';
  rightPanel.style.padding = '8px';
  clearRightPanelStacks(rightPanel);

  // ---- pool (único/normalizado) ----
  let images = await loadImgs(carouselJson);
  images = Array.from(new Set(images.filter(Boolean)));
  if (images.length === 0){
    images = [
      'IMG/CORTES/Corte-1.jpg','IMG/CORTES/Corte-2.jpg','IMG/CORTES/Corte-3.jpg',
      'IMG/CORTES/Corte-4.jpg','IMG/CORTES/Corte-5.jpg','IMG/CORTES/Corte-6.jpg'
    ];
  }

  const stacks = Array.from({length: stacksCount}, ()=> makeStack());
  stacks.forEach(s => rightPanel.appendChild(s));

  const initial = shuffle(images);

  setStacksLoading(stacks, true);
  const totalImgs = images.length;
  if (totalImgs > 0) {
    cUi.show(totalImgs > 1 ? `Cargando imágenes (0/${totalImgs})…` : 'Cargando imágenes…');
    await preloadImageUrls(images, (loaded, total) => {
      if (total > 3) cUi.show(`Cargando imágenes (${loaded}/${total})…`);
    });
  }
  setStacksLoading(stacks, false);

  // ---- inicial: todos ACTIVO distintos (si hay pool suficiente) ----
  stacks.forEach((stack, i)=>{
    const first = initial[i % initial.length];
    stack.appendChild(makeSlide(first, true));
    const rest = shuffle(images.filter(x=>x!==first)).slice(0, Math.min(2, Math.max(0, images.length-1)));
    rest.forEach(src => stack.appendChild(makeSlide(src, false)));
  });

  // cooldown por fila (evita volver a poner la misma muy seguido)
  const lastSeen = Array.from({length: stacksCount}, ()=>[]);
  stacks.forEach((s,i)=>{ const src=getActiveCarouselSlideSrc(s); if(src){ lastSeen[i].unshift(src); } });

  // ---- selección de candidato SIN colisión con activos de otras filas ----
  // Recorremos un "máster" por fila para no quedarnos pegados
  const master = shuffle(images);
  const ptr    = Array.from({length: stacksCount}, ()=> 0);

  function pickForRow(rowIdx){
    // activos actuales (otras filas)
    const activeOthers = new Set(
      stacks
        .map((s, i)=> i===rowIdx ? null : getActiveCarouselSlideSrc(s))
        .filter(Boolean)
    );
    const cooldown = new Set(lastSeen[rowIdx]); // últimos 2

    // Si hay pool suficiente (>= filas), exigimos NO chocar
    const requireDistinct = images.length >= stacksCount;

    // intentamos una vuelta completa al máster
    for(let k=0;k<master.length;k++){
      const cand = master[(ptr[rowIdx] + k) % master.length];
      if (requireDistinct && activeOthers.has(cand)) continue;
      if (cooldown.has(cand)) continue;
      ptr[rowIdx] = (ptr[rowIdx] + k + 1) % master.length;
      return cand;
    }
    // segunda chance: sólo evitar activos
    for(let k=0;k<master.length;k++){
      const cand = master[(ptr[rowIdx] + k) % master.length];
      if (requireDistinct && activeOthers.has(cand)) continue;
      ptr[rowIdx] = (ptr[rowIdx] + k + 1) % master.length;
      return cand;
    }
    // última: cualquiera
    const cand = master[ptr[rowIdx]];
    ptr[rowIdx] = (ptr[rowIdx] + 1) % master.length;
    return cand;
  }

  function rotateRow(rowIdx){
    const stack  = stacks[rowIdx];
    const slides = [...stack.querySelectorAll('.slide')];
    if (!slides.length) return;

    const cur = stack.querySelector('.slide.active');
    let nextIdx = 0;
    if (cur){
      const i = slides.indexOf(cur);
      cur.classList.remove('active');
      nextIdx = (i + 1) % slides.length;
    }
    const next = slides[nextIdx];
    const src = pickForRow(rowIdx);
    setCarouselSlideImage(next, src);
    next.classList.add('active');

    // cooldown máx 2
    lastSeen[rowIdx].unshift(src);
    if (lastSeen[rowIdx].length > 2) lastSeen[rowIdx].pop();

    // comprobación final: si por algún motivo quedó repetida con otra fila, forzamos otro pick
    if (images.length >= stacksCount){
      const mySrc = next.dataset.carouselSrc || '';
      const clash = stacks.some((s,i)=> i!==rowIdx && getActiveCarouselSlideSrc(s) === mySrc);
      if (clash){
        const alt = pickForRow(rowIdx);
        if (alt && alt !== mySrc) setCarouselSlideImage(next, alt);
      }
    }
  }

  // ---- scheduler ROUND-ROBIN (1 fila por tick) ----
  let rr = 0;
  const jitter = (Math.random()*400)|0;

  // arranque suave
  setTimeout(()=>{ rotateRow(rr); rr = (rr+1)%stacksCount; }, 400 + jitter);
  window.__tvCarousel.timer = setInterval(()=>{ rotateRow(rr); rr = (rr+1)%stacksCount; }, baseInterval + jitter);
  window.__tvCarousel.running = true;
  } finally {
    cUi.hide();
  }
}


/* =========================
   INIT GENERAL + auto-refresh JSON
   ========================= */
let __listPollTimer = null;
let __carouselPollTimer = null;
let __layoutObserversAttached = false;
const __REFRESH_MIN_MS = 450;

function resolveListJsonPath(path) {
  if (window.LiveJsonSync && window.LiveJsonSync.resolveJsonUrl) {
    return window.LiveJsonSync.resolveJsonUrl(path);
  }
  const raw = (path || 'JSON/productos.json').trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw.startsWith('/') ? raw : '/' + raw.replace(/^\.\//, '');
}

function getListRenderConfig() {
  const base = window.APP_CONFIG || {};
  const cols = qsParamInt('cols', base.cols ?? 3);
  const productsPerColumn = qsParamInt('ppc', base.productsPerColumn ?? 15);
  const startIndex = qsParamInt('start', base.startIndex ?? 0);
  const productsPerPage = qsParamInt('ppp', base.productsPerPage ?? (cols * productsPerColumn));
  const jsonPath = resolveListJsonPath(qsParamStr('j', base.jsonPath || 'JSON/productos.json'));
  const p = qsParamInt('p', 1);
  const overrideSide = qsParamStr('side', '').toLowerCase();
  const qs = new URL(location).searchParams;
  const cfg = window.APP_CONFIG || {};
  const carouselJson = qs.get('cj') || qs.get('carousel') || cfg.carouselJson || '';
  return {
    cols,
    productsPerColumn,
    startIndex,
    productsPerPage,
    jsonPath,
    p,
    overrideSide,
    carouselJson: carouselJson.trim() ? resolveListJsonPath(carouselJson.trim()) : '',
  };
}

function tvRefreshUi() {
  return window.LiveJsonSync && window.LiveJsonSync.TvRefreshUI
    ? window.LiveJsonSync.TvRefreshUI
    : null;
}

/** Overlay de carga solo sobre #rightPanel (carrusel de imágenes). */
function carouselRefreshUi() {
  return {
    show(message) {
      const el = document.getElementById('tv-carousel-refresh');
      if (!el) return;
      const msg = el.querySelector('.tv-data-refresh-msg');
      if (msg && message) msg.textContent = message;
      el.classList.add('is-visible');
      el.setAttribute('aria-hidden', 'false');
    },
    hide() {
      const el = document.getElementById('tv-carousel-refresh');
      if (!el) return;
      el.classList.remove('is-visible');
      el.setAttribute('aria-hidden', 'true');
    },
  };
}

function clearRightPanelStacks(panel) {
  if (!panel) return;
  Array.from(panel.children).forEach(ch => {
    if (ch.classList.contains('stack')) ch.remove();
  });
}

function setStacksLoading(stacks, loading) {
  (stacks || []).forEach(stack => {
    let ov = stack.querySelector('.tv-stack-refresh');
    if (loading) {
      if (!ov) {
        ov = document.createElement('div');
        ov.className = 'tv-stack-refresh';
        ov.setAttribute('aria-hidden', 'true');
        ov.innerHTML = '<div class="tv-data-refresh-spinner" aria-hidden="true"></div>';
        stack.appendChild(ov);
      }
      ov.classList.add('is-visible');
      ov.setAttribute('aria-hidden', 'false');
    } else if (ov) {
      ov.classList.remove('is-visible');
      ov.setAttribute('aria-hidden', 'true');
    }
  });
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

function preloadImageUrls(urls, onProgress) {
  const list = Array.from(new Set((urls || []).map(resolveAssetUrl).filter(Boolean)));
  const total = list.length;
  let loaded = 0;
  const tick = () => {
    loaded += 1;
    if (typeof onProgress === 'function') onProgress(loaded, total);
  };
  if (!total) return Promise.resolve();
  return Promise.all(list.map(src => new Promise(resolve => {
    const img = new Image();
    const finish = () => {
      if (img.decode) {
        img.decode().then(() => { tick(); resolve(); }).catch(() => { tick(); resolve(); });
      } else {
        tick();
        resolve();
      }
    };
    img.onload = finish;
    img.onerror = () => { tick(); resolve(); };
    img.src = src;
  })));
}

function yieldToPaint() {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function applyListLayoutSide(config) {
  const main = document.getElementById('mainLayout');
  if (!main) return;
  const useLeft = config.overrideSide
    ? (['left', 'izq', 'l'].includes(config.overrideSide))
    : ((config.p % 2) === 1);
  main.classList.toggle('image-left', useLeft);
  main.classList.toggle('image-right', !useLeft);
}

function renderProductListFromJson(j, config) {
  const { ORDER, data } = normalizeJson(j);
  const ordered = sortByOrder(data, ORDER);
  const flat = flattenItems(ordered);
  const capacity = config.cols * config.productsPerColumn;
  const pageSize = Math.min(config.productsPerPage, capacity);
  const safeStart = Math.max(0, Math.min(config.startIndex, Math.max(0, flat.length - 1)));
  const slice = flat.slice(safeStart, safeStart + pageSize);
  const columns = buildColumns(slice, config.cols, config.productsPerColumn);
  renderColumns(columns);
  fitMenuToHeightRobust();
}

async function applyProductListUpdate(j, config, opts = {}) {
  const ui = tvRefreshUi();
  const showOverlay = !opts.silent && ui;
  const started = Date.now();
  if (showOverlay) ui.show(opts.message || 'Actualizando precios…');
  try {
    await yieldToPaint();
    renderProductListFromJson(j, config);
    await yieldToPaint();
  } finally {
    if (showOverlay) {
      const wait = Math.max(0, __REFRESH_MIN_MS - (Date.now() - started));
      if (wait) await new Promise(r => setTimeout(r, wait));
      ui.hide();
    }
  }
}

function attachLayoutObserversOnce() {
  if (__layoutObserversAttached) return;
  __layoutObserversAttached = true;
  const body = document.getElementById('menuBody');
  const main = document.getElementById('mainLayout');
  const ro = new ResizeObserver(() => fitMenuToHeightRobust());
  if (body) ro.observe(body);
  if (main) ro.observe(main);
  const colsEl = document.getElementById('columns');
  if (colsEl) {
    const mo = new MutationObserver(() => fitMenuToHeightRobust());
    mo.observe(colsEl, { childList: true, subtree: true });
  }
}

async function init() {
  const config = getListRenderConfig();
  applyListLayoutSide(config);

  if (window.LiveJsonSync && window.LiveJsonSync.preloadJson) {
    window.LiveJsonSync.preloadJson(config.jsonPath);
    if (config.carouselJson) window.LiveJsonSync.preloadJson(config.carouselJson);
  }

  let listJson;
  const ui = tvRefreshUi();
  if (ui) ui.show('Cargando precios…');
  try {
    if (window.LiveJsonSync && window.LiveJsonSync.fetchJson) {
      listJson = await window.LiveJsonSync.fetchJson(config.jsonPath);
    } else {
      const res = await fetch(config.jsonPath, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      listJson = await res.json();
    }
  } catch (e) {
    console.error('No se pudo cargar JSON de listado:', e);
    listJson = { categorias: [] };
  }

  await applyProductListUpdate(listJson, config, { silent: true });
  if (ui) ui.hide();

  attachLayoutObserversOnce();
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  fitMenuToHeightRobust();

  ensureVideo();
  startFooterCarousel();
  await buildDynamicRightCarousel();

  if (window.LiveJsonSync) {
    if (__listPollTimer) clearInterval(__listPollTimer);
    __listPollTimer = window.LiveJsonSync.start({
      path: config.jsonPath,
      intervalMs: window.LiveJsonSync.getPollIntervalMs(),
      initialStamp: window.LiveJsonSync.stampFromJson(listJson),
      onRefreshStart: () => {
        const u = tvRefreshUi();
        if (u) u.show('Actualizando precios…');
      },
      onUpdate: (fresh) => applyProductListUpdate(fresh, config, { silent: true, message: 'Actualizando precios…' }),
      onRefreshEnd: () => {
        const u = tvRefreshUi();
        if (u) u.hide();
      },
    });

    const cj = config.carouselJson;
    if (cj && cj !== config.jsonPath) {
      if (__carouselPollTimer) clearInterval(__carouselPollTimer);
      __carouselPollTimer = window.LiveJsonSync.start({
        path: cj,
        intervalMs: window.LiveJsonSync.getPollIntervalMs(),
        initialStamp: '',
        onUpdate: async () => {
          await buildDynamicRightCarousel();
        },
      });
    }
  }
}
document.addEventListener('DOMContentLoaded', init);

// (Compat: si en tu HTML quedaba algo que llamaba a "startSplitRightCarousels", lo dejamos no-op)
function startSplitRightCarousels(){ /* no-op: ahora manejamos un carrusel dinámico */ }

/* =========================
   Nieve opcional (si tu CSS tiene .snow/i)
   ========================= */
function startSnow(n=160){
  let layer=document.querySelector('.snow');
  if(!layer){ layer=document.createElement('div'); layer.className='snow'; document.body.appendChild(layer); }
  layer.innerHTML='';
  for(let i=0;i<n;i++){
    const f=document.createElement('i');
    f.style.setProperty('--x', (Math.random()*100)+'%');
    f.style.setProperty('--d', (6+Math.random()*8)+'s');
    f.style.setProperty('--o', (0.35+Math.random()*0.65).toFixed(2));
    f.style.setProperty('--tx', (Math.random()*40-20)+'px');
    f.style.setProperty('--sz', (2+Math.random()*5)+'px');
    layer.appendChild(f);
  }
}
// Si usás nieve, descomentá la siguiente línea:
 document.addEventListener('DOMContentLoaded', ()=> startSnow(180));

/* =========================
   THEME / PALETTE / SNOW (no pisa al HTML)
   ========================= */
function applyThemeFromConfig(){
  const link = document.getElementById('theme-css');
  if (!link) return;

  const qs = new URL(location).searchParams;
  const qsTheme  = (qs.get('theme') || '').trim();
  const stored   = (localStorage.getItem('ec_theme') || '').trim();
  const cfgTheme = (window.APP_CONFIG && window.APP_CONFIG.theme) ? String(window.APP_CONFIG.theme) : '';
  const chosen   = (qsTheme || stored || cfgTheme || 'default').replace(/[^a-z0-9._-]/gi,'');

  // Si ya apunta al mismo path, no recargues
  const currentPath = new URL(link.href, location.href).pathname;
  const targetPath  = new URL(`CSS/themes/${chosen}.css`, location.href).pathname;
  if (currentPath !== targetPath){
    const bust = (window.APP_CONFIG && window.APP_CONFIG.version)
      ? `?v=${window.APP_CONFIG.version}` : `?v=${Date.now()}`;
    link.href = `CSS/themes/${chosen}.css${bust}`;
    link.onerror = ()=>{ if (chosen !== 'default') link.href = `CSS/themes/default.css${bust}`; };
    try { localStorage.setItem('ec_theme', chosen); } catch {}
  }

  // Paletas extendidas (sumo 'plata' y 'champagne' que usa el confetti)
  const paletteRaw = ((qs.get('palette') || (window.APP_CONFIG?.palette) || '') + '').toLowerCase();
  const allowedPalettes = new Set(['','rojo','verde','oro','plata','champagne']);
  const palette = allowedPalettes.has(paletteRaw) ? paletteRaw : '';
  document.documentElement.setAttribute('data-palette', palette);

  // Nieve: solo si se pidió (APP_CONFIG.snow o ?snow=1)
  const snowOn = (qs.get('snow') === '1') || !!(window.APP_CONFIG && window.APP_CONFIG.snow);
  document.documentElement.classList.toggle('snow-enabled', snowOn);
}
document.addEventListener('DOMContentLoaded', applyThemeFromConfig);

// Antes:
// document.addEventListener('DOMContentLoaded', ()=> startSnow(180));

// Después: solo si el <html> tiene la clase (puesta por el theme loader)
document.addEventListener('DOMContentLoaded', ()=>{
  if (document.documentElement.classList.contains('snow-enabled')){
    startSnow(180);
  }
});
