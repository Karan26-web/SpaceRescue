/* Space Rescue — narrated intro: three story cards between START and the
   lesson. Strict sequencing per card: the scene lands first, then the
   VoiceOver + typed line play together while the relevant visual is
   spotlighted (rest of the screen dims), then a beat of hold before the
   next card. Only after the last card completes does the icon nav button
   appear, bottom-right, gently pulsing. SKIP jumps straight ahead.
   Every slide arms its own scene animation and a synthesized SFX cue. */
(function () {
  const root = document.getElementById('intro');
  if (!root) return;
  const slides = Array.from(root.querySelectorAll('.slide'));
  const skipBtn = document.getElementById('intro-skip');
  const learnBtn = document.getElementById('lets-learn');

  const LINES = [
    'A group of asteroids is heading towards our planet.',
    'We must use our cannon to shoot them down.',
    'To use the cannon correctly, you need to know different types of angles.'
  ];
  /* the element(s) each line is about — spotlighted while it plays */
  const FOCUS = ['.intro-meteor', '.intro-cannon', '#angle-demo'];

  const SCENE_BEAT = 700;   // scene lands, breathes, THEN the narration starts
  const HOLD_MS = 1900;     // dwell after line + VoiceOver both finish

  let idx = -1, onDone = null, active = false, seq = 0;
  let typeTimer = 0, autoTimer = 0;
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

  function typeInto(el, text, done) {
    clearInterval(typeTimer);
    el.textContent = '';
    let i = 0;
    typeTimer = setInterval(() => {
      el.textContent = text.slice(0, ++i);
      if (i >= text.length) {
        clearInterval(typeTimer);
        if (done) done();
      }
    }, 30);
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
    const my = ++seq;
    slides.forEach((s, k) => s.classList.toggle('on', k === i));
    clearTimeout(autoTimer);
    const line = slides[i].querySelector('.line');
    const card = slides[i].querySelector('.narrator');
    line.textContent = '';
    CUES[i]();
    // 1: the scene appears and settles
    autoTimer = setTimeout(() => {
      if (!active || seq !== my) return;
      // 2: spotlight the subject, dim the rest, speak + type the line
      slides[i].classList.add('dim');
      slides[i].querySelectorAll(FOCUS[i]).forEach(el => el.classList.add('focus'));
      card.classList.add('speaking');
      let typed = false, spoken = false;
      const settle = () => {
        if (!typed || !spoken || !active || seq !== my) return;
        card.classList.remove('speaking');
        // 3: everything has landed — open the next step
        if (i === slides.length - 1) {
          learnBtn.hidden = false;
          SFX.pop();
        } else {
          autoTimer = setTimeout(() => { if (active && seq === my) show(i + 1); }, HOLD_MS);
        }
      };
      typeInto(line, LINES[i], () => { typed = true; settle(); });
      VO.say(LINES[i], () => { spoken = true; settle(); });
    }, SCENE_BEAT);
  }

  function finish() {
    if (!active) return;
    active = false;
    leave(idx);
    VO.stop();
    clearInterval(typeTimer);
    clearTimeout(autoTimer);
    root.classList.add('hide');
    root.addEventListener('transitionend', () => root.remove(), { once: true });
    window.removeEventListener('keydown', onKey);
    if (onDone) onDone();
  }

  function onKey(e) {
    if (!active) return;
    if (e.key === 'Escape') finish();
    if ((e.key === 'Enter' || e.key === ' ') && !learnBtn.hidden) {
      e.preventDefault();
      finish();
    }
  }

  /* --- hook 3: the ray sweeps up to 60°, arc + readout grow with it, the
     barrel tracks the bearing exactly like it will in the game --- */
  function startAngleDemo() {
    const svg = document.getElementById('angle-demo');
    const ray = svg.querySelector('.demo-ray');
    const arc = svg.querySelector('.demo-arc');
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
      // barrel art points up at rest — same bearing mapping as the game
      barrel.setAttribute('transform', `rotate(${90 - a} ${PX} ${PY})`);
    })(t0);
  }

  skipBtn.addEventListener('click', e => {
    e.stopPropagation();
    SFX.tap();
    finish();
  });

  learnBtn.addEventListener('click', e => {
    e.stopPropagation();
    SFX.good();
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
