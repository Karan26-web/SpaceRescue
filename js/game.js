/* Space Rescue — meteor-defence angle game.
   One meteor per round streaks toward the cannon along a protractor angle
   (0° = right horizon, counterclockwise). Pick the right angle from four
   options: the cannon swings to that bearing and fires. Pick wrong (or dally
   too long) and the meteor slams the cannon. */
(function () {
  const QUESTIONS = [90, 120, 150, 30, 75, 110, 42, 55];
  const APPROACH_SECS = 18;   // spawn → cannon, if the player never answers —
                              // generous, so there's time to read the angle
  const LIVES = 3;

  const game = document.getElementById('game');
  const arena = document.getElementById('arena');
  const svg = document.getElementById('angle-svg');
  const meteorEl = document.getElementById('meteor');
  const cannonEl = document.getElementById('cannon');
  const barrel = document.getElementById('cannon-barrel');
  const tutorialDim = document.getElementById('tutorial-dim');
  const promptEl = document.getElementById('prompt');
  const livesEl = document.getElementById('lives');
  const optionsEl = document.getElementById('options');
  const flash = document.getElementById('damage-flash');
  const result = document.getElementById('result');
  const resultTitle = document.getElementById('result-title');
  const resultText = document.getElementById('result-text');
  const againBtn = document.getElementById('again-btn');

  /* answers are angle TYPES, not degree readings. Each type carries a
     representative bearing the cannon fires along when that (wrong) type
     is picked — the bolt visibly streaks off where the player aimed. */
  const TYPES = [
    { name: 'Acute angle',    test: a => a > 0 && a < 90,    aim: 45 },
    { name: 'Right angle',    test: a => a === 90,           aim: 90 },
    { name: 'Obtuse angle',   test: a => a > 90 && a < 180,  aim: 135 },
    { name: 'Straight angle', test: a => a === 180,          aim: 180 }
  ];
  const typeOf = a => TYPES.find(t => t.test(a));

  /* one art for every approach: assets/comet.svg — rocky head lower-left,
     painted flame wrapping the head and streaming to the upper-right, with
     an animated turbulence filter baked into the file so the fire writhes.
     face = the direction the head points with no rotation applied (deg,
     screen convention: 0 = +x, 90 = down). ox/oy = the head centre in the
     image (%), used as both anchor and rotation origin so the head stays
     glued to the ray. headR = head radius as a fraction of rendered width,
     used for surface-contact collision and the particle fire sheath. */
  const art = { src: 'assets/comet.svg', ox: 35, oy: 57, face: 145,
                headR: 0.2375, width: 'clamp(140px, 15vw, 230px)' };

  const INTROS = [
    'Meteor incoming! What type of angle is it riding in on?',
    'Check the rays — which type of angle matches its path?',
    'Compare it with the horizon line. Your call, pilot!',
    'Look at the arc: what type of angle is the approach?'
  ];

  let round = 0, lives = LIVES, hits = 0;
  let angle = 0, progress = 0, spawnR = 0, pivot = { x: 0, y: 0 }, baseHalf = 120, domeR = 110;
  let phase = 'idle';           // idle | tutorial | flying | resolving | over
  let lastT = 0, raf = 0;
  let approachLine = null;      // dotted tether pivot → asteroid, live-updated

  const rad = d => d * Math.PI / 180;
  const classify = a =>
    a < 90 ? 'an acute angle' : a === 90 ? 'a right angle'
    : a < 180 ? 'an obtuse angle' : 'a straight angle';

  /* ---------- VoiceOver: shared engine (js/vo.js) ---------- */
  const voice = (text, done) =>
    window.VO ? VO.say(text, done) : (done && setTimeout(done, 1800));
  const hushVoice = () => { if (window.VO) VO.stop(); };

  /* ---------- layout ---------- */

  function computePivot() {
    // measure off the dome base — the barrel rotates, so its rect is unstable
    const b = document.getElementById('cannon-base').getBoundingClientRect();
    const a = arena.getBoundingClientRect();
    // Camnono.png is a tightly-cropped dome — content fills the image edge
    // to edge, so the ground line sits at the very bottom (no bottom-padding
    // fudge factor needed, unlike the old Canon2.svg art)
    pivot = { x: b.left - a.left + b.width / 2, y: b.top - a.top + b.height };
    baseHalf = b.width / 2;
    // The dome art is an ellipse around the pivot: half-width = half the
    // image (content spans edge to edge), height = the full image (apex at
    // the top edge, base at the pivot). Intersect this round's ray with it
    // so the meteor detonates exactly where it touches the rim.
    const rx = b.width * 0.5, ry = b.height;
    domeR = (rx * ry) / Math.hypot(ry * Math.cos(rad(angle)), rx * Math.sin(rad(angle)));
    // spawn just past where this round's ray leaves the arena, so the meteor
    // slides into view within the first second or two
    const dx = Math.cos(rad(angle)), dy = -Math.sin(rad(angle));
    let t = Infinity;
    if (dx > 1e-6) t = Math.min(t, (a.width - pivot.x) / dx);
    if (dx < -1e-6) t = Math.min(t, -pivot.x / dx);
    if (dy < -1e-6) t = Math.min(t, -pivot.y / dy);
    spawnR = (Number.isFinite(t) ? t : Math.max(a.width, a.height)) + 240;
  }

  function meteorPos() {
    const r = spawnR * (1 - progress);
    return { x: pivot.x + Math.cos(rad(angle)) * r, y: pivot.y - Math.sin(rad(angle)) * r };
  }

  /* solid horizon baseline through the pivot (the 0° reference the angle is
     read against — and the cannon's resting direction), plus, once a meteor
     is inbound, the dotted tether pivot → asteroid and the arc between the
     horizontal and that tether. The tether's far end is re-pinned to the
     asteroid every frame (renderMeteor), so it visibly shortens as the rock
     closes in. */
  function drawRays(withApproach = true) {
    const W = arena.clientWidth;
    // the true pivot now sits almost exactly on the arena's bottom edge
    // (Camnono.png's dome is cropped flush, unlike the old padded art) —
    // clamp only enough to keep the halo's glow from clipping at the edge
    const hy = Math.min(pivot.y, arena.clientHeight - 5);
    let html =
      `<line x1="0" y1="${hy}" x2="${W}" y2="${hy}"
             stroke="rgba(10, 16, 56, 0.55)" stroke-width="9"/>
       <line x1="0" y1="${hy}" x2="${W}" y2="${hy}"
             stroke="#f4f6ff" stroke-width="4"
             style="filter: drop-shadow(0 0 6px rgba(150,190,255,0.8))"/>
       <text x="${W - 14}" y="${hy - 12}" text-anchor="end" fill="#f4f6ff"
             font-size="20" font-weight="800"
             style="paint-order: stroke; stroke: rgba(10,16,56,0.7); stroke-width: 4px">0°</text>`;
    if (withApproach) {
      const p = meteorPos();
      const R = baseHalf * 1.2;   // arc sits just outside the dome
      const ax = pivot.x + Math.cos(rad(angle)) * R;
      const ay = pivot.y - Math.sin(rad(angle)) * R;
      const largeArc = angle > 180 ? 1 : 0;
      html +=
        `<line id="approach-line" x1="${pivot.x}" y1="${pivot.y}" x2="${p.x}" y2="${p.y}"
               stroke="#7ef06e" stroke-width="3" stroke-dasharray="10 9" opacity="0.85"/>
         <path id="angle-arc" d="M ${pivot.x + R} ${pivot.y} A ${R} ${R} 0 ${largeArc} 0 ${ax} ${ay}"
               fill="none" stroke="#ffd45e" stroke-width="3.5" opacity="0.95"/>`;
    }
    svg.innerHTML = html;
    approachLine = withApproach ? svg.querySelector('#approach-line') : null;
  }

  /* targeted feedback: pulse the angle the round was about and name its
     type right beside the arc, so the words and the picture connect */
  function highlightAngle() {
    const arc = svg.querySelector('#angle-arc');
    if (arc) arc.classList.add('highlight');
    if (approachLine) approachLine.classList.add('highlight');
    const mid = angle / 2, R = baseHalf * 1.65;
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', pivot.x + Math.cos(rad(mid)) * R);
    t.setAttribute('y', Math.max(30, pivot.y - Math.sin(rad(mid)) * R));
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('class', 'angle-callout');
    t.textContent = typeOf(angle).name;
    svg.appendChild(t);
  }

  function renderMeteor() {
    const p = meteorPos();
    // keep the dotted tether pinned to the asteroid — it shrinks as it nears
    if (approachLine) {
      approachLine.setAttribute('x2', p.x);
      approachLine.setAttribute('y2', p.y);
    }
    const travel = Math.atan2(Math.sin(rad(angle)), -Math.cos(rad(angle)));
    const rot = travel * 180 / Math.PI - art.face;
    meteorEl.style.transform =
      `translate(${p.x}px, ${p.y}px) translate(-${art.ox}%, -${art.oy}%) rotate(${rot}deg)`;
    // live fire: stream particles off the head, back along the approach ray
    if (window.FireFX && meteorEl.style.visibility === 'visible') {
      const tx = Math.cos(rad(angle)), ty = -Math.sin(rad(angle));  // tail-ward
      FireFX.trail(p.x, p.y, tx, ty, meteorEl.offsetWidth * art.headR,
                   phase === 'rushing' ? 1.8 : 1);
    }
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
    const opts = TYPES.slice().sort(() => Math.random() - 0.5);
    optionsEl.innerHTML = '';
    for (const t of opts) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt-btn';
      b.dataset.type = t.name;
      b.textContent = t.name;
      b.addEventListener('click', () => answer(t, b));
      optionsEl.appendChild(b);
    }
  }

  /* ---------- tutorial: VoiceOver + spotlight, once per session ----------
     The whole environment is shown first, then the objective is spoken.
     While the cannon is being talked about the rest of the screen dims and
     the cannon comes into focus; same for the angle options. */
  function spotlight(el) {
    document.querySelectorAll('#game .spot').forEach(x => x.classList.remove('spot'));
    tutorialDim.classList.toggle('on', !!el);
    if (el) el.classList.add('spot');
  }

  function runTutorial(done) {
    phase = 'tutorial';
    angle = 0;
    buildOptions();          // the answer pad is part of the environment tour
    computePivot();
    drawRays(false);         // horizon only — no meteor inbound yet
    barrel.style.transform = 'translateX(-50%) rotate(90deg)';   // resting horizontal
    meteorEl.style.visibility = 'hidden';
    const steps = [
      { text: 'Asteroids are coming!', spot: null },
      { text: 'Use the cannon to defend your planet.', spot: cannonEl },
      { text: 'Select a suitable angle to position the cannon.', spot: optionsEl }
    ];
    let i = 0;
    (function step() {
      if (i >= steps.length) {
        spotlight(null);
        setTimeout(done, 500);   // let the dim fade out before play begins
        return;
      }
      const s = steps[i++];
      spotlight(s.spot);
      setPrompt(s.text);
      voice(s.text, () => setTimeout(step, 450));
    })();
  }

  function startRound() {
    angle = QUESTIONS[round];
    progress = 0;
    phase = 'flying';
    buildOptions();   // fill the answer bar FIRST — it changes the arena's
    computePivot();   // height, and all geometry below measures the arena
    drawRays();
    // the cannon rests horizontal, pointing right along the 0° baseline —
    // the angle to read is formed against this position
    barrel.style.transform = 'translateX(-50%) rotate(90deg)';
    meteorEl.src = art.src;
    meteorEl.style.width = art.width;
    meteorEl.style.transformOrigin = `${art.ox}% ${art.oy}%`;
    meteorEl.style.visibility = 'visible';
    renderMeteor();
    SFX.approachStart(APPROACH_SECS);
    setPrompt(INTROS[round % INTROS.length]);
  }

  function lockOptions(chosenBtn, correctToo) {
    const right = typeOf(angle).name;
    for (const b of optionsEl.children) {
      b.disabled = true;
      if (correctToo && b.dataset.type === right) b.classList.add('right');
    }
    if (chosenBtn && chosenBtn.dataset.type !== right) chosenBtn.classList.add('wrong');
  }

  /* the cannon swings and fires: the correct type intercepts along the real
     approach ray, a wrong type fires along that type's own bearing and the
     bolt streaks off into empty space */
  function answer(t, btn) {
    if (phase !== 'flying') return;
    SFX.tap();
    phase = 'resolving';
    lockOptions(btn, true);
    const correct = t.name === typeOf(angle).name;
    const aimDeg = correct ? angle : t.aim;
    if (correct) SFX.good();
    SFX.servo();                       // barrel swinging to the tapped bearing
    barrel.style.transform = `translateX(-50%) rotate(${90 - aimDeg}deg)`;
    setTimeout(() => {
      SFX.fire();
      const target = correct
        ? meteorPos()
        : { x: pivot.x + Math.cos(rad(aimDeg)) * spawnR * 0.92,
            y: pivot.y - Math.sin(rad(aimDeg)) * spawnR * 0.92 };
      shootBolt(aimDeg, target, correct ? 240 : 430, () => {
        if (correct) return explodeMeteor(target);
        SFX.alert();                   // you were wrong, and it's still coming
        // targeted feedback: light up the real angle and name its type
        highlightAngle();
        const picked = (/^[aeiou]/i.test(t.name) ? 'an ' : 'a ') + t.name.toLowerCase();
        setPrompt(`Missed! This is ${classify(angle)}, not ${picked} — brace for impact!`, 'bad');
        voice(`This is ${classify(angle)}.`);
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
    if (window.FireFX) FireFX.burst(at.x, at.y, 1);
    spawnBurst(at, { sparks: 12 });
    hits++;
    // targeted feedback: the angle just solved pulses while its type is named
    highlightAngle();
    setPrompt(`Direct hit! This is ${classify(angle)} (${angle}°). Nice reading, pilot!`, 'good');
    voice(`This is ${classify(angle)}.`);
    setTimeout(nextRound, 2000);
  }

  /* wrong / too late: the meteor accelerates in and slams the cannon.
     The cannon is destroyed — chars and sinks — then a fresh one rides up
     from the bottom of the screen into position: one life spent, visibly. */
  function impact() {
    phase = 'resolving';
    const at = meteorPos();          // blow up right where it struck
    SFX.approachStop();
    SFX.impact();                    // sub drop + clang + whoop, mix ducked
    meteorEl.style.visibility = 'hidden';
    if (window.FireFX) FireFX.burst(at.x, at.y, 1.7);
    spawnBurst(at, { big: true, sparks: 18, smoke: 5 });
    flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
    game.classList.remove('shake'); void game.offsetWidth; game.classList.add('shake');
    lives--;
    renderLives();
    SFX.lifeLost(lives);             // heartbeat under the impact tail
    // targeted feedback (skip re-highlighting if the missed shot already did)
    if (!svg.querySelector('.angle-callout')) {
      highlightAngle();
      voice(`This is ${classify(angle)}.`);
    }
    setPrompt(`Ouch! This is ${classify(angle)} (${angle}°). Cannon destroyed — shields down!`, 'bad');
    lockOptions(null, true);
    // the wreck goes down under the explosion…
    setTimeout(() => cannonEl.classList.add('destroyed'), 150);
    // …and once the dust settles, a new cannon (if any lives remain)
    setTimeout(() => {
      if (lives <= 0) return endRun(false);
      round++;
      if (round >= QUESTIONS.length) return endRun(true);
      respawnCannon(startRound);
    }, 2300);
  }

  /* replacement cannon: transitions in from below the screen, barrel back
     in its original horizontal position, then the next round begins */
  function respawnCannon(done) {
    cannonEl.classList.remove('destroyed');
    barrel.style.transform = 'translateX(-50%) rotate(90deg)';
    cannonEl.classList.add('respawn');
    SFX.swoosh();
    setTimeout(() => {
      cannonEl.classList.remove('respawn');
      done();
    }, 950);   // matches the cannon-respawn animation, so measuring is safe
  }

  function nextRound() {
    if (lives <= 0) return endRun(false);
    round++;
    if (round >= QUESTIONS.length) return endRun(true);
    startRound();
  }

  function endRun(won) {
    phase = 'over';
    hushVoice();
    meteorEl.style.visibility = 'hidden';
    svg.innerHTML = '';
    approachLine = null;
    optionsEl.innerHTML = '';
    SFX.approachStop();
    SFX.fanfare(won);
    resultTitle.textContent = won ? 'MISSION COMPLETE' : 'STATION OVERRUN';
    resultText.textContent = won
      ? '✦  You read every angle right — angle master!  ✦'
      : '✦  The meteors broke through. Try again, pilot!  ✦';
    document.getElementById('stat-hits').textContent = `${hits}/${QUESTIONS.length}`;
    document.getElementById('stat-shields').textContent = Math.max(0, lives);
    againBtn.classList.toggle('retry', !won);   // red button when the run failed
    result.classList.remove('hide');
  }

  function reset() {
    round = 0; lives = LIVES; hits = 0;
    renderLives();
    result.classList.add('hide');
    cannonEl.classList.remove('destroyed', 'respawn');   // fresh cannon
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
    } else if (phase === 'resolving') {
      renderMeteor();     // frozen mid-air while the bolt flies — keep burning
    }
  }

  window.addEventListener('resize', () => {
    if (phase === 'over' || phase === 'idle') return;
    computePivot();
    if (phase === 'tutorial') return drawRays(false);   // horizon only
    drawRays();
    renderMeteor();
  });

  againBtn.addEventListener('click', () => {
    SFX.tap();
    reset();
  });

  window.AngleGame = {
    start() {
      renderLives();
      lastT = performance.now();
      raf = requestAnimationFrame(tick);
      // environment tour + spoken objective first, then the mission begins
      runTutorial(startRound);
    }
  };
})();
