/* Space Rescue — starting screen
   Stars + Earth horizon greet the player; Start (or Enter/Space)
   fades the screen out and reveals the ship + D-pad. */
(function () {
  const screen = document.getElementById('start-screen');
  const btn = document.getElementById('start-btn');

  function begin() {
    if (screen.classList.contains('hide')) return;
    SFX.ambienceStop();
    SFX.launch();
    screen.classList.add('hide');
    screen.addEventListener('transitionend', () => screen.remove(), { once: true });
    // body stays pre-start (game hidden) through the narrated intro and the
    // angles lesson; the game is only revealed and measured at the very end
    const go = () => {
      document.body.classList.remove('pre-start');
      if (window.AngleGame) window.AngleGame.start();
    };
    const teach = window.Lesson ? () => Lesson.play(go) : go;
    if (window.Intro) Intro.play(teach); else teach();
  }

  // the drone can only arm after a gesture, so start it on the first one
  ['pointerdown', 'pointermove', 'keydown'].forEach(ev =>
    window.addEventListener(ev, function armOnce() {
      ['pointerdown', 'pointermove', 'keydown'].forEach(e2 =>
        window.removeEventListener(e2, armOnce));
      if (!screen.classList.contains('hide')) SFX.ambienceStart();
    }, { passive: true }));

  btn.addEventListener('click', begin);
  window.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      window.removeEventListener('keydown', onKey);
      begin();
    }
  });
})();
