/**
 * Polling de JSON en pantallas TV: detecta cambios en el campo "updated" del archivo.
 * Uso: LiveJsonSync.start({ path, intervalMs, initialStamp, onUpdate })
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

  function stampFromJson(j) {
    if (!j || typeof j !== 'object') return '';
    return String(j.updated || '');
  }

  /**
   * @param {{ path: string, intervalMs?: number, initialStamp?: string, onUpdate: (data: object) => void }} opts
   * @returns {number} interval id
   */
  function start(opts) {
    const path = opts.path;
    const intervalMs = opts.intervalMs ?? getPollIntervalMs();
    let lastStamp = opts.initialStamp ?? '';
    let first = true;

    async function tick() {
      try {
        const res = await fetch(path, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const stamp = stampFromJson(data);
        if (!first && stamp && stamp === lastStamp) return;
        first = false;
        if (stamp) lastStamp = stamp;
        opts.onUpdate(data);
      } catch (e) {
        console.warn('[LiveJsonSync]', path, e);
      }
    }

    tick();
    return setInterval(tick, intervalMs);
  }

  global.LiveJsonSync = { start, stampFromJson, getPollIntervalMs, DEFAULT_SEC };
})(window);
