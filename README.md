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

## 🧮 Alat Belajar
Tombol kalkulator hijau di pojok atas (atau di layar awal/menang). Game otomatis dijeda selama dibuka.

- **Pecahan** — `1/4`, pecahan campuran `3 1/4`, desimal, `%`, `^`, `√`, kurung. Hasil: pecahan biasa, campuran,
  desimal & persen, **lengkap dengan langkah pengerjaan** (samakan penyebut/KPK, kali kebalikan, sederhanakan/FPB). Ada riwayat.
- **FPB & KPK** — dengan faktorisasi prima.
- **Persen** — x% dari y, berapa persen, naik/turun, diskon.
- **Persamaan** — linear, kuadrat (rumus ABC), SPLDV (Cramer); koefisien boleh pecahan; ada langkahnya.
- **Statistik** — rata-rata, median, modus, kuartil, jangkauan, varians, simpangan baku.
- **Konversi** — panjang, massa, luas, volume, waktu, suhu, kecepatan, data.
- **IPK** — hitung IPK/IPS + predikat, tersimpan di HP.
- **Fokus** — timer Pomodoro 25/5/15/50 menit, sapi bilang "moo" saat selesai.

**Soal Sapi**: tiap 150 poin muncul soal kilat (pecahan, persen, FPB). Jawab benar dalam 10 detik → **+30 poin**.

## Efek
Partikel canvas (tetes susu, bintang, hati, percikan, daun, confetti, kembang api, gelombang kejut),
sapi SVG animasi (kedip, mata mengikuti kursor, telinga mengepak, lonceng bergoyang, ekspresi senang),
screen shake, flash, dan latar pelangi saat frenzy.

## Suara (semua disintesis WebAudio, tanpa file audio)
- **Musik latar** chiptune ladang — makin cepat & naik nada saat FRENZY, ada rebana saat Lonceng Emas (tombol 🎵).
- **6 variasi bunyi pencet** (pop, boing, squeak, cipratan susu, lonceng sapi, bonk) — nadanya naik seiring combo.
- **6 jenis "moo"**: panjang, pendek, anak sapi, banteng, moo-moo, dan moo bertanya; paduan suara moo saat menang.
- Level combo + terompet, combo putus ("wah-wah"), sapi emas muncul/ketangkap/kabur, lonceng emas,
  hujan + petir Badai Susu, isi-tenaga + ledakan MEGA MOO, power-up siap, tombol terkunci, hover/klik tombol,
  jingle mulai, jingle tiap milestone, confetti, kembang api (siulan + duar + kretek), deg-degan di skor 900+,
  drum roll + fanfare kemenangan. Tombol 🔊 untuk mute semua.

## Struktur
```
index.html   – layout + sapi SVG
style.css    – tampilan & animasi
game.js      – logika game, partikel, audio
tools.js     – Alat Belajar (kalkulator pecahan dll) + Soal Sapi
tools.css    – tampilan Alat Belajar
assets/      – ikon SVG (logo, lonceng, badai, mega, piala, susu, suara)
```

## 📱 APK Android
Folder `android/` berisi aplikasi Android (WebView) yang membungkus game ini — jalan **offline** (font ikut dibundel).

APK dibuild otomatis oleh GitHub Actions (`.github/workflows/android.yml`) setiap ada perubahan,
lalu diunggah ke halaman **Releases** repo sebagai `MOOOO-Clicker.apk` (juga sebagai artifact di tab Actions).

Build manual (butuh Android SDK + Gradle):
```
./android/prepare-web.sh
MOOOO_KEYSTORE=/path/ke/keystore MOOOO_KS_PASS=... gradle -p android assembleRelease
```

Tanda tangan APK: kalau secret repo `MOOOO_KEYSTORE_B64` (keystore dalam base64), `MOOOO_KS_PASS`, dan opsional
`MOOOO_KEY_ALIAS` diisi, semua build pakai kunci yang sama (bisa update tanpa uninstall). Kalau belum diisi,
CI membuat keystore sementara tiap build — APK tetap bisa diinstall, tapi untuk update harus uninstall versi lama dulu.
