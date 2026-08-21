/* Space Rescue — shared VoiceOver engine.
   One voice for the whole game: intro cards, lesson narration, game tutorial
   and feedback all speak through VO.say().

   Recorded VoiceOver: when the studio clips arrive (Aniket Chauhan), map
   them with VO.register({ '<exact line text>': 'assets/vo/line-01.mp3', … })
   — registered lines play the recording; everything else falls back to the
   Web Speech API, and if speech is unavailable a timed fallback keeps every
   sequence moving. */
window.VO = (function () {
  const canSpeak = 'speechSynthesis' in window;
  const clips = {};        // line text → audio URL (recorded VO)
  let audio = null;        // currently playing clip
  let curFin = null;       // pending completion of the current line
  let timer = 0;

  function stop() {        // silence without firing the callback
    curFin = null;
    clearTimeout(timer);
    if (audio) { audio.pause(); audio = null; }
    if (canSpeak) { try { speechSynthesis.cancel(); } catch (e) {} }
  }

  function skip() {        // silence AND complete — for "get on with it" taps
    const f = curFin;
    stop();
    if (f) f();
  }

  function say(text, done) {
    stop();
    let fired = false;
    const fin = () => {
      if (fired) return;
      fired = true;
      if (curFin === fin) curFin = null;
      clearTimeout(timer);
      if (done) done();
    };
    curFin = fin;
    const url = clips[text];
    if (url) {
      audio = new Audio(url);
      audio.onended = fin;
      audio.onerror = fin;
      audio.play().catch(fin);
      // stalled-download safety net, sized far past any sane clip length
      timer = setTimeout(fin, 4000 + text.length * 120);
      return;
    }
    if (canSpeak) {
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 0.95;
        u.pitch = 1.05;
        u.onend = fin;
        u.onerror = fin;
        speechSynthesis.speak(u);
      } catch (e) { /* the timer below still advances the sequence */ }
    }
    // fallback: no working speech (muted OS, no voices) — pace by length
    timer = setTimeout(fin, 1200 + text.length * (canSpeak ? 95 : 55));
  }

  return {
    say, stop, skip,
    speaking: () => !!curFin,
    register(map) { Object.assign(clips, map); }
  };
})();
