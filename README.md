# 🐄 MOOOO Clicker

Pencet si sapi sampai **skor 1000**! Game clicker berbasis web (HTML + CSS + JS murni, tanpa library).

## Cara main
Buka `index.html` di browser, lalu pencet sapinya (klik / tap / tombol **SPASI**).

- **Combo** — pencet cepat (jeda < 0,75 detik) untuk naik level: x2 (10), x3 (25), **x5 MOOO-FRENZY** (50).
- **Sapi Emas** — muncul acak & bergerak, tangkap untuk **+25**.
- **Power-up** (tombol 1 / 2 / 3):
  - 🔔 **Lonceng Emas** (skor 50) — poin x2 selama 8 detik
  - 🌧️ **Badai Susu** (skor 150) — auto-pencet 6 detik + hujan susu
  - 💥 **MEGA MOO** (skor 300) — ledakan +40 poin
- **Milestone** 100 / 250 / 500 / 750 — banner, confetti, hujan emoji.
- **1000** — kembang api, fanfare, statistik & rekor waktu tercepat (disimpan di browser).

## Efek
Partikel canvas (tetes susu, bintang, hati, percikan, daun, confetti, kembang api, gelombang kejut),
sapi SVG animasi (kedip, mata mengikuti kursor, telinga mengepak, lonceng bergoyang, ekspresi senang),
screen shake, flash, latar pelangi saat frenzy, dan suara "moo" sintesis WebAudio (bisa di-mute).

## Struktur
```
index.html   – layout + sapi SVG
style.css    – tampilan & animasi
game.js      – logika game, partikel, audio
assets/      – ikon SVG (logo, lonceng, badai, mega, piala, susu, suara)
```
