/* Space Rescue — angles teaching module (between the intro hooks and the game).
   One persistent SVG stage tells the story: a point grows a ray, then another,
   the space between becomes an angle — then vertex/arms, angle sizes, and the
   named types, with drag activities and staged-feedback questions throughout
   (storyboard pages 2–34). Data-driven: SLIDES below is the whole lesson.
   Sounds are synthesized in SFX (pop/draw for the stage, tap/good/alert/servo
   reused from the game, fanfare on completion). */
(function () {
  const W = 1240, H = 700, P = { x: 560, y: 430 }, LEN = 330, AR = 95;
  const rad = d => d * Math.PI / 180;
  const px = (d, r) => P.x + Math.cos(rad(d)) * r;
  const py = (d, r) => P.y - Math.sin(rad(d)) * r;

  /* ---------- layer skeleton ---------- */
  const root = document.createElement('div');
  root.id = 'lesson';
  root.className = 'hide';
  root.hidden = true;
  root.innerHTML = `
    <div id="lesson-board" aria-hidden="true"></div>
    <button type="button" id="lesson-skip">SKIP ▸</button>
    <aside id="lesson-rail" hidden>
      <span class="rail-step"></span>
      <div class="rail-narr"><i></i>NARRATOR</div>
      <div class="rail-say-slot"></div>
      <div class="rail-drag-slot"><h4>DRAG THESE</h4></div>
    </aside>
    <div id="lesson-say">
      <div class="say-hud"><i></i><b></b><i></i></div>
      <div class="say-inner">
        <div class="say-accent"></div>
        <p class="line"></p>
        <span class="hint">TAP TO CONTINUE ▸</span>
        <div class="say-dots"><span></span><span></span><span></span></div>
      </div>
    </div>
    <div id="lesson-scene">
      <svg id="lesson-stage" viewBox="0 0 ${W} ${H}" aria-hidden="true">
        <defs>
          <marker id="lm-w" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M1 1 L11 6 L1 11 Z" fill="#f4f6ff"/>
          </marker>
          <marker id="lm-y" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M1 1 L11 6 L1 11 Z" fill="#ffd75e"/>
          </marker>
          <marker id="lm-d" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M1 1 L11 6 L1 11 Z" fill="#23307c"/>
          </marker>
        </defs>
        <g id="ls-refs"></g>
        <path id="ls-arc" fill="none"/>
        <path id="ls-corner" fill="none"/>
        <line id="ls-ray1" class="ls-ray" marker-end="url(#lm-w)"/>
        <line id="ls-ray2" class="ls-ray" marker-end="url(#lm-w)"/>
        <circle id="ls-pt" r="11"/>
        <text id="ls-label"></text>
        <g id="ls-annot"></g>
        <g id="ls-cards"></g>
        <g id="ls-recap"></g>
      </svg>
      <div id="lesson-zones"></div>
    </div>
    <div id="lesson-footer">
      <div id="lesson-chips"></div>
      <div id="lesson-actions"></div>
    </div>
    <div id="lesson-final" hidden>
      <h2>GREAT JOB!</h2>
      <p class="final-sub">You’ve learned all about angles!</p>
      <p class="final-line">✔ You now understand how angles are formed, compared, and classified.</p>
      <p class="final-line ready">🚀 You are now ready to DEFEND THE STATION!</p>
      <button type="button" id="defend-btn">LET’S DEFEND! ▸</button>
    </div>`;
  document.body.appendChild(root);

  const $ = id => root.querySelector('#' + id);
  const sayLine = root.querySelector('#lesson-say .line');
  const sayHint = root.querySelector('#lesson-say .hint');
  const stage = $('lesson-stage');
  const E = {
    refs: $('ls-refs'), arc: $('ls-arc'), corner: $('ls-corner'),
    ray1: $('ls-ray1'), ray2: $('ls-ray2'), pt: $('ls-pt'),
    label: $('ls-label'), annot: $('ls-annot'), cards: $('ls-cards'),
    recap: $('ls-recap')
  };
  const zones = $('lesson-zones'), actions = $('lesson-actions'),
        chipsEl = $('lesson-chips'), finalEl = $('lesson-final');
  const railEl = $('lesson-rail'),
        railStep = railEl.querySelector('.rail-step'),
        railSay = railEl.querySelector('.rail-say-slot'),
        railDrag = railEl.querySelector('.rail-drag-slot'),
        sayBox = root.querySelector('#lesson-say');

  /* rail mode: text + controls live in a left panel, the board stays clear */
  function enterRail() {
    root.classList.add('rail');
    railEl.hidden = false;
    railStep.textContent = `STEP ${idx + 1} / ${SLIDES.length}`;
    railSay.appendChild(sayBox);
  }
  function exitRail() {
    if (!root.classList.contains('rail')) return;
    root.classList.remove('rail');
    railEl.hidden = true;
    root.insertBefore(sayBox, $('lesson-scene'));
    railDrag.querySelectorAll('.lesson-drag').forEach(x => x.remove());
  }

  /* stage-space point → percent position inside the overlay layer (handles
     the SVG's letterboxing, so markers stay glued at any aspect ratio) */
  function stagePosPct(x, y) {
    const p = new DOMPoint(x, y).matrixTransform(stage.getScreenCTM());
    const r = zones.getBoundingClientRect();
    return { left: (p.x - r.left) / r.width * 100, top: (p.y - r.top) / r.height * 100 };
  }

  /* ---------- stage helpers ---------- */
  const attr = (e, o) => { for (const k in o) e.setAttribute(k, o[k]); };
  const show = (e, on) => { e.style.display = on ? '' : 'none'; };

  function setRay(line, deg, len = LEN) {
    attr(line, { x1: P.x, y1: P.y, x2: px(deg, len), y2: py(deg, len) });
  }

  function arcPath(deg, r = AR) {
    return `M ${P.x + r} ${P.y} A ${r} ${r} 0 ${deg > 180 ? 1 : 0} 0 ${px(deg, r)} ${py(deg, r)}`;
  }

  let raf = 0;
  function animate(dur, step, done) {
    cancelAnimationFrame(raf);
    const t0 = performance.now();
    (function fr(t) {
      const k = Math.min(1, (t - t0) / dur);
      step(1 - Math.pow(1 - k, 3));
      if (k < 1) raf = requestAnimationFrame(fr);
      else if (done) done();
    })(t0);
  }

  function growRay(line, deg, dur = 500) {
    show(line, true);
    SFX.draw();
    animate(dur, k => setRay(line, deg, 40 + (LEN - 40) * k));
  }

  function sweepArc(toDeg, dur = 600, r = AR) {
    show(E.arc, true);
    animate(dur, k => attr(E.arc, { d: arcPath(Math.max(1, toDeg * k), r) }));
  }

  function setLabel(text, x = P.x + 60, y = P.y + 90) {
    show(E.label, !!text);
    if (!text) return;
    E.label.textContent = text;
    attr(E.label, { x, y });
    E.label.classList.remove('pop');
    E.label.getBoundingClientRect();   // restart the pop-in animation
    E.label.classList.add('pop');
    SFX.pop();
  }

  /* yellow callout: arrow from (fx,fy) to (tx,ty) plus text near the tail */
  function callout(fx, fy, tx, ty, text, txAnchor = 'start') {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.innerHTML = `<line x1="${fx}" y1="${fy}" x2="${tx}" y2="${ty}" stroke="#ffd75e"
        stroke-width="5" marker-end="url(#lm-y)"/>
      <text x="${fx + (txAnchor === 'start' ? 14 : -14)}" y="${fy + 10}"
        text-anchor="${txAnchor === 'start' ? 'start' : 'end'}" class="ls-callout">${text}</text>`;
    E.annot.appendChild(g);
    SFX.pop();
  }

  function refRay(dir) {   // dashed reference: 'up' | 'left'
    const d = dir === 'up' ? 90 : 180;
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('class', 'ls-ref');
    l.setAttribute('marker-end', 'url(#lm-w)');
    attr(l, { x1: P.x, y1: P.y, x2: px(d, LEN * 0.85), y2: py(d, LEN * 0.85) });
    E.refs.appendChild(l);
  }

  /* base scene reset + declarative setup */
  function scene(o = {}) {
    cancelAnimationFrame(raf);
    E.refs.innerHTML = ''; E.annot.innerHTML = '';
    E.cards.innerHTML = ''; E.recap.innerHTML = '';
    zones.innerHTML = ''; actions.innerHTML = '';
    show(E.arc, false); show(E.corner, false); show(E.label, false);
    show(E.pt, o.pt !== false);
    attr(E.pt, { cx: P.x, cy: P.y });
    show(E.ray1, o.ray1 !== false);
    if (o.ray1 !== false) setRay(E.ray1, 0);
    show(E.ray2, o.ray2 != null);
    if (o.ray2 != null) setRay(E.ray2, o.ray2);
    (o.refs || []).forEach(refRay);
    if (o.arc != null) { show(E.arc, true); attr(E.arc, { d: arcPath(o.arc, o.arcR || AR) }); }
    if (o.corner) {
      show(E.corner, true);
      attr(E.corner, { d: `M ${P.x + 56} ${P.y} L ${P.x + 56} ${P.y - 56} L ${P.x} ${P.y - 56}` });
    }
    if (o.label) setLabel(o.label, o.labelX, o.labelY);
  }

  /* ---------- mini-angle drawings (cards, recap, chips) ---------- */
  function miniAngle(deg, r, len, cx, cy, marker = 'lm-w') {
    const large = deg > 180 ? 1 : 0;
    const lx = a => cx + Math.cos(rad(a)) * len;
    const ly = a => cy - Math.sin(rad(a)) * len;
    const ax = cx + Math.cos(rad(deg)) * r, ay = cy - Math.sin(rad(deg)) * r;
    return `<path d="M ${cx + r} ${cy} A ${r} ${r} 0 ${large} 0 ${ax} ${ay}" fill="none"
        class="ls-mini-arc"/>
      <line x1="${cx}" y1="${cy}" x2="${lx(0)}" y2="${cy}" class="ls-mini-ray" marker-end="url(#${marker})"/>
      <line x1="${cx}" y1="${cy}" x2="${lx(deg)}" y2="${ly(deg)}" class="ls-mini-ray" marker-end="url(#${marker})"/>
      <circle cx="${cx}" cy="${cy}" r="7" fill="${marker === 'lm-d' ? '#23307c' : '#f4f6ff'}"/>`;
  }

  function buildCards(defs, onPick) {
    const cw = 470, ch = 410, xs = [110, 660], y = 105;
    defs.forEach((d, i) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'ls-card');
      g.dataset.correct = d.correct ? '1' : '0';
      // long arms read clearly; centre sits low-left so both arms fit
      g.innerHTML = `<rect x="${xs[i]}" y="${y}" width="${cw}" height="${ch}" rx="22"/>` +
        miniAngle(d.deg, 62, 205, xs[i] + cw / 2 - 45, y + ch / 2 + 40);
      g.addEventListener('click', e => { e.stopPropagation(); onPick(d, g); });
      E.cards.appendChild(g);
    });
  }

  /* ---------- narrator + flow ---------- */
  let idx = -1, active = false, onDone = null;
  let typeTimer = 0, typing = false, locked = false, currentText = '';

  function narrate(text) {
    currentText = text;
    clearInterval(typeTimer);
    typing = true;
    sayLine.textContent = '';
    let i = 0;
    typeTimer = setInterval(() => {
      sayLine.textContent = text.slice(0, ++i);
      if (i >= text.length) { clearInterval(typeTimer); typing = false; }
    }, 22);
  }

  function button(text, cls, fn) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lesson-btn ' + (cls || '');
    b.textContent = text;
    b.addEventListener('click', e => { e.stopPropagation(); fn(b); });
    actions.appendChild(b);
    return b;
  }

  /* learned-types tray, bottom-left (accumulates like the storyboard) */
  const CHIP_DEFS = {
    complete: ['Complete Angle', 350], straight: ['Straight Angle', 180],
    right: ['Right Angle', 90], acute: ['Acute Angle', 45],
    obtuse: ['Obtuse Angle', 135], reflex: ['Reflex Angle', 240]
  };
  function syncChips(list) {
    chipsEl.innerHTML = '';
    (list || []).forEach(k => {
      const [name, deg] = CHIP_DEFS[k];
      const d = document.createElement('div');
      d.className = 'lesson-chip';
      d.innerHTML = `<svg viewBox="0 0 132 106">${miniAngle(deg, 20, 52, 54, 56, 'lm-d')}</svg><span>${name}</span>`;
      chipsEl.appendChild(d);
    });
  }

  /* animated hand hint for "try it yourself" screens — sits by the ray tip,
     nudges to suggest the drag, vanishes on the first touch */
  function showHand(deg) {
    const h = document.createElement('div');
    h.className = 'lesson-hand';
    h.textContent = '👆';
    const pos = stagePosPct(px(deg, 250), py(deg, 250));
    h.style.left = pos.left + '%';
    h.style.top = pos.top + '%';
    zones.appendChild(h);
  }
  const hideHand = () =>
    zones.querySelectorAll('.lesson-hand').forEach(h => h.remove());

  /* ---------- draggable ray (activities) ---------- */
  let dragCfg = null;   // {deg, onChange}
  function enableDrag(startDeg, onChange) {
    dragCfg = { deg: startDeg, onChange };
    stage.classList.add('draggable');
  }
  function stageAngle(ev) {
    const ctm = stage.getScreenCTM().inverse();
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm);
    let a = Math.atan2(P.y - p.y, p.x - P.x) * 180 / Math.PI;   // (-180, 180]
    // below the baseline: snap to the NEAREST end of the 0–180 range, so a
    // drag skimming just under 0° stays at 0° instead of flipping to 177°
    if (a < 0) a = a > -90 ? 3 : 177;
    return Math.min(177, Math.max(3, a));
  }
  let dragging = false;
  stage.addEventListener('pointerdown', ev => {
    if (!dragCfg) return;
    hideHand();
    dragging = true;
    stage.setPointerCapture(ev.pointerId);
    dragCfg.deg = stageAngle(ev);
    dragCfg.onChange(dragCfg.deg);
  });
  stage.addEventListener('pointermove', ev => {
    if (!dragCfg || !dragging) return;
    dragCfg.deg = stageAngle(ev);
    dragCfg.onChange(dragCfg.deg);
  });
  stage.addEventListener('pointerup', () => {
    if (dragCfg && dragging) SFX.servo();
    dragging = false;
  });

  function liveAngle(deg) {
    setRay(E.ray2, deg);
    attr(E.arc, { d: arcPath(deg) });
    show(E.arc, true);
  }

  /* a drag-the-ray activity with staged feedback (used 3×) */
  function makeAngleActivity(startDeg, ok, fb) {
    return function () {
      locked = true;
      scene({ ray2: startDeg, arc: startDeg });
      let tries = 0;
      enableDrag(startDeg, liveAngle);
      showHand(startDeg);
      button('Check', '', () => {
        const d = dragCfg.deg;
        if (d >= ok[0] && d <= ok[1]) {
          SFX.good();
          narrate(fb.right);
          dragCfg = null; stage.classList.remove('draggable');
          actions.innerHTML = '';
          setTimeout(next, 2100);
        } else {
          SFX.alert();
          tries++;
          narrate(tries === 1 ? fb.w1 : fb.w2);
          if (tries === 1 && fb.showRef) fb.showRef.forEach(refRay);
        }
      });
    };
  }

  const FB = {
    acute: {
      right: 'That’s right! This angle is smaller than a right angle, so it is an acute angle.',
      w1: 'Not quite. Compare this angle with a right angle. Is it smaller or larger?',
      w2: 'Look closely — an acute angle has a smaller turn than the right angle. Bring the ray below the dashed guide.',
      showRef: ['up']
    },
    obtuse: {
      right: 'Excellent! Larger than a right angle but smaller than a straight angle — that’s an obtuse angle.',
      w1: 'Not quite. Think about where an obtuse angle lies — between a right angle and a straight angle.',
      w2: 'An obtuse angle must go past the right angle, but stop before the straight angle. Move your ray between the two guides.',
      showRef: ['up', 'left']
    },
    right: {
      right: 'Perfect! A square corner — that’s a right angle.',
      w1: 'Not quite. A right angle makes a square corner — exactly half of a straight angle.',
      w2: 'Line your ray up with the dashed guide to make a square corner.',
      showRef: ['up']
    }
  };

  /* a two-card comparison question */
  function pickCardActivity(defs, praise, retry) {
    return function () {
      locked = true;
      scene({ pt: false, ray1: false });
      buildCards(defs, (d, g) => {
        if (d.correct) {
          SFX.good();
          g.classList.add('right');
          narrate(praise);
          setTimeout(next, 1800);
        } else {
          SFX.alert();
          g.classList.add('wrong');
          narrate(retry);
          setTimeout(() => g.classList.remove('wrong'), 700);
        }
      });
    };
  }

  /* ---------- the lesson ---------- */
  const SLIDES = [
    { text: 'This is a point.',
      go() { scene({ ray1: false, label: 'Point', labelX: P.x - 40, labelY: P.y + 100 }); } },

    { text: 'Let’s draw a ray from this point.',
      go() { scene({ ray1: false }); growRay(E.ray1, 0); } },

    { text: 'Now, let’s draw another ray from the same point.',
      go() { scene({}); growRay(E.ray2, 60); } },

    { text: 'The space formed between these two rays is called an angle.',
      go() { scene({ ray2: 60 }); sweepArc(60); setTimeout(() => setLabel('Angle'), 620); } },

    { text: 'The two rays that form the angle are called its arms.',
      go() {
        scene({ ray2: 60, arc: 60 });
        callout(px(60, 285) + 165, py(60, 285) - 45, px(60, 240), py(60, 240), 'Arms');
        callout(px(0, 285) + 65, py(0, 285) - 65, px(0, 250), py(0, 250) - 6, 'Arms');
      } },

    { text: 'The common point where the two rays begin is called the vertex.',
      go() {
        scene({ ray2: 60, arc: 60 });
        callout(P.x - 190, P.y + 130, P.x - 16, P.y + 12, 'Vertex', 'end');
      } },

    /* drag the labels — check-for-understanding, in the teaching-rail layout */
    { text: 'Drag the labels to their correct place.',
      rail: true,
      go() {
        locked = true;
        scene({ ray2: 60, arc: 60 });
        const done = new Set();
        // zones anchor to real stage geometry once the rail layout has settled
        requestAnimationFrame(() => {
          [{ key: 'Vertex', x: P.x - 30, y: P.y + 72 },
           { key: 'Arms', x: px(60, 285) + 160, y: py(60, 285) - 55 }].forEach(t => {
            const z = document.createElement('div');
            z.className = 'lesson-zone';
            z.dataset.key = t.key;
            z.textContent = 'DROP HERE';
            const pos = stagePosPct(t.x, t.y);
            z.style.left = pos.left + '%';
            z.style.top = pos.top + '%';
            zones.appendChild(z);
          });
        });
        ['Vertex', 'Arms'].forEach(k => {
          const c = document.createElement('button');
          c.type = 'button';
          c.className = 'lesson-drag';
          c.dataset.key = k;
          c.textContent = k;
          railDrag.appendChild(c);
          let sx, sy;
          c.addEventListener('pointerdown', ev => {
            ev.preventDefault();
            c.setPointerCapture(ev.pointerId);
            sx = ev.clientX; sy = ev.clientY;
            const move = e2 =>
              c.style.transform = `translate(${e2.clientX - sx}px, ${e2.clientY - sy}px)`;
            const up = () => {
              c.removeEventListener('pointermove', move);
              c.removeEventListener('pointerup', up);
              const cr = c.getBoundingClientRect();
              for (const z of zones.querySelectorAll('.lesson-zone')) {
                const zr = z.getBoundingClientRect();
                const hit = cr.left < zr.right && cr.right > zr.left &&
                            cr.top < zr.bottom && cr.bottom > zr.top;
                if (!hit || z.classList.contains('filled')) continue;
                if (z.dataset.key === c.dataset.key) {
                  SFX.good();
                  z.classList.add('filled');
                  z.textContent = c.dataset.key;
                  c.remove();
                  done.add(k);
                  if (done.size === 2) { narrate('Great! That’s the vertex and the arms.'); setTimeout(next, 1600); }
                } else {
                  SFX.alert();
                  c.style.transform = '';
                }
                return;
              }
              c.style.transform = '';   // dropped on empty board — snap home
            };
            c.addEventListener('pointermove', move);
            c.addEventListener('pointerup', up);
          });
        });
      } },

    { text: 'So, here we have an angle with a vertex and two arms.',
      go() {
        scene({ ray2: 60, arc: 60 });
        callout(px(60, 285) + 165, py(60, 285) - 45, px(60, 240), py(60, 240), 'Arms');
        callout(P.x - 190, P.y + 130, P.x - 16, P.y + 12, 'Vertex', 'end');
      } },

    { text: 'The size of an angle depends on how far one arm turns from the other.',
      go() { scene({ ray2: 60, arc: 60, label: 'Angle' }); } },

    { text: 'The more the ray turns, the larger the angle becomes.',
      go() {
        scene({ ray2: 60, arc: 60 });
        setTimeout(() => {
          SFX.draw();
          animate(900, k => liveAngle(60 + 65 * k));
        }, 500);
      } },

    { text: 'Try it yourself — drag the ray to change the angle.',
      go() {
        locked = true;
        scene({ ray2: 60, arc: 60 });
        enableDrag(60, liveAngle);
        showHand(60);
        button('Next', '', () => {
          dragCfg = null; stage.classList.remove('draggable');
          SFX.tap(); next();
        });
      } },

    { text: 'Which angle is larger? Tap it.',
      go: pickCardActivity(
        [{ deg: 45 }, { deg: 135, correct: true }],
        'That’s right! The more the arm turns, the larger the angle.',
        'Try again — look at how far the arm has turned in each one.') },

    { text: 'When an arm makes a complete turn around the vertex, it is called a complete angle.',
      chips: ['complete'],
      go() { scene({ ray2: 1, refs: ['up', 'left'], arc: 350, arcR: 70, label: 'Complete Angle' }); } },

    { text: 'When the ray takes only half of a complete turn…',
      chips: ['complete'],
      go() { scene({ ray2: 180, arc: 180 }); } },

    { text: '…the rays lie on a straight line.',
      chips: ['complete'],
      go() { scene({ ray2: 180, arc: 180 }); } },

    { text: 'It is called a straight angle.',
      chips: ['complete', 'straight'],
      go() { scene({ ray2: 180, arc: 180, label: 'Straight Angle', labelX: P.x - 60 }); } },

    { text: 'Exactly half of a straight angle makes a right angle.',
      chips: ['complete', 'straight'],
      go() { scene({ ray2: 90, arc: 90, label: 'Right Angle' }); } },

    { text: 'It looks like the corner of a square.',
      chips: ['complete', 'straight', 'right'],
      go() { scene({ ray2: 90, corner: true, label: 'Right Angle' }); } },

    { text: 'An angle smaller than a right angle is called an acute angle.',
      chips: ['complete', 'straight', 'right'],
      go() { scene({ ray2: 45, refs: ['up'], arc: 45, label: 'Acute Angle' }); } },

    { text: 'Drag the ray to make an acute angle.',
      chips: ['complete', 'straight', 'right', 'acute'],
      go: makeAngleActivity(120, [5, 85], FB.acute) },

    { text: 'An angle larger than a right angle but smaller than a straight angle is called an obtuse angle.',
      chips: ['complete', 'straight', 'right', 'acute'],
      go() { scene({ ray2: 135, refs: ['up', 'left'], arc: 135, label: 'Obtuse Angle' }); } },

    { text: 'Drag the ray to make an obtuse angle.',
      chips: ['complete', 'straight', 'right', 'acute', 'obtuse'],
      go: makeAngleActivity(45, [95, 175], FB.obtuse) },

    { text: 'An angle that extends beyond the straight angle is called a reflex angle.',
      chips: ['complete', 'straight', 'right', 'acute', 'obtuse', 'reflex'],
      go() { scene({ ray2: 235, refs: ['up', 'left'], arc: 235, arcR: 70, label: 'Reflex Angle' }); } },

    { text: 'Let’s recap the different types of angles we learnt.',
      go() {
        scene({ pt: false, ray1: false });
        const types = [['Acute', 45], ['Right', 90], ['Obtuse', 135], ['Straight', 180], ['Reflex', 240], ['Complete', 350]];
        types.forEach(([name, deg], i) => {
          const x = 130 + (i % 3) * 350, y = 150 + ((i / 3) | 0) * 260;
          const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          g.innerHTML = miniAngle(deg, 34, 105, x, y) +
            `<text x="${x}" y="${y + 105}" class="ls-recap-name">${name}</text>`;
          E.recap.appendChild(g);
        });
        const a = document.createElement('a');
        a.href = 'https://angle-explorer.netlify.app/';
        a.target = '_blank';
        a.rel = 'noopener';
        a.id = 'lesson-link';
        a.textContent = 'Open Angle Explorer ↗';
        a.addEventListener('click', e => e.stopPropagation());
        zones.appendChild(a);
      } },

    { text: 'Quick check — which angle is smaller? Tap it.',
      go: pickCardActivity(
        [{ deg: 45, correct: true }, { deg: 135 }],
        'That’s right! The smaller turn makes the smaller angle.',
        'Try again — which arm has turned less?') },

    { text: 'Which type of angle is this?',
      go() {
        locked = true;
        scene({ ray2: 45, arc: 45 });
        let tries = 0;
        ['Acute', 'Obtuse', 'Right', 'Straight'].forEach(name => {
          button(name, 'quiz', b => {
            if (name === 'Acute') {
              SFX.good();
              b.classList.add('right');
              narrate('That’s right! This angle is smaller than a right angle, so it is an acute angle.');
              actions.querySelectorAll('button').forEach(x => x.disabled = true);
              setTimeout(next, 2000);
            } else {
              SFX.alert();
              b.classList.add('wrong');
              tries++;
              if (tries === 1) { refRay('up'); narrate('Not quite. Compare this angle with a right angle — is it smaller or larger?'); }
              else narrate('Look closely — this angle has a smaller turn than the right angle. An angle smaller than a right angle is acute.');
              setTimeout(() => b.classList.remove('wrong'), 700);
            }
          });
        });
      } },

    { text: 'Drag the ray to make a right angle.',
      go: makeAngleActivity(40, [85, 95], FB.right) },

    { text: 'Which angle is larger than a right angle but smaller than a straight angle?',
      go: pickCardActivity(
        [{ deg: 310 }, { deg: 135, correct: true }],
        'Exactly! Larger than a right angle but smaller than a straight angle — an obtuse angle.',
        'Not quite. This one has gone past the straight angle. Which angle stops between the right and straight angles?') },

    { text: '', final: true,
      go() {
        locked = true;
        root.querySelector('#lesson-say').style.visibility = 'hidden';
        $('lesson-scene').style.visibility = 'hidden';
        finalEl.hidden = false;
        SFX.fanfare(true);
      } }
  ];

  /* ---------- flow ---------- */
  function next() {
    if (!active) return;
    idx++;
    if (idx >= SLIDES.length) return finish();
    locked = false;
    const s = SLIDES[idx];
    if (s.rail) enterRail(); else exitRail();
    syncChips(s.chips);
    sayHint.style.visibility = 'hidden';
    s.go();
    if (s.text) narrate(s.text);
    if (!locked) sayHint.style.visibility = '';
  }

  function advanceTap() {
    if (!active || idx < 0) return;
    if (typing) {                       // first tap reveals the full line
      clearInterval(typeTimer);
      typing = false;
      sayLine.textContent = currentText;
      return;
    }
    if (locked) return;
    SFX.tap();
    next();
  }

  function finish() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(raf);
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
      advanceTap();
    }
  }

  root.addEventListener('click', advanceTap);
  $('lesson-skip').addEventListener('click', e => { e.stopPropagation(); SFX.tap(); finish(); });
  $('defend-btn').addEventListener('click', e => { e.stopPropagation(); SFX.launch(); finish(); });

  window.Lesson = {
    debug() { return { idx, typing, locked, total: SLIDES.length }; },
    play(done) {
      onDone = done;
      active = true;
      idx = -1;
      root.hidden = false;
      requestAnimationFrame(() => root.classList.remove('hide'));
      window.addEventListener('keydown', onKey);
      next();
    }
  };
})();
