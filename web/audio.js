// Procedural audio (Web Audio API, no sound files).
// - Sound effects: wooden knocks, scrapes and thocks built from filtered noise.
// - Music: J. S. Bach, Prelude in C major BWV 846 (public domain), played by a
//   soft music-box / piano voice with a small generated reverb.
const ToppleAudio = (() => {
  let ac = null, master, sfxBus, musicBus, noise, reverb;
  let sfxOn = true, musicOn = true, musicTimer = null;

  function ctx() {
    if (ac) return ac;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
    // White noise, reused by every effect.
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // Small room reverb: decaying noise impulse.
    reverb = ac.createConvolver();
    const len = ac.sampleRate * 2.2, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    reverb.buffer = ir;
    const wet = ac.createGain(); wet.gain.value = 0.35;
    reverb.connect(wet).connect(musicBus);
    return ac;
  }
  function resume() { const a = ctx(); if (a && a.state === 'suspended') a.resume(); return a; }

  // --- effects -------------------------------------------------------------
  function noiseSrc(t, dur, filterType, freq, q, vol, attack = 0.002) {
    const s = ac.createBufferSource(); s.buffer = noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ac.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    return { f, g };
  }
  function body(t, freq, dur, vol, type = 'sine', drop = 0.85) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * drop, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  const ready = () => sfxOn && resume();

  // A wooden knock: short resonant noise click plus a damped hollow body tone.
  function knock(freq = 700, vol = 0.5, t0) {
    if (!ready()) return;
    const t = t0 || ac.currentTime;
    noiseSrc(t, 0.05, 'bandpass', freq * 2.2, 6, vol * 0.9);
    body(t, freq, 0.09, vol * 0.6, 'triangle', 0.92);
    body(t, freq * 2.76, 0.04, vol * 0.15, 'sine', 0.95);
  }
  const fx = {
    // Block starts to slide: wooden scrape whose length follows the slide.
    slide(ms, ice) {
      if (!ready()) return;
      const t = ac.currentTime, dur = Math.max(0.08, ms / 1000);
      if (ice) {
        const n = noiseSrc(t, dur, 'highpass', 3500, 0.7, 0.12, 0.02);
        n.f.frequency.exponentialRampToValueAtTime(6000, t + dur);
        body(t, 1800, 0.06, 0.05, 'sine', 1.2);
      } else {
        const n = noiseSrc(t, dur, 'bandpass', 900, 1.2, 0.22, 0.015);
        n.f.frequency.linearRampToValueAtTime(600, t + dur);
        knock(520, 0.18, t);
      }
    },
    // Landing after a fall: low, soft "thock" of wood on wood.
    land(heavy) {
      if (!ready()) return;
      const t = ac.currentTime;
      noiseSrc(t, 0.12, 'lowpass', heavy ? 380 : 700, 0.8, heavy ? 0.7 : 0.45);
      body(t, heavy ? 95 : 150, heavy ? 0.22 : 0.15, heavy ? 0.7 : 0.45, 'sine', 0.7);
      knock(heavy ? 260 : 380, 0.25, t);
    },
    // Fragile block breaks: a crunchy burst of small splinter knocks.
    crack() {
      if (!ready()) return;
      const t = ac.currentTime;
      noiseSrc(t, 0.25, 'bandpass', 1400, 0.9, 0.5);
      for (let i = 0; i < 6; i++) knock(500 + Math.random() * 1400, 0.25, t + i * 0.018 + Math.random() * 0.01);
      body(t, 120, 0.2, 0.4, 'sine', 0.6);
    },
    // Balloon floats up: soft rising airy tone.
    rise() {
      if (!ready()) return;
      const t = ac.currentTime;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(380, t); o.frequency.exponentialRampToValueAtTime(760, t + 0.25);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(sfxBus); o.start(t); o.stop(t + 0.35);
      noiseSrc(t, 0.25, 'bandpass', 2500, 1, 0.05, 0.05);
    },
    undo() { knock(900, 0.25); },
    tap() { knock(1100, 0.2); },
    // Win: a little wooden marimba arpeggio.
    win() {
      if (!ready()) return;
      const t = ac.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        body(t + i * 0.11, f, 0.5, 0.22, 'sine', 1);
        body(t + i * 0.11, f * 4, 0.08, 0.05, 'sine', 1);
        noiseSrc(t + i * 0.11, 0.03, 'bandpass', f * 3, 5, 0.08);
      });
    },
  };

  // --- music: Bach BWV 846 -----------------------------------------------
  // Each bar: five notes n0..n4, played as n0 n1 n2 n3 n4 n2 n3 n4, twice.
  const BARS = [
    'C4 E4 G4 C5 E5', 'C4 D4 A4 D5 F5', 'B3 D4 G4 D5 F5', 'C4 E4 G4 C5 E5',
    'C4 E4 A4 E5 A5', 'C4 D4 F#4 A4 D5', 'B3 D4 G4 D5 G5', 'B3 C4 E4 G4 C5',
    'A3 C4 E4 G4 C5', 'D3 A3 D4 F#4 C5', 'G3 B3 D4 G4 B4', 'G3 Bb3 E4 G4 C#5',
    'F3 A3 D4 A4 D5', 'F3 Ab3 D4 F4 B4', 'E3 G3 C4 G4 C5', 'E3 F3 A3 C4 F4',
    'D3 F3 A3 C4 F4', 'G2 D3 G3 B3 F4', 'C3 E3 G3 C4 E4', 'C3 G3 Bb3 C4 E4',
    'F2 F3 A3 C4 E4', 'F#2 C3 A3 C4 Eb4', 'Ab2 F3 B3 C4 D4', 'G2 F3 G3 B3 D4',
    'G2 E3 G3 C4 E4', 'G2 D3 G3 C4 F4', 'G2 D3 G3 B3 F4', 'G2 Eb3 A3 C4 F#4',
    'G2 E3 G3 C4 G4', 'G2 D3 G3 C4 F4', 'G2 D3 G3 B3 F4', 'C2 C3 G3 Bb3 E4',
  ];
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function hz(name) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    const n = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12;
    return 440 * Math.pow(2, (n - 69) / 12);
  }
  // Soft piano-like voice: sine fundamental, quiet octave, gentle lowpass.
  function note(t, freq, dur, vol) {
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o1.type = 'triangle'; o1.frequency.value = freq;
    o2.type = 'sine'; o2.frequency.value = freq * 2;
    const g2 = ac.createGain(); g2.gain.value = 0.25;
    f.type = 'lowpass'; f.frequency.value = Math.min(4000, freq * 6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o1.connect(f); o2.connect(g2).connect(f);
    f.connect(g); g.connect(musicBus); g.connect(reverb);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  const STEP = 0.24; // seconds per sixteenth note
  let step = 0, nextTime = 0;
  const TOTAL = BARS.length * 16 + 32; // 32 sixteenths of final chord + rest
  function scheduleMusic() {
    while (nextTime < ac.currentTime + 0.6) {
      const bar = Math.floor(step / 16), pos = step % 16;
      if (bar < BARS.length) {
        const n = BARS[bar].split(' ').map(hz);
        const half = pos % 8, idx = [0, 1, 2, 3, 4, 2, 3, 4][half];
        const vol = idx === 0 ? 0.11 : idx === 1 ? 0.08 : 0.065;
        const dur = idx === 0 ? STEP * 8 : idx === 1 ? STEP * 7 : STEP * 3;
        note(nextTime, n[idx], dur, vol);
      } else if (step === BARS.length * 16) {
        ['C2', 'C3', 'G3', 'C4', 'E4', 'G4', 'C5'].forEach((s, i) => note(nextTime + i * 0.09, hz(s), 5, 0.07));
      }
      nextTime += STEP;
      step = (step + 1) % TOTAL;
    }
  }
  function startMusic() {
    if (!musicOn || !resume() || musicTimer) return;
    nextTime = ac.currentTime + 0.1;
    musicBus.gain.cancelScheduledValues(ac.currentTime);
    musicBus.gain.setValueAtTime(musicBus.gain.value, ac.currentTime);
    musicBus.gain.linearRampToValueAtTime(0.55, ac.currentTime + 1.5);
    scheduleMusic();
    musicTimer = setInterval(scheduleMusic, 150);
  }
  function stopMusic() {
    if (!ac || !musicTimer) return;
    clearInterval(musicTimer); musicTimer = null;
    musicBus.gain.cancelScheduledValues(ac.currentTime);
    musicBus.gain.setValueAtTime(musicBus.gain.value, ac.currentTime);
    musicBus.gain.linearRampToValueAtTime(0, ac.currentTime + 0.4);
  }
  // Pause music while the tab is hidden.
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend(); else if (sfxOn || musicOn) ac.resume();
  });

  return {
    fx,
    init({ sfx, music }) { sfxOn = sfx !== false; musicOn = music !== false; },
    unlock() { resume(); if (musicOn) startMusic(); }, // call from a user gesture
    get sfx() { return sfxOn; },
    get music() { return musicOn; },
    setSfx(on) { sfxOn = on; },
    setMusic(on) { musicOn = on; if (on) startMusic(); else stopMusic(); },
  };
})();
