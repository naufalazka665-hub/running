# Lintasan: run coach berbasis sport science

Website statis (HTML/CSS/JS murni, tanpa build dan tanpa server) untuk **merencanakan latihan lari** dan berfungsi sebagai **coach harian**. Semua saran diturunkan dari literatur sport science dan bisa ditelusuri ke referensinya.

## Fitur

| Bagian | Isi | Dasar ilmiah |
|---|---|---|
| **Hari ini** | Sesi hari ini, cek kesiapan pagi (tidur, nyeri otot, stres, mood, HR istirahat, nyeri, sakit) → sesi otomatis disesuaikan; analisis beban & insight coach | Kuesioner wellness (Hooper 1995, McLean 2010), Meeusen 2013 |
| **Rencana** | Generator periodisasi Base → Build → Peak → Taper untuk 5K/10K/HM/marathon, 3–6 hari/minggu | Issurin 2010, Mujika 2018, Seiler 2010, Bosquet 2007, Daniels 2014 |
| **Log** | Catat sesi dengan session-RPE; grafik km & beban 8 minggu | Foster 2001 |
| **Profil & zona** | VDOT, pace E/M/T/I/R, zona HR Karvonen, prediksi lomba (VDOT & Riegel) | Daniels & Gilbert 1979, Tanaka 2001, Karvonen 1957, Riegel 1981 |
| **Pustaka sains** | 15 topik (fisiologi, 80/20, taper, cedera, kekuatan, nutrisi, panas tropis, pacing, dll.) dengan tingkat bukti & referensi jurnal, plus pencarian "Tanya coach" | lihat `js/knowledge.js` |

### Aturan coach yang diterapkan
- Volume naik maks ~10%/minggu, minggu ringan (−20%) tiap minggu ke-4.
- Sesi keras dibatasi: T ≤10%, I ≤8%, R ≤5% volume mingguan (Daniels).
- ±80% volume di intensitas rendah; easy run tidak pernah lebih panjang dari long run.
- Taper 1–3 minggu (sesuai jarak), volume turun 40–60%, intensitas dipertahankan.
- Tidak ada sesi kualitas 3 hari sebelum lomba.
- Peringatan: lonjakan volume >30% (Nielsen 2014), monotony >2 (Foster 1998), ACWR >1,5 (dengan catatan kritik Impellizzeri 2020), terlalu banyak intensitas sedang, tanpa hari istirahat, dua sesi keras berturut-turut.
- Tanda bahaya: nyeri tajam/terlokalisasi atau gejala sakit di bawah leher → istirahat.

## Menjalankan

Buka `index.html` langsung di browser, atau:

```bash
npm start            # http://localhost:8080
npm test             # 18 unit test (rumus VDOT vs tabel Daniels, generator rencana, coach, pustaka)
```

Bisa di-deploy apa adanya ke GitHub Pages (Settings → Pages → branch, folder root).

Data disimpan di `localStorage` browser; gunakan Ekspor/Impor JSON di tab Profil untuk cadangan. Saat pertama dibuka, aplikasi memuat **data contoh** yang bisa dihapus dengan satu klik.

## Struktur

```
index.html          kerangka halaman
css/style.css       tema (light/dark)
js/science.js       rumus murni: VDOT, pace, HR, sRPE, monotony, ACWR
js/plan.js          generator rencana berperiodisasi
js/coach.js         readiness, penyesuaian sesi, analisis log
js/knowledge.js     pustaka materi + pencarian
js/app.js           UI & penyimpanan
tests/              node:test
```

## Batasan

Lintasan adalah alat edukasi, bukan pengganti dokter, fisioterapis, atau pelatih bersertifikat. Rumus HRmax berbasis usia meleset ±10 bpm; ACWR bukan prediktor cedera yang valid; "Tanya coach" adalah pencarian kata kunci, bukan AI generatif.
