/* Space Rescue — narrated intro: three story cards between START and the
   mission. Click / Enter / Space advances (first tap fast-forwards the
   typewriter, next tap turns the card); SKIP jumps straight into the game.
   Every slide arms its own scene animation and a sound cue synthesized by
   SFX — no new audio assets. */
(function () {
  const root = document.getElementById('intro');
  if (!root) return;
  const slides = Array.from(root.querySelectorAll('.slide'));
  const skipBtn = document.getElementById('intro-skip');

  const LINES = [
    'Far above Earth, a meteor shower is heading straight for our space station!',
    'Our defence cannon can stop them—but first, we need to get its aim just right.',
    'And for that, we’ll need angles.'
  ];

  let idx = -1, onDone = null, active = false;
  let typeTimer = 0, typing = false;
  let sweepTimer = 0, demoRaf = 0;

  /* per-slide sound direction:
     0 — the meteor-approach rumble swells under the falling rocks
     1 — warning siren, then the servo whirs with each barrel test-sweep
     2 — servo as the ray sweeps up, a bell chord when the angle locks */
  const CUES = [
    () => SFX.approachStart(12),
    () => {
      SFX.alert();
      SFX.servo();
      sweepTimer = setInterval(() => { if (active && idx === 1) SFX.servo(); }, 2300);
    },
    () => {
      SFX.servo();
      setTimeout(() => { if (active && idx === 2) SFX.good(); }, 1100);
      startAngleDemo();
    }
  ];

  function typeInto(el, text) {
    clearInterval(typeTimer);
    typing = true;
    el.textContent = '';
    let i = 0;
    typeTimer = setInterval(() => {
      el.textContent = text.slice(0, ++i);
      if (i >= text.length) { clearInterval(typeTimer); typing = false; }
    }, 24);
  }

  function leave(i) {
    if (i === 0) SFX.approachStop();
    if (i === 1) { clearInterval(sweepTimer); sweepTimer = 0; }
    if (i === 2) { cancelAnimationFrame(demoRaf); demoRaf = 0; }
  }

  function show(i) {
    if (idx >= 0) leave(idx);
    if (i >= slides.length) return finish();
    idx = i;
    slides.forEach((s, k) => s.classList.toggle('on', k === i));
    typeInto(slides[i].querySelector('.line'), LINES[i]);
    CUES[i]();
  }

  function advance() {
    if (!active) return;
    if (typing) {                       // first tap: reveal the full line
      clearInterval(typeTimer);
      typing = false;
      slides[idx].querySelector('.line').textContent = LINES[idx];
      return;
    }
    SFX.tap();
    show(idx + 1);
  }

  function finish() {
    if (!active) return;
    active = false;
    leave(idx);
    clearInterval(typeTimer);
    root.classList.add('hide');
    root.addEventListener('transitionend', () => root.remove(), { once: true });
    window.removeEventListener('keydown', onKey);
    if (onDone) onDone();
  }

  function onKey(e) {
    if (!active) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
      e.preventDefault();
      advance();
    } else if (e.key === 'Escape') {
      finish();
    }
  }

  /* --- hook 3: the ray sweeps up to 60°, arc + readout grow with it, the
     barrel tracks the bearing exactly like it will in the game --- */
  function startAngleDemo() {
    const svg = document.getElementById('angle-demo');
    const ray = svg.querySelector('.demo-ray');
    const arc = svg.querySelector('.demo-arc');
    const deg = svg.querySelector('.demo-deg');
    const barrel = svg.querySelector('.demo-barrel');
    const PX = 150, PY = 330, R = 120, LEN = 340, TARGET = 60;
    const t0 = performance.now();
    cancelAnimationFrame(demoRaf);
    (function step(t) {
      if (!active || idx !== 2) return;
      demoRaf = requestAnimationFrame(step);
      const cycle = ((t - t0) / 1000) % 4;          // 1.2s sweep, then hold
      const k = Math.min(1, cycle / 1.2);
      const a = TARGET * (1 - Math.pow(1 - k, 3));  // ease-out
      const r = a * Math.PI / 180;
      ray.setAttribute('x2', PX + Math.cos(r) * LEN);
      ray.setAttribute('y2', PY - Math.sin(r) * LEN);
      arc.setAttribute('d',
        `M ${PX + R} ${PY} A ${R} ${R} 0 0 0 ${PX + Math.cos(r) * R} ${PY - Math.sin(r) * R}`);
      const mid = r / 2;
      deg.setAttribute('x', PX + Math.cos(mid) * (R + 48));
      deg.setAttribute('y', PY - Math.sin(mid) * (R + 48) + 10);
      deg.textContent = Math.round(a) + '°';
      // barrel art points up at rest — same bearing mapping as the game
      barrel.setAttribute('transform', `rotate(${90 - a} ${PX} ${PY})`);
    })(t0);
  }

  root.addEventListener('click', advance);
  skipBtn.addEventListener('click', e => {
    e.stopPropagation();
    SFX.tap();
    finish();
  });

  window.Intro = {
    play(done) {
      onDone = done;
      active = true;
      root.hidden = false;
      requestAnimationFrame(() => root.classList.remove('hide'));
      window.addEventListener('keydown', onKey);
      show(0);
    }
  };
})();
