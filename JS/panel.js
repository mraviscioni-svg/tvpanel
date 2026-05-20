/* ==== QS helpers ==== */
function qsParamStr(name, def=""){ const u=new URL(location.href); const v=(u.searchParams.get(name)||"").trim(); return v||def; }
function qsParamInt(name, def){ const u=new URL(location.href); const v=parseInt(u.searchParams.get(name) ?? def,10); return Number.isFinite(v)?v:def; }

/* ==== Tema / paleta / nieve ==== */
(function ThemeLoader(){
  const params = new URL(location).searchParams;
  const themeParam   = params.get('theme');                      // p.ej. 'default', 'navidad'
  const paletteParam = (params.get('palette')||"").toLowerCase();// 'rojo' | 'verde' | 'oro'
  const snowParam    = params.get('snow');                       // '1' => activa nieve

  const savedTheme   = localStorage.getItem('ec_theme');
  const theme        = themeParam || savedTheme || 'default';

  const link = document.getElementById('theme-css');
  if (link) {
    link.href  = `CSS/themes/${theme}.css`;
    localStorage.setItem('ec_theme', theme);
  }

  const allowed = new Set(['','rojo','verde','oro']);
  const palette = allowed.has(paletteParam) ? paletteParam : '';
  document.documentElement.setAttribute('data-palette', palette);

  if (snowParam === '1') document.documentElement.classList.add('snow-enabled');

  // helpers opcionales
  window.setTheme = (name) => {
    const l = document.getElementById('theme-css');
    if (l){ l.href = `CSS/themes/${name}.css`; localStorage.setItem('ec_theme', name); }
  };
  window.setPalette = (name) => document.documentElement.setAttribute('data-palette', String(name||''));
})();

/* ==== Reloj ==== */
function updateClock(){
  const el=document.getElementById("clock"); if(!el) return;
  const DAYS=["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
  const MONTHS=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const now=new Date(); const dow=DAYS[now.getDay()], d=now.getDate(), month=MONTHS[now.getMonth()];
  let h=now.getHours(), ampm=h>=12?"PM":"AM"; h=h%12; if(h===0)h=12; const m=String(now.getMinutes()).padStart(2,'0');
  el.querySelector('.clock-date').textContent=`${dow} ${d} de ${month}`;
  el.querySelector('.clock-time .hm').textContent=`${String(h).padStart(2,'0')}:${m}`;
  el.querySelector('.clock-time .ampm').textContent=ampm;
}
setInterval(updateClock,1000); updateClock();

/* ==== Carga de configuración de TVs ==== */
async function loadTVsConfig(){
  const path = qsParamStr('config', 'JSON/tvs.json'); // default
  try{
    const res = await fetch(path, {cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const j = await res.json();
    // Estructura esperada:
    // {
    //   "header": { "title": "...", "hint": "..." },
    //   "tvs": [ { "id": "tv1", "title": "TV 1", "tag": "TV", "description": "...", "url": "tv1.html?p=1", "active": true }, ... ]
    // }
    const header = j.header || {};
    const tvs = Array.isArray(j.tvs) ? j.tvs : [];
    return { header, tvs };
  }catch(err){
    console.error('No se pudo cargar el JSON de TVs:', err);
    return { header: {}, tvs: [] };
  }
}

/* ==== Render ==== */
function createCard(tv){
  const card = document.createElement('div');
  card.className = 'card' + (tv.active === false ? ' disabled' : '');
  card.innerHTML = `
    <div class="card-body">
      <div>
        <span class="pill">${tv.tag || 'TV'}</span>
        <div class="title">${tv.title || tv.id || 'TV'}</div>
        <p class="desc">${tv.description || ''}</p>
      </div>
    </div>
    <div class="card-foot">
      <a class="btn">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M13.5 4H20a1 1 0 0 1 1 1v6.5a1 1 0 1 1-2 0V7.41l-7.3 7.3a1 1 0 0 1-1.4-1.42l7.3-7.29h-4.09a1 1 0 1 1 0-2ZM5 5h6.5a1 1 0 1 1 0 2H7.41l7.3 7.29a1 1 0 0 1-1.42 1.42L6 8.41v4.09a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1Z"/>
        </svg>
        Abrir
      </a>
      <span class="badge-right"><span class="dot"></span> ${tv.active === false ? 'Inactivo' : 'Activo'}</span>
    </div>
  `;

  // click abre en misma pestaña
  const btn = card.querySelector('.btn');
  if (btn && tv.url && tv.active !== false){
    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      location.href = tv.url;
    });
  }
  return card;
}

function renderPanel({header, tvs}){
  const title = document.getElementById('panel-title');
  const hint  = document.getElementById('panel-hint');
  if(header.title) title.textContent = header.title;
  if(header.hint)  hint.textContent  = header.hint;

  const grid = document.getElementById('cards');
  grid.innerHTML = '';
  tvs.forEach(tv => grid.appendChild(createCard(tv)));
}

/* ==== Init ==== */
async function init(){
  const cfg = await loadTVsConfig();
  renderPanel(cfg);
}
document.addEventListener('DOMContentLoaded', init);
