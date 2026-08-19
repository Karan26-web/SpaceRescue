/* FireFX — live fire for the meteor: a canvas particle layer over the arena.
   Three stacked systems sell the burn — soft smoke underneath, additive
   flame blobs that cool from white-hot to deep red as they age, and bright
   embers that scatter and twinkle. game.js feeds it the meteor head's
   position + tail direction every frame; burst() fires on detonation. */
(function () {
  const canvas = document.getElementById('fx-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const MAX_PARTICLES = 640;

  let W = 0, H = 0;
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;   // arena still hidden pre-start
    W = r.width; H = r.height;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);

  /* pre-rendered soft radial sprites — one per cooling stage, plus smoke
     and ember. drawImage of a cached sprite beats per-particle gradients */
  function makeSprite(inner, outer) {
    const s = document.createElement('canvas');
    s.width = s.height = 64;
    const c = s.getContext('2d');
    const g = c.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, inner);
    g.addColorStop(0.55, outer);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    return s;
  }
  const FLAME = [
    makeSprite('rgba(255,255,235,1)',   'rgba(255,225,130,0.55)'),  // white-hot
    makeSprite('rgba(255,235,140,1)',   'rgba(255,170,50,0.5)'),    // yellow
    makeSprite('rgba(255,180,70,0.95)', 'rgba(255,100,25,0.45)'),   // orange
    makeSprite('rgba(255,110,40,0.9)',  'rgba(210,50,15,0.4)'),     // red
    makeSprite('rgba(190,70,25,0.8)',   'rgba(120,30,12,0.32)')     // dying red
  ];
  const SMOKE = makeSprite('rgba(90,86,110,0.5)',  'rgba(60,58,80,0.25)');
  const EMBER = makeSprite('rgba(255,245,200,1)',  'rgba(255,150,40,0.6)');

  const parts = [];
  const rand = (a, b) => a + Math.random() * (b - a);

  function push(p) {
    if (parts.length >= MAX_PARTICLES) parts.shift();
    parts.push(p);
  }

  /* --- continuous trail: called every frame while the meteor flies.
     (x, y) = head centre, (tx, ty) = unit vector pointing tail-ward
     (opposite of travel), headR = head radius in px --- */
  let lastTrail = 0;
  const emitDebt = { flame: 0, ember: 0, smoke: 0 };

  function trail(x, y, tx, ty, headR, intensity = 1) {
    if (!W) resize();
    const now = performance.now();
    const dt = Math.min((now - lastTrail) / 1000, 0.1);
    lastTrail = now;
    if (dt <= 0) return;
    const rates = { flame: 140 * intensity, ember: 18 * intensity, smoke: 14 };
    for (const kind in rates) {
      emitDebt[kind] += rates[kind] * dt;
      while (emitDebt[kind] >= 1) {
        emitDebt[kind]--;
        spawnOne(kind, x, y, tx, ty, headR);
      }
    }
  }

  function spawnOne(kind, x, y, tx, ty, headR) {
    const px = -ty, py = tx;             // perpendicular, for spread + wobble
    if (kind === 'smoke') {              // only well down the tail, post-flame
      const off = rand(-0.55, 0.55) * headR;
      const back = rand(headR * 1.8, headR * 3.4);
      push({
        kind,
        x: x + tx * back + px * off,
        y: y + ty * back + py * off,
        vx: tx * rand(30, 70) + px * rand(-18, 18),
        vy: ty * rand(30, 70) + py * rand(-18, 18),
        r: headR * rand(0.5, 0.9),
        life: rand(0.9, 1.6),
        age: 0, px, py,
        phase: rand(0, Math.PI * 2), freq: rand(6, 14),
        amp: headR * rand(0.05, 0.2)
      });
      return;
    }
    // flame + ember: born on a ring hugging the head's rim so fire sheathes
    // the whole rock — dense at the tail side (phi = 0), thinning to short
    // licks that wrap around to the leading edge (phi = ±PI)
    const u = Math.random() * 2 - 1;
    const phi = u * u * u * Math.PI;              // cubic bias tail-ward
    const rx = tx * Math.cos(phi) + px * Math.sin(phi);   // radial unit
    const ry = ty * Math.cos(phi) + py * Math.sin(phi);
    const wrap = 0.5 + 0.5 * Math.cos(phi);       // 1 at tail → 0 at the nose
    const ring = headR * rand(0.72, 1.05);
    const speed = kind === 'ember' ? rand(140, 320) : rand(90, 200);
    const drift = 0.35 + 0.65 * wrap;             // nose-born fire streams less
    push({
      kind,
      x: x + rx * ring,
      y: y + ry * ring,
      vx: tx * speed * drift + rx * speed * 0.15, // tail-ward + slight breakout
      vy: ty * speed * drift + ry * speed * 0.15,
      r: (kind === 'ember' ? rand(2, 4.5) : headR * rand(0.3, 0.55))
         * (0.5 + 0.5 * wrap),
      life: (kind === 'ember' ? rand(0.5, 1.1) : rand(0.3, 0.6))
            * (0.45 + 0.55 * wrap),
      age: 0, px, py,
      phase: rand(0, Math.PI * 2),
      freq: rand(6, 14),
      amp: kind === 'flame' ? headR * rand(0.12, 0.35) : headR * rand(0.05, 0.2)
    });
  }

  /* --- one-shot fireball for detonations --- */
  function burst(x, y, scale = 1) {
    if (!W) resize();
    const n = Math.round(26 * scale);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rand(60, 420) * scale;
      push({
        kind: i % 3 ? 'ember' : 'flame',
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.85,
        r: i % 3 ? rand(2, 5) : rand(10, 26) * scale,
        life: rand(0.4, 0.9),
        age: 0,
        px: -Math.sin(a), py: Math.cos(a),
        phase: rand(0, Math.PI * 2), freq: rand(6, 12), amp: rand(2, 8)
      });
    }
  }

  /* --- sim + render loop (idles cheaply when no particles are alive) --- */
  function drawP(p) {
    const t = p.age / p.life;
    const wob = Math.sin(p.age * p.freq + p.phase) * p.amp * t;
    const x = p.x + p.px * wob;
    const y = p.y + p.py * wob;
    let sprite, r, a;
    if (p.kind === 'flame') {
      sprite = FLAME[Math.min(4, (t * 5) | 0)];   // cool through the palette
      r = p.r * (0.65 + 1.5 * t);                 // expand while cooling
      a = (1 - t) * 0.9;
    } else if (p.kind === 'ember') {
      sprite = EMBER;
      r = p.r * (1 - t * 0.6);
      a = (1 - t) * (0.55 + 0.45 * Math.sin(p.age * 40 + p.phase));  // twinkle
    } else {
      sprite = SMOKE;
      r = p.r * (0.6 + 2.2 * t);
      a = Math.sin(Math.min(1, t) * Math.PI) * 0.32;  // ease in, thin out
    }
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
  }

  let last = performance.now();
  (function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    if (!W) { resize(); if (!W) return; }
    ctx.clearRect(0, 0, W, H);
    if (!parts.length) return;

    const drag = Math.max(0, 1 - 1.6 * dt);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (p.age >= p.life) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= drag;                       // flames decelerate as they cool
      p.vy *= drag;
      if (p.kind === 'smoke') p.vy -= 14 * dt;   // gentle lift
    }

    // smoke sits under the fire; flames + embers blend additively so
    // overlapping blobs glow hotter instead of muddying
    ctx.globalCompositeOperation = 'source-over';
    for (const p of parts) if (p.kind === 'smoke') drawP(p);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) if (p.kind !== 'smoke') drawP(p);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  })(last);

  window.FireFX = { trail, burst };
})();
