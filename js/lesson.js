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
    <div id="lesson-say">
      <div class="say-inner">
        <p class="line"></p>
      </div>
    </div>
    <div id="lesson-scene">
      <svg id="lesson-stage" viewBox="0 0 ${W} ${H}" aria-hidden="true">
        <defs>
          <marker id="lm-w" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M1 1 L11 6 L1 11 Z" fill="#f4f6ff"/>
          </marker>
          <marker id="lm-y" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M1.4 1.6 L11 6 L1.4 10.4 L4.2 6 Z" fill="#ffd75e"/>
          </marker>
          <marker id="lm-c" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M1.4 1.6 L11 6 L1.4 10.4 L4.2 6 Z" fill="#5fd6ff"/>
          </marker>
          <marker id="lm-p" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M1.4 1.6 L11 6 L1.4 10.4 L4.2 6 Z" fill="#e88bff"/>
          </marker>
          <linearGradient id="lg-card" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#232e6e"/>
            <stop offset="1" stop-color="#141b46"/>
          </linearGradient>
          <marker id="lm-d" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M1 1 L11 6 L1 11 Z" fill="#23307c"/>
          </marker>
          <marker id="lm-g" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M1 1 L11 6 L1 11 Z" fill="#57c46b"/>
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
    <button type="button" id="lesson-back" class="nav-back" hidden aria-label="Back"></button>
    <button type="button" id="lesson-next" class="nav-next" hidden aria-label="Continue"></button>
    <div id="lesson-footer">
      <div id="lesson-chips"></div>
      <div id="lesson-actions"></div>
    </div>
    <div id="lesson-final" class="splash" hidden>
      <div class="splash-hills" aria-hidden="true"></div>
      <img class="splash-comet" src="assets/comet.svg" alt="" aria-hidden="true">
      <i class="splash-star s1"></i><i class="splash-star s2"></i><i class="splash-star s3"></i>
      <i class="splash-star s4"></i><i class="splash-star s5"></i>
      <h2 class="splash-title">ANGLE DEFENSE</h2>
      <p class="splash-sub">✦&nbsp; You’ve learned angles — now defend the station! &nbsp;✦</p>
      <svg class="splash-cannon" viewBox="20 190 260 145" aria-hidden="true">
        <path class="fc-arc" d="M 30 330 A 120 120 0 0 1 270 330" fill="none"/>
        <g class="fc-ticks">
          <line x1="262" y1="330" x2="274" y2="330"/>
          <line x1="247" y1="274" x2="257.4" y2="268"/>
          <line x1="206" y1="233" x2="212" y2="222.6"/>
          <line x1="150" y1="218" x2="150" y2="206"/>
          <line x1="94" y1="233" x2="88" y2="222.6"/>
          <line x1="53" y1="274" x2="42.6" y2="268"/>
          <line x1="38" y1="330" x2="26" y2="330"/>
        </g>
        <path class="fc-disc" d="M 70 330 A 80 80 0 0 1 230 330 Z"/>
        <path class="fc-ring" d="M 95 330 A 55 55 0 0 1 205 330" fill="none"/>
        <image class="dome-tint" href="assets/Camnono.png" x="46.4" y="194.8" width="207.1" height="143.8"/>
        <image href="assets/Canon1.svg" x="125.3" y="197.25" width="49.4" height="147.5"/>
      </svg>
      <button type="button" id="defend-btn" class="splash-btn">START GAME ▸</button>
      <p class="splash-tap">✦&nbsp; Tap to begin &nbsp;✦</p>
    </div>`;
  document.body.appendChild(root);

  const $ = id => root.querySelector('#' + id);
  const sayLine = root.querySelector('#lesson-say .line');
  const nextBtn = $('lesson-next');
  const backBtn = $('lesson-back');
  const stage = $('lesson-stage');
  const E = {
    refs: $('ls-refs'), arc: $('ls-arc'), corner: $('ls-corner'),
    ray1: $('ls-ray1'), ray2: $('ls-ray2'), pt: $('ls-pt'),
    label: $('ls-label'), annot: $('ls-annot'), cards: $('ls-cards'),
    recap: $('ls-recap')
  };
  const zones = $('lesson-zones'), actions = $('lesson-actions'),
        chipsEl = $('lesson-chips'), finalEl = $('lesson-final');
  const sayBox = root.querySelector('#lesson-say');

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

  function setLabel(text, x = P.x + 60, y = P.y + 90, anchor = 'start') {
    show(E.label, !!text);
    if (!text) return;
    E.label.textContent = text;
    attr(E.label, { x, y, 'text-anchor': anchor });
    E.label.classList.remove('pop');
    E.label.getBoundingClientRect();   // restart the pop-in animation
    E.label.classList.add('pop');
    SFX.pop();
  }

  /* yellow callout: a gently bowed arrow from (fx,fy) to (tx,ty) with the
     label near the tail — the curve keeps it from reading as a bare line */
  function callout(fx, fy, tx, ty, text, txAnchor = 'start') {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const mx = (fx + tx) / 2, my = (fy + ty) / 2;
    const dx = tx - fx, dy = ty - fy;
    g.innerHTML = `<path d="M ${fx} ${fy} Q ${mx + dy * 0.22} ${my - dx * 0.22} ${tx} ${ty}"
        fill="none" class="ls-callout-arrow" marker-end="url(#lm-y)"/>
      <text x="${fx + (txAnchor === 'start' ? 16 : -16)}" y="${fy + 12}"
        text-anchor="${txAnchor === 'start' ? 'start' : 'end'}" class="ls-callout">${text}</text>`;
    E.annot.appendChild(g);
    SFX.pop();
  }

  /* curved dotted leader (drop zone → the feature it names) */
  function leader(fx, fy, tx, ty, key, tint = 'gold') {
    const MARKER = { gold: 'lm-y', cyan: 'lm-c', pink: 'lm-p' };
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('class', `ls-leader ls-leader--${tint}`);
    p.setAttribute('fill', 'none');
    p.setAttribute('marker-end', `url(#${MARKER[tint] || 'lm-y'})`);
    const mx = (fx + tx) / 2, my = (fy + ty) / 2;
    const dx = tx - fx, dy = ty - fy;
    p.setAttribute('d', `M ${fx} ${fy} Q ${mx + dy * 0.18} ${my - dx * 0.18} ${tx} ${ty}`);
    if (key) p.dataset.for = key;
    return p;
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
    // ray2Len: shortens just this arm — needed when a steep downward angle
    // (e.g. reflex) would otherwise run the ray past the stage into the
    // footer tray below
    if (o.ray2 != null) setRay(E.ray2, o.ray2, o.ray2Len);
    (o.refs || []).forEach(refRay);
    if (o.arc != null) { show(E.arc, true); attr(E.arc, { d: arcPath(o.arc, o.arcR || AR) }); }
    if (o.corner) {
      show(E.corner, true);
      attr(E.corner, { d: `M ${P.x + 56} ${P.y} L ${P.x + 56} ${P.y - 56} L ${P.x} ${P.y - 56}` });
    }
    if (o.label) setLabel(o.label, o.labelX, o.labelY);
  }

  /* ---------- mini-angle drawings (cards, recap, chips) ---------- */
  // len2 lets the second ray run longer than the first — needed for the
  // complete angle, whose two arms sit almost on top of each other and
  // would otherwise fuse into what reads as a single ray
  function miniAngle(deg, r, len, cx, cy, marker = 'lm-w', len2 = len) {
    const large = deg > 180 ? 1 : 0;
    const lx = (a, l) => cx + Math.cos(rad(a)) * l;
    const ly = (a, l) => cy - Math.sin(rad(a)) * l;
    const ax = cx + Math.cos(rad(deg)) * r, ay = cy - Math.sin(rad(deg)) * r;
    // a right angle is marked with a small square corner, not the round arc
    // used for every other type (ray1 always sits at 0° in these icons, so
    // an axis-aligned bracket lines up correctly whenever deg is exactly 90)
    const mark = deg === 90
      ? `M ${cx + r * 0.72} ${cy} L ${cx + r * 0.72} ${cy - r * 0.72} L ${cx} ${cy - r * 0.72}`
      : `M ${cx + r} ${cy} A ${r} ${r} 0 ${large} 0 ${ax} ${ay}`;
    return `<path d="${mark}" fill="none" class="ls-mini-arc"/>
      <line x1="${cx}" y1="${cy}" x2="${lx(0, len)}" y2="${cy}" class="ls-mini-ray" marker-end="url(#${marker})"/>
      <line x1="${cx}" y1="${cy}" x2="${lx(deg, len2)}" y2="${ly(deg, len2)}" class="ls-mini-ray" marker-end="url(#${marker})"/>
      <circle cx="${cx}" cy="${cy}" r="7" fill="${marker === 'lm-d' ? '#23307c' : '#f4f6ff'}"/>`;
  }

  function buildCards(defs, onPick) {
    const cw = 500, ch = 430, xs = [95, 645], y = 95;
    defs.forEach((d, i) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'ls-card');
      g.dataset.correct = d.correct ? '1' : '0';
      // big cards, big diagrams: long arms, centre low-left so both arms fit
      g.innerHTML = `<rect x="${xs[i]}" y="${y}" width="${cw}" height="${ch}" rx="26" fill="url(#lg-card)"/>` +
        miniAngle(d.deg, 76, 235, xs[i] + cw / 2 - 40, y + ch / 2 + 48);
      g.addEventListener('click', e => { e.stopPropagation(); onPick(d, g); });
      E.cards.appendChild(g);
    });
  }

  /* ---------- narrator + flow ----------
     One sentence at a time: each line types out while the VoiceOver reads
     it. When BOTH finish, the slide "settles": within a statement group it
     auto-advances after a breath; at a group boundary (slide.pause) the
     icon continue button appears bottom-right instead. Activities gate
     themselves. (Statement grouping to be confirmed with Rishi.) */
  let idx = -1, active = false, onDone = null;
  let typeTimer = 0, typing = false, locked = false, currentText = '';
  let typeDone = false, voDone = false, narrSeq = 0, autoTimer = 0;
  const AUTO_MS = 1500;   // breath between auto-advancing statements
  let onNarr = null;   // one-shot: fires when the line has typed AND spoken
  function narrDone() {
    const f = onNarr;
    onNarr = null;
    if (f) f();
  }

  /* both halves of the line landed — advance or offer the nav button */
  function lineSettled(my) {
    if (narrSeq !== my || !typeDone || !voDone || !active) return;
    sayBox.classList.remove('speaking');
    narrDone();
    slideSettled();
  }

  function slideSettled() {
    if (!active || locked) return;
    const s = SLIDES[idx];
    if (s.pause) showNext();
    else autoTimer = setTimeout(() => { if (active && !locked) next(); }, AUTO_MS);
  }

  /* icon continue button, bottom-right */
  let nextFn = null;
  function showNext(fn) {
    nextFn = fn || next;
    if (nextBtn.hidden) { nextBtn.hidden = false; SFX.pop(); }
  }
  function hideNext() { nextBtn.hidden = true; nextFn = null; }
  nextBtn.addEventListener('click', e => {
    e.stopPropagation();
    const f = nextFn || next;
    hideNext();
    SFX.tap();
    f();
  });

  function narrate(text) {
    currentText = text;
    clearInterval(typeTimer);
    typing = true;
    typeDone = false;
    voDone = false;
    const my = ++narrSeq;
    sayBox.classList.add('speaking');
    VO.say(text, () => {
      if (narrSeq !== my) return;
      voDone = true;
      lineSettled(my);
    });
    // size the panel to the finished line up front, so the glass frame fits
    // the text and doesn't jitter wider while the typewriter runs. Prefer a
    // single line: if it only just misses, step the type down a touch (max
    // ~15%) before allowing a wrap.
    sayBox.style.width = '';
    sayLine.style.whiteSpace = 'nowrap';
    sayLine.style.fontSize = '';
    sayLine.textContent = text;
    const base = parseFloat(getComputedStyle(sayLine).fontSize);
    let scale = 1;
    while (sayLine.scrollWidth > sayLine.clientWidth + 1 && scale > 0.85) {
      scale -= 0.05;
      sayLine.style.fontSize = (base * scale).toFixed(1) + 'px';
    }
    if (sayLine.scrollWidth > sayLine.clientWidth + 1) {   // genuinely long
      sayLine.style.whiteSpace = '';
      sayLine.style.fontSize = '';
    }
    sayBox.style.width = Math.ceil(sayBox.getBoundingClientRect().width) + 'px';
    sayLine.textContent = '';
    let i = 0;
    typeTimer = setInterval(() => {
      sayLine.textContent = text.slice(0, ++i);
      if (i >= text.length) {
        clearInterval(typeTimer);
        typing = false;
        typeDone = true;
        lineSettled(my);
      }
    }, 22);
  }

  /* activity slides flip the narrator card into "challenge" dress: an amber
     frame, so tasks read differently from teaching without extra text */
  const taskMode = () => sayBox.classList.add('task');

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
    complete: ['Complete Angle', 359.9], straight: ['Straight Angle', 180],
    right: ['Right Angle', 90], acute: ['Acute Angle', 45],
    obtuse: ['Obtuse Angle', 135], reflex: ['Reflex Angle', 240]
  };
  const shownChips = new Set();   // types already sitting in the tray
  function addChipEl(k) {
    const [name, deg] = CHIP_DEFS[k];
    const d = document.createElement('div');
    d.className = 'lesson-chip';
    const len2 = k === 'complete' ? 68 : 52;   // stretch the swept arm so it clears the baseline ray
    d.innerHTML = `<svg viewBox="0 0 132 106">${miniAngle(deg, 20, 52, 54, 56, 'lm-d', len2)}</svg><span>${name}</span>`;
    chipsEl.appendChild(d);
    // tight-fit the viewBox around the drawing so every diagram sits
    // dead-centre in its card. getBBox ignores marker arrowheads — the pad
    // covers them; the floor keeps stroke scale comparable across cards.
    const svg = d.querySelector('svg');
    try {
      const b = svg.getBBox(), pad = 14, MINW = 128, MINH = 100;
      let x = b.x - pad, y = b.y - pad, w = b.width + pad * 2, h = b.height + pad * 2;
      if (w < MINW) { x -= (MINW - w) / 2; w = MINW; }
      if (h < MINH) { y -= (MINH - h) / 2; h = MINH; }
      svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
    } catch (e) { /* not rendered yet — default viewBox still works */ }
    return d;
  }
  function syncChips(list) {
    chipsEl.innerHTML = '';
    (list || []).forEach(k => {
      const d = addChipEl(k);
      if (active && !shownChips.has(k)) {   // safety net (dev skips): fly it in
        shownChips.add(k);
        flyChipIn(d);
      }
    });
  }
  /* snapshot capture path: the card takes off right away */
  function earnChip(k) {
    if (shownChips.has(k)) return;
    shownChips.add(k);
    flyChipIn(addChipEl(k), 60);
  }

  /* a newly earned card detaches from the stage and drops into its tray
     slot — swoosh on take-off, squash-and-pop when it lands */
  function flyChipIn(chip, delay = 520) {
    chip.style.visibility = 'hidden';   // slot is reserved, card is in flight
    setTimeout(() => {
      if (!chip.isConnected) return;    // slide moved on before take-off
      const sr = $('lesson-scene').getBoundingClientRect();
      const cr = chip.getBoundingClientRect();
      const dx = (sr.left + sr.width / 2 - cr.width / 2) - cr.left;
      const dy = (sr.top + sr.height * 0.42 - cr.height / 2) - cr.top;
      const clone = chip.cloneNode(true);
      clone.classList.add('fly');
      Object.assign(clone.style, {
        visibility: 'visible',
        left: cr.left + 'px', top: cr.top + 'px',
        width: cr.width + 'px', height: cr.height + 'px'
      });
      root.appendChild(clone);
      SFX.swoosh();
      const anim = clone.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(1.7)`, opacity: 0 },
        { transform: `translate(${dx}px, ${dy}px) scale(1.65)`, opacity: 1, offset: 0.16 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.55}px) scale(1.35)`, offset: 0.58 },
        { transform: 'translate(0, 0) scale(1)' }
      ], { duration: 900, easing: 'cubic-bezier(0.5, 0, 0.35, 1)' });
      anim.onfinish = () => {
        clone.remove();
        if (!chip.isConnected) return;
        chip.style.visibility = '';
        SFX.pop();
        chip.animate([
          { transform: 'scale(1.12, 0.85)' },
          { transform: 'scale(0.96, 1.06)' },
          { transform: 'scale(1)' }
        ], { duration: 260, easing: 'ease-out' });
      };
    }, delay);   // default: let the slide's own scene draw first
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
  let dragCfg = null;   // {deg, onChange, full?, cx?, cy?}
  function enableDrag(startDeg, onChange, opts) {
    dragCfg = Object.assign({ deg: startDeg, onChange }, opts);
    stage.classList.add('draggable');
  }
  function stageAngle(ev) {
    const ctm = stage.getScreenCTM().inverse();
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm);
    const cx = dragCfg.cx ?? P.x, cy = dragCfg.cy ?? P.y;
    let a = Math.atan2(cy - p.y, p.x - cx) * 180 / Math.PI;   // (-180, 180]
    if (dragCfg.full) return (a + 360) % 360;                 // free spin 0–360
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
      taskMode();
      scene({ ray2: startDeg, arc: startDeg });
      let tries = 0;
      // free spin — the full 360° is reachable. A ray imperceptibly close
      // to a landmark (90/180/270/360) snaps onto it, so what the student
      // sees is exactly what Check judges — no silent boundary rejections.
      const shown = d => {
        for (const s of [90, 180, 270, 360]) if (Math.abs(d - s) < 2) { d = s; break; }
        return Math.min(Math.max(d, 1), 359.9);
      };
      enableDrag(startDeg, d => liveAngle(shown(d)), { full: true });
      showHand(startDeg);
      button('Check', 'primary', () => {
        const d = shown(dragCfg.deg);
        if (d >= ok[0] && d <= ok[1]) {
          SFX.good();
          narrate(fb.right);
          dragCfg = null; stage.classList.remove('draggable');
          actions.innerHTML = '';
          setTimeout(next, 2600);
        } else {
          SFX.alert();
          tries++;
          narrate(tries === 1 ? fb.w1 : fb.w2);
          if (tries === 1 && fb.showRef) fb.showRef.forEach(refRay);
        }
      });
    };
  }

  /* feedback lines — short, clear, crisp */
  const FB = {
    acute: {
      right: 'Correct! Smaller than a right angle — an acute angle.',
      w1: 'Compare it with a right angle. Smaller or larger?',
      w2: 'Bring the ray below the dashed guide to make it acute.',
      showRef: ['up']
    },
    obtuse: {
      right: 'Excellent! That’s an obtuse angle.',
      w1: 'An obtuse angle lies between a right angle and a straight angle.',
      w2: 'Move the ray between the two dashed guides.',
      showRef: ['up', 'left']
    },
    right: {
      right: 'Perfect! A square corner — a right angle.',
      w1: 'A right angle makes a square corner.',
      w2: 'Line the ray up with the dashed guide.',
      showRef: ['up']
    }
  };

  /* a named-angle reveal (used by every "…is called a — angle" slide):
     the arm sweeps into place while the narration types, the name pops
     once the line lands, then a camera snap captures the angle and files
     it as a card in the tray below. Options: refs, arcR, labelX/Y,
     from (sweep start angle), static (no sweep — name + snap only),
     corner (show the square right-angle mark instead of the round arc). */
  function angleReveal(deg, name, chip, o = {}) {
    return function () {
      locked = true;
      const r = o.arcR || AR;
      const st = { sweep: !!o.static, narr: false, done: false };
      if (o.static) {
        scene({ ray2: deg, arc: deg, arcR: r, refs: o.refs, ray2Len: o.len });
      } else {
        const from = o.from ?? 1;
        scene({ ray2: from, arc: from, arcR: r, refs: o.refs, ray2Len: o.len });
        setTimeout(() => {
          if (!active) return;
          SFX.draw();
          animate(1300, k => {
            const d = Math.max(1, from + (deg - from) * k);
            setRay(E.ray2, d, o.len);
            attr(E.arc, { d: arcPath(d, r) });
          }, () => { st.sweep = true; step(); });
        }, 420);
      }
      onNarr = () => { st.narr = true; step(); };
      function step() {
        if (!st.sweep || !st.narr || st.done || !active) return;
        st.done = true;
        // a right angle is marked with a small square corner by convention,
        // not the round arc used for every other type — swap once settled
        if (o.corner) {
          show(E.arc, false);
          show(E.corner, true);
          attr(E.corner, { d: `M ${P.x + 56} ${P.y} L ${P.x + 56} ${P.y - 56} L ${P.x} ${P.y - 56}` });
        }
        setLabel(name, o.labelX, o.labelY, o.labelAnchor);
        setTimeout(() => {
          if (!active) return;
          snapCapture(chip);
          setTimeout(() => {           // card has landed — free to continue
            if (!active) return;
            locked = false;
            slideSettled();
          }, 1250);
        }, 800);
      }
    };
  }

  /* camera-snap: white flash over the board, then the earned card flies down */
  function snapCapture(chip) {
    SFX.shutter();
    const f = document.createElement('div');
    f.className = 'snap-flash';
    $('lesson-scene').appendChild(f);
    f.addEventListener('animationend', () => f.remove());
    earnChip(chip);
  }

  /* a two-card comparison question. On a wrong pick, the arcs — the part
     that shows how far each arm has turned — flash on both cards while the
     VoiceOver reads the hint, so the student sees WHAT to compare. */
  function pickCardActivity(defs, praise, retry) {
    return function () {
      locked = true;
      taskMode();
      scene({ pt: false, ray1: false });
      buildCards(defs, (d, g) => {
        if (d.correct) {
          SFX.good();
          g.classList.add('right');
          narrate(praise);
          setTimeout(next, 2600);
        } else {
          SFX.alert();
          g.classList.add('wrong');
          narrate(retry);
          E.cards.querySelectorAll('.ls-mini-arc').forEach(a => a.classList.add('flash'));
          setTimeout(() => {
            g.classList.remove('wrong');
            E.cards.querySelectorAll('.ls-mini-arc').forEach(a => a.classList.remove('flash'));
          }, 1700);
        }
      });
    };
  }

  /* ---------- the lesson ---------- */
  /* One sentence per slide. `pause: true` marks a statement-group boundary:
     the icon continue button appears there instead of auto-advancing.
     (Grouping to be confirmed with Rishi.) */
  const SLIDES = [
    { text: 'Let’s start with a point.',
      go() { scene({ ray1: false, label: 'Point', labelX: P.x - 40, labelY: P.y + 100 }); } },

    { text: 'Now, let’s draw a ray from this point.',
      go() { scene({ ray1: false }); growRay(E.ray1, 0); } },

    { text: 'Let’s draw another ray from the same point.',
      go() { scene({}); growRay(E.ray2, 60); } },

    { text: 'The space between the two rays is called an angle.', pause: true,
      go() { scene({ ray2: 60 }); sweepArc(60); setTimeout(() => setLabel('Angle'), 620); } },

    { text: 'The two rays are called the arms of the angle.',
      go() {
        scene({ ray2: 60, arc: 60 });
        callout(px(60, 285) + 165, py(60, 285) - 45, px(60, 240), py(60, 240), 'Arms');
        callout(px(0, 285) + 65, py(0, 285) - 65, px(0, 250), py(0, 250) - 6, 'Arms');
      } },

    { text: 'The point where the two rays meet is called the vertex.',
      go() {
        scene({ ray2: 60, arc: 60 });
        callout(P.x - 190, P.y + 130, P.x - 16, P.y + 12, 'Vertex', 'end');
      } },

    /* drag the labels — check-for-understanding. The figure stays centred;
       the label chips dock on the left, the drop capsules line up in a
       column on the right, each tied to its feature by a curved leader.
       A looping hand animation acts out the first drag — no "DRAG THESE"
       text needed. */
    { text: 'Drag each label to its place.',
      go() {
        locked = true;
        taskMode();
        scene({ ray2: 60, arc: 60 });
        const KEYS = ['Vertex', 'Arms', 'Angle'];
        const done = new Set();
        const dock = document.createElement('div');
        dock.id = 'drag-dock';
        zones.appendChild(dock);

        /* celebratory sparkle ring when a label lands in its home */
        function celebrate(z) {
          const zr = z.getBoundingClientRect(), br = zones.getBoundingClientRect();
          for (let i = 0; i < 7; i++) {
            const s = document.createElement('span');
            s.className = 'zone-spark';
            const dir = (i / 7) * Math.PI * 2;
            s.style.left = (zr.left + zr.width / 2 - br.left) + 'px';
            s.style.top = (zr.top + zr.height / 2 - br.top) + 'px';
            s.style.setProperty('--dx', Math.cos(dir) * 66 + 'px');
            s.style.setProperty('--dy', Math.sin(dir) * 54 + 'px');
            zones.appendChild(s);
            s.addEventListener('animationend', () => s.remove());
          }
          SFX.good();
        }

        /* the demo hand acts out one full drag, dock → first capsule,
           looping until the student grabs a chip themselves */
        function demoHand() {
          const c0 = dock.querySelector('.lesson-drag');
          // act out the drag on the first chip's OWN capsule, so the
          // demonstrated gesture is also a true one
          const z0 = c0 && (zones.querySelector(`.lesson-zone[data-key="${c0.dataset.key}"]`)
                     || zones.querySelector('.lesson-zone'));
          if (!c0 || !z0) return;
          const br = zones.getBoundingClientRect();
          const a = c0.getBoundingClientRect(), b = z0.getBoundingClientRect();
          const h = document.createElement('div');
          h.className = 'lesson-hand demo';
          h.textContent = '👆';
          h.style.left = (a.left + a.width / 2 - br.left) + 'px';
          h.style.top = (a.top + a.height / 2 - br.top) + 'px';
          zones.appendChild(h);
          const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
          const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
          h.animate([
            { transform: 'translate(-30%, -10%) scale(1)', opacity: 0, offset: 0 },
            { transform: 'translate(-30%, -10%) scale(1)', opacity: 1, offset: 0.12 },
            { transform: 'translate(-30%, -10%) scale(0.82)', opacity: 1, offset: 0.22 },
            { transform: `translate(calc(-30% + ${dx}px), calc(-10% + ${dy}px)) scale(0.82)`, opacity: 1, offset: 0.72 },
            { transform: `translate(calc(-30% + ${dx}px), calc(-10% + ${dy}px)) scale(1)`, opacity: 1, offset: 0.84 },
            { transform: `translate(calc(-30% + ${dx}px), calc(-10% + ${dy}px)) scale(1)`, opacity: 0, offset: 1 }
          ], { duration: 2800, iterations: Infinity, easing: 'ease-in-out' });
        }

        // zones anchor to real stage geometry once layout has settled, and
        // mirror the drag chips' exact size so labels visibly fit.
        // Each capsule sits NEXT TO the feature it names — Angle upper-left,
        // Arms upper-right, Vertex below the point — so every leader is
        // short and none of them cross: the screen reads like a labelled
        // diagram, not a wiring loom.
        requestAnimationFrame(() => {
          const chip = dock.querySelector('.lesson-drag');
          const cr = chip ? chip.getBoundingClientRect() : null;
          // each slot + its arrow share a hue (gold = angle, cyan = arms,
          // pink = vertex) so slot↔feature pairs read at a glance; the drag
          // chips stay neutral so the colours never give the answer away
          const SPOTS = [
            { key: 'Angle', tint: 'gold', x: 320, y: 165, leads: [
                [430, 200, 648, 370]        // → lands square on the arc's midpoint
              ] },
            { key: 'Arms', tint: 'cyan', x: 1005, y: 165, leads: [
                [905, 190, px(60, 205) + 26, py(60, 205) - 4],        // → upper arm
                [918, 210, px(0, 255) + 6, py(0, 255) - 16]           // → lower arm
              ] },
            { key: 'Vertex', tint: 'pink', x: 760, y: 565, leads: [
                [700, 545, P.x + 22, P.y + 20]                        // → the point
              ] }
          ];
          SPOTS.forEach(t => {
            const z = document.createElement('div');
            z.className = `lesson-zone tint-${t.tint}`;
            z.dataset.key = t.key;
            z.textContent = '?';
            const pos = stagePosPct(t.x, t.y);
            z.style.left = pos.left + '%';
            z.style.top = pos.top + '%';
            if (cr) {
              z.style.width = cr.width + 'px';
              z.style.height = cr.height + 'px';
            }
            zones.appendChild(z);
            t.leads.forEach(ld => E.annot.appendChild(leader(ld[0], ld[1], ld[2], ld[3], t.key, t.tint)));
          });
          demoHand();
        });

        KEYS.forEach(k => {
          const c = document.createElement('button');
          c.type = 'button';
          c.className = 'lesson-drag';
          c.dataset.key = k;
          c.textContent = k;
          dock.appendChild(c);
          let sx, sy, dx = 0, dy = 0, busy = false;
          c.addEventListener('pointerdown', ev => {
            if (busy) return;
            ev.preventDefault();
            hideHand();
            c.setPointerCapture(ev.pointerId);
            sx = ev.clientX; sy = ev.clientY;
            const move = e2 => {
              dx = e2.clientX - sx; dy = e2.clientY - sy;
              c.style.transform = `translate(${dx}px, ${dy}px)`;
            };
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
                  z.classList.add('filled');
                  z.textContent = c.dataset.key;
                  // leaders stay put once correct — just settle from a
                  // dotted "look here" hint into a plain solid confirmation
                  E.annot.querySelectorAll(`.ls-leader[data-for="${z.dataset.key}"]`)
                    .forEach(x => {
                      x.classList.add('done');
                      x.setAttribute('marker-end', 'url(#lm-g)');
                    });
                  celebrate(z);
                  c.remove();
                  done.add(k);
                  if (done.size === KEYS.length) {
                    narrate('Perfect! Vertex, arms — and the angle between them.');
                    setTimeout(next, 2600);
                  }
                } else {
                  // wrong home: the drop lands, shakes its head, walks back
                  SFX.alert();
                  busy = true;
                  c.style.setProperty('--dx', dx + 'px');
                  c.style.setProperty('--dy', dy + 'px');
                  c.classList.add('shake');
                  setTimeout(() => {
                    c.classList.remove('shake');
                    c.style.transition = 'transform 0.45s cubic-bezier(0.3, 0.8, 0.4, 1)';
                    c.style.transform = '';
                    setTimeout(() => { c.style.transition = ''; busy = false; }, 480);
                  }, 480);
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

    { text: 'Angles can be different sizes.',
      go() { scene({ ray2: 60, arc: 60, label: 'Angle' }); } },

    { text: 'The angle grows as one arm turns away from the other.',
      go() {
        scene({ ray2: 60, arc: 60 });
        // the arm demonstrates on its own: swing wider, then narrower, settle
        const swing = (a, b, dur, next) =>
          animate(dur, k => liveAngle(a + (b - a) * k), next);
        setTimeout(() => {
          if (!active) return;
          SFX.draw();
          swing(60, 125, 900, () => swing(125, 28, 1100, () => swing(28, 60, 800)));
        }, 600);
      } },

    { text: 'Turn the ray all the way around!',
      go() {
        locked = true;
        taskMode();
        scene({ ray2: 60, arc: 60 });
        // free spin: the student can take the arm through a full 360°
        enableDrag(60, d => liveAngle(Math.min(Math.max(d, 1), 359.9)), { full: true });
        showHand(60);
        showNext(() => {
          dragCfg = null; stage.classList.remove('draggable');
          next();
        });
      } },

    { text: 'Tap the larger angle.',
      go: pickCardActivity(
        [{ deg: 45 }, { deg: 135, correct: true }],
        'Right! A bigger turn makes a bigger angle.',
        'Look at the turn between the arms. Try again!') },

    { text: 'When an arm makes a complete turn around the vertex, it is called a complete angle.',
      // 359.9° (not a bare 360) keeps the arc's large-arc sweep well-defined
      // while landing the arm back on top of the baseline ray, as a
      // completed revolution should look. Made noticeably longer than the
      // baseline ray too — at nearly the same direction, equal-length arms
      // would fuse into what reads as a single ray with no visible arc
      go: angleReveal(359.9, 'Complete Angle', 'complete',
        { refs: ['up', 'left'], arcR: 70, labelY: P.y + 120, len: LEN + 80 }) },

    { text: 'When the ray takes only half of a complete turn…',
      chips: ['complete'],
      go() {
        scene({ ray2: 1, arc: 1 });
        setTimeout(() => {
          if (!active) return;
          SFX.draw();
          animate(1200, k => liveAngle(Math.max(1, 180 * k)));
        }, 420);
      } },

    { text: '…the rays lie on a straight line.',
      chips: ['complete'],
      go() { scene({ ray2: 180, arc: 180 }); } },

    { text: 'It is called a straight angle.',
      chips: ['complete'],
      // the straight-angle line is symmetric about the vertex, so the label
      // is centred on it too, rather than left-anchored like the others
      go: angleReveal(180, 'Straight Angle', 'straight', { static: true, labelX: P.x, labelAnchor: 'middle' }) },

    { text: 'Exactly half of a straight angle makes a right angle.',
      chips: ['complete', 'straight'],
      go: angleReveal(90, 'Right Angle', 'right', { from: 180, corner: true }) },

    { text: 'It looks like the corner of a square.', pause: true,
      chips: ['complete', 'straight', 'right'],
      go() { scene({ ray2: 90, corner: true, label: 'Right Angle' }); } },

    { text: 'An angle smaller than a right angle is called an acute angle.',
      chips: ['complete', 'straight', 'right'],
      go: angleReveal(45, 'Acute Angle', 'acute', { refs: ['up'], from: 90 }) },

    /* drag challenges show NO learned-cards tray — the card art would
       hand the player the answer shape */
    { text: 'Drag the ray to make an acute angle.',
      go: makeAngleActivity(120, [1, 89], FB.acute) },

    { text: 'An angle larger than a right angle but smaller than a straight angle is called an obtuse angle.',
      chips: ['complete', 'straight', 'right', 'acute'],
      go: angleReveal(135, 'Obtuse Angle', 'obtuse', { refs: ['up', 'left'], from: 90 }) },

    { text: 'Drag the ray to make an obtuse angle.',
      go: makeAngleActivity(45, [91, 179], FB.obtuse) },

    { text: 'An angle that extends beyond the straight angle is called a reflex angle.', pause: true,
      chips: ['complete', 'straight', 'right', 'acute', 'obtuse'],
      // shortened arm: at 235° the full-length ray would dip past the stage
      // into the card tray below — clip it to a length that clears the tray
      go: angleReveal(235, 'Reflex Angle', 'reflex', { refs: ['up', 'left'], arcR: 70, from: 180, len: 210 }) },

    /* recap — a live angle explorer: spin the ray a full turn, the sector
       fill sweeps with it and the type name flips as each band is entered */
    { text: 'Drag the ray and watch the angle change!',
      go() {
        locked = true;
        taskMode();
        scene({ pt: false, ray1: false });
        const C = { x: 620, y: 345 }, R = 245, ARM = R * 0.86, FR = R * 0.94;
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.innerHTML = `
          <circle class="ae-disc" cx="${C.x}" cy="${C.y}" r="${R}"/>
          <line class="ae-cross" x1="${C.x - R + 16}" y1="${C.y}" x2="${C.x + R - 16}" y2="${C.y}"/>
          <line class="ae-cross" x1="${C.x}" y1="${C.y - R + 16}" x2="${C.x}" y2="${C.y + R - 16}"/>
          <path id="ae-fill"/>
          <line class="ae-ray" x1="${C.x}" y1="${C.y}" x2="${C.x + ARM}" y2="${C.y}"/>
          <line id="ae-ray" class="ae-ray"/>
          <path id="ae-arc" fill="none"/>
          <circle class="ae-hub" cx="${C.x}" cy="${C.y}" r="10"/>
          <circle id="ae-handle" r="17"/>
          <text id="ae-name" x="${C.x}" y="${C.y + R + 62}" text-anchor="middle"></text>`;
        E.recap.appendChild(g);
        const fill = g.querySelector('#ae-fill'), arc = g.querySelector('#ae-arc'),
              ray = g.querySelector('#ae-ray'), handle = g.querySelector('#ae-handle'),
              nameEl = g.querySelector('#ae-name');
        const typeOf = d =>
          d >= 356 ? 'Complete Angle' :
          d > 183  ? 'Reflex Angle'   :
          d >= 177 ? 'Straight Angle' :
          d > 93   ? 'Obtuse Angle'   :
          d >= 87  ? 'Right Angle'    : 'Acute Angle';
        const snap = d => {           // the landmark angles feel magnetic
          for (const s of [90, 180, 270, 360]) if (Math.abs(d - s) < 5) return s;
          return d;
        };
        let lastType = '';
        function render(deg) {
          const d = Math.min(Math.max(deg, 2), 359.9), large = d > 180 ? 1 : 0;
          const cos = Math.cos(rad(d)), sin = Math.sin(rad(d));
          attr(ray, { x1: C.x, y1: C.y, x2: C.x + cos * ARM, y2: C.y - sin * ARM });
          attr(handle, { cx: C.x + cos * ARM, cy: C.y - sin * ARM });
          fill.setAttribute('d', `M ${C.x} ${C.y} L ${C.x + FR} ${C.y}
            A ${FR} ${FR} 0 ${large} 0 ${C.x + cos * FR} ${C.y - sin * FR} Z`);
          arc.setAttribute('d', `M ${C.x + 70} ${C.y}
            A 70 70 0 ${large} 0 ${C.x + cos * 70} ${C.y - sin * 70}`);
          const t = typeOf(deg);
          nameEl.textContent = t;   // type name only — no degree readout
          if (t !== lastType) { if (lastType) SFX.pop(); lastType = t; }
        }
        render(60);
        enableDrag(60, d => render(snap(d)), { full: true, cx: C.x, cy: C.y });
        showNext(() => {
          dragCfg = null; stage.classList.remove('draggable');
          next();
        });
      } },

    { text: 'Tap the smaller angle.',
      go: pickCardActivity(
        [{ deg: 45, correct: true }, { deg: 135 }],
        'Yes! A smaller turn makes a smaller angle.',
        'Which arm has turned less? Try again!') },

    { text: 'Which type of angle is this?',
      go() {
        locked = true;
        taskMode();
        scene({ ray2: 45, arc: 45 });
        let tries = 0;
        ['Acute', 'Obtuse', 'Right', 'Straight'].forEach(name => {
          button(name, 'quiz', b => {
            if (name === 'Acute') {
              SFX.good();
              b.classList.add('right');
              narrate('That’s right! Smaller than a right angle — acute.');
              actions.querySelectorAll('button').forEach(x => x.disabled = true);
              setTimeout(next, 2600);
            } else {
              SFX.alert();
              b.classList.add('wrong');
              tries++;
              if (tries === 1) { refRay('up'); narrate('Compare it with a right angle — smaller or larger?'); }
              else narrate('A smaller turn than a right angle means acute.');
              setTimeout(() => b.classList.remove('wrong'), 700);
            }
          });
        });
      } },

    { text: 'Drag the ray to make a right angle.',
      go: makeAngleActivity(40, [87, 93], FB.right) },

    { text: 'Tap the obtuse angle.',
      go: pickCardActivity(
        [{ deg: 310 }, { deg: 135, correct: true }],
        'Exactly! That’s an obtuse angle.',
        'That one goes past a straight angle. Try again!') },

    { text: '', final: true,
      go() {
        locked = true;
        root.querySelector('#lesson-say').style.visibility = 'hidden';
        $('lesson-scene').style.visibility = 'hidden';
        $('lesson-skip').style.visibility = 'hidden';   // splash owns the exit
        finalEl.hidden = false;
        SFX.fanfare(true);
      } }
  ];

  /* ---------- flow ---------- */
  function next() {
    if (!active) return;
    clearTimeout(autoTimer);
    hideNext();
    idx++;
    if (idx >= SLIDES.length) return finish();
    locked = false;
    onNarr = null;
    typeDone = voDone = false;
    sayBox.classList.remove('task');
    const s = SLIDES[idx];
    // no back on the first slide or on the final splash (it owns the exit)
    backBtn.hidden = idx === 0 || !!s.final;
    syncChips(s.chips);
    s.go();
    if (s.text) narrate(s.text);
  }

  /* step back one slide: every slide's go() rebuilds its scene from
     scratch, so replaying the previous one restores it faithfully */
  function goBack() {
    if (!active || idx <= 0) return;
    clearTimeout(autoTimer);
    hideNext();
    VO.stop();
    clearInterval(typeTimer);
    typing = false;
    dragCfg = null;                       // release any live drag activity
    stage.classList.remove('draggable');
    SFX.tap();
    idx -= 2;
    next();
  }
  backBtn.addEventListener('click', e => { e.stopPropagation(); goBack(); });

  /* a tap is only ever "get on with this line": first tap completes the
     typing, a second skips the rest of the VoiceOver. Moving between
     statement groups is the nav button's job alone. */
  function advanceTap() {
    if (!active || idx < 0) return;
    if (typing) {
      clearInterval(typeTimer);
      typing = false;
      sayLine.textContent = currentText;
      typeDone = true;
      lineSettled(narrSeq);
      return;
    }
    if (window.VO && VO.speaking()) VO.skip();
  }

  function finish() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(raf);
    clearInterval(typeTimer);
    clearTimeout(autoTimer);
    VO.stop();
    root.classList.add('hide');
    root.addEventListener('transitionend', () => root.remove(), { once: true });
    window.removeEventListener('keydown', onKey);
    if (onDone) onDone();
  }

  function onKey(e) {
    if (!active) return;
    if (e.key === 'ArrowLeft' && !backBtn.hidden) {
      e.preventDefault();
      goBack();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (!nextBtn.hidden) nextBtn.click();
      else advanceTap();
    }
  }

  root.addEventListener('click', advanceTap);
  $('lesson-skip').addEventListener('click', e => { e.stopPropagation(); SFX.tap(); finish(); });
  $('defend-btn').addEventListener('click', e => { e.stopPropagation(); SFX.launch(); finish(); });

  window.Lesson = {
    debug() { return { idx, typing, locked, total: SLIDES.length }; },
    skipTo(i) { if (active) { idx = i - 1; next(); } },   // dev/testing hook
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
