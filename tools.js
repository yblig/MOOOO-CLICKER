/* =========================================================
   MOOOO CLICKER — Alat Belajar 🧮 + Soal Sapi
   Kalkulator pecahan (bisa 1/4, 3 1/4, desimal, %, pangkat)
   dengan langkah pengerjaan, dan alat bantu belajar lainnya.
   ========================================================= */
(() => {
  "use strict";

  const G = () => window.MOOOO || {};
  const sfx = (name, ...a) => { try { G().sfx?.[name]?.(...a); } catch { /* tanpa suara */ } };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* abaikan */ } },
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* =========================================================
     BILANGAN RASIONAL (BigInt — hasil selalu tepat)
     ========================================================= */
  const babs = (a) => (a < 0n ? -a : a);
  function bgcd(a, b) { a = babs(a); b = babs(b); while (b) [a, b] = [b, a % b]; return a; }
  function blcm(a, b) { return a && b ? babs(a / bgcd(a, b) * b) : 0n; }

  class Q {
    constructor(n, d = 1n) {
      if (d === 0n) throw new Error("Tidak bisa dibagi dengan nol 🙅");
      if (d < 0n) { n = -n; d = -d; }
      const g = bgcd(n, d) || 1n;
      this.n = n / g; this.d = d / g;
    }
    static raw(n, d) { const q = Object.create(Q.prototype); q.n = n; q.d = d; return q; } // tanpa disederhanakan
    static from(str) { // "12", "0.25"
      const [i, f = ""] = str.split(".");
      return new Q(BigInt((i || "0") + f), 10n ** BigInt(f.length));
    }
    add(o) { return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
    sub(o) { return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
    mul(o) { return new Q(this.n * o.n, this.d * o.d); }
    div(o) { if (o.n === 0n) throw new Error("Tidak bisa dibagi dengan nol 🙅"); return new Q(this.n * o.d, this.d * o.n); }
    pow(k) {
      if (k.d !== 1n) throw new Error("Pangkat harus bilangan bulat (contoh 2^3)");
      if (babs(k.n) > 200n) throw new Error("Pangkatnya kebesaran 😅");
      if (k.n < 0n) { if (this.n === 0n) throw new Error("Tidak bisa dibagi dengan nol 🙅"); return new Q(this.d ** -k.n, this.n ** -k.n); }
      return new Q(this.n ** k.n, this.d ** k.n);
    }
    isInt() { return this.d === 1n; }
    eq(o) { return this.n === o.n && this.d === o.d; }
    toNumber() { return Number(this.n) / Number(this.d); }
    toString() { return this.d === 1n ? String(this.n) : `${this.n}/${this.d}`; }
    mixed() {
      if (this.d === 1n || babs(this.n) < this.d) return this.toString();
      const neg = this.n < 0n, a = babs(this.n);
      return `${neg ? "-" : ""}${a / this.d} ${a % this.d}/${this.d}`;
    }
    terminates() { let d = this.d; while (d % 2n === 0n) d /= 2n; while (d % 5n === 0n) d /= 5n; return d === 1n; }
    decimal(max = 10) {
      const neg = this.n < 0n, a = babs(this.n);
      let int = a / this.d, rem = a % this.d, digits = "";
      for (let i = 0; i < max && rem; i++) { rem *= 10n; digits += rem / this.d; rem %= this.d; }
      // pembulatan digit terakhir bila masih ada sisa
      let s = digits ? `${int}.${digits}` : `${int}`;
      if (rem && rem * 2n >= this.d) s = roundUp(s);
      s = s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
      return (neg && s !== "0" ? "-" : "") + s;
    }
  }
  function roundUp(s) {
    const arr = s.split("");
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i] === ".") continue;
      if (arr[i] === "9") arr[i] = "0"; else { arr[i] = String(+arr[i] + 1); return arr.join(""); }
    }
    return "1" + arr.join("");
  }

  /* =========================================================
     PARSER EKSPRESI
     Mendukung: + - × ÷ * / : ^ ( ) %, desimal, pecahan a/b,
     dan pecahan campuran "3 1/4" (spasi di antara bulat & pecahan).
     ========================================================= */
  function tokenize(src) {
    const s = src.replace(/[×xX]/g, "*").replace(/[÷:]/g, "/").replace(/[−–]/g, "-").replace(/,/g, ".");
    const out = [];
    let i = 0;
    const prev = () => out[out.length - 1];
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9.]/.test(c)) {
        const m = /^\d*\.?\d+|^\d+\.?/.exec(s.slice(i));
        const numStr = m[0].replace(/\.$/, "");
        if (!/\d/.test(numStr)) throw new Error("Angkanya kurang lengkap");
        const rest = s.slice(i + m[0].length);
        const p = prev();
        const afterPow = p && p.t === "op" && (p.v === "^" || p.v === "/");
        // pecahan campuran: bulat + spasi + a/b  (contoh 3 1/4)
        const mm = /^\s+(\d+)\s*\/\s*(\d+)(?!\s*[\^.\d])/.exec(rest);
        if (!afterPow && /^\d+$/.test(numStr) && mm) {
          const w = BigInt(numStr), a = BigInt(mm[1]), b = BigInt(mm[2]);
          if (b === 0n) throw new Error("Tidak bisa dibagi dengan nol 🙅");
          out.push({ t: "num", v: new Q(w * b + a, b), raw: `${numStr} ${mm[1]}/${mm[2]}`, mixed: { w, a, b } });
          i += m[0].length + mm[0].length;
          continue;
        }
        // pecahan biasa a/b sebagai satu angka (biar langkahnya rapi)
        const fm = /^\s*\/\s*(\d+)(?!\s*[\^.\d])/.exec(rest);
        if (!afterPow && /^\d+$/.test(numStr) && fm) {
          const b = BigInt(fm[1]);
          if (b === 0n) throw new Error("Tidak bisa dibagi dengan nol 🙅");
          out.push({ t: "num", v: Q.raw(BigInt(numStr), b), raw: `${numStr}/${fm[1]}`, frac: true });
          i += m[0].length + fm[0].length;
          continue;
        }
        out.push({ t: "num", v: Q.from(numStr), raw: numStr });
        i += m[0].length;
        continue;
      }
      if ("+-*/^()%".includes(c)) { out.push({ t: c === "(" || c === ")" ? c : "op", v: c }); i++; continue; }
      if (c === "√") { out.push({ t: "op", v: "√" }); i++; continue; }
      throw new Error(`Karakter "${c}" belum dikenal`);
    }
    return out;
  }

  function evaluate(src) {
    const toks = tokenize(src);
    if (!toks.length) throw new Error("Ketik soalnya dulu ya");
    let pos = 0;
    const steps = [];
    const peek = () => toks[pos];
    const take = () => toks[pos++];
    const isOp = (v) => peek() && peek().t === "op" && peek().v === v;

    function expr() {
      let a = term();
      while (isOp("+") || isOp("-")) { const op = take().v; const b = term(); a = binop(a, op, b); }
      return a;
    }
    function term() {
      let a = factor();
      for (;;) {
        if (isOp("*") || isOp("/")) { const op = take().v; const b = factor(); a = binop(a, op, b); }
        else if (peek() && peek().t === "(") { const b = factor(); a = binop(a, "*", b); } // 2(3+1)
        else break;
      }
      return a;
    }
    function factor() {
      let a = unary();
      if (isOp("^")) { take(); const b = factor(); a = binop(a, "^", b); }
      return a;
    }
    function unary() {
      if (isOp("-")) { take(); const v = unary(); return { q: new Q(-v.q.n, v.q.d), s: `-${wrap(v)}` }; }
      if (isOp("+")) { take(); return unary(); }
      if (isOp("√")) { take(); const v = unary(); return sqrtOf(v); }
      return postfix(primary());
    }
    function postfix(v) {
      while (isOp("%")) {
        take();
        const r = v.q.div(new Q(100n));
        steps.push({ title: "Persen", text: `${v.s}% = ${v.s}/100 = ${r}` });
        v = { q: r, s: r.toString() };
      }
      return v;
    }
    function primary() {
      const t = take();
      if (!t) throw new Error("Soalnya belum selesai");
      if (t.t === "num") {
        if (t.mixed) {
          const { w, a, b } = t.mixed;
          steps.push({ title: "Ubah pecahan campuran", text: `${t.raw} = (${w}×${b} + ${a})/${b} = ${w * b + a}/${b}` });
          return { q: t.v, s: `${w * b + a}/${b}` };
        }
        if (t.frac) {
          const simp = new Q(t.v.n, t.v.d);
          if (!simp.eq(t.v) || simp.d === 1n) steps.push({ title: "Sederhanakan", text: `${t.raw} = ${simp}  (dibagi FPB ${bgcd(t.v.n, t.v.d)})` });
          return { q: simp, s: simp.toString() };
        }
        if (!t.v.isInt()) steps.push({ title: "Ubah desimal", text: `${t.raw} = ${decAsFrac(t.raw)} = ${t.v}` });
        return { q: t.v, s: t.v.toString() };
      }
      if (t.t === "(") {
        const v = expr();
        if (!peek() || peek().t !== ")") throw new Error("Kurung tutup \")\" kurang");
        take();
        return postfix({ q: v.q, s: v.q.toString() });
      }
      throw new Error("Susunan soalnya kurang pas");
    }
    function sqrtOf(v) {
      const r = ratSqrt(v.q);
      if (!r) throw new Error("Akar ini tidak menghasilkan pecahan tepat — coba tab Persamaan/Statistik untuk desimal");
      steps.push({ title: "Akar", text: `√(${v.s}) = ${r}` });
      return { q: r, s: r.toString() };
    }

    const res = expr();
    if (pos < toks.length) throw new Error(toks[pos].t === ")" ? "Kurung buka \"(\" kurang" : "Ada angka/tanda yang berlebih");
    return { q: res.q, steps };

    function binop(A, op, B) {
      const a = A.q, b = B.q;
      let r, text, title;
      if (op === "+" || op === "-") {
        r = op === "+" ? a.add(b) : a.sub(b);
        title = op === "+" ? "Penjumlahan" : "Pengurangan";
        if (a.d === b.d) {
          const top = op === "+" ? a.n + b.n : a.n - b.n;
          text = a.d === 1n ? `${a} ${op} ${wrapQ(b)} = ${r}` : `${a} ${op} ${wrapQ(b)} = (${a.n} ${op} ${wrapN(b.n)})/${a.d} = ${top}/${a.d}${simpNote(top, a.d, r)}`;
        } else {
          const L = blcm(a.d, b.d);
          const an = a.n * (L / a.d), bn = b.n * (L / b.d);
          const top = op === "+" ? an + bn : an - bn;
          text = `Samakan penyebut, KPK(${a.d}, ${b.d}) = ${L}\n${a} ${op} ${wrapQ(b)} = ${an}/${L} ${op} ${wrapN(bn)}/${L} = ${top}/${L}${simpNote(top, L, r)}`;
        }
      } else if (op === "*") {
        r = a.mul(b); title = "Perkalian";
        const tn = a.n * b.n, td = a.d * b.d;
        text = a.isInt() && b.isInt() ? `${a} × ${wrapQ(b)} = ${r}` : `${wrapQ(a)} × ${wrapQ(b)} = (${a.n}×${wrapN(b.n)})/(${a.d}×${b.d}) = ${tn}/${td}${simpNote(tn, td, r)}`;
      } else if (op === "/") {
        if (b.n === 0n) throw new Error("Tidak bisa dibagi dengan nol 🙅");
        r = a.div(b); title = "Pembagian";
        const inv = new Q(b.d, b.n);
        const tn = a.n * inv.n, td = a.d * inv.d;
        text = a.isInt() && b.isInt() && r.isInt() ? `${a} ÷ ${wrapQ(b)} = ${r}` : `Bagi = kali kebalikannya\n${wrapQ(a)} ÷ ${wrapQ(b)} = ${wrapQ(a)} × ${wrapQ(inv)} = ${tn}/${td}${simpNote(tn, td, r)}`;
      } else if (op === "^") {
        r = a.pow(b); title = "Pangkat";
        text = a.isInt() ? `${wrapQ(a)}^${b} = ${r}` : `(${a})^${b} = ${a.n}^${b}/${a.d}^${b} = ${r}`;
      }
      steps.push({ title, text });
      return { q: r, s: r.toString() };
    }
  }
  function decAsFrac(raw) { const f = (raw.split(".")[1] || ""); return `${raw.replace(".", "").replace(/^0+(?=\d)/, "")}/${10 ** f.length}`; }
  const wrapN = (n) => (n < 0n ? `(${n})` : `${n}`);
  const wrapQ = (q) => (q.n < 0n ? `(${q})` : `${q}`);
  const wrap = (v) => (/[ +\-*/]/.test(v.s) ? `(${v.s})` : v.s);
  function simpNote(n, d, r) {
    const raw = `${n}/${d}`;
    if (raw === r.toString()) return "";
    const g = bgcd(n, d);
    return ` = ${r}  (sederhanakan: bagi FPB ${g})`;
  }
  function bsqrt(n) { if (n < 0n) return null; if (n < 2n) return n; let x = BigInt(Math.floor(Math.sqrt(Number(n)))); while (x * x > n) x--; while ((x + 1n) * (x + 1n) <= n) x++; return x * x === n ? x : null; }
  function ratSqrt(q) { if (q.n < 0n) return null; const a = bsqrt(q.n), b = bsqrt(q.d); return a !== null && b !== null ? new Q(a, b) : null; }

  /* ---------- tampilan pecahan bertumpuk ---------- */
  function fracHTML(q) {
    if (q.d === 1n) return `<span class="fr-int">${q.n}</span>`;
    return `<span class="fr"><span class="fr-n">${babs(q.n)}</span><span class="fr-d">${q.d}</span></span>`.replace('<span class="fr">', q.n < 0n ? '<span class="fr-sign">−</span><span class="fr">' : '<span class="fr">');
  }
  function mixedHTML(q) {
    if (q.d === 1n || babs(q.n) < q.d) return fracHTML(q);
    const neg = q.n < 0n, a = babs(q.n);
    return `${neg ? '<span class="fr-sign">−</span>' : ""}<span class="fr-int">${a / q.d}</span><span class="fr"><span class="fr-n">${a % q.d}</span><span class="fr-d">${q.d}</span></span>`;
  }

  /* =========================================================
     UI ALAT BELAJAR
     ========================================================= */
  const TABS = [
    { id: "frac", icon: "½", name: "Pecahan" },
    { id: "fpb", icon: "🔢", name: "FPB & KPK" },
    { id: "pct", icon: "%", name: "Persen" },
    { id: "eq", icon: "𝑥", name: "Persamaan" },
    { id: "stat", icon: "📊", name: "Statistik" },
    { id: "conv", icon: "📏", name: "Konversi" },
    { id: "ipk", icon: "🎓", name: "IPK" },
    { id: "pomo", icon: "⏳", name: "Fokus" },
  ];

  const root = document.createElement("div");
  root.id = "tools";
  root.className = "tools";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Alat Belajar");
  root.innerHTML = `
    <div class="tl-sheet">
      <div class="tl-head">
        <img src="assets/calc.svg" alt="" class="tl-logo" />
        <div class="tl-title">Alat Belajar <small>game dijeda selama kamu belajar</small></div>
        <button class="tl-close" id="tlClose" aria-label="Tutup">✕</button>
      </div>
      <nav class="tl-tabs" id="tlTabs">
        ${TABS.map((t) => `<button class="tl-tab" data-tab="${t.id}"><span>${t.icon}</span>${t.name}</button>`).join("")}
      </nav>
      <div class="tl-body" id="tlBody">

        <!-- PECAHAN -->
        <section class="tl-pane" data-pane="frac">
          <label class="tl-label" for="fxIn">Tulis soal (contoh: <code>3 1/4 + 1/2</code>, <code>2/3 × 3/4</code>, <code>(1/2 + 1/3) ÷ 1/6</code>)</label>
          <input id="fxIn" class="tl-input big" autocomplete="off" spellcheck="false" placeholder="3 1/4 + 1/2" />
          <div class="tl-result" id="fxOut"></div>
          <div class="keypad" id="fxPad">
            ${["7", "8", "9", "÷", "C",
               "4", "5", "6", "×", "⌫",
               "1", "2", "3", "−", "(",
               "0", ".", "a/b", "+", ")",
               "␣", "%", "^", "√", "="].map((k) => `<button class="key${/[÷×−+=^%√]/.test(k) ? " op" : ""}${k === "=" ? " eq" : ""}${k === "C" || k === "⌫" ? " danger" : ""}" data-k="${k}">${k === "␣" ? "spasi<small>campuran</small>" : k === "a/b" ? "a/b<small>pecahan</small>" : k}</button>`).join("")}
          </div>
          <details class="tl-steps" id="fxStepsBox" open><summary>Langkah pengerjaan</summary><ol id="fxSteps"></ol></details>
          <div class="tl-hist"><b>Riwayat</b><div id="fxHist"></div></div>
          <p class="tl-tip">Tips: pecahan campuran ditulis pakai spasi, contoh <code>3 1/4</code> = tiga seperempat. Tekan <b>=</b> untuk simpan ke riwayat.</p>
        </section>

        <!-- FPB KPK -->
        <section class="tl-pane" data-pane="fpb">
          <label class="tl-label" for="fpbIn">Masukkan bilangan bulat, pisahkan dengan koma</label>
          <input id="fpbIn" class="tl-input big" inputmode="numeric" placeholder="12, 18, 30" value="12, 18, 30" />
          <div id="fpbOut" class="tl-result"></div>
        </section>

        <!-- PERSEN -->
        <section class="tl-pane" data-pane="pct">
          <div class="tl-card">
            <b>Berapa <input id="p1a" class="tl-input sm" value="25" />% dari <input id="p1b" class="tl-input sm" value="80" />?</b>
            <div id="p1o" class="tl-ans"></div>
          </div>
          <div class="tl-card">
            <b><input id="p2a" class="tl-input sm" value="15" /> itu berapa % dari <input id="p2b" class="tl-input sm" value="60" />?</b>
            <div id="p2o" class="tl-ans"></div>
          </div>
          <div class="tl-card">
            <b>Perubahan dari <input id="p3a" class="tl-input sm" value="50000" /> ke <input id="p3b" class="tl-input sm" value="65000" /></b>
            <div id="p3o" class="tl-ans"></div>
          </div>
          <div class="tl-card">
            <b>Harga <input id="p4a" class="tl-input sm" value="120000" /> diskon <input id="p4b" class="tl-input sm" value="30" />%</b>
            <div id="p4o" class="tl-ans"></div>
          </div>
        </section>

        <!-- PERSAMAAN -->
        <section class="tl-pane" data-pane="eq">
          <div class="tl-seg" id="eqSeg"><button data-eq="lin" class="on">Linear ax + b = c</button><button data-eq="quad">Kuadrat ax² + bx + c = 0</button><button data-eq="spl">SPLDV (2 variabel)</button></div>
          <div class="eq-form" data-eqf="lin">
            <div class="eq-line"><input id="lA" class="tl-input sm" value="2" /> x + <input id="lB" class="tl-input sm" value="1/2" /> = <input id="lC" class="tl-input sm" value="7" /></div>
          </div>
          <div class="eq-form" data-eqf="quad" hidden>
            <div class="eq-line"><input id="qA" class="tl-input sm" value="1" /> x² + <input id="qB" class="tl-input sm" value="-5" /> x + <input id="qC" class="tl-input sm" value="6" /> = 0</div>
          </div>
          <div class="eq-form" data-eqf="spl" hidden>
            <div class="eq-line"><input id="s1" class="tl-input sm" value="2" /> x + <input id="s2" class="tl-input sm" value="3" /> y = <input id="s3" class="tl-input sm" value="12" /></div>
            <div class="eq-line"><input id="s4" class="tl-input sm" value="1" /> x − <input id="s5" class="tl-input sm" value="1" /> y = <input id="s6" class="tl-input sm" value="1" /></div>
          </div>
          <p class="tl-tip">Koefisien boleh pecahan, contoh <code>1/2</code> atau <code>-3 1/4</code>.</p>
          <div id="eqOut" class="tl-result"></div>
          <ol id="eqSteps" class="tl-steplist"></ol>
        </section>

        <!-- STATISTIK -->
        <section class="tl-pane" data-pane="stat">
          <label class="tl-label" for="stIn">Data (pisahkan dengan koma, spasi, atau baris baru)</label>
          <textarea id="stIn" class="tl-input" rows="3">70, 85, 90, 65, 85, 78, 92, 85, 60, 88</textarea>
          <div id="stOut" class="tl-grid"></div>
        </section>

        <!-- KONVERSI -->
        <section class="tl-pane" data-pane="conv">
          <div class="tl-seg" id="cvSeg"></div>
          <div class="cv-row">
            <input id="cvIn" class="tl-input big" inputmode="decimal" value="1" />
            <select id="cvFrom" class="tl-input"></select>
          </div>
          <div id="cvOut" class="cv-list"></div>
        </section>

        <!-- IPK -->
        <section class="tl-pane" data-pane="ipk">
          <div id="ipkRows"></div>
          <button class="tl-btn ghost" id="ipkAdd">+ Tambah mata kuliah</button>
          <div id="ipkOut" class="tl-result"></div>
          <p class="tl-tip">Skala 4: A=4, AB=3.5, B=3, BC=2.5, C=2, D=1, E=0. Data tersimpan di HP ini.</p>
        </section>

        <!-- POMODORO -->
        <section class="tl-pane" data-pane="pomo">
          <div class="tl-seg" id="pmSeg"><button data-m="25" class="on">Fokus 25</button><button data-m="5">Istirahat 5</button><button data-m="15">Istirahat 15</button><button data-m="50">Fokus 50</button></div>
          <div class="pomo-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" class="pr-bg"/><circle cx="60" cy="60" r="52" class="pr-fg" id="pmRing"/></svg><div class="pomo-time" id="pmTime">25:00</div></div>
          <div class="pomo-btns"><button class="tl-btn" id="pmGo">Mulai</button><button class="tl-btn ghost" id="pmReset">Ulang</button></div>
          <p class="tl-tip" id="pmInfo">Sesi selesai hari ini: 0 · Sapi akan bilang "moo" kalau waktunya habis.</p>
        </section>
      </div>
    </div>`;
  document.body.appendChild(root);

  const $ = (id) => document.getElementById(id);
  let currentTab = store.get("moooo-tool-tab") || "frac";

  function openTools(tab) {
    G().pause?.();
    document.body.classList.add("tools-open");
    root.classList.add("show");
    sfx("uiClick");
    showTab(tab || currentTab);
  }
  function closeTools() {
    root.classList.remove("show");
    document.body.classList.remove("tools-open");
    sfx("uiClick");
    G().resume?.();
  }
  function showTab(id) {
    if (!TABS.some((t) => t.id === id)) id = "frac";
    currentTab = id;
    store.set("moooo-tool-tab", id);
    root.querySelectorAll(".tl-tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === id));
    root.querySelectorAll(".tl-pane").forEach((p) => (p.hidden = p.dataset.pane !== id));
    root.querySelector(`.tl-tab[data-tab="${id}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    $("tlBody").scrollTop = 0;
  }
  $("tlClose").addEventListener("click", closeTools);
  $("tlTabs").addEventListener("click", (e) => { const b = e.target.closest(".tl-tab"); if (b) { sfx("hover"); showTab(b.dataset.tab); } });
  root.addEventListener("keydown", (e) => { if (e.key === "Escape") closeTools(); });
  document.querySelectorAll("[data-open-tools]").forEach((b) => b.addEventListener("click", () => openTools()));

  /* ---------- PECAHAN ---------- */
  const fxIn = $("fxIn");
  let hist = [];
  try { hist = JSON.parse(store.get("moooo-frac-hist") || "[]"); } catch { hist = []; }
  function renderFrac() {
    const src = fxIn.value.trim();
    const out = $("fxOut"), stepsEl = $("fxSteps");
    if (!src) { out.innerHTML = `<div class="tl-empty">Hasil muncul di sini 🐮</div>`; stepsEl.innerHTML = ""; return null; }
    try {
      const { q, steps } = evaluate(src);
      const dec = q.decimal(10);
      const approx = !q.terminates();
      out.innerHTML = `
        <div class="res-main">= ${mixedHTML(q)}</div>
        <div class="res-row">
          <span><small>Pecahan biasa</small><b class="fr-wrap">${fracHTML(q)}</b></span>
          ${q.d !== 1n && babs(q.n) > q.d ? `<span><small>Campuran</small><b class="fr-wrap">${mixedHTML(q)}</b></span>` : ""}
          <span><small>Desimal</small><b>${approx ? "≈ " : ""}${dec}</b></span>
          <span><small>Persen</small><b>${approx ? "≈ " : ""}${q.mul(new Q(100n)).decimal(4)}%</b></span>
        </div>`;
      stepsEl.innerHTML = steps.length
        ? steps.map((s) => `<li><b>${esc(s.title)}</b><pre>${esc(s.text)}</pre></li>`).join("") + `<li><b>Hasil akhir</b><pre>${esc(q.mixed())}${q.d !== 1n && babs(q.n) > q.d ? `  (= ${q})` : ""}</pre></li>`
        : `<li><pre>${esc(q.mixed())}</pre></li>`;
      return q;
    } catch (err) {
      out.innerHTML = `<div class="tl-err">⚠️ ${esc(err.message)}</div>`;
      stepsEl.innerHTML = "";
      return null;
    }
  }
  function renderHist() {
    $("fxHist").innerHTML = hist.length
      ? hist.map((h, i) => `<button class="hist-item" data-i="${i}"><span>${esc(h.src)}</span><b>= ${esc(h.res)}</b></button>`).join("")
      : `<span class="tl-empty sm">Belum ada.</span>`;
  }
  $("fxHist").addEventListener("click", (e) => { const b = e.target.closest(".hist-item"); if (b) { fxIn.value = hist[+b.dataset.i].src; renderFrac(); } });
  function commitFrac() {
    const q = renderFrac();
    if (!q) { sfx("denied"); return; }
    sfx("coin");
    const src = fxIn.value.trim();
    hist = [{ src, res: q.mixed() }, ...hist.filter((h) => h.src !== src)].slice(0, 12);
    store.set("moooo-frac-hist", JSON.stringify(hist));
    renderHist();
  }
  function insert(text) {
    const s = fxIn.selectionStart ?? fxIn.value.length, e = fxIn.selectionEnd ?? s;
    fxIn.value = fxIn.value.slice(0, s) + text + fxIn.value.slice(e);
    const p = s + text.length;
    try { fxIn.setSelectionRange(p, p); } catch { /* abaikan */ }
  }
  $("fxPad").addEventListener("pointerdown", (e) => e.target.closest(".key") && e.preventDefault()); // jangan munculkan keyboard HP
  $("fxPad").addEventListener("click", (e) => {
    const b = e.target.closest(".key"); if (!b) return;
    const k = b.dataset.k;
    sfx("pop", 0);
    if (k === "C") fxIn.value = "";
    else if (k === "⌫") {
      const s = fxIn.selectionStart ?? fxIn.value.length, en = fxIn.selectionEnd ?? s;
      if (s !== en) insert(""); else if (s > 0) { fxIn.value = fxIn.value.slice(0, s - 1) + fxIn.value.slice(s); try { fxIn.setSelectionRange(s - 1, s - 1); } catch { /* */ } }
    }
    else if (k === "=") { commitFrac(); return; }
    else if (k === "␣") insert(" ");
    else if (k === "a/b") insert("/");
    else if (k === "−") insert(" - ");
    else if (k === "+") insert(" + ");
    else if (k === "×") insert(" × ");
    else if (k === "÷") insert(" ÷ ");
    else insert(k);
    renderFrac();
  });
  fxIn.addEventListener("input", renderFrac);
  fxIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); commitFrac(); } });

  /* ---------- FPB & KPK ---------- */
  function factorize(n) {
    const f = new Map();
    for (let p = 2; p * p <= n; p++) while (n % p === 0) { f.set(p, (f.get(p) || 0) + 1); n /= p; }
    if (n > 1) f.set(n, (f.get(n) || 0) + 1);
    return f;
  }
  const sup = (k) => (k === 1 ? "" : String(k).replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]));
  const fstr = (f) => (f.size ? [...f].map(([p, k]) => `${p}${sup(k)}`).join(" × ") : "1");
  function renderFpb() {
    const nums = $("fpbIn").value.split(/[,;\s]+/).filter(Boolean).map(Number);
    const out = $("fpbOut");
    if (nums.length < 2) { out.innerHTML = `<div class="tl-empty">Masukkan minimal 2 bilangan</div>`; return; }
    if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > 1e9)) { out.innerHTML = `<div class="tl-err">⚠️ Gunakan bilangan bulat positif (1 – 1.000.000.000)</div>`; return; }
    const fs = nums.map(factorize);
    const primes = [...new Set(fs.flatMap((f) => [...f.keys()]))].sort((a, b) => a - b);
    const gcdF = new Map(), lcmF = new Map();
    primes.forEach((p) => {
      const ks = fs.map((f) => f.get(p) || 0);
      const mn = Math.min(...ks), mx = Math.max(...ks);
      if (mn) gcdF.set(p, mn);
      lcmF.set(p, mx);
    });
    const prod = (f) => [...f].reduce((a, [p, k]) => a * BigInt(p) ** BigInt(k), 1n);
    out.innerHTML = `
      <div class="tl-card"><b>Faktorisasi prima</b>${nums.map((n, i) => `<div class="mono">${n} = ${fstr(fs[i])}</div>`).join("")}</div>
      <div class="res-two">
        <div class="tl-card hl"><small>FPB (faktor persekutuan terbesar)</small><div class="res-big">${prod(gcdF)}</div><div class="mono sm">ambil prima yang sama, pangkat terkecil: ${fstr(gcdF)}</div></div>
        <div class="tl-card hl"><small>KPK (kelipatan persekutuan terkecil)</small><div class="res-big">${prod(lcmF)}</div><div class="mono sm">ambil semua prima, pangkat terbesar: ${fstr(lcmF)}</div></div>
      </div>`;
  }
  $("fpbIn").addEventListener("input", renderFpb);

  /* ---------- PERSEN ---------- */
  const num = (id) => { const v = parseFloat(String($(id).value).replace(",", ".")); return Number.isFinite(v) ? v : NaN; };
  const fmt = (v, d = 4) => (Number.isFinite(v) ? Number(v.toFixed(d)).toLocaleString("id-ID", { maximumFractionDigits: d }) : "—");
  function renderPct() {
    const a1 = num("p1a"), b1 = num("p1b");
    $("p1o").innerHTML = `= <b>${fmt(a1 / 100 * b1)}</b> <span class="mono sm">(${fmt(a1)}/100 × ${fmt(b1)})</span>`;
    const a2 = num("p2a"), b2 = num("p2b");
    $("p2o").innerHTML = b2 ? `= <b>${fmt(a2 / b2 * 100)}%</b> <span class="mono sm">(${fmt(a2)} ÷ ${fmt(b2)} × 100%)</span>` : "—";
    const a3 = num("p3a"), b3 = num("p3b");
    const ch = (b3 - a3) / a3 * 100;
    $("p3o").innerHTML = a3 ? `${ch >= 0 ? "Naik" : "Turun"} <b>${fmt(Math.abs(ch))}%</b> <span class="mono sm">((${fmt(b3)} − ${fmt(a3)}) ÷ ${fmt(a3)} × 100%)</span>` : "—";
    const a4 = num("p4a"), b4 = num("p4b");
    $("p4o").innerHTML = `Hemat <b>${fmt(a4 * b4 / 100, 2)}</b>, bayar <b>${fmt(a4 * (1 - b4 / 100), 2)}</b>`;
  }
  ["p1a", "p1b", "p2a", "p2b", "p3a", "p3b", "p4a", "p4b"].forEach((id) => $(id).addEventListener("input", renderPct));

  /* ---------- PERSAMAAN ---------- */
  let eqMode = "lin";
  const qv = (id) => evaluate($(id).value || "0").q;
  function renderEq() {
    const out = $("eqOut"), st = $("eqSteps");
    const step = (t) => `<li><pre>${esc(t)}</pre></li>`;
    try {
      if (eqMode === "lin") {
        const a = qv("lA"), b = qv("lB"), c = qv("lC");
        if (a.n === 0n) throw new Error("a tidak boleh 0 (itu bukan persamaan linear)");
        const rhs = c.sub(b), x = rhs.div(a);
        out.innerHTML = `<div class="res-main">x = ${mixedHTML(x)}</div>${x.isInt() ? "" : `<div class="mono sm center">≈ ${x.decimal(8)}</div>`}`;
        st.innerHTML = step(`${a}x + ${wrapQ(b)} = ${c}`) + step(`${a}x = ${c} − ${wrapQ(b)}  →  ${a}x = ${rhs}`) + step(`x = ${rhs} ÷ ${wrapQ(a)} = ${x}${x.d !== 1n && babs(x.n) > x.d ? ` = ${x.mixed()}` : ""}`);
      } else if (eqMode === "quad") {
        const a = qv("qA"), b = qv("qB"), c = qv("qC");
        if (a.n === 0n) throw new Error("a tidak boleh 0 (itu persamaan linear)");
        const D = b.mul(b).sub(new Q(4n).mul(a).mul(c));
        const two_a = new Q(2n).mul(a);
        const nb = new Q(-b.n, b.d);
        let html, last;
        if (D.n < 0n) {
          const re = nb.div(two_a), imAbs = Math.sqrt(-D.toNumber()) / Math.abs(two_a.toNumber());
          html = `<div class="res-main sm">Tidak ada akar real (D &lt; 0)</div><div class="mono center">x = ${re.decimal(6)} ± ${fmt(imAbs, 6)} i</div>`;
          last = "D < 0 → akar imajiner (kompleks)";
        } else {
          const r = ratSqrt(D);
          if (r) {
            const x1 = nb.add(r).div(two_a), x2 = nb.sub(r).div(two_a);
            html = D.n === 0n ? `<div class="res-main">x = ${mixedHTML(x1)}</div><div class="mono sm center">akar kembar</div>` : `<div class="res-main">x₁ = ${mixedHTML(x1)} &nbsp; x₂ = ${mixedHTML(x2)}</div>${x1.isInt() && x2.isInt() ? "" : `<div class="mono sm center">≈ ${x1.decimal(6)} dan ${x2.decimal(6)}</div>`}`;
            last = `√D = ${r}\nx₁ = (${nb} + ${r}) / ${two_a} = ${x1}\nx₂ = (${nb} − ${r}) / ${two_a} = ${x2}`;
          } else {
            const sd = Math.sqrt(D.toNumber());
            const x1 = (nb.toNumber() + sd) / two_a.toNumber(), x2 = (nb.toNumber() - sd) / two_a.toNumber();
            html = `<div class="res-main sm">x = (${nb} ± √${D}) / ${two_a}</div><div class="mono center">x₁ ≈ ${fmt(x1, 6)} &nbsp; x₂ ≈ ${fmt(x2, 6)}</div>`;
            last = `√${D} ≈ ${fmt(sd, 6)} (bukan bilangan bulat/pecahan tepat)\nx₁ ≈ ${fmt(x1, 6)}, x₂ ≈ ${fmt(x2, 6)}`;
          }
        }
        out.innerHTML = html;
        st.innerHTML = step(`Rumus ABC: x = (−b ± √D) / 2a,  D = b² − 4ac`) + step(`D = (${b})² − 4·(${a})·(${c}) = ${D}`) + step(last);
      } else {
        const a1 = qv("s1"), b1 = qv("s2"), c1 = qv("s3");
        const a2 = qv("s4"), b2 = new Q(-qv("s5").n, qv("s5").d), c2 = qv("s6");
        const det = a1.mul(b2).sub(a2.mul(b1));
        if (det.n === 0n) throw new Error("Determinan 0 → tidak ada solusi tunggal (sejajar atau berimpit)");
        const x = c1.mul(b2).sub(c2.mul(b1)).div(det), y = a1.mul(c2).sub(a2.mul(c1)).div(det);
        out.innerHTML = `<div class="res-main">x = ${mixedHTML(x)} &nbsp; y = ${mixedHTML(y)}</div>`;
        st.innerHTML = step(`Metode determinan (Cramer)\nD = a₁b₂ − a₂b₁ = (${a1})(${b2}) − (${a2})(${b1}) = ${det}`) +
          step(`Dx = c₁b₂ − c₂b₁ = ${c1.mul(b2).sub(c2.mul(b1))}  →  x = Dx/D = ${x}`) +
          step(`Dy = a₁c₂ − a₂c₁ = ${a1.mul(c2).sub(a2.mul(c1))}  →  y = Dy/D = ${y}`) +
          step(`Cek: ${a1}·(${x}) + ${b1}·(${y}) = ${a1.mul(x).add(b1.mul(y))} ✓`);
      }
    } catch (err) {
      out.innerHTML = `<div class="tl-err">⚠️ ${esc(err.message)}</div>`;
      st.innerHTML = "";
    }
  }
  $("eqSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    eqMode = b.dataset.eq;
    $("eqSeg").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    root.querySelectorAll(".eq-form").forEach((f) => (f.hidden = f.dataset.eqf !== eqMode));
    renderEq();
  });
  root.querySelectorAll('[data-pane="eq"] input').forEach((i) => i.addEventListener("input", renderEq));

  /* ---------- STATISTIK ---------- */
  function renderStat() {
    const xs = $("stIn").value.split(/[\s,;]+/).filter(Boolean).map((v) => parseFloat(v.replace(",", ".")));
    const out = $("stOut");
    if (!xs.length || xs.some((v) => !Number.isFinite(v))) { out.innerHTML = `<div class="tl-err">⚠️ Pastikan semua data berupa angka</div>`; return; }
    const n = xs.length, s = [...xs].sort((a, b) => a - b);
    const sum = xs.reduce((a, b) => a + b, 0), mean = sum / n;
    const med = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
    const cnt = new Map(); xs.forEach((v) => cnt.set(v, (cnt.get(v) || 0) + 1));
    const maxC = Math.max(...cnt.values());
    const modes = maxC > 1 ? [...cnt].filter(([, c]) => c === maxC).map(([v]) => v) : [];
    const ss = xs.reduce((a, v) => a + (v - mean) ** 2, 0);
    const q = (p) => { const i = (n - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
    const cells = [
      ["Banyak data (n)", n], ["Jumlah (Σx)", fmt(sum)], ["Rata-rata (x̄)", fmt(mean)], ["Median", fmt(med)],
      ["Modus", modes.length ? modes.map((m) => fmt(m)).join(", ") : "tidak ada"], ["Minimum", fmt(s[0])], ["Maksimum", fmt(s[n - 1])], ["Jangkauan", fmt(s[n - 1] - s[0])],
      ["Q1", fmt(q(0.25))], ["Q3", fmt(q(0.75))], ["Simpangan baku (sampel, s)", n > 1 ? fmt(Math.sqrt(ss / (n - 1))) : "—"], ["Simpangan baku (populasi, σ)", fmt(Math.sqrt(ss / n))],
      ["Varians (sampel)", n > 1 ? fmt(ss / (n - 1)) : "—"], ["Data terurut", s.map((v) => fmt(v)).join(", ")],
    ];
    out.innerHTML = cells.map(([k, v], i) => `<div class="st-cell${i === cells.length - 1 ? " wide" : ""}"><small>${k}</small><b>${v}</b></div>`).join("");
  }
  $("stIn").addEventListener("input", renderStat);

  /* ---------- KONVERSI ---------- */
  const UNITS = {
    Panjang: { km: 1000, hm: 100, dam: 10, m: 1, dm: 0.1, cm: 0.01, mm: 0.001, mil: 1609.344, inci: 0.0254, kaki: 0.3048, yard: 0.9144 },
    Massa: { ton: 1e6, kuintal: 1e5, kg: 1000, hg: 100, ons: 100, dag: 10, g: 1, dg: 0.1, cg: 0.01, mg: 0.001, pon: 453.59237 },
    Luas: { "km²": 1e6, ha: 1e4, are: 100, "m²": 1, "dm²": 0.01, "cm²": 1e-4, "mm²": 1e-6 },
    Volume: { "m³": 1000, kL: 1000, "dm³": 1, L: 1, dL: 0.1, cL: 0.01, "cm³": 0.001, mL: 0.001, cc: 0.001 },
    Waktu: { abad: 3155760000, dekade: 315576000, tahun: 31557600, bulan: 2629800, minggu: 604800, hari: 86400, jam: 3600, menit: 60, detik: 1 },
    Suhu: { "°C": "c", "°F": "f", K: "k", "°R": "r" },
    Kecepatan: { "km/jam": 1 / 3.6, "m/s": 1, "m/menit": 1 / 60, knot: 0.514444 },
    Data: { TB: 1024 ** 4, GB: 1024 ** 3, MB: 1024 ** 2, KB: 1024, byte: 1, bit: 1 / 8 },
  };
  let cvCat = store.get("moooo-cv-cat") || "Panjang";
  if (!UNITS[cvCat]) cvCat = "Panjang";
  $("cvSeg").innerHTML = Object.keys(UNITS).map((k) => `<button data-c="${k}">${k}</button>`).join("");
  function setCat(c) {
    cvCat = c; store.set("moooo-cv-cat", c);
    $("cvSeg").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.c === c));
    $("cvFrom").innerHTML = Object.keys(UNITS[c]).map((u) => `<option>${u}</option>`).join("");
    $("cvFrom").value = { Panjang: "m", Massa: "kg", Luas: "m²", Volume: "L", Waktu: "jam", Suhu: "°C", Kecepatan: "km/jam", Data: "GB" }[c];
    renderConv();
  }
  const toC = { c: (v) => v, f: (v) => (v - 32) * 5 / 9, k: (v) => v - 273.15, r: (v) => v * 5 / 4 };
  const fromC = { c: (v) => v, f: (v) => v * 9 / 5 + 32, k: (v) => v + 273.15, r: (v) => v * 4 / 5 };
  function renderConv() {
    const v = num("cvIn"), from = $("cvFrom").value, U = UNITS[cvCat];
    $("cvOut").innerHTML = Object.keys(U).filter((u) => u !== from).map((u) => {
      const r = cvCat === "Suhu" ? fromC[U[u]](toC[U[from]](v)) : v * U[from] / U[u];
      const shown = Number.isFinite(r) ? (Math.abs(r) >= 1e12 || (Math.abs(r) < 1e-6 && r !== 0) ? r.toExponential(4) : fmt(r, 6)) : "—";
      return `<div class="cv-item"><b>${shown}</b><span>${u}</span></div>`;
    }).join("");
  }
  $("cvSeg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setCat(b.dataset.c); });
  $("cvIn").addEventListener("input", renderConv);
  $("cvFrom").addEventListener("change", renderConv);

  /* ---------- IPK ---------- */
  const GRADES = { A: 4, AB: 3.5, B: 3, BC: 2.5, C: 2, D: 1, E: 0 };
  let ipk;
  try { ipk = JSON.parse(store.get("moooo-ipk") || "null"); } catch { ipk = null; }
  if (!Array.isArray(ipk) || !ipk.length) ipk = [{ mk: "Kalkulus 1", sks: 3, g: "A" }, { mk: "Fisika Dasar", sks: 3, g: "B" }, { mk: "Bahasa Indonesia", sks: 2, g: "AB" }];
  function renderIpkRows() {
    $("ipkRows").innerHTML = ipk.map((r, i) => `
      <div class="ipk-row" data-i="${i}">
        <input class="tl-input" data-f="mk" value="${esc(r.mk)}" placeholder="Mata kuliah" aria-label="Mata kuliah" />
        <input class="tl-input sm" data-f="sks" inputmode="numeric" value="${r.sks}" aria-label="SKS" />
        <select class="tl-input sm" data-f="g" aria-label="Nilai">${Object.keys(GRADES).map((g) => `<option${g === r.g ? " selected" : ""}>${g}</option>`).join("")}</select>
        <button class="ipk-del" aria-label="Hapus">✕</button>
      </div>`).join("");
    renderIpk();
  }
  function renderIpk() {
    let sks = 0, pts = 0;
    ipk.forEach((r) => { const s = Math.max(0, parseFloat(r.sks) || 0); sks += s; pts += s * GRADES[r.g]; });
    const v = sks ? pts / sks : 0;
    const pred = !sks ? "" : v >= 3.51 ? "Dengan Pujian (Cumlaude) 🏆" : v >= 3.01 ? "Sangat Memuaskan ⭐" : v >= 2.76 ? "Memuaskan 👍" : v >= 2 ? "Cukup" : "Perlu ditingkatkan 💪";
    $("ipkOut").innerHTML = `<div class="res-two"><div class="tl-card hl"><small>IPK / IPS</small><div class="res-big">${sks ? v.toFixed(2) : "—"}</div><div class="sm">${pred}</div></div><div class="tl-card hl"><small>Total SKS · Mutu</small><div class="res-big">${sks}</div><div class="sm mono">Σ(SKS × nilai) = ${fmt(pts, 2)}</div></div></div>`;
    store.set("moooo-ipk", JSON.stringify(ipk));
  }
  $("ipkRows").addEventListener("input", (e) => {
    const row = e.target.closest(".ipk-row"); if (!row) return;
    ipk[+row.dataset.i][e.target.dataset.f] = e.target.value;
    renderIpk();
  });
  $("ipkRows").addEventListener("change", (e) => { const row = e.target.closest(".ipk-row"); if (row) { ipk[+row.dataset.i][e.target.dataset.f] = e.target.value; renderIpk(); } });
  $("ipkRows").addEventListener("click", (e) => {
    const b = e.target.closest(".ipk-del"); if (!b) return;
    ipk.splice(+b.closest(".ipk-row").dataset.i, 1);
    if (!ipk.length) ipk.push({ mk: "", sks: 2, g: "A" });
    renderIpkRows();
  });
  $("ipkAdd").addEventListener("click", () => { ipk.push({ mk: "", sks: 2, g: "A" }); renderIpkRows(); sfx("uiClick"); });

  /* ---------- POMODORO ---------- */
  let pmLen = 25 * 60, pmLeft = pmLen, pmEnd = 0, pmTimer = 0;
  const today = new Date().toDateString();
  let pmDone = 0;
  try { const d = JSON.parse(store.get("moooo-pomo") || "{}"); pmDone = d.day === today ? d.n : 0; } catch { pmDone = 0; }
  const RING = 2 * Math.PI * 52;
  $("pmRing").style.strokeDasharray = RING;
  function renderPomo() {
    const left = pmEnd ? Math.max(0, Math.round((pmEnd - Date.now()) / 1000)) : pmLeft;
    $("pmTime").textContent = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
    $("pmRing").style.strokeDashoffset = RING * (1 - left / pmLen);
    $("pmGo").textContent = pmEnd ? "Jeda" : left < pmLen ? "Lanjut" : "Mulai";
    $("pmInfo").textContent = `Sesi selesai hari ini: ${pmDone} · Sapi akan bilang "moo" kalau waktunya habis.`;
    if (pmEnd && left === 0) {
      clearInterval(pmTimer); pmEnd = 0; pmLeft = pmLen;
      pmDone++; store.set("moooo-pomo", JSON.stringify({ day: today, n: pmDone }));
      sfx("milestone", 100); sfx("mooChoir");
      renderPomo();
    }
  }
  $("pmGo").addEventListener("click", () => {
    if (pmEnd) { pmLeft = Math.max(0, Math.round((pmEnd - Date.now()) / 1000)); pmEnd = 0; clearInterval(pmTimer); }
    else { pmEnd = Date.now() + pmLeft * 1000; pmTimer = setInterval(renderPomo, 250); sfx("powerReady"); }
    renderPomo();
  });
  $("pmReset").addEventListener("click", () => { clearInterval(pmTimer); pmEnd = 0; pmLeft = pmLen; renderPomo(); });
  $("pmSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    $("pmSeg").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    clearInterval(pmTimer); pmEnd = 0; pmLen = pmLeft = +b.dataset.m * 60; renderPomo();
  });

  // isi awal (contoh langsung terlihat)
  fxIn.value = "3 1/4 + 1/2";
  renderFrac(); renderHist(); renderFpb(); renderPct(); renderEq(); renderStat(); setCat(cvCat); renderIpkRows(); renderPomo();

  /* =========================================================
     SOAL SAPI — kuis kecil di tengah game, jawab benar = +30
     ========================================================= */
  const QUIZ_EVERY = 150, QUIZ_POINTS = 30, QUIZ_TIME = 10000;
  let nextQuizAt = QUIZ_EVERY, quizTimer = 0, quizRAF = 0;
  const quiz = document.createElement("div");
  quiz.className = "quiz";
  quiz.innerHTML = `<div class="qz-head"><span>🧠 SOAL SAPI</span><b>+${QUIZ_POINTS}</b></div><div class="qz-q" id="qzQ"></div><div class="qz-opts" id="qzOpts"></div><div class="qz-bar"><div id="qzBar"></div></div><div class="qz-note" id="qzNote"></div>`;
  document.body.appendChild(quiz);

  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  function makeQuestion() {
    const kind = ri(0, 6);
    let text, ans, explain;
    if (kind === 0 || kind === 1) {
      const b = ri(2, 8), d = ri(2, 8), a = ri(1, b - 1 || 1), c = ri(1, d - 1 || 1);
      const op = kind === 0 ? "+" : "−";
      let x = new Q(BigInt(a), BigInt(b)), y = new Q(BigInt(c), BigInt(d));
      if (op === "−" && x.sub(y).n <= 0n) { [x, y] = [y, x]; if (x.eq(y)) x = x.add(new Q(1n)); } // hasil selalu positif
      ans = op === "+" ? x.add(y) : x.sub(y);
      text = `${x} ${op} ${y} = ?`;
      explain = `Samakan penyebut (KPK ${blcm(x.d, y.d)}) → ${ans.mixed()}`;
    } else if (kind === 2) {
      const x = new Q(BigInt(ri(1, 5)), BigInt(ri(2, 6))), y = new Q(BigInt(ri(1, 5)), BigInt(ri(2, 6)));
      ans = x.mul(y); text = `${x} × ${y} = ?`; explain = `Kali atas × atas, bawah × bawah → ${ans}`;
    } else if (kind === 3) {
      const x = new Q(BigInt(ri(1, 4)), BigInt(ri(2, 5))), y = new Q(BigInt(ri(1, 4)), BigInt(ri(2, 5)));
      ans = x.div(y); text = `${x} ÷ ${y} = ?`; explain = `Bagi = kali kebalikan: ${x} × ${new Q(y.d, y.n)} = ${ans.mixed()}`;
    } else if (kind === 4) {
      const b = ri(2, 9), w = ri(1, 5), a = ri(1, b - 1);
      ans = new Q(BigInt(w * b + a), BigInt(b));
      text = `${w} ${a}/${b} jadi pecahan biasa = ?`; explain = `(${w}×${b} + ${a})/${b} = ${ans}`;
      return { text, ans, explain, opts: distract(ans, (q) => q.toString(), [new Q(BigInt(w + a), BigInt(b)), new Q(BigInt(w * a + b), BigInt(b)), new Q(BigInt(w * b - a), BigInt(b))]) };
    } else if (kind === 5) {
      const p = pickArr([10, 20, 25, 50, 75, 5, 40]), base = pickArr([40, 60, 80, 120, 200, 360, 500]);
      ans = new Q(BigInt(p * base), 100n); text = `${p}% dari ${base} = ?`; explain = `${p}/100 × ${base} = ${ans}`;
    } else {
      const g = ri(2, 9), a = g * ri(1, 6), b = g * ri(2, 7);
      const real = Number(bgcd(BigInt(a), BigInt(b)));
      ans = new Q(BigInt(real)); text = `FPB dari ${a} dan ${b} = ?`; explain = `Faktor terbesar yang membagi keduanya: ${real}`;
    }
    return { text, ans, explain, opts: distract(ans, (q) => q.mixed()) };
  }
  function pickArr(a) { return a[Math.floor(Math.random() * a.length)]; }
  function distract(ans, show, extra = []) {
    const set = new Map([[show(ans), true]]);
    const cands = [...extra,
      ans.add(new Q(1n, ans.d === 1n ? 1n : ans.d)), ans.sub(new Q(1n, ans.d === 1n ? 1n : ans.d)),
      new Q(ans.n + 1n, ans.d + 1n), new Q(ans.d, ans.n || 1n), ans.mul(new Q(2n)), ans.add(new Q(1n, 2n))];
    for (const c of cands) { if (set.size >= 3) break; const s = show(c); if (!set.has(s) && c.n > 0n) set.set(s, false); }
    while (set.size < 3) set.set(String(ri(2, 30)), false);
    return [...set].map(([label, ok]) => ({ label, ok })).sort(() => Math.random() - 0.5);
  }
  function showQuiz() {
    if (!G().isRunning?.()) return;
    const q = makeQuestion();
    $("qzQ").textContent = q.text;
    $("qzNote").textContent = "";
    $("qzOpts").innerHTML = q.opts.map((o, i) => `<button class="qz-opt" data-i="${i}">${esc(o.label)}</button>`).join("");
    quiz.classList.remove("done");
    quiz.classList.add("show");
    sfx("goldSpawn");
    const t0 = performance.now();
    let paused = 0, pauseStart = 0;
    cancelAnimationFrame(quizRAF);
    const tick = () => {
      if (document.body.classList.contains("tools-open")) { if (!pauseStart) pauseStart = performance.now(); }
      else if (pauseStart) { paused += performance.now() - pauseStart; pauseStart = 0; }
      const left = 1 - (performance.now() - t0 - paused - (pauseStart ? performance.now() - pauseStart : 0)) / QUIZ_TIME;
      $("qzBar").style.width = Math.max(0, left * 100) + "%";
      if (left <= 0) { finish(null); return; }
      if (!G().isRunning?.() && !pauseStart) { hideQuiz(0); return; }
      quizRAF = requestAnimationFrame(tick);
    };
    quizRAF = requestAnimationFrame(tick);
    const finish = (opt) => {
      cancelAnimationFrame(quizRAF);
      quiz.classList.add("done");
      $("qzOpts").querySelectorAll(".qz-opt").forEach((b, i) => { b.disabled = true; if (q.opts[i].ok) b.classList.add("right"); });
      if (opt && opt.ok) { $("qzNote").textContent = "✅ Benar! " + q.explain; sfx("levelUp", 2); G().bonus?.(QUIZ_POINTS, "PINTAR! 🧠"); }
      else { $("qzNote").textContent = (opt ? "❌ Kurang tepat. " : "⏰ Waktu habis. ") + q.explain; sfx("comboBreak"); }
      hideQuiz(2600);
    };
    $("qzOpts").onclick = (e) => {
      const b = e.target.closest(".qz-opt"); if (!b || b.disabled) return;
      const opt = q.opts[+b.dataset.i];
      if (!opt.ok) b.classList.add("wrong");
      finish(opt);
    };
  }
  function hideQuiz(ms) { clearTimeout(quizTimer); quizTimer = setTimeout(() => quiz.classList.remove("show"), ms); }

  window.addEventListener("moooo:score", (e) => {
    const { score, before } = e.detail;
    if (before === 0 || score < before) nextQuizAt = QUIZ_EVERY; // permainan baru
    if (score >= nextQuizAt && score < 1000) {
      nextQuizAt = (Math.floor(score / QUIZ_EVERY) + 1) * QUIZ_EVERY;
      if (!quiz.classList.contains("show")) setTimeout(showQuiz, 300);
    }
    if (score >= 1000) hideQuiz(0);
  });

  // untuk pengujian / dipakai bagian lain
  window.MOOOOTools = { evaluate: (s) => { const r = evaluate(s); return { value: r.q.toString(), mixed: r.q.mixed(), decimal: r.q.decimal(10), steps: r.steps }; }, open: openTools, close: closeTools };
})();
