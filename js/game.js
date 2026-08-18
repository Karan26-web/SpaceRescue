/* Space Rescue — meteor-defence angle game.
   One meteor per round streaks toward the cannon along a protractor angle
   (0° = right horizon, counterclockwise). Pick the right angle from four
   options: the cannon swings to that bearing and fires. Pick wrong (or dally
   too long) and the meteor slams the cannon. */
(function () {
  const QUESTIONS = [90, 120, 150, 30, 75, 110, 42, 55];
  const APPROACH_SECS = 14;   // spawn → cannon, if the player never answers
  const LIVES = 3;

  const game = document.getElementById('game');
  const arena = document.getElementById('arena');
  const svg = document.getElementById('angle-svg');
  const meteorEl = document.getElementById('meteor');
  const barrel = document.getElementById('cannon-barrel');
  const promptEl = document.getElementById('prompt');
  const roundLabel = document.getElementById('round-label');
  const livesEl = document.getElementById('lives');
  const optionsEl = document.getElementById('options');
  const flash = document.getElementById('damage-flash');
  const result = document.getElementById('result');
  const resultTitle = document.getElementById('result-title');
  const resultText = document.getElementById('result-text');

  const DISTRACTOR_POOL = [20, 25, 30, 42, 45, 55, 60, 75, 90, 100, 110, 120, 135, 150, 160, 165];

  /* two meteor arts: the round fireball rides shallow, side-on approaches;
     the teardrop comet (tail-up) sells a straight vertical drop.
     face = the direction the art points with no rotation applied (deg,
     screen convention: 0 = +x, 90 = down). ox/oy = the head's spot in the
     image (%), used as both anchor and rotation origin so the head stays
     glued to the ray. */
  /* headR = radius of the art's rocky head as a fraction of rendered width,
     used for surface-contact collision against the dome */
  const ARTS = {
    meteor: { src: 'assets/meteor.png', ox: 32, oy: 50, face: 180, headR: 0.24,
              width: 'clamp(110px, 13vw, 190px)' },
    comet:  { src: 'assets/comet.png',  ox: 50, oy: 84, face: 90,  headR: 0.32,
              width: 'clamp(64px, 7vw, 100px)' }
  };
  let art = ARTS.meteor;

  const INTROS = [
    'Meteor incoming! What angle is it riding in on?',
    'Check the rays — which angle matches its path?',
    'Read the sky like a protractor. Your call, pilot!',
    'Line it up: what is the meteor’s approach angle?'
  ];

  let round = 0, lives = LIVES, hits = 0;
  let angle = 0, progress = 0, spawnR = 0, pivot = { x: 0, y: 0 }, baseHalf = 120, domeR = 110;
  let phase = 'idle';           // idle | flying | resolving | over
  let lastT = 0, raf = 0;

  const rad = d => d * Math.PI / 180;
  const classify = a =>
    a < 90 ? 'an acute angle' : a === 90 ? 'a right angle'
    : a < 180 ? 'an obtuse angle' : 'a straight angle';

  /* ---------- layout ---------- */

  function computePivot() {
    // measure off the dome base — the barrel rotates, so its rect is unstable
    const b = document.getElementById('cannon-base').getBoundingClientRect();
    const a = arena.getBoundingClientRect();
    pivot = { x: b.left - a.left + b.width / 2, y: b.top - a.top + b.height * 0.94 };
    baseHalf = b.width / 2;
    // The dome art is an ellipse around the pivot: half-width 47% of the
    // image, and visibly taller than that (content spans 19%..94% of the
    // height). Intersect this round's ray with it so the meteor detonates
    // exactly where it touches the rim, at any approach angle.
    const rx = b.width * 0.47, ry = b.height * 0.75;
    domeR = (rx * ry) / Math.hypot(ry * Math.cos(rad(angle)), rx * Math.sin(rad(angle)));
    // spawn just past where this round's ray leaves the arena, so the meteor
    // slides into view within the first second or two
    const dx = Math.cos(rad(angle)), dy = -Math.sin(rad(angle));
    let t = Infinity;
    if (dx > 1e-6) t = Math.min(t, (a.width - pivot.x) / dx);
    if (dx < -1e-6) t = Math.min(t, -pivot.x / dx);
    if (dy < -1e-6) t = Math.min(t, -pivot.y / dy);
    spawnR = (Number.isFinite(t) ? t : Math.max(a.width, a.height)) + 150;
  }

  function meteorPos() {
    const r = spawnR * (1 - progress);
    return { x: pivot.x + Math.cos(rad(angle)) * r, y: pivot.y - Math.sin(rad(angle)) * r };
  }

  /* dashed baseline ray + approach ray + the arc between them */
  function drawRays() {
    const L = spawnR;
    const ex = pivot.x + Math.cos(rad(angle)) * L;
    const ey = pivot.y - Math.sin(rad(angle)) * L;
    const R = baseHalf * 1.2;   // arc sits just outside the dome
    const ax = pivot.x + Math.cos(rad(angle)) * R;
    const ay = pivot.y - Math.sin(rad(angle)) * R;
    const largeArc = angle > 180 ? 1 : 0;
    svg.innerHTML =
      `<line x1="${pivot.x}" y1="${pivot.y}" x2="${pivot.x + L}" y2="${pivot.y}"
             stroke="#7ef06e" stroke-width="3" stroke-dasharray="10 9" opacity="0.85"/>
       <line x1="${pivot.x}" y1="${pivot.y}" x2="${ex}" y2="${ey}"
             stroke="#7ef06e" stroke-width="3" stroke-dasharray="10 9" opacity="0.85"/>
       <path d="M ${pivot.x + R} ${pivot.y} A ${R} ${R} 0 ${largeArc} 0 ${ax} ${ay}"
             fill="none" stroke="#ffd45e" stroke-width="3" opacity="0.9"/>`;
  }

  function renderMeteor() {
    const p = meteorPos();
    const travel = Math.atan2(Math.sin(rad(angle)), -Math.cos(rad(angle)));
    const rot = travel * 180 / Math.PI - art.face;
    meteorEl.style.transform =
      `translate(${p.x}px, ${p.y}px) translate(-${art.ox}%, -${art.oy}%) rotate(${rot}deg)`;
  }

  /* ---------- HUD ---------- */

  function setPrompt(text, tone) {
    promptEl.textContent = text;
    promptEl.classList.remove('good', 'bad');
    if (tone) promptEl.classList.add(tone);
  }

  function renderLives() {
    livesEl.innerHTML = '';
    for (let i = 0; i < LIVES; i++) {
      const dot = document.createElement('i');
      if (i >= lives) dot.className = 'lost';
      livesEl.appendChild(dot);
    }
  }

  /* ---------- rounds ---------- */

  function buildOptions() {
    const opts = [angle];
    const pool = DISTRACTOR_POOL.filter(v => v !== angle);
    while (opts.length < 4)
      opts.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
    opts.sort(() => Math.random() - 0.5);

    optionsEl.innerHTML = '';
    for (const v of opts) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt-btn';
      b.textContent = v + '°';
      b.addEventListener('click', () => answer(v, b));
      optionsEl.appendChild(b);
    }
  }

  function startRound() {
    angle = QUESTIONS[round];
    progress = 0;
    phase = 'flying';
    computePivot();
    drawRays();
    barrel.style.transform = 'translateX(-50%) rotate(0deg)';
    // near-vertical drops use the straight teardrop comet
    art = Math.abs(angle - 90) <= 4 ? ARTS.comet : ARTS.meteor;
    meteorEl.src = art.src;
    meteorEl.style.width = art.width;
    meteorEl.style.transformOrigin = `${art.ox}% ${art.oy}%`;
    meteorEl.style.visibility = 'visible';
    renderMeteor();
    SFX.approachStart(APPROACH_SECS);
    roundLabel.textContent = `Meteor ${round + 1} / ${QUESTIONS.length}`;
    setPrompt(INTROS[round % INTROS.length]);
    buildOptions();
  }

  function lockOptions(chosenBtn, correctToo) {
    for (const b of optionsEl.children) {
      b.disabled = true;
      if (correctToo && b.textContent === angle + '°') b.classList.add('right');
    }
    if (chosenBtn && chosenBtn.textContent !== angle + '°') chosenBtn.classList.add('wrong');
  }

  /* the cannon always swings to the tapped bearing and fires: a correct
     bearing intercepts the meteor, a wrong one streaks off into empty space */
  function answer(v, btn) {
    if (phase !== 'flying') return;
    SFX.tap();
    phase = 'resolving';
    lockOptions(btn, true);
    const correct = v === angle;
    if (correct) SFX.good();
    SFX.servo();                       // barrel swinging to the tapped bearing
    barrel.style.transform = `translateX(-50%) rotate(${90 - v}deg)`;
    setTimeout(() => {
      SFX.fire();
      const target = correct
        ? meteorPos()
        : { x: pivot.x + Math.cos(rad(v)) * spawnR * 0.92,
            y: pivot.y - Math.sin(rad(v)) * spawnR * 0.92 };
      shootBolt(v, target, correct ? 240 : 430, () => {
        if (correct) return explodeMeteor(target);
        SFX.alert();                   // you were wrong, and it's still coming
        setPrompt('Missed! Wrong bearing — brace for impact!', 'bad');
        phase = 'rushing';
      });
    }, 340);
  }

  function shootBolt(deg, target, D, done) {
    const bolt = document.createElement('div');
    bolt.className = 'bolt';
    arena.appendChild(bolt);
    const t0 = performance.now();
    (function fly(t) {
      const k = Math.min(1, (t - t0) / D);
      const x = pivot.x + (target.x - pivot.x) * k;
      const y = pivot.y + (target.y - pivot.y) * k;
      bolt.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${-deg}deg)`;
      if (k < 1) return requestAnimationFrame(fly);
      bolt.remove();
      done();
    })(t0);
  }

  /* layered DOM-particle explosion: flash core + ring, flying sparks,
     and (for cannon strikes) smoke puffs drifting up from the wreck */
  function spawnBurst(at, { big = false, sparks = 10, smoke = 0 } = {}) {
    const add = el => {
      el.style.left = at.x + 'px';
      el.style.top = at.y + 'px';
      arena.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    };
    const core = document.createElement('div');
    core.className = big ? 'burst big' : 'burst';
    add(core);
    for (let i = 0; i < sparks; i++) {
      const s = document.createElement('div');
      s.className = 'spark';
      const dir = Math.random() * Math.PI * 2;
      const dist = (big ? 90 : 60) + Math.random() * (big ? 130 : 80);
      s.style.setProperty('--dx', Math.cos(dir) * dist + 'px');
      s.style.setProperty('--dy', Math.sin(dir) * dist * 0.8 + 'px');
      s.style.animationDelay = Math.random() * 0.06 + 's';
      add(s);
    }
    for (let i = 0; i < smoke; i++) {
      const p = document.createElement('div');
      p.className = 'smoke';
      p.style.setProperty('--dx', (Math.random() * 90 - 45) + 'px');
      p.style.animationDelay = i * 0.12 + 's';
      add(p);
    }
  }

  function explodeMeteor(at) {
    SFX.approachStop();
    SFX.shatter();
    meteorEl.style.visibility = 'hidden';
    spawnBurst(at, { sparks: 12 });
    hits++;
    setPrompt(`Direct hit! ${angle}° — ${classify(angle)}. Nice reading, pilot!`, 'good');
    setTimeout(nextRound, 1600);
  }

  /* wrong / too late: the meteor accelerates in and slams the cannon */
  function impact() {
    phase = 'resolving';
    const at = meteorPos();          // blow up right where it struck
    SFX.approachStop();
    SFX.impact();                    // sub drop + clang + whoop, mix ducked
    meteorEl.style.visibility = 'hidden';
    spawnBurst(at, { big: true, sparks: 18, smoke: 5 });
    flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
    game.classList.remove('shake'); void game.offsetWidth; game.classList.add('shake');
    lives--;
    renderLives();
    SFX.lifeLost(lives);             // heartbeat under the impact tail
    setPrompt(`Ouch! It came in at ${angle}° — ${classify(angle)}. Shields down!`, 'bad');
    lockOptions(null, true);
    setTimeout(nextRound, 1900);
  }

  function nextRound() {
    if (lives <= 0) return endRun(false);
    round++;
    if (round >= QUESTIONS.length) return endRun(true);
    startRound();
  }

  function endRun(won) {
    phase = 'over';
    meteorEl.style.visibility = 'hidden';
    svg.innerHTML = '';
    optionsEl.innerHTML = '';
    SFX.approachStop();
    SFX.fanfare(won);
    resultTitle.textContent = won ? 'Mission complete!' : 'Station overrun!';
    resultText.textContent = won
      ? `You shot down ${hits} of ${QUESTIONS.length} meteors. Angle master!`
      : `The meteors got through after ${hits} hit${hits === 1 ? '' : 's'}. Try again, pilot!`;
    result.classList.remove('hide');
  }

  function reset() {
    round = 0; lives = LIVES; hits = 0;
    renderLives();
    result.classList.add('hide');
    startRound();
  }

  /* ---------- main loop: meteor approach ---------- */

  /* true once the meteor's head touches the dome's visible rim */
  function touchingDome() {
    const headEdge = meteorEl.offsetWidth * art.headR;
    return spawnR * (1 - progress) <= domeR + headEdge;
  }

  function tick(t) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((t - lastT) / 1000, 0.05);
    lastT = t;
    if (phase === 'flying') {
      progress += dt / APPROACH_SECS;
      if (touchingDome()) { lockOptions(null, true); return impact(); }
      renderMeteor();
    } else if (phase === 'rushing') {
      progress += dt * 1.4;                    // slam in fast
      if (touchingDome()) return impact();
      renderMeteor();
    }
  }

  window.addEventListener('resize', () => {
    if (phase === 'over' || phase === 'idle') return;
    computePivot();
    drawRays();
    renderMeteor();
  });

  document.getElementById('again-btn').addEventListener('click', () => {
    SFX.tap();
    reset();
  });

  window.AngleGame = {
    start() {
      renderLives();
      startRound();
      lastT = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };
})();
