/**
 * Ticker de partidos Mundial — index2-mundial, promociones, etc.
 */
const FIXTURES_API = '/backend/mundial-fixtures.php';
const FIXTURES_POLL_MS = 10 * 60 * 1000;

let fixturesPollTimer = null;

function escapeHtml(str) {
  const s = String(str);
  return s
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;')
    .split("'").join('&#039;');
}

function renderFixtureChip(g) {
  const liveCls = g.live ? ' live' : '';
  const group = g.groupLabel ? `<span class="group">${escapeHtml(g.groupLabel)}</span>` : '';
  return `<span class="fixture-chip${liveCls}"><span class="time">${escapeHtml(g.timeLabel)}</span><span class="teams">${escapeHtml(g.teamsLabel)}</span>${group}</span>`;
}

function renderFixtures(data) {
  const track = document.getElementById('fixtures-track');
  const headingEl = document.getElementById('fixtures-heading-text');
  if (!track) return;

  if (headingEl) {
    headingEl.textContent = data.tickerMode === 'today'
      ? 'Partidos de hoy'
      : 'Próximos partidos';
  }

  const list = Array.isArray(data.ticker) ? data.ticker : [];
  if (!list.length) {
    track.classList.add('is-static');
    track.innerHTML = '<span class="fixture-chip">Sin partidos programados</span>';
    return;
  }

  const html = list.map(renderFixtureChip).join('');
  if (list.length <= 4) {
    track.classList.add('is-static');
    track.innerHTML = html;
  } else {
    track.classList.remove('is-static');
    track.innerHTML = html + html;
  }
}

async function loadMundialFixtures() {
  try {
    const r = await fetch(FIXTURES_API, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || 'API error');
    renderFixtures(data);
  } catch (err) {
    console.error('[MUNDIAL] Error cargando partidos:', err);
    const track = document.getElementById('fixtures-track');
    if (track) {
      track.classList.add('is-static');
      track.innerHTML = '<span class="fixture-chip">Partidos no disponibles</span>';
    }
  }
}

function startFixturesPolling() {
  if (!document.getElementById('fixtures-track')) return;
  loadMundialFixtures();
  if (fixturesPollTimer) clearInterval(fixturesPollTimer);
  fixturesPollTimer = setInterval(loadMundialFixtures, FIXTURES_POLL_MS);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startFixturesPolling);
} else {
  startFixturesPolling();
}
