/* Space Background — animated starfield + nebula on a <canvas>.
   Usage:  const bg = SpaceBackground(canvasEl, { starCount: 420 });
           bg.destroy();   // stops the loop and removes listeners
*/
function SpaceBackground(canvas, opts) {
  const o = Object.assign({
    starCount: 200,
    warmStarRatio: 0.28,   // 0..1 share of warm amber stars
    twinkle: true,
    driftSpeed: 0.35,      // horizontal parallax drift
    shootingStars: true,
    nebulaIntensity: 0.85, // 0..1.6 — how far the bands lift off the base
    background: '#0d1147'
  }, opts || {});

  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, stars = [], neb = null, shots = [], raf = 0, t0 = performance.now();
  let lastT = 0;
  const par = { x: 0, y: 0 };        // parallax velocity fed from the game (px/s)
  const nebOff = { x: 0, y: 0 };     // accumulated nebula scroll offset
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* Layered ribbon backdrop. Wavy shapes fold in from the left and the right
     in nested pairs — an outer shade with a second, tighter shade inside it —
     which is what gives the reference art its sense of depth. Every wave is
     built from sines with a whole number of cycles across the tile, so the
     layer scrolls horizontally without a seam. */
  const BASE_COL = [13, 17, 71];

  // crest/extent of a wave sits at `at` (0..1 across the width)
  const crestAt = at => -Math.PI / 2 - Math.PI * 2 * at;   // for 'below' bands
  const reachAt = at => Math.PI / 2 - Math.PI * 2 * at;    // for 'above' bands

  // y of a band's edge at x, as a fraction of height
  function edgeAt(band, x, W) {
    const p = (x / W) * Math.PI * 2;
    return band.y
         + band.a1 * Math.sin(band.k1 * p + band.p1)
         + band.a2 * Math.sin(band.k2 * p + band.p2);
  }

  function bandPath(g, band, W, H, shift, side) {
    g.beginPath();
    // step in exact fractions of W so the last point lands on x === W, where
    // the wave equals its value at x === 0 — otherwise the tile edge notches
    const steps = Math.max(8, Math.ceil(W / 4));
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * W;
      const y = edgeAt(band, x, W) * H + shift;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    // close over the half of the tile this band fills
    g.lineTo(W, side === 'below' ? H : 0);
    g.lineTo(0, side === 'below' ? H : 0);
    g.closePath();
    g.fill();
  }

  function mixCol(col) {  // pull each band toward the base by intensity
    const t = Math.max(0, Math.min(1.6, o.nebulaIntensity));
    return `rgb(${col.map((v, i) => Math.round(BASE_COL[i] + (v - BASE_COL[i]) * t)).join(',')})`;
  }

  function buildNebula() {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    const g = c.getContext('2d');
    const W = c.width, H = c.height;

    g.fillStyle = o.background;
    g.fillRect(0, 0, W, H);

    // Painted back to front. Each pair is drawn outer shape first, then the
    // tighter one inside it, so a strip of the outer shade stays visible as
    // the layer beneath. 'above' fills toward the top edge, 'below' toward
    // the bottom — and because a 'below' shape runs to the bottom of the tile,
    // the right-hand pair folds over the left-hand one where it rides higher.
    const bands = [
      // violet swell hugging the top-left, deeper shade under a brighter one
      { y: 0.11, a1: 0.20, a2: 0.05, p2: 1.2, at: 0.15, col: [44, 34, 134], side: 'above' },
      { y: 0.02, a1: 0.17, a2: 0.04, p2: 1.2, at: 0.15, col: [62, 49, 172], side: 'above' },

      // navy layers rising from the lower-left
      { y: 0.72, a1: 0.10, a2: 0.035, p2: 2.2, at: 0.25, col: [22, 29, 98],  side: 'below' },
      { y: 0.86, a1: 0.08, a2: 0.030, p2: 2.2, at: 0.25, col: [30, 39, 122], side: 'below' },

      // lighter layers folding in over them from the lower-right
      { y: 0.81, a1: 0.09, a2: 0.030, p2: 4.6, at: 0.80, col: [36, 46, 138], side: 'below' },
      { y: 0.94, a1: 0.07, a2: 0.025, p2: 4.6, at: 0.80, col: [45, 57, 158], side: 'below' }
    ];

    for (const band of bands) {
      band.k1 = 1;
      band.k2 = 2;
      band.p1 = band.side === 'below' ? crestAt(band.at) : reachAt(band.at);
      g.fillStyle = mixCol(band.col);
      bandPath(g, band, W, H, 0, band.side);
    }

    neb = c;
  }

  function seedStars() {
    stars = Array.from({ length: o.starCount }, () => {
      const warm = Math.random() < o.warmStarRatio;
      const depth = rnd(0.25, 1);
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: (warm ? rnd(0.7, 1.9) : rnd(0.4, 1.5)) * (0.6 + depth * 0.7),
        depth,
        hue: warm ? rnd(28, 48) : rnd(200, 235),
        sat: warm ? rnd(70, 95) : rnd(15, 45),
        lit: warm ? rnd(58, 72) : rnd(80, 100),
        base: rnd(0.25, 0.95),
        sp: rnd(0.4, 2.2),
        ph: Math.random() * Math.PI * 2
      };
    });
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    w = r.width || canvas.clientWidth;
    h = r.height || canvas.clientHeight;
    canvas.width = Math.max(1, w * dpr);
    canvas.height = Math.max(1, h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildNebula();
    seedStars();
  }

  function draw(t) {
    const dt = Math.min(Math.max(t - lastT, 0), 0.05);
    lastT = t;
    ctx.clearRect(0, 0, w, h);

    // the ribbon layer is the farthest thing out: it slides horizontally
    // against the ship's motion and wraps, and drifts only slightly vertically
    nebOff.x -= par.x * 0.12 * dt;
    nebOff.y = Math.max(-h * 0.04, Math.min(h * 0.04, nebOff.y - par.y * 0.05 * dt));
    // tile on whole pixels and overlap the copies by 1px: a fractional
    // destination width leaves a hairline gap at the seam
    const TW = neb.width;
    const ox = Math.round(((nebOff.x % TW) + TW) % TW);
    const oy = Math.round(-h * 0.05 + nebOff.y);   // 10% overheight, so the
    const th = Math.ceil(h * 1.1);                 // vertical drift can't show an edge
    ctx.drawImage(neb, ox - TW, oy, TW + 1, th);
    ctx.drawImage(neb, ox, oy, TW + 1, th);

    for (const s of stars) {
      // idle drift + depth-scaled parallax: deeper stars sweep past faster
      s.x -= o.driftSpeed * s.depth * 0.35 + par.x * s.depth * 0.5 * dt;
      s.y -= par.y * s.depth * 0.5 * dt;
      if (s.x < -4) s.x += w + 8; else if (s.x > w + 4) s.x -= w + 8;
      if (s.y < -4) s.y += h + 8; else if (s.y > h + 4) s.y -= h + 8;
      const a = o.twinkle ? s.base * (0.55 + 0.45 * Math.sin(t * s.sp + s.ph)) : s.base;
      ctx.beginPath();
      ctx.fillStyle = `hsla(${s.hue},${s.sat}%,${s.lit}%,${a})`;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      if (s.r > 1.5) {                       // soft halo on the bigger stars
        ctx.beginPath();
        ctx.fillStyle = `hsla(${s.hue},${s.sat}%,${s.lit}%,${a * 0.12})`;
        ctx.arc(s.x, s.y, s.r * 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (o.shootingStars) {
      if (Math.random() < 0.0025 && shots.length < 2) {
        shots.push({ x: Math.random() * w * 0.7 + w * 0.2, y: Math.random() * h * 0.5,
                     life: 0, len: 90 + Math.random() * 90,
                     vx: -260 - Math.random() * 200, vy: 90 + Math.random() * 70 });
      }
      const dt = 1 / 60;
      shots = shots.filter(sh => {
        sh.life += dt; sh.x += sh.vx * dt; sh.y += sh.vy * dt;
        const a = Math.max(0, 1 - sh.life / 1.1);
        const ang = Math.atan2(sh.vy, sh.vx);
        const gx = sh.x - Math.cos(ang) * sh.len, gy = sh.y - Math.sin(ang) * sh.len;
        const grd = ctx.createLinearGradient(sh.x, sh.y, gx, gy);
        grd.addColorStop(0, `rgba(255,255,255,${a * 0.9})`);
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = grd; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(gx, gy); ctx.stroke();
        return a > 0;
      });
    }
  }

  function loop(t) { draw((t - t0) / 1000); raf = requestAnimationFrame(loop); }

  window.addEventListener('resize', resize);
  resize();
  raf = requestAnimationFrame(loop);

  return {
    options: o,
    resize,
    setParallax(vx, vy) { par.x = vx || 0; par.y = vy || 0; },
    destroy() { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); }
  };
}

if (typeof module !== 'undefined') module.exports = SpaceBackground;
