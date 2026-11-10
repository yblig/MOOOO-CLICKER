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
    };
  }
  S = freshState();

  let best = parseFloat(store.get("moooo-best")) || 0;
  let muted = store.get("moooo-muted") === "1";
  renderBest();
  renderMute();

  /* =========================================================
     AUDIO — semua disintesis pakai WebAudio, tanpa file
     ========================================================= */
  let actx = null;
  let master = null;
  function audio() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
      master = actx.createGain();
      master.gain.value = 0.5;
      master.connect(actx.destination);
    }
    if (actx.state === "suspended") actx.resume();
    return actx;
  }

  function tone({ type = "sine", f0 = 440, f1 = f0, dur = 0.15, vol = 0.3, delay = 0, filter = 0 }) {
    if (muted) return;
    const a = audio(); if (!a) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) {
      const lp = a.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = filter;
      o.connect(lp); node = lp;
    }
    node.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise({ dur = 0.3, vol = 0.3, freq = 800, delay = 0 }) {
    if (muted) return;
    const a = audio(); if (!a) return;
    const t = a.currentTime + delay;
    const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = a.createBufferSource(); src.buffer = buf;
    const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = freq;
    const g = a.createGain(); g.gain.value = vol;
    src.connect(lp); lp.connect(g); g.connect(master);
    src.start(t);
  }

  const sfx = {
    pop(combo) {
      const p = 380 + Math.min(combo, 60) * 12;
      tone({ type: "triangle", f0: p, f1: p * 1.9, dur: 0.09, vol: 0.22 });
    },
    moo(pitch = 1) {
      if (muted) return;
      const a = audio(); if (!a) return;
      const t = a.currentTime;
      const dur = 0.9;
      const o = a.createOscillator();
      const o2 = a.createOscillator();
      const vib = a.createOscillator();
      const vibG = a.createGain();
      const f1 = a.createBiquadFilter();
      const f2 = a.createBiquadFilter();
      const g = a.createGain();
      o.type = "sawtooth"; o2.type = "square";
      const base = 150 * pitch;
      o.frequency.setValueAtTime(base * 0.9, t);
      o.frequency.linearRampToValueAtTime(base * 1.12, t + 0.25);
      o.frequency.linearRampToValueAtTime(base * 0.78, t + dur);
      o2.frequency.setValueAtTime(base * 0.45, t);
      o2.frequency.linearRampToValueAtTime(base * 0.39, t + dur);
      vib.frequency.value = 6; vibG.gain.value = 4;
      vib.connect(vibG); vibG.connect(o.frequency);
      f1.type = "bandpass"; f1.Q.value = 3;
      f1.frequency.setValueAtTime(400, t);
      f1.frequency.linearRampToValueAtTime(900, t + 0.3); // "mmm" -> "ooo"
      f1.frequency.linearRampToValueAtTime(500, t + dur);
      f2.type = "lowpass"; f2.frequency.value = 1400;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.12);
      g.gain.setValueAtTime(0.5, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f1); o2.connect(f1); f1.connect(f2); f2.connect(g); g.connect(master);
      [o, o2, vib].forEach((n) => { n.start(t); n.stop(t + dur + 0.05); });
    },
    ding() {
      [0, 0.08, 0.16].forEach((d, i) => tone({ type: "sine", f0: 880 * (1 + i * 0.26), dur: 0.5, vol: 0.18, delay: d }));
    },
    coin() {
      tone({ type: "square", f0: 988, dur: 0.08, vol: 0.12, filter: 4000 });
      tone({ type: "square", f0: 1319, dur: 0.35, vol: 0.12, delay: 0.08, filter: 4000 });
    },
    levelUp() {
      [523, 659, 784, 1047].forEach((f, i) => tone({ type: "triangle", f0: f, dur: 0.18, vol: 0.2, delay: i * 0.06 }));
    },
    boom() {
      tone({ type: "sine", f0: 160, f1: 30, dur: 0.6, vol: 0.6 });
      noise({ dur: 0.6, vol: 0.5, freq: 1200 });
    },
    whoosh() { noise({ dur: 0.5, vol: 0.25, freq: 2500 }); },
    fanfare() {
      const notes = [523, 523, 523, 659, 784, 659, 784, 1047];
      const times = [0, 0.12, 0.24, 0.36, 0.6, 0.78, 0.9, 1.1];
      notes.forEach((f, i) => {
        tone({ type: "square", f0: f, dur: i === notes.length - 1 ? 0.9 : 0.16, vol: 0.12, delay: times[i], filter: 3000 });
        tone({ type: "triangle", f0: f / 2, dur: 0.2, vol: 0.12, delay: times[i] });
      });
    },
    firework() {
      noise({ dur: 0.35, vol: 0.18, freq: 3000 });
      tone({ type: "sine", f0: 1200 + Math.random() * 600, f1: 300, dur: 0.4, vol: 0.06 });
    },
  };

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
        sfx.levelUp();
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
    sfx.pop(S.combo);
    if (Math.random() < 0.12 || (S.combo > 0 && S.combo % 15 === 0 && !auto)) sfx.moo(rnd(0.85, 1.25));
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
    sfx.ding();
    sfx.moo(0.9);
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
    if (S.score < cfg.unlock || now < S.cdUntil[name]) return;
    S.cdUntil[name] = now + cfg.cooldown;
    const { x, y } = cowCenter();

    if (name === "bell") {
      S.boostUntil = now + cfg.duration;
      showBanner("LONCENG EMAS x2! 🔔");
      sfx.coin(); sfx.ding();
      confetti(x, y, 60);
      emojiRain("🔔", 12);
    } else if (name === "storm") {
      S.stormUntil = now + cfg.duration;
      S.stormAcc = 0;
      showBanner("BADAI SUSU! 🥛🥛🥛");
      sfx.whoosh();
      emojiRain("🥛", 30);
    } else if (name === "mega") {
      showBanner("MEGA MOOOOO!!! 💥");
      sfx.boom(); sfx.moo(0.7);
      doFlash(); shake(true);
      for (let i = 0; i < 4; i++) setTimeout(() => burst(x + rnd(-80, 80), y + rnd(-80, 80), 3), i * 90);
      confetti(x, y, 150, Math.PI * 2, 0, 20);
      addScore(40, x, y - 40, "#ff5e8a");
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
      btn.classList.toggle("ready", !locked && cdLeft === 0 && S.running);
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
    sfx.coin();
  }

  goldCow.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!S.running || !goldCow.classList.contains("show")) return;
    goldCow.classList.remove("show");
    S.golds++;
    S.goldUntil = 0;
    scheduleGold(performance.now());
    const x = e.clientX, y = e.clientY;
    sfx.coin(); sfx.moo(1.4);
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
    sfx.fanfare();
    setTimeout(() => sfx.moo(1), 400);
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
    sfx.moo(1);
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
    if (!muted) sfx.pop(5);
  });

  function renderMute() {
    muteBtn.querySelector("img").src = muted ? "assets/sound-off.svg" : "assets/sound-on.svg";
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
        if (S.levelIdx > 0) floatText(W / 2, H * 0.35, "combo putus...", { size: 26, color: "#cfd8e3", life: 0.8 });
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
      }

      // sapi emas
      if (!S.goldUntil && now > S.nextGold) spawnGold(now);
      if (S.goldUntil) {
        if (now > S.goldUntil) {
          S.goldUntil = 0;
          goldCow.classList.remove("show");
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
