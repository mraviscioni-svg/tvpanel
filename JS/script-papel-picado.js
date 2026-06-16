/**
 * Papel picado argentino — decoración celeste / blanco / sol de mayo
 */
(function () {
  const COLORS = ['#74ACDF', '#75aadb', '#5f9fd4'];

  function startPapelPicado(count = 40) {
    const layer = document.querySelector('.arg-papel-picado');
    if (!layer) return;

    layer.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('i');
      const isGold = Math.random() < 0.12;
      const isWhite = !isGold && Math.random() < 0.38;

      piece.style.setProperty('--x', (Math.random() * 100).toFixed(2) + '%');
      piece.style.setProperty('--d', (14 + Math.random() * 18).toFixed(2) + 's');
      piece.style.setProperty('--delay', (-Math.random() * 22).toFixed(2) + 's');
      piece.style.setProperty('--o', (0.28 + Math.random() * 0.42).toFixed(2));
      piece.style.setProperty('--w', (9 + Math.random() * 12).toFixed(1) + 'px');
      piece.style.setProperty('--h', (14 + Math.random() * 16).toFixed(1) + 'px');
      piece.style.setProperty('--tx', (Math.random() * 90 - 45).toFixed(1) + 'px');
      piece.style.setProperty('--r0', (Math.random() * 50 - 25).toFixed(1) + 'deg');
      piece.style.setProperty('--r1', (200 + Math.random() * 320).toFixed(1) + 'deg');

      if (isGold) {
        piece.classList.add('is-gold');
        piece.style.setProperty('--w', (10 + Math.random() * 8).toFixed(1) + 'px');
        piece.style.setProperty('--h', piece.style.getPropertyValue('--w'));
      } else if (isWhite) {
        piece.classList.add('is-white');
      } else {
        piece.style.setProperty('--papel-c', COLORS[Math.floor(Math.random() * COLORS.length)]);
      }

      layer.appendChild(piece);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => startPapelPicado());
  } else {
    startPapelPicado();
  }
})();
