/* =========================================================
   MOOOO CLICKER — pencet sapi sampai skor 1000!
   ========================================================= */
(() => {
  "use strict";

  const GOAL = 1000;
  const MILESTONES = [100, 250, 500, 750];
  const COMBO_WINDOW = 750; // ms antar pencetan agar combo tetap jalan
  const COMBO_LEVELS = [
    { at: 0, mult: 1, label: "COMBO" },
    { at: 10, mult: 2, label: "MANTAP!" },
    { at: 25, mult: 3, label: "GILA!" },
    { at: 50, mult: 5, label: "MOOO-FRENZY!" },
  ];
  const POWERS = {
    bell: { unlock: 50, cooldown: 20000, duration: 8000 },
    storm: { unlock: 150, cooldown: 25000, duration: 6000 },
    mega: { unlock: 300, cooldown: 30000, duration: 0 },
  };

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const app = $("app");
  const cowBtn = $("cow");
  const scoreEl = $("score");
  const bottleFill = $("bottleFill");
  const progressText = $("progressText");
  const timerEl = $("timer");
  const bestEl = $("best");
  const comboBox = $("comboBox");
  const comboText = $("comboText");
  const comboFill = $("comboFill");
  const hint = $("hint");
  const goldCow = $("goldCow");
  const banner = $("banner");
  const bannerText = $("bannerText");
  const flash = $("flash");
  const muteBtn = $("muteBtn");
  const musicBtn = $("musicBtn");
  const eyeL = $("eyeL");
  const eyeR = $("eyeR");
  const eyesG = $("eyes");
  const happyEyes = $("happyEyes");
  const mouthSmile = $("mouthSmile");
  const mouthMoo = $("mouthMoo");
  const pupils = document.querySelectorAll(".pupil");
  const powerBtns = {
    bell: $("pBell"),
    storm: $("pStorm"),
    mega: $("pMega"),
  };

  // ---------- Storage aman ----------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* abaikan */ } },
  };

  // ---------- STATE ----------
  let S;
  function freshState() {
    return {
      running: false,
      score: 0,
      shownScore: 0,
      clicks: 0,
      combo: 0,
      lastClick: 0,
      levelIdx: 0,
      maxMult: 1,
      golds: 0,
      startTime: 0,
      endTime: 0,
      milestonesHit: new Set(),
      boostUntil: 0,
      stormUntil: 0,
      stormAcc: 0,
      cdUntil: { bell: 0, storm: 0, mega: 0 },
      nextGold: 0,
      goldUntil: 0,
      goldVX: 0, goldVY: 0, goldX: 0, goldY: 0,
      nextBeat: 0,
      wasReady: { bell: false, storm: false, mega: false },
    };
  }
  S = freshState();

  let best = parseFloat(store.get("moooo-best")) || 0;
  let muted = store.get("moooo-muted") === "1";
  let musicOn = store.get("moooo-music") !== "0";
  renderBest();
  renderMute();
  renderMusic();

  /* =========================================================
     AUDIO — semua disintesis pakai WebAudio, tanpa file
     ========================================================= */
  let actx = null;
  let master = null, sfxBus = null, musicBus = null;
  let noiseBuf = null;
  function audio() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
      const comp = actx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      master = actx.createGain();
      master.gain.value = muted ? 0 : 0.6;
      sfxBus = actx.createGain(); sfxBus.gain.value = 1;
      musicBus = actx.createGain(); musicBus.gain.value = 0.32;
      sfxBus.connect(master); musicBus.connect(master);
      master.connect(comp); comp.connect(actx.destination);
      // satu buffer noise dipakai ulang (hemat CPU)
      noiseBuf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (actx.state === "suspended") actx.resume();
    return actx;
  }
  function setMasterMute() {
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.6, actx.currentTime, 0.03);
  }

  function tone({ type = "sine", f0 = 440, f1 = f0, dur = 0.15, vol = 0.3, delay = 0, filter = 0, attack = 0.01, at = 0, bus, vib = 0, glide = "exp" }) {
    const a = audio(); if (!a || muted) return;
    if (f0 > 16000) return; // di atas pendengaran, lewati
    f1 = Math.min(f1, 18000);
    const t = (at || a.currentTime) + delay;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) {
      if (glide === "exp") o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      else o.frequency.linearRampToValueAtTime(f1, t + dur);
    }
    if (vib) {
      const lfo = a.createOscillator(), lg = a.createGain();
      lfo.frequency.value = 7; lg.gain.value = vib;
      lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) {
      const lp = a.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = filter;
      o.connect(lp); node = lp;
    }
    node.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise({ dur = 0.3, vol = 0.3, freq = 800, f1 = 0, type = "lowpass", q = 1, delay = 0, at = 0, attack = 0.005, bus }) {
    const a = audio(); if (!a || muted) return;
    const t = (at || a.currentTime) + delay;
    const src = a.createBufferSource(); src.buffer = noiseBuf;
    const f = a.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus || sfxBus);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }

  // ---------- suara "moo" ----------
  function mooVoice({ pitch = 1, dur = 0.9, at = 0, vol = 0.5, shape = "long" }) {
    const a = audio(); if (!a || muted) return;
    const t = at || a.currentTime;
    const o = a.createOscillator(), o2 = a.createOscillator();
    const vib = a.createOscillator(), vibG = a.createGain();
    const f1 = a.createBiquadFilter(), f2 = a.createBiquadFilter();
    const g = a.createGain();
    o.type = "sawtooth"; o2.type = "square";
    const base = 150 * pitch;
    o.frequency.setValueAtTime(base * 0.9, t);
    o.frequency.linearRampToValueAtTime(base * 1.12, t + dur * 0.28);
    o.frequency.linearRampToValueAtTime(base * (shape === "question" ? 1.35 : 0.78), t + dur);
    o2.frequency.setValueAtTime(base * 0.45, t);
    o2.frequency.linearRampToValueAtTime(base * 0.39, t + dur);
    vib.frequency.value = shape === "bull" ? 4 : 6; vibG.gain.value = base * 0.03;
    vib.connect(vibG); vibG.connect(o.frequency);
    f1.type = "bandpass"; f1.Q.value = 3;
    f1.frequency.setValueAtTime(380 * pitch, t);
    f1.frequency.linearRampToValueAtTime(900 * pitch, t + dur * 0.33); // "mmm" -> "ooo"
    f1.frequency.linearRampToValueAtTime(500 * pitch, t + dur);
    f2.type = "lowpass"; f2.frequency.value = 1500 * pitch;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.12, dur * 0.2));
    g.gain.setValueAtTime(vol, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f1); o2.connect(f1); f1.connect(f2); f2.connect(g); g.connect(sfxBus);
    [o, o2, vib].forEach((n) => { n.start(t); n.stop(t + dur + 0.05); });
  }

  // lonceng sapi: partial inharmonik
  function cowbell(f = 560, vol = 0.18, delay = 0, dur = 0.35) {
    [1, 1.48].forEach((m) => tone({ type: "square", f0: f * m, dur, vol: vol * 0.5, delay, filter: 2600 }));
    noise({ dur: 0.04, vol: vol * 0.6, freq: 3000, type: "bandpass", q: 2, delay });
  }
  function bellPartials(f = 880, vol = 0.15, delay = 0, dur = 1.4) {
    [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.93, 0.12]].forEach(([m, v]) =>
      tone({ type: "sine", f0: f * m, dur: dur / Math.sqrt(m), vol: vol * v, delay, attack: 0.003 }));
  }

  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI -> Hz

  let lastHover = 0;
  let rainNode = null;

  const sfx = {
    // ---------- klik sapi: 6 variasi acak, nada naik sesuai combo ----------
    pop(combo) {
      const up = Math.pow(2, Math.min(combo, 48) / 48); // naik 1 oktaf sampai combo 48
      const v = Math.random();
      if (v < 0.34) tone({ type: "triangle", f0: 380 * up, f1: 760 * up, dur: 0.09, vol: 0.22 });           // pop
      else if (v < 0.52) { tone({ type: "sine", f0: 180 * up, f1: 520 * up, dur: 0.18, vol: 0.25, vib: 30 }); } // boing
      else if (v < 0.66) tone({ type: "square", f0: 1100 * up, f1: 1700 * up, dur: 0.07, vol: 0.08, filter: 5000 }); // squeak mainan
      else if (v < 0.8) { noise({ dur: 0.16, vol: 0.22, freq: 2400, f1: 700, type: "bandpass", q: 3 }); tone({ type: "sine", f0: 700 * up, f1: 300, dur: 0.08, vol: 0.12 }); } // cipratan susu
      else if (v < 0.92) cowbell(520 * up, 0.16);                                                             // tonk lonceng
      else { tone({ type: "sine", f0: 90, f1: 45, dur: 0.12, vol: 0.4 }); tone({ type: "triangle", f0: 600 * up, dur: 0.05, vol: 0.12 }); } // bonk
    },
    moo(pitch = 1) { mooVoice({ pitch }); },
    randomMoo() {
      const k = pick(["long", "short", "calf", "bull", "double", "question"]);
      if (k === "short") mooVoice({ pitch: rnd(0.95, 1.15), dur: 0.4 });
      else if (k === "calf") mooVoice({ pitch: rnd(1.5, 1.8), dur: 0.5, vol: 0.4 });
      else if (k === "bull") mooVoice({ pitch: rnd(0.6, 0.7), dur: 1.3, vol: 0.6, shape: "bull" });
      else if (k === "double") { const a = audio(); if (!a) return; mooVoice({ pitch: 1.1, dur: 0.25 }); mooVoice({ pitch: 1, dur: 0.7, at: a.currentTime + 0.3 }); }
      else if (k === "question") mooVoice({ pitch: 1.05, dur: 0.7, shape: "question" });
      else mooVoice({ pitch: rnd(0.85, 1.2) });
    },
    mooChoir() {
      const a = audio(); if (!a) return;
      [0.8, 1, 1.2, 1.6].forEach((p, i) => mooVoice({ pitch: p, dur: 1.6, vol: 0.28, at: a.currentTime + i * 0.05 }));
    },
    ding() { [0, 0.08, 0.16].forEach((d, i) => tone({ type: "sine", f0: 880 * (1 + i * 0.26), dur: 0.5, vol: 0.18, delay: d })); },
    coin() {
      tone({ type: "square", f0: 988, dur: 0.08, vol: 0.12, filter: 4000 });
      tone({ type: "square", f0: 1319, dur: 0.35, vol: 0.12, delay: 0.08, filter: 4000 });
    },
    levelUp(level = 1) {
      const scale = [60, 64, 67, 72, 76, 79, 84];
      const n = 3 + level;
      for (let i = 0; i < n; i++) tone({ type: "triangle", f0: NOTE(scale[i % scale.length] + (level - 1) * 2), dur: 0.2, vol: 0.2, delay: i * 0.055 });
      if (level >= 3) sfx.airHorn();
    },
    airHorn() {
      [0, 0.18, 0.36].forEach((d, k) => [233, 294, 349].forEach((f) =>
        tone({ type: "sawtooth", f0: f, dur: k === 2 ? 0.6 : 0.14, vol: 0.07, delay: d, filter: 2200, attack: 0.02 })));
    },
    comboBreak() {
      [392, 370, 349, 311].forEach((f, i) => tone({ type: "triangle", f0: f, f1: f * 0.97, dur: i === 3 ? 0.5 : 0.18, vol: 0.14, delay: i * 0.17, vib: i === 3 ? 8 : 0 }));
    },
    goldSpawn() {
      for (let i = 0; i < 8; i++) bellPartials(NOTE(84 + [0, 4, 7, 12, 16, 19, 24, 28][i]), 0.05, i * 0.04, 0.6);
    },
    goldCatch() {
      sfx.coin();
      [72, 76, 79, 84, 88].forEach((n, i) => tone({ type: "square", f0: NOTE(n), dur: 0.12, vol: 0.08, delay: 0.1 + i * 0.05, filter: 5000 }));
      mooVoice({ pitch: 1.45, dur: 0.6, vol: 0.35 });
    },
    goldMiss() {
      [[311, 0.3], [294, 0.3], [277, 0.3], [262, 0.9]].reduce((d, [f, l]) => {
        tone({ type: "sawtooth", f0: f, f1: f * 0.98, dur: l, vol: 0.08, delay: d, filter: 1200, vib: l > 0.5 ? 6 : 0, attack: 0.03 });
        return d + l;
      }, 0);
    },
    bellPower() {
      bellPartials(660, 0.22, 0, 2); bellPartials(990, 0.16, 0.15, 1.8); bellPartials(1320, 0.12, 0.3, 1.6);
      for (let i = 0; i < 10; i++) noise({ dur: 0.05, vol: 0.12, freq: 7000, type: "highpass", delay: i * 0.07 }); // jingle
    },
    jingle() { // tiap klik saat Lonceng Emas aktif
      noise({ dur: 0.06, vol: 0.09, freq: 6500, type: "highpass" });
      tone({ type: "sine", f0: pick([1568, 1760, 2093]), dur: 0.2, vol: 0.05 });
    },
    stormStart() {
      sfx.thunder();
      const a = audio(); if (!a || muted) return;
      sfx.stormStop();
      const src = a.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const f = a.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1800; f.Q.value = 0.6;
      const g = a.createGain(); g.gain.setValueAtTime(0.0001, a.currentTime); g.gain.exponentialRampToValueAtTime(0.16, a.currentTime + 0.4);
      src.connect(f); f.connect(g); g.connect(sfxBus); src.start();
      rainNode = { src, g };
    },
    stormStop() {
      if (!rainNode || !actx) return;
      const { src, g } = rainNode; rainNode = null;
      g.gain.setTargetAtTime(0.0001, actx.currentTime, 0.2);
      src.stop(actx.currentTime + 1);
    },
    drip() { tone({ type: "sine", f0: rnd(900, 1500), f1: rnd(1800, 2600), dur: 0.06, vol: 0.06 }); },
    thunder() {
      noise({ dur: 1.6, vol: 0.5, freq: 400, f1: 80, attack: 0.02 });
      noise({ dur: 0.25, vol: 0.35, freq: 3000, f1: 600, delay: 0.05 });
      tone({ type: "sine", f0: 60, f1: 30, dur: 1.2, vol: 0.35 });
    },
    megaCharge() {
      tone({ type: "sawtooth", f0: 80, f1: 1200, dur: 0.55, vol: 0.12, filter: 3000, attack: 0.3 });
      noise({ dur: 0.55, vol: 0.18, freq: 300, f1: 6000, type: "bandpass", q: 2, attack: 0.4 });
    },
    boom(delay = 0) {
      tone({ type: "sine", f0: 160, f1: 30, dur: 0.7, vol: 0.7, delay });
      noise({ dur: 0.9, vol: 0.55, freq: 2000, f1: 120, delay });
    },
    whoosh() { noise({ dur: 0.5, vol: 0.25, freq: 400, f1: 4000, type: "bandpass", q: 1.5, attack: 0.2 }); },
    powerReady() {
      tone({ type: "sine", f0: 1047, dur: 0.12, vol: 0.12 });
      tone({ type: "sine", f0: 1568, dur: 0.3, vol: 0.12, delay: 0.09 });
    },
    denied() { tone({ type: "square", f0: 160, dur: 0.12, vol: 0.08, filter: 900 }); tone({ type: "square", f0: 120, dur: 0.18, vol: 0.08, delay: 0.1, filter: 900 }); },
    hover() {
      const now = performance.now(); if (now - lastHover < 60) return; lastHover = now;
      tone({ type: "sine", f0: 1800, dur: 0.03, vol: 0.04 });
    },
    uiClick() { tone({ type: "triangle", f0: 660, f1: 990, dur: 0.07, vol: 0.14 }); },
    startJingle() {
      [[67, 0], [72, 0.1], [76, 0.2], [79, 0.3], [84, 0.45]].forEach(([n, d]) => {
        tone({ type: "square", f0: NOTE(n), dur: n === 84 ? 0.5 : 0.12, vol: 0.09, delay: d, filter: 4000 });
        tone({ type: "triangle", f0: NOTE(n - 12), dur: 0.15, vol: 0.12, delay: d });
      });
      cowbell(560, 0.2, 0.45);
    },
    heartbeat() {
      tone({ type: "sine", f0: 70, f1: 40, dur: 0.15, vol: 0.45 });
      tone({ type: "sine", f0: 65, f1: 38, dur: 0.15, vol: 0.32, delay: 0.18 });
    },
    milestone(m) {
      const seq = { 100: [72, 76, 79], 250: [72, 76, 79, 84], 500: [67, 72, 76, 79, 84], 750: [67, 72, 76, 79, 84, 88] }[m] || [72, 79];
      seq.forEach((n, i) => {
        tone({ type: "square", f0: NOTE(n), dur: i === seq.length - 1 ? 0.6 : 0.14, vol: 0.1, delay: i * 0.1, filter: 3500 });
        tone({ type: "triangle", f0: NOTE(n - 12), dur: 0.2, vol: 0.14, delay: i * 0.1 });
      });
      cowbell(600, 0.2, seq.length * 0.1);
      sfx.confettiPop(0.05);
      setTimeout(() => sfx.randomMoo(), 350);
    },
    confettiPop(delay = 0) {
      noise({ dur: 0.12, vol: 0.4, freq: 2500, type: "bandpass", q: 0.8, delay });
      for (let i = 0; i < 6; i++) noise({ dur: 0.03, vol: 0.1, freq: 6000, type: "highpass", delay: delay + 0.1 + Math.random() * 0.4 });
    },
    firework() {
      tone({ type: "sine", f0: 500, f1: 2200, dur: 0.35, vol: 0.05, attack: 0.05 });           // siulan naik
      noise({ dur: 0.4, vol: 0.3, freq: 3500, f1: 400, delay: 0.32 });                           // DUAR
      for (let i = 0; i < 10; i++) noise({ dur: 0.025, vol: 0.08, freq: 5000, type: "highpass", delay: 0.45 + Math.random() * 0.7 }); // kretek-kretek
    },
    drumRoll(len = 1) {
      const n = Math.floor(len * 22);
      for (let i = 0; i < n; i++) noise({ dur: 0.05, vol: 0.06 + (i / n) * 0.18, freq: 1800, type: "bandpass", q: 1, delay: i / 22 });
      noise({ dur: 0.6, vol: 0.4, freq: 7000, type: "highpass", delay: len }); // crash
    },
    fanfare() {
      sfx.drumRoll(0.9);
      const notes = [72, 72, 72, 76, 79, 76, 79, 84];
      const times = [0, 0.12, 0.24, 0.36, 0.6, 0.78, 0.9, 1.1];
      notes.forEach((n, i) => {
        const d = 0.95 + times[i];
        tone({ type: "square", f0: NOTE(n), dur: i === notes.length - 1 ? 1.1 : 0.16, vol: 0.12, delay: d, filter: 3000 });
        tone({ type: "sawtooth", f0: NOTE(n + 7), dur: i === notes.length - 1 ? 1.1 : 0.16, vol: 0.04, delay: d, filter: 2000 });
        tone({ type: "triangle", f0: NOTE(n - 12), dur: 0.2, vol: 0.14, delay: d });
      });
      setTimeout(() => sfx.mooChoir(), 2200);
    },
  };

  /* ---------- MUSIK LATAR (chiptune ladang, disusun real-time) ---------- */
  const music = (() => {
    // progresi C - Am - F - G, 16 langkah per bar
    const CHORDS = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]];
    const MEL = [
      [72, 0, 76, 0, 79, 0, 76, 0, 77, 76, 74, 0, 72, 0, 0, 0],
      [69, 0, 72, 0, 76, 0, 72, 0, 74, 72, 71, 0, 69, 0, 67, 0],
      [69, 0, 72, 0, 77, 0, 76, 74, 72, 0, 69, 0, 72, 0, 74, 0],
      [74, 0, 71, 0, 67, 0, 71, 74, 79, 0, 77, 0, 76, 0, 74, 0],
    ];
    let timer = 0, step = 0, nextT = 0, playing = false;
    function tick() {
      const a = actx; if (!a) return;
      const frenzy = document.body.classList.contains("frenzy");
      const boost = document.body.classList.contains("boost");
      const bpm = frenzy ? 150 : 116;
      const stepDur = 60 / bpm / 4;
      const tr = frenzy ? 2 : 0;
      while (nextT < a.currentTime + 0.15) {
        const bar = Math.floor(step / 16) % 4, s = step % 16;
        const ch = CHORDS[bar];
        const at = nextT;
        // bass
        if (s % 4 === 0) tone({ type: "triangle", f0: NOTE(ch[0] - 12 + tr), dur: stepDur * 3, vol: 0.32, at, bus: musicBus });
        if (s % 4 === 2) tone({ type: "triangle", f0: NOTE(ch[0] + tr), dur: stepDur, vol: 0.2, at, bus: musicBus });
        // arpeggio
        if (s % 2 === 1) tone({ type: "square", f0: NOTE(ch[(s >> 1) % 3] + 12 + tr), dur: stepDur * 0.9, vol: 0.035, at, filter: 2500, bus: musicBus });
        // melodi
        const m = MEL[bar][s];
        if (m) tone({ type: "square", f0: NOTE(m + tr), dur: stepDur * 1.8, vol: 0.08, at, filter: 3200, bus: musicBus, vib: 3 });
        // drum
        if (s === 0 || s === 8 || (frenzy && s % 4 === 0)) tone({ type: "sine", f0: 140, f1: 45, dur: 0.14, vol: 0.5, at, bus: musicBus });
        if (s === 4 || s === 12) noise({ dur: 0.12, vol: 0.18, freq: 1800, type: "bandpass", q: 0.8, at, bus: musicBus });
        if (s % 2 === 0) noise({ dur: 0.03, vol: frenzy ? 0.08 : 0.05, freq: 8000, type: "highpass", at, bus: musicBus });
        if (boost && s % 2 === 1) noise({ dur: 0.05, vol: 0.06, freq: 9000, type: "highpass", at, bus: musicBus }); // rebana lonceng
        if (s === 0 && bar === 0) cowbellMusic(at);
        nextT += stepDur; step++;
      }
    }
    function cowbellMusic(at) {
      [560, 829].forEach((f) => tone({ type: "square", f0: f, dur: 0.25, vol: 0.03, at, filter: 2600, bus: musicBus }));
    }
    return {
      start() {
        const a = audio(); if (!a || playing || !musicOn) return;
        playing = true; step = 0; nextT = a.currentTime + 0.1;
        timer = setInterval(tick, 40);
      },
      stop() { playing = false; clearInterval(timer); },
      get playing() { return playing; },
    };
  })();

  /* =========================================================
     PARTIKEL (canvas)
     ========================================================= */
  const cv = $("fx");
  const ctx = cv.getContext("2d");
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  const parts = [];
  const MAX_PARTS = 900;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const CONFETTI = ["#ff5e8a", "#ffd93d", "#6bcb77", "#4d96ff", "#b06bff", "#ff9f43", "#ffffff"];

  function add(p) {
    if (parts.length >= MAX_PARTS) parts.shift();
    const o = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0.99, life: 1, rot: 0, vr: 0, size: 10, color: "#fff" }, p);
    o.max = o.life;
    parts.push(o);
  }

  function burst(x, y, power = 1) {
    // tetesan susu
    for (let i = 0; i < 8 * power; i++) {
      const a = rnd(0, Math.PI * 2), s = rnd(3, 9) * Math.sqrt(power);
      add({ type: "drop", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3, g: 0.35, life: rnd(0.6, 1.1), size: rnd(6, 12), color: "#ffffff" });
    }
    // bintang & hati
    for (let i = 0; i < 4 * power; i++) {
      const a = rnd(0, Math.PI * 2), s = rnd(2, 7);
      add({ type: Math.random() < 0.5 ? "star" : "heart", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, g: 0.12, life: rnd(0.7, 1.3), size: rnd(10, 18), vr: rnd(-0.2, 0.2), color: pick(["#ffd93d", "#ff8fb1", "#ff5e8a", "#fff3a8"]) });
    }
    // percikan garis
    for (let i = 0; i < 6 * power; i++) {
      const a = rnd(0, Math.PI * 2), s = rnd(8, 16);
      add({ type: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 0.86, life: rnd(0.25, 0.45), size: rnd(2, 4), color: pick(["#fff", "#ffe066"]) });
    }
    // gelombang kejut
    add({ type: "ring", x, y, life: 0.45, size: 10, grow: 220 * Math.sqrt(power), color: "rgba(255,255,255,1)" });
  }

  function grassBurst(x, y) {
    for (let i = 0; i < 6; i++) {
      add({ type: "leaf", x, y, vx: rnd(-6, 6), vy: rnd(-10, -4), g: 0.3, life: rnd(0.8, 1.3), size: rnd(8, 14), vr: rnd(-0.3, 0.3), rot: rnd(0, 6), color: pick(["#6bcb77", "#4caf3a", "#9be37a"]) });
    }
  }

  function confetti(x, y, n = 80, spread = Math.PI * 2, dir = -Math.PI / 2, speed = 14) {
    for (let i = 0; i < n; i++) {
      const a = dir + rnd(-spread / 2, spread / 2), s = rnd(speed * 0.4, speed);
      add({ type: "confetti", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.25, drag: 0.97, life: rnd(1.5, 2.8), size: rnd(7, 13), rot: rnd(0, 6), vr: rnd(-0.4, 0.4), color: pick(CONFETTI), wob: rnd(0, 6) });
    }
  }

  function firework(x, y) {
    const c = pick(CONFETTI);
    const c2 = pick(CONFETTI);
    const n = 60;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, s = rnd(5, 9);
      add({ type: "glow", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.08, drag: 0.96, life: rnd(1, 1.6), size: rnd(2.5, 4), color: i % 2 ? c : c2 });
    }
    add({ type: "ring", x, y, life: 0.5, size: 10, grow: 160, color: c });
    sfx.firework();
  }

  function floatText(x, y, text, opts = {}) {
    add({ type: "text", x, y, vx: rnd(-1, 1), vy: opts.vy ?? -3.2, drag: 0.97, life: opts.life ?? 0.9, size: opts.size ?? 34, text, color: opts.color ?? "#fff", g: -0.02 });
  }

  function emojiRain(emoji, n = 20) {
    for (let i = 0; i < n; i++) {
      add({ type: "emoji", text: emoji, x: rnd(0, W), y: rnd(-200, -20), vx: rnd(-1, 1), vy: rnd(3, 7), g: 0.08, drag: 1, life: 3, size: rnd(24, 46), rot: rnd(-0.5, 0.5), vr: rnd(-0.05, 0.05) });
    }
  }

  function drawStar(r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.45 : r;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
  }
  function drawHeart(r) {
    ctx.beginPath();
    ctx.moveTo(0, r * 0.35);
    ctx.bezierCurveTo(-r * 1.2, -r * 0.4, -r * 0.5, -r * 1.2, 0, -r * 0.45);
    ctx.bezierCurveTo(r * 0.5, -r * 1.2, r * 1.2, -r * 0.4, 0, r * 0.35);
    ctx.closePath();
  }
  function drawDrop(r) {
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.3);
    ctx.bezierCurveTo(r * 0.9, -r * 0.2, r, r * 0.9, 0, r);
    ctx.bezierCurveTo(-r, r * 0.9, -r * 0.9, -r * 0.2, 0, -r * 1.3);
    ctx.closePath();
  }

  function stepParticles(dt) {
    const k = dt * 60;
    ctx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0 || p.y > H + 120) { parts.splice(i, 1); continue; }
      p.vx *= Math.pow(p.drag, k);
      p.vy = p.vy * Math.pow(p.drag, k) + p.g * k;
      p.x += p.vx * k; p.y += p.vy * k;
      p.rot += p.vr * k;
      const t = Math.min(1, p.life / p.max);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, t * 2);
      switch (p.type) {
        case "drop": {
          ctx.rotate(Math.atan2(p.vy, p.vx) + Math.PI / 2 - p.rot);
          drawDrop(p.size * 0.6);
          ctx.fillStyle = "#fff"; ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = "#7fa6d6"; ctx.stroke();
          break;
        }
        case "star": drawStar(p.size * 0.6); ctx.fillStyle = p.color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#2b2118"; ctx.stroke(); break;
        case "heart": drawHeart(p.size * 0.7); ctx.fillStyle = p.color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#2b2118"; ctx.stroke(); break;
        case "spark":
          ctx.rotate(-p.rot);
          ctx.strokeStyle = p.color; ctx.lineWidth = p.size; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-p.vx * 2, -p.vy * 2); ctx.stroke();
          break;
        case "ring": {
          const prog = 1 - p.life / p.max;
          ctx.globalAlpha = (1 - prog) * 0.9;
          ctx.strokeStyle = p.color; ctx.lineWidth = 8 * (1 - prog) + 1;
          ctx.beginPath(); ctx.arc(0, 0, p.size + p.grow * prog, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case "confetti": {
          p.wob += 0.2 * k;
          ctx.scale(1, Math.cos(p.wob));
          ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          break;
        }
        case "leaf":
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.ellipse(0, 0, p.size / 2, p.size / 5, 0, 0, Math.PI * 2); ctx.fill();
          break;
        case "glow":
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 12;
          ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
          break;
        case "text": {
          const prog = 1 - p.life / p.max;
          const sc = prog < 0.15 ? 0.5 + (prog / 0.15) * 0.8 : 1.3 - Math.min(0.3, (prog - 0.15));
          ctx.rotate(-p.rot);
          ctx.scale(sc, sc);
          ctx.font = `${p.size}px "Lilita One", sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.lineJoin = "round"; ctx.lineWidth = 7; ctx.strokeStyle = "#2b2118";
          ctx.strokeText(p.text, 0, 0);
          ctx.fillStyle = p.color; ctx.fillText(p.text, 0, 0);
          break;
        }
        case "emoji":
          ctx.font = `${p.size}px serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(p.text, 0, 0);
          break;
      }
      ctx.restore();
    }
  }

  /* =========================================================
     EKSPRESI SAPI
     ========================================================= */
  let faceTimer = 0;
  function happyFace(ms = 220) {
    eyesG.setAttribute("opacity", "0");
    happyEyes.setAttribute("opacity", "1");
    mouthSmile.setAttribute("opacity", "0");
    mouthMoo.setAttribute("opacity", "1");
    clearTimeout(faceTimer);
    faceTimer = setTimeout(() => {
      eyesG.setAttribute("opacity", "1");
      happyEyes.setAttribute("opacity", "0");
      mouthSmile.setAttribute("opacity", "1");
      mouthMoo.setAttribute("opacity", "0");
    }, ms);
  }

  function blink() {
    [eyeL, eyeR].forEach((e) => e.classList.add("blink"));
    setTimeout(() => [eyeL, eyeR].forEach((e) => e.classList.remove("blink")), 130);
    setTimeout(blink, rnd(1800, 4800));
  }
  setTimeout(blink, 2000);

  // pupil mengikuti kursor
  window.addEventListener("pointermove", (e) => {
    const r = cowBtn.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height * 0.42;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    const d = Math.hypot(dx, dy) || 1;
    const m = Math.min(9, d / 30);
    const tx = (dx / d) * m, ty = (dy / d) * m;
    pupils.forEach((p) => (p.style.transform = `translate(${tx}px, ${ty}px)`));
  });

  /* =========================================================
     LOGIKA GAME
     ========================================================= */
  function multiplier() {
    return COMBO_LEVELS[S.levelIdx].mult * (performance.now() < S.boostUntil ? 2 : 1);
  }

  function cowCenter() {
    const r = cowBtn.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
  }

  function retrigger(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // paksa reflow agar animasi bisa diulang
    el.classList.add(cls);
  }

  function shake(big = false) {
    app.classList.remove("shake", "shake-big");
    void app.offsetWidth;
    app.classList.add(big ? "shake-big" : "shake");
  }

  function doFlash() { retrigger(flash, "go"); }

  function showBanner(text) {
    bannerText.textContent = text;
    retrigger(banner, "go");
  }

  function hitCow(x, y, { auto = false } = {}) {
    if (!S.running) return;
    const now = performance.now();

    if (!auto) {
      S.combo = now - S.lastClick < COMBO_WINDOW ? S.combo + 1 : 1;
      S.lastClick = now;
      S.clicks++;
      // naik level combo?
      let idx = 0;
      COMBO_LEVELS.forEach((l, i) => { if (S.combo >= l.at) idx = i; });
      if (idx > S.levelIdx) {
        S.levelIdx = idx;
        const lvl = COMBO_LEVELS[idx];
        S.maxMult = Math.max(S.maxMult, lvl.mult);
        floatText(x, y - 60, `${lvl.label} x${lvl.mult}`, { size: 44, color: "#ffd93d", life: 1.3 });
        sfx.levelUp(idx);
        sfx.confettiPop();
        shake(idx >= 3);
        confetti(x, y, 30 + idx * 15);
        if (idx >= 3) { document.body.classList.add("frenzy"); doFlash(); emojiRain("🐄", 14); }
      }
    }

    const gain = multiplier();
    addScore(gain, x, y);

    // efek
    burst(x, y, auto ? 0.5 : 1 + S.levelIdx * 0.35);
    if (Math.random() < 0.4) grassBurst(x, y + 40);
    retrigger(cowBtn, "squish");
    happyFace();
    retrigger(scoreEl, "pop");
    if (!auto || Math.random() < 0.5) sfx.pop(S.combo);
    if (performance.now() < S.boostUntil) sfx.jingle();
    if (Math.random() < 0.1 || (S.combo > 0 && S.combo % 15 === 0 && !auto)) sfx.randomMoo();
    if (Math.random() < 0.03) floatText(x, y - 80, pick(["MOOO!", "MOO~", "MOOOOO!!", "🥛", "💖"]), { size: 40, color: "#ff8fb1" });

    if (S.clicks === 1) hint.classList.add("hide");
  }

  function addScore(n, x, y, color) {
    const before = S.score;
    S.score = Math.min(GOAL, S.score + n);
    const col = color || (n >= 5 ? "#ff6bf0" : n >= 3 ? "#ff9f43" : n >= 2 ? "#ffd93d" : "#ffffff");
    floatText(x + rnd(-30, 30), y - 20, `+${n}`, { size: 30 + Math.min(n, 10) * 3, color: col });

    MILESTONES.forEach((m) => {
      if (before < m && S.score >= m && !S.milestonesHit.has(m)) {
        S.milestonesHit.add(m);
        milestone(m);
      }
    });
    updateHUD();
    if (S.score >= GOAL) win();
  }

  function milestone(m) {
    const msg = { 100: "100! KEREN! 🐮", 250: "250! MOOOMANTAP!", 500: "500! SETENGAH JALAN!", 750: "750! HAMPIR!! 🔥" }[m];
    showBanner(msg);
    sfx.milestone(m);
    doFlash();
    shake(true);
    confetti(W * 0.15, H, 70, Math.PI / 2.5, -Math.PI / 2.6, 22);
    confetti(W * 0.85, H, 70, Math.PI / 2.5, -Math.PI + Math.PI / 2.6, 22);
    emojiRain(pick(["🥛", "🐄", "⭐", "🌼"]), 18);
    document.querySelector(`.milestones span[data-m="${m}"]`)?.classList.add("done");
  }

  function updateHUD() {
    scoreEl.textContent = S.score;
    const pct = (S.score / GOAL) * 100;
    bottleFill.style.width = pct + "%";
    progressText.textContent = `${S.score} / ${GOAL}`;
    if (S.score >= GOAL) document.querySelector('.milestones span[data-m="1000"]')?.classList.add("done");
  }

  /* ---------- Power-ups ---------- */
  function usePower(name) {
    if (!S.running) return;
    const cfg = POWERS[name];
    const now = performance.now();
    if (S.score < cfg.unlock || now < S.cdUntil[name]) { sfx.denied(); return; }
    S.cdUntil[name] = now + cfg.cooldown;
    const { x, y } = cowCenter();

    if (name === "bell") {
      S.boostUntil = now + cfg.duration;
      showBanner("LONCENG EMAS x2! 🔔");
      sfx.bellPower();
      confetti(x, y, 60);
      emojiRain("🔔", 12);
    } else if (name === "storm") {
      S.stormUntil = now + cfg.duration;
      S.stormAcc = 0;
      showBanner("BADAI SUSU! 🥛🥛🥛");
      sfx.whoosh();
      sfx.stormStart();
      emojiRain("🥛", 30);
    } else if (name === "mega") {
      showBanner("MEGA MOOOOO!!! 💥");
      sfx.megaCharge();
      retrigger(cowBtn, "squish");
      setTimeout(() => {
        if (!S.running) return;
        sfx.boom(); mooVoice({ pitch: 0.65, dur: 1.4, vol: 0.6, shape: "bull" });
        doFlash(); shake(true);
        for (let i = 0; i < 4; i++) setTimeout(() => burst(x + rnd(-80, 80), y + rnd(-80, 80), 3), i * 90);
        confetti(x, y, 150, Math.PI * 2, 0, 20);
        addScore(40, x, y - 40, "#ff5e8a");
      }, 520);
    }
  }

  function updatePowers(now) {
    for (const [name, btn] of Object.entries(powerBtns)) {
      const cfg = POWERS[name];
      const locked = S.score < cfg.unlock;
      const cdLeft = Math.max(0, S.cdUntil[name] - now);
      const active = (name === "bell" && now < S.boostUntil) || (name === "storm" && now < S.stormUntil);
      btn.classList.toggle("locked", locked);
      btn.classList.toggle("active", active);
      const ready = !locked && cdLeft === 0 && S.running;
      if (ready && !S.wasReady[name]) sfx.powerReady();
      S.wasReady[name] = ready;
      btn.classList.toggle("ready", ready);
      btn.disabled = locked || cdLeft > 0 || !S.running;
      btn.querySelector(".p-cd").style.height = active ? "0%" : (cdLeft / cfg.cooldown) * 100 + "%";
    }
    document.body.classList.toggle("boost", now < S.boostUntil);
  }

  /* ---------- Sapi emas ---------- */
  function scheduleGold(now) { S.nextGold = now + rnd(9000, 17000); }

  function spawnGold(now) {
    S.goldUntil = now + 4500;
    S.goldX = rnd(40, W - 130);
    S.goldY = rnd(H * 0.2, H * 0.7);
    S.goldVX = rnd(-2.5, 2.5) || 1.5;
    S.goldVY = rnd(-1.5, 1.5);
    goldCow.classList.add("show");
    sfx.goldSpawn();
  }

  goldCow.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!S.running || !goldCow.classList.contains("show")) return;
    goldCow.classList.remove("show");
    S.golds++;
    S.goldUntil = 0;
    scheduleGold(performance.now());
    const x = e.clientX, y = e.clientY;
    sfx.goldCatch();
    firework(x, y);
    confetti(x, y, 60);
    showBanner("SAPI EMAS! +25 ✨");
    addScore(25, x, y, "#ffd93d");
  });

  /* ---------- Menang ---------- */
  let fireworksTimer = 0;
  function win() {
    if (!S.running) return;
    S.running = false;
    S.endTime = performance.now();
    const secs = (S.endTime - S.startTime) / 1000;
    goldCow.classList.remove("show");
    document.body.classList.remove("frenzy", "boost");

    const isRecord = !best || secs < best;
    if (isRecord) { best = secs; store.set("moooo-best", String(best)); renderBest(); }

    $("wTime").textContent = secs.toFixed(1) + "s";
    $("wClicks").textContent = S.clicks;
    $("wCombo").textContent = "x" + S.maxMult;
    $("wGold").textContent = S.golds;
    $("newRecord").classList.toggle("show", isRecord);

    showBanner("1000!!! MOOOOOO!!! 🏆");
    music.stop();
    sfx.stormStop();
    sfx.confettiPop();
    sfx.fanfare();
    doFlash(); shake(true);
    emojiRain("🐄", 40);
    confetti(0, H, 120, Math.PI / 3, -Math.PI / 3, 26);
    confetti(W, H, 120, Math.PI / 3, -Math.PI + Math.PI / 3, 26);

    let n = 0;
    clearInterval(fireworksTimer);
    fireworksTimer = setInterval(() => {
      firework(rnd(W * 0.1, W * 0.9), rnd(H * 0.1, H * 0.5));
      if (++n > 24) clearInterval(fireworksTimer);
    }, 280);

    setTimeout(() => $("winScreen").classList.add("show"), 1300);
  }

  /* ---------- Mulai / reset ---------- */
  function start() {
    audio();
    clearInterval(fireworksTimer);
    S = freshState();
    S.running = true;
    S.startTime = performance.now();
    scheduleGold(S.startTime);
    document.querySelectorAll(".milestones span").forEach((s) => s.classList.remove("done"));
    document.body.classList.remove("frenzy", "boost");
    hint.classList.remove("hide");
    updateHUD();
    $("startScreen").classList.remove("show");
    $("winScreen").classList.remove("show");
    sfx.stormStop();
    sfx.startJingle();
    setTimeout(() => sfx.moo(1), 550);
    music.stop();
    setTimeout(() => { if (S.running) music.start(); }, 900);
    const { x, y } = cowCenter();
    confetti(x, y, 80);
    cowBtn.focus({ preventScroll: true });
  }

  $("startBtn").addEventListener("click", start);
  $("againBtn").addEventListener("click", start);

  /* ---------- Input ---------- */
  cowBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    hitCow(e.clientX, e.clientY);
  });
  // cegah "click" bawaan (sudah ditangani pointerdown)
  cowBtn.addEventListener("click", (e) => e.preventDefault());

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "Enter") {
      if (!S.running) {
        // hanya layar awal yang bisa dimulai pakai keyboard (biar spam spasi tidak melewati layar menang)
        if ($("startScreen").classList.contains("show")) {
          if (e.repeat) return;
          e.preventDefault();
          start();
        }
        return;
      }
      e.preventDefault();
      if (e.repeat) return; // tahan tombol tidak dihitung
      const { x, y, r } = cowCenter();
      hitCow(x + rnd(-r.width * 0.3, r.width * 0.3), y + rnd(-r.height * 0.3, r.height * 0.3));
    } else if (S.running && e.key === "1") usePower("bell");
    else if (S.running && e.key === "2") usePower("storm");
    else if (S.running && e.key === "3") usePower("mega");
  });

  Object.entries(powerBtns).forEach(([name, btn]) => btn.addEventListener("click", () => usePower(name)));

  muteBtn.addEventListener("click", () => {
    muted = !muted;
    store.set("moooo-muted", muted ? "1" : "0");
    renderMute();
    audio(); setMasterMute();
    if (!muted) sfx.uiClick();
  });

  musicBtn.addEventListener("click", () => {
    musicOn = !musicOn;
    store.set("moooo-music", musicOn ? "1" : "0");
    renderMusic();
    sfx.uiClick();
    if (musicOn && S.running) music.start(); else music.stop();
  });

  // suara hover & klik untuk semua tombol
  document.querySelectorAll(".power, .big-btn, .icon-btn").forEach((b) => {
    b.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse" && !b.disabled) sfx.hover(); });
  });
  document.querySelectorAll(".big-btn").forEach((b) => b.addEventListener("pointerdown", () => sfx.uiClick()));

  function renderMute() {
    muteBtn.querySelector("img").src = muted ? "assets/sound-off.svg" : "assets/sound-on.svg";
  }
  function renderMusic() {
    musicBtn.querySelector("img").src = musicOn ? "assets/music-on.svg" : "assets/music-off.svg";
    musicBtn.classList.toggle("off", !musicOn);
  }
  function renderBest() { bestEl.textContent = best ? best.toFixed(1) + "s" : "—"; }

  /* =========================================================
     LOOP UTAMA
     ========================================================= */
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (S.running) {
      timerEl.textContent = ((now - S.startTime) / 1000).toFixed(1) + "s";

      // combo meluruh
      const since = now - S.lastClick;
      if (S.combo > 0 && since > COMBO_WINDOW) {
        if (S.levelIdx > 0) { floatText(W / 2, H * 0.35, "combo putus...", { size: 26, color: "#cfd8e3", life: 0.8 }); sfx.comboBreak(); }
        S.combo = 0; S.levelIdx = 0;
        document.body.classList.remove("frenzy");
      }
      const lvl = COMBO_LEVELS[S.levelIdx];
      comboBox.classList.toggle("show", S.combo >= 3);
      comboBox.className = comboBox.className.replace(/\blvl\d\b/g, "").trim();
      comboBox.classList.add("lvl" + (S.levelIdx + 1));
      comboText.textContent = `${lvl.label} x${lvl.mult} · ${S.combo}`;
      comboFill.style.width = Math.max(0, 1 - since / COMBO_WINDOW) * 100 + "%";

      // badai susu: auto-pencet
      if (now < S.stormUntil) {
        S.stormAcc += dt * 12;
        while (S.stormAcc >= 1 && S.running) {
          S.stormAcc -= 1;
          const { x, y, r } = cowCenter();
          hitCow(x + rnd(-r.width * 0.4, r.width * 0.4), y + rnd(-r.height * 0.4, r.height * 0.3), { auto: true });
        }
        if (Math.random() < 0.6) add({ type: "drop", x: rnd(0, W), y: -20, vx: rnd(-1, 1), vy: rnd(6, 10), g: 0.3, life: 2, size: rnd(8, 14) });
        if (Math.random() < 0.15) sfx.drip();
      } else if (S.stormUntil) {
        S.stormUntil = 0;
        sfx.stormStop();
      }

      // deg-degan menjelang 1000
      if (S.score >= 900 && now > S.nextBeat) {
        sfx.heartbeat();
        S.nextBeat = now + (S.score >= 970 ? 450 : 750);
      }

      // sapi emas
      if (!S.goldUntil && now > S.nextGold) spawnGold(now);
      if (S.goldUntil) {
        if (now > S.goldUntil) {
          S.goldUntil = 0;
          goldCow.classList.remove("show");
          sfx.goldMiss();
          floatText(W / 2, H * 0.3, "sapi emas kabur... 🏃", { size: 26, color: "#ffd93d", life: 1 });
          scheduleGold(now);
        } else {
          const k = dt * 60;
          S.goldX += S.goldVX * k; S.goldY += S.goldVY * k;
          if (S.goldX < 10 || S.goldX > W - 96) S.goldVX *= -1;
          if (S.goldY < 60 || S.goldY > H - 120) S.goldVY *= -1;
          goldCow.style.left = S.goldX + "px";
          goldCow.style.top = S.goldY + "px";
          if (Math.random() < 0.3) add({ type: "glow", x: S.goldX + 43 + rnd(-20, 20), y: S.goldY + 43 + rnd(-20, 20), vx: rnd(-1, 1), vy: rnd(-1, 1), life: 0.6, size: rnd(2, 4), color: "#ffd700" });
        }
      }
    }

    updatePowers(now);
    stepParticles(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
