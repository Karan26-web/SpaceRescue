/* Space Rescue — sound effects.
   Everything is synthesized with WebAudio (no audio files, works offline):
   - a looping filtered-noise thruster that swells with engine power
   - a bright blip on button press
   - a low thud when the ship bumps a screen edge
   Audio is armed on the first user gesture (browser autoplay policy). */
window.SFX = (function () {
  let ctx = null, master = null;
  let thrustGain = null, thrustFilter = null, thrustLevel = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);

    // thruster: looping white noise -> lowpass -> gain (silent until throttled)
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    thrustFilter = ctx.createBiquadFilter();
    thrustFilter.type = 'lowpass';
    thrustFilter.frequency.value = 220;
    thrustFilter.Q.value = 0.8;
    thrustGain = ctx.createGain();
    thrustGain.gain.value = 0;
    src.connect(thrustFilter).connect(thrustGain).connect(master);
    src.start();

    // restore any throttle requested before audio was armed
    if (thrustLevel > 0) api.setThrust(thrustLevel);
    return true;
  }

  ['pointerdown', 'keydown'].forEach(ev =>
    window.addEventListener(ev, () => ensure(), { passive: true }));

  const api = {
    /* short bright chirp for a control press */
    click() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(1320, t + 0.06);
      g.gain.setValueAtTime(0.10, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + 0.1);
    },

    /* engine intensity 0..1 — call every frame; ramps are smoothed */
    setThrust(level) {
      thrustLevel = level;
      if (!ctx || !thrustGain) return;
      const t = ctx.currentTime;
      thrustGain.gain.setTargetAtTime(level * 0.35, t, 0.08);
      thrustFilter.frequency.setTargetAtTime(220 + level * 700, t, 0.1);
    },

    /* low thud for hitting the edge of the screen */
    bump() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.18);
      g.gain.setValueAtTime(0.30, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + 0.22);
    },

    /* cannon shot: pitched-down zap over a burst of bright noise */
    fire() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1500, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.22);
      og.gain.setValueAtTime(0.22, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(og).connect(master);
      osc.start(t); osc.stop(t + 0.26);

      const n = noiseSrc(0.2);
      const f = ctx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 1200;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.14, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      n.connect(f).connect(ng).connect(master);
      n.start(t);
    },

    /* meteor explosion: deep boom + crackling noise tail */
    boom() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.5);
      og.gain.setValueAtTime(0.5, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(og).connect(master);
      osc.start(t); osc.stop(t + 0.6);

      const n = noiseSrc(0.6);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(3200, t);
      f.frequency.exponentialRampToValueAtTime(240, t + 0.55);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.4, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      n.connect(f).connect(ng).connect(master);
      n.start(t);
    },

    /* meteor slamming the cannon: harsh crunch + descending alarm */
    impact() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      const n = noiseSrc(0.4);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 300; f.Q.value = 0.7;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.55, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      n.connect(f).connect(ng).connect(master);
      n.start(t);

      for (const d of [0, 0.28]) {           // two-tone warning whoop
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(660, t + d);
        osc.frequency.exponentialRampToValueAtTime(330, t + d + 0.22);
        g.gain.setValueAtTime(0.09, t + d);
        g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.24);
        osc.connect(g).connect(master);
        osc.start(t + d); osc.stop(t + d + 0.26);
      }
    },

    /* little rising two-note chime for a correct answer */
    good() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      [[523.25, 0], [783.99, 0.11]].forEach(([fq, d]) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = fq;
        g.gain.setValueAtTime(0.16, t + d);
        g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.22);
        osc.connect(g).connect(master);
        osc.start(t + d); osc.stop(t + d + 0.24);
      });
    },

    /* victory fanfare / defeat slide for the end screen */
    fanfare(won) {
      if (!ensure()) return;
      const t = ctx.currentTime;
      const seq = won
        ? [[523.25, 0], [659.25, 0.14], [783.99, 0.28], [1046.5, 0.42]]
        : [[392, 0], [330, 0.2], [262, 0.4]];
      seq.forEach(([fq, d]) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = won ? 'triangle' : 'sawtooth';
        osc.frequency.value = fq;
        g.gain.setValueAtTime(won ? 0.18 : 0.12, t + d);
        g.gain.exponentialRampToValueAtTime(0.001, t + d + (won ? 0.3 : 0.34));
        osc.connect(g).connect(master);
        osc.start(t + d); osc.stop(t + d + 0.4);
      });
    }
  };

  /* one-shot noise buffer source of the given length (seconds) */
  function noiseSrc(sec) {
    const len = Math.max(1, ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  return api;
})();
