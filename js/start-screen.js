/* Space Rescue — starting screen
   Stars + Earth horizon greet the player; Start (or Enter/Space)
   fades the screen out and reveals the ship + D-pad. */
(function () {
  const screen = document.getElementById('start-screen');
  const btn = document.getElementById('start-btn');

  function begin() {
    if (screen.classList.contains('hide')) return;
    if (window.SFX && SFX.click) SFX.click();
    screen.classList.add('hide');
    document.body.classList.remove('pre-start');
    screen.addEventListener('transitionend', () => screen.remove(), { once: true });
    if (window.AngleGame) window.AngleGame.start();
  }

  btn.addEventListener('click', begin);
  window.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      window.removeEventListener('keydown', onKey);
      begin();
    }
  });
})();
