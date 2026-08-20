/* Space Rescue — sound effects (revised pass).
   Everything is synthesized with WebAudio (no audio files, works offline).

   Stage map:
     start screen idle .... ambienceStart / ambienceStop   (drifting drone + solar wind)
     start button ......... launch()                       (rising whoosh + low push)
     meteor approach ...... approachStart(secs) / approachStop()
     answer tap ........... tap()                          (soft mallet pluck)
     cannon swings ........ servo()                        (whir + locking clunk)
     cannon fires ......... fire()                         (recoil thump + zap + air tail)
     correct answer ....... good()                         (bell arpeggio + sparkle)
     meteor destroyed ..... shatter()                      (bright shatter + debris)
     wrong bearing ........ alert()                        (falling siren)
     cannon is hit ........ impact()                       (sub drop + clang + whoop, ducked)
     shield lost .......... lifeLost(remaining)            (double heartbeat)
     end of run ........... fanfare(won)

   Master gain ducks under big hits, every one-shot is pitch/level randomised so
   repeats don't fatigue, audio suspends when the tab is hidden, and mute is
   persisted in localStorage. Audio arms on the first user gesture. */
window.SFX = (function () {
  const STORE_KEY = 'spaceRescue.muted';
  let ctx = null, master = null, muted = false;
  let thrustGain = null, thrustFilter = null, thrustLevel = 0;
  const loops = {};

  /* sound is always on — no persisted mute state is read any more */
  const baseLevel = () => (muted ? 0 : 0.5);
  const vary = (amt) => 1 + (Math.random() * 2 - 1) * amt;   // ±amt

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = baseLevel();
    master.connect(ctx.destination);

    // thruster: looping filtered noise, silent until throttled
    const src = noiseSrc(2);
    src.loop = true;
    thrustFilter = ctx.createBiquadFilter();
    thrustFilter.type = 'lowpass';
    thrustFilter.frequency.value = 220;
    thrustFilter.Q.value = 0.8;
    thrustGain = ctx.createGain();
    thrustGain.gain.value = 0;
    src.connect(thrustFilter).connect(thrustGain).connect(master);
    src.start();

    if (thrustLevel > 0) api.setThrust(thrustLevel);
    return true;
  }

  ['pointerdown', 'keydown'].forEach(ev =>
    window.addEventListener(ev, () => ensure(), { passive: true }));

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  /* ---------- primitives ---------- */

  function noiseSrc(sec) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * sec));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  /* pitched envelope: type, start Hz, end Hz, when, duration, peak gain */
  function tone(type, f0, f1, t, dur, peak, dest) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.012, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /* FM bell — warmer than a bare triangle, decays like a struck object */
  function bell(freq, t, dur, peak, dest) {
    const car = ctx.createOscillator(), mod = ctx.createOscillator();
    const mg = ctx.createGain(), g = ctx.createGain();
    car.type = 'sine'; car.frequency.value = freq;
    mod.type = 'sine'; mod.frequency.value = freq * 2.7;
    mg.gain.setValueAtTime(freq * 1.6, t);
    mg.gain.exponentialRampToValueAtTime(1, t + dur * 0.5);
    mod.connect(mg).connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(g).connect(dest || master);
    mod.start(t); car.start(t);
    mod.stop(t + dur); car.stop(t + dur + 0.02);
  }

  /* filtered noise burst: length, filter type, start Hz, end Hz, peak, when */
  function burst(sec, type, f0, f1, peak, t, Q, dest) {
    const n = noiseSrc(sec), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = type; f.Q.value = Q || 1;
    f.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + sec);
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + sec);
    n.connect(f).connect(g).connect(dest || master);
    n.start(t);
  }

  /* dip the whole mix so a big hit has room, then recover */
  function duck(t, amount, hold) {
    const g = master.gain, base = baseLevel();
    g.cancelScheduledValues(t);
    g.setValueAtTime(base, t);
    g.linearRampToValueAtTime(base * amount, t + 0.05);
    g.setValueAtTime(base * amount, t + 0.05 + hold);
    g.linearRampToValueAtTime(base, t + 0.05 + hold + 0.4);
  }

  function stopLoop(key, fade) {
    const L = loops[key];
    if (!L || !ctx) return;
    const t = ctx.currentTime, f = fade == null ? 0.35 : fade;
    L.out.gain.cancelScheduledValues(t);
    L.out.gain.setValueAtTime(L.out.gain.value, t);
    L.out.gain.linearRampToValueAtTime(0.0001, t + f);
    L.nodes.forEach(nd => { if (nd.stop) { try { nd.stop(t + f + 0.05); } catch (e) {} } });
    delete loops[key];
  }

  const api = {
    /* ---------- 01 start-screen idle drone ---------- */
    ambienceStart() {
      if (!ensure() || loops.ambience) return;
      const t = ctx.currentTime, out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, t);
      out.gain.linearRampToValueAtTime(0.9, t + 1.4);
      out.connect(master);
      const nodes = [out];
      [55, 82.5, 110.3].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.value = 0.10 - i * 0.025;
        const lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = 0.07 + i * 0.03;
        lg.gain.value = g.gain.value * 0.6;
        lfo.connect(lg).connect(g.gain);
        o.connect(g).connect(out);
        o.start(t); lfo.start(t);
        nodes.push(o, lfo);
      });
      const n = noiseSrc(4), f = ctx.createBiquadFilter(), ng = ctx.createGain();
      n.loop = true;
      f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.6;
      ng.gain.value = 0.03;
      const nl = ctx.createOscillator(), nlg = ctx.createGain();
      nl.frequency.value = 0.13; nlg.gain.value = 320;
      nl.connect(nlg).connect(f.frequency);
      n.connect(f).connect(ng).connect(out);
      n.start(t); nl.start(t);
      nodes.push(n, nl);
      loops.ambience = { out, nodes };
    },
    ambienceStop() { stopLoop('ambience', 0.8); },

    /* ---------- 02 start button ---------- */
    launch() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      burst(0.75, 'bandpass', 300, 3000, 0.30, t, 1.4);
      tone('sine', 60, 130, t, 0.5, 0.35);
      bell(523.25, t + 0.42, 0.7, 0.16);
      bell(1046.5, t + 0.50, 0.6, 0.09);
    },

    /* ---------- 03 meteor approach: rumble that swells + accelerating ping ---------- */
    approachStart(secs) {
      if (!ensure() || loops.approach) return;
      const T = Math.max(3, secs || 14), t = ctx.currentTime;
      const out = ctx.createGain();
      out.gain.value = 1;
      out.connect(master);
      const nodes = [out];

      const n = noiseSrc(4), f = ctx.createBiquadFilter(), g = ctx.createGain();
      n.loop = true;
      f.type = 'lowpass';
      f.frequency.setValueAtTime(150, t);
      f.frequency.linearRampToValueAtTime(700, t + T);
      g.gain.setValueAtTime(0.05, t);
      g.gain.linearRampToValueAtTime(0.30, t + T);
      n.connect(f).connect(g).connect(out);
      n.start(t); nodes.push(n);

      const sub = ctx.createOscillator(), sg = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(42, t);
      sub.frequency.linearRampToValueAtTime(70, t + T);
      sg.gain.setValueAtTime(0.04, t);
      sg.gain.linearRampToValueAtTime(0.20, t + T);
      sub.connect(sg).connect(out);
      sub.start(t); nodes.push(sub);

      let d = 0.4, gap = T / 9;
      for (let i = 0; i < 30 && d < T; i++) {
        ping(t + d, out, 0.05 + (d / T) * 0.12);
        gap = Math.max(0.18, gap * 0.82);
        d += gap;
      }
      loops.approach = { out, nodes };
    },
    approachStop() { stopLoop('approach', 0.3); },

    /* ---------- 04 answer tap ---------- */
    tap() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      bell(740 * vary(0.03), t, 0.16, 0.22);
      burst(0.02, 'highpass', 3000, 3000, 0.06, t);
    },
    click() { api.tap(); },              // back-compat with old call sites

    /* ---------- lesson cues: element pop-in + ray-draw sweep ---------- */
    pop() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      tone('sine', 520 * vary(0.05), 800, t, 0.09, 0.16);
      burst(0.03, 'highpass', 2600, 2600, 0.05, t);
    },
    draw() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      burst(0.32, 'bandpass', 500, 2400, 0.11, t, 1.3);
      tone('sine', 300, 700, t, 0.28, 0.07);
    },
    /* earned card drops from the stage into the tray: falling air + pitch drop
       (the landing itself is pop(), fired by the animation's finish handler) */
    swoosh() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      burst(0.6, 'bandpass', 2200 * vary(0.06), 320, 0.16, t, 1.2);
      tone('sine', 620 * vary(0.05), 170, t + 0.05, 0.5, 0.07);
    },
    /* camera snap: the moment a learned angle is captured into the tray */
    shutter() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      burst(0.035, 'highpass', 5200, 5200, 0.22, t);          // click
      tone('square', 330, 180, t + 0.02, 0.05, 0.09);         // mechanical clack
      burst(0.05, 'bandpass', 1400, 850, 0.12, t + 0.05, 2);
    },

    /* ---------- 05 cannon swings to bearing ---------- */
    servo() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(150, t);
      o.frequency.linearRampToValueAtTime(215, t + 0.26);
      lfo.type = 'sine'; lfo.frequency.value = 34; lg.gain.value = 22;
      lfo.connect(lg).connect(o.frequency);
      f.type = 'bandpass'; f.frequency.value = 1000; f.Q.value = 3;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.10, t + 0.04);
      g.gain.setValueAtTime(0.10, t + 0.24);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.31);
      o.connect(f).connect(g).connect(master);
      lfo.start(t); o.start(t);
      lfo.stop(t + 0.33); o.stop(t + 0.33);
      tone('sine', 210, 90, t + 0.30, 0.09, 0.20);              // locking clunk
      burst(0.05, 'highpass', 2200, 900, 0.07, t + 0.30);
    },

    /* ---------- 06 cannon fires ---------- */
    fire() {
      if (!ensure()) return;
      const t = ctx.currentTime, p = vary(0.07), l = vary(0.10);
      tone('sine', 120 * p, 45, t, 0.16, 0.42 * l);             // recoil thump
      tone('square', 1200 * p, 320, t + 0.01, 0.13, 0.14 * l);  // zap body
      tone('triangle', 2400 * p, 700, t, 0.07, 0.10 * l);       // bright tip
      burst(0.34, 'highpass', 900, 4200, 0.10 * l, t + 0.03);   // air tail
    },

    /* ---------- 07 correct answer ---------- */
    good() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      [[659.25, 0], [830.6, 0.07], [987.77, 0.14]].forEach(([f, d]) => bell(f, t + d, 0.5, 0.17));
      bell(1975.5, t + 0.20, 0.45, 0.07);
      burst(0.3, 'highpass', 5000, 9000, 0.05, t + 0.14);
    },

    /* ---------- 08 meteor destroyed ---------- */
    shatter() {
      if (!ensure()) return;
      const t = ctx.currentTime, p = vary(0.07), l = vary(0.10);
      tone('sine', 190 * p, 55, t, 0.30, 0.45 * l);
      burst(0.28, 'bandpass', 1800 * p, 700, 0.34 * l, t, 0.8);
      for (let i = 0; i < 9; i++)                               // debris crackle
        burst(0.05, 'highpass', 1800 + Math.random() * 3000, 2000,
              0.05 + Math.random() * 0.05, t + 0.08 + Math.random() * 0.55);
    },
    boom() { api.shatter(); },           // back-compat

    /* ---------- 09 wrong bearing: falling siren while the meteor rushes in ---------- */
    alert() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      [0, 0.19].forEach(d => {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'square';
        o.frequency.setValueAtTime(520, t + d);
        o.frequency.exponentialRampToValueAtTime(300, t + d + 0.17);
        f.type = 'lowpass'; f.frequency.value = 1400;
        g.gain.setValueAtTime(0.0001, t + d);
        g.gain.linearRampToValueAtTime(0.11, t + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.18);
        o.connect(f).connect(g).connect(master);
        o.start(t + d); o.stop(t + d + 0.20);
      });
      burst(0.4, 'lowpass', 500, 180, 0.12, t);
    },

    /* ---------- 10 meteor hits the cannon (one designed hit, mix ducked) ---------- */
    impact() {
      if (!ensure()) return;
      const t = ctx.currentTime, p = vary(0.06);
      duck(t, 0.55, 0.25);
      tone('sine', 150 * p, 30, t, 0.75, 0.55);                 // sub drop
      burst(0.35, 'lowpass', 2600, 300, 0.35, t);               // blast body
      [430, 617, 921, 1310].forEach((f, i) =>                   // metal clang
        tone('sine', f * p, f * p * 0.98, t + 0.01, 0.5 - i * 0.07, 0.10 - i * 0.02));
      for (let i = 0; i < 6; i++)
        burst(0.06, 'bandpass', 900 + Math.random() * 2500, 1200, 0.05,
              t + 0.15 + Math.random() * 0.5);
      [0.55, 0.95].forEach(d => tone('triangle', 700, 380, t + d, 0.30, 0.10));  // whoop
    },

    /* ---------- 11 shield lost: heartbeat, lower with each life gone ---------- */
    lifeLost(remaining) {
      if (!ensure()) return;
      const t = ctx.currentTime + 0.45;                         // sits under the impact tail
      const drop = Math.pow(0.88, Math.max(0, 2 - (remaining == null ? 2 : remaining)));
      [0, 0.26].forEach((d, i) => {
        tone('sine', 78 * drop, 42 * drop, t + d, 0.30, 0.40 - i * 0.12);
        burst(0.12, 'lowpass', 320, 140, 0.10, t + d);
      });
    },

    /* ---------- 12 / 13 end of run ---------- */
    fanfare(won) {
      if (!ensure()) return;
      const t = ctx.currentTime;
      if (won) {
        [[523.25, 0], [659.25, 0.13], [783.99, 0.26], [1046.5, 0.39]]
          .forEach(([f, d]) => bell(f, t + d, 0.9, 0.16));
        [261.63, 392, 523.25].forEach(f => tone('triangle', f, f, t + 0.39, 1.2, 0.06));
        bell(1568, t + 0.62, 1.1, 0.07);
        burst(0.9, 'highpass', 4000, 11000, 0.05, t + 0.40);
        return;
      }
      [220, 221.5].forEach(f => {                               // soft power-down
        const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
        o.type = 'triangle';
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 0.42, t + 1.1);
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(2200, t);
        lp.frequency.exponentialRampToValueAtTime(300, t + 1.2);
        g.gain.setValueAtTime(0.13, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
        o.connect(lp).connect(g).connect(master);
        o.start(t); o.stop(t + 1.30);
      });
      burst(1.1, 'lowpass', 1800, 160, 0.10, t);
      tone('sine', 130, 60, t + 0.05, 0.60, 0.20);
    },

    /* ---------- carried over from the ship build ---------- */
    setThrust(level) {
      thrustLevel = level;
      if (!ctx || !thrustGain) return;
      const t = ctx.currentTime;
      thrustGain.gain.setTargetAtTime(level * 0.35, t, 0.08);
      thrustFilter.frequency.setTargetAtTime(220 + level * 700, t, 0.1);
    },

    bump() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      tone('sine', 140, 50, t, 0.20, 0.30);
    },

    /* ---------- mute ---------- */
    isMuted() { return muted; },
    setMuted(on) {
      muted = !!on;
      try { localStorage.setItem(STORE_KEY, muted ? '1' : '0'); } catch (e) {}
      if (master) {
        const t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(baseLevel(), t + 0.12);
      }
      return muted;
    },
    toggleMute() { return api.setMuted(!muted); }
  };

  function ping(when, dest, peak) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 1180;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.min(0.2, peak), when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    o.connect(g).connect(dest);
    o.start(when); o.stop(when + 0.24);
  }

  return api;
})();
