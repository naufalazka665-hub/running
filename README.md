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

### Rencana adaptif (update otomatis tiap minggu)
Semua data tersimpan otomatis (indikator "Tersimpan otomatis" di kanan atas). Saat Anda membuka aplikasi di minggu baru, coach me-review minggu sebelumnya lalu menyusun ulang minggu ini dan sisa rencana:

| Kondisi minggu lalu | Keputusan | Minggu ini |
|---|---|---|
| Kepatuhan ≥85%, RPE easy ≤4, readiness baik | **Lanjut** | sesuai rencana |
| Kepatuhan 60–85%, RPE easy ≥5, ≥3 hari kuning, atau sempat sakit | **Tahan** | min(rencana, maks(km terlaksana, 85% target)) |
| Kepatuhan <60%, ≥2 hari merah, atau nyeri tajam | **Turunkan** | min(rencana, maks(km terlaksana, 60% target) × 1,1) |
| Lomba/time trial tercatat dengan waktu lebih cepat | **VDOT naik** | semua pace diperbarui |

Sisa rencana dihitung ulang dari volume baru (naik maks 10%/minggu, fase & minggu ringan tetap, tanggal lomba tetap). Minggu yang sudah lewat tidak diubah. Bila Anda baru mencatat sesi minggu lalu setelah review berjalan, review diulang otomatis. Program tiap minggu bisa disalin sebagai teks (catatan/WhatsApp).

### Impor otomatis Strava & Garmin
- **Strava (otomatis):** hubungkan sekali di tab Log, lalu setiap kali aplikasi dibuka, lari baru disinkronkan sebelum review mingguan berjalan. Garmin, Coros, Suunto, dan Apple Watch ikut masuk bila jamnya tersinkron ke Strava.
  1. Buat aplikasi di <https://www.strava.com/settings/api>.
  2. Isi *Authorization Callback Domain* dengan domain tempat Lintasan di-host (mis. `username.github.io` atau `localhost`).
  3. Masukkan Client ID & Client Secret di tab Log → Hubungkan Strava.
  - Tanpa server, Client Secret disimpan di browser Anda. Ini wajar untuk pemakaian pribadi; untuk aplikasi multi-pengguna, pindahkan penukaran token ke server.
  - Hanya berjalan di halaman yang di-host (GitHub Pages/localhost), tidak dari file yang dibuka langsung.
- **Garmin:** API resmi Garmin Connect hanya untuk mitra bisnis. Jalur yang tersedia: sambungkan Garmin Connect ke Strava (otomatis), atau impor *Activities.csv*, TCX, atau GPX dari Garmin Connect.
- **Impor file:** Garmin Activities.csv, Strava activities.csv (ekspor akun), GPX, TCX. File .FIT belum didukung.
- Hanya aktivitas lari yang diimpor. Duplikat (impor ulang, lari yang sama dari dua sumber, atau sudah dicatat manual) dilewati, dan aktivitas yang Anda hapus tidak diimpor ulang.
- RPE ditaksir dari HR rata-rata (%HRR) atau pace terhadap zona VDOT, ditandai ≈, dan bisa dikoreksi langsung di tabel.

### Akun pelari (login & sinkron cloud)
Pelari bisa membuat akun (email + password) agar profil, rencana, log, dan cek kesiapan tersimpan di cloud dan muncul di semua perangkat.

- **Local-first:** data tetap tersimpan di browser (cepat, bisa offline), lalu disalin otomatis ke akun ±1 detik setelah setiap perubahan. Kalau sedang offline, sinkron diulang saat koneksi kembali.
- **Gabung data saat masuk:** perangkat baru langsung memakai data akun. Kalau perangkat ini dan akun sama-sama berisi data, log digabung, sedangkan profil & rencana diambil dari versi terbaru. Log yang dihapus tidak hidup lagi.
- **Keluar** menghapus data dari perangkat itu (aman di akun). Cocok untuk perangkat bersama.
- **Keamanan:** setiap pelari hanya bisa membaca & menulis datanya sendiri (Row Level Security di database). Password dikelola Supabase Auth, tidak pernah disimpan oleh Lintasan.
- Token Strava sengaja **tidak** ikut ke akun (tetap per perangkat), karena berisi Client Secret.

**Setup (sekali, ±10 menit, gratis):**
1. Buat proyek di <https://supabase.com> → *New project* (pilih region Singapore untuk Indonesia).
2. *SQL Editor* → tempel isi [`supabase/schema.sql`](supabase/schema.sql) → *Run*.
3. *Authentication → URL Configuration*: isi *Site URL* dengan `https://naufalazka665-hub.github.io/running/`, lalu tambahkan URL yang sama (dan `http://localhost:8080/` untuk uji lokal) di *Redirect URLs*.
4. *Authentication → Sign In / Providers → Email*: pastikan aktif. "Confirm email" disarankan tetap aktif.
5. *Project Settings → API*: salin **Project URL** dan **anon public key** ke `js/config.js`, lalu commit. Anon key memang publik; **jangan** pernah memakai `service_role` key di sini.

Catatan: layanan email bawaan Supabase dibatasi beberapa email per jam. Kalau pengguna sudah banyak, pasang SMTP sendiri (*Authentication → SMTP Settings*). Nama menu di dashboard Supabase bisa sedikit berbeda antar versi.

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
npm start            # http://localhost:8080 (perlu untuk sinkron Strava lokal)
npm test             # 40 unit test (rumus VDOT vs tabel Daniels, generator rencana, rencana adaptif, coach, importer, sinkron akun, pustaka)
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
js/importers.js     parser Strava/Garmin CSV, Strava API, GPX, TCX + taksiran RPE & dedup
js/strava.js        OAuth & sinkron Strava dari browser
js/sync.js          akun (Supabase Auth) & sinkron cloud + logika gabung data
js/config.js        URL & anon key Supabase (kosong = tanpa akun)
supabase/schema.sql tabel runner_data + Row Level Security
js/app.js           UI & penyimpanan
tests/              node:test
```

## Batasan

Lintasan adalah alat edukasi, bukan pengganti dokter, fisioterapis, atau pelatih bersertifikat. Rumus HRmax berbasis usia meleset ±10 bpm; ACWR bukan prediktor cedera yang valid; "Tanya coach" adalah pencarian kata kunci, bukan AI generatif.
