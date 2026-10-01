/*
 * knowledge.js — pustaka materi kepelatihan lari berbasis sport science.
 * Tingkat bukti: "Kuat" (meta-analisis/konsensus), "Sedang" (studi terkontrol/observasional konsisten),
 * "Praktik" (praktik pelatih yang mapan, bukti langsung terbatas).
 */
(function (root) {
  'use strict';

  var TOPICS = [
    {
      id: 'fisiologi',
      title: 'Tiga penentu performa ketahanan',
      cat: 'Fisiologi',
      evidence: 'Kuat',
      summary: 'Performa lari jarak jauh ditentukan oleh VO2max, fraksi VO2max yang bisa dipertahankan (ambang laktat), dan running economy. Semua latihan pada akhirnya menarget salah satu dari ketiganya.',
      points: [
        'VO2max: kapasitas maksimal mengambil & memakai oksigen. Dilatih paling efektif dengan interval 3–5 menit di ~95–100% VO2max.',
        'Ambang laktat (LT2 / critical speed): intensitas tertinggi yang masih stabil secara metabolik. Untuk lomba 10K–marathon, ini sering lebih menentukan daripada VO2max.',
        'Running economy: oksigen yang dibutuhkan pada kecepatan tertentu. Diperbaiki oleh volume bertahun-tahun, latihan kekuatan, plyometrik, dan strides.',
        'Volume aerobik tinggi di intensitas rendah membangun kepadatan mitokondria, kapilarisasi, dan volume plasma, fondasi bagi ketiganya.'
      ],
      practice: [
        'Pelari pemula: hampir semua kemajuan datang dari konsistensi volume easy.',
        'Pelari menengah: tambahkan 1–2 sesi kualitas (threshold + interval) per minggu.'
      ],
      refs: [
        'Joyner MJ & Coyle EF (2008). Endurance exercise performance: the physiology of champions. J Physiol 586(1):35–44.',
        'Bassett DR & Howley ET (2000). Limiting factors for maximum oxygen uptake and determinants of endurance performance. Med Sci Sports Exerc 32(1):70–84.'
      ],
      keywords: ['vo2max', 'vo2', 'ambang', 'laktat', 'threshold', 'economy', 'fisiologi', 'mitokondria', 'kapiler', 'aerobik']
    },
    {
      id: 'intensitas',
      title: 'Distribusi intensitas 80/20',
      cat: 'Metodologi',
      evidence: 'Kuat',
      summary: 'Atlet ketahanan top menghabiskan ~80% sesi (≈90% waktu) di bawah ambang aerobik (LT1) dan ~20% sesi di intensitas tinggi. Pelari rekreasi justru sering terjebak di "zona abu-abu" (sedang) setiap hari.',
      points: [
        'Model 3 zona (Seiler): Z1 di bawah VT1/LT1, Z2 antara VT1–VT2, Z3 di atas VT2.',
        'Pola polarized/pyramidal sama-sama efektif; yang konsisten buruk adalah terlalu banyak intensitas sedang.',
        'Easy run yang benar-benar easy membuat sesi keras bisa dilakukan dengan kualitas tinggi.',
        'Talk test: di Z1 Anda bisa bicara kalimat utuh.'
      ],
      practice: [
        'Easy run di RPE 2–3 / HR zona 2. Jika ragu, perlambat.',
        'Batasi 2 sesi keras per minggu (termasuk long run dengan segmen cepat).'
      ],
      refs: [
        'Seiler KS & Kjerland GØ (2006). Quantifying training intensity distribution in elite endurance athletes: is there evidence for an "optimal" distribution? Scand J Med Sci Sports 16(1):49–56.',
        'Seiler S (2010). What is best practice for training intensity and duration distribution in endurance athletes? Int J Sports Physiol Perform 5(3):276–291.',
        'Stöggl T & Sperlich B (2014). Polarized training has greater impact on key endurance variables than threshold, high intensity, or high volume training. Front Physiol 5:33.'
      ],
      keywords: ['80/20', 'polarized', 'polarisasi', 'zona', 'easy', 'santai', 'intensitas', 'pelan', 'zona 2', 'talk test', 'pyramidal']
    },
    {
      id: 'vdot',
      title: 'VDOT & pace latihan',
      cat: 'Metodologi',
      evidence: 'Praktik',
      summary: 'VDOT (Daniels & Gilbert) adalah "VO2max efektif" yang dihitung dari hasil lomba. Dari VDOT diturunkan lima intensitas latihan dengan tujuan fisiologis berbeda.',
      points: [
        'E (Easy, 59–74% VO2max): fondasi aerobik, pemulihan, long run.',
        'M (Marathon): pace lomba marathon; latih ritme & pemakaian bahan bakar.',
        'T (Threshold, ~88%): "comfortably hard", ±60 mnt pace lomba. Sesi maks ~10% volume mingguan.',
        'I (Interval, ~97–100%): rep 3–5 mnt menarget VO2max. Maks ~8% volume mingguan atau 10 km.',
        'R (Repetition): pace ~1 mil, rep pendek dengan pulih penuh; melatih kecepatan & economy. Maks ~5%.',
        'Perbarui VDOT dari lomba/time trial tiap 4–6 minggu; jangan dari target yang belum dicapai.'
      ],
      practice: [
        'Latih sesuai kebugaran saat ini, bukan kebugaran yang diinginkan.',
        'Di cuaca panas/lembap, pakai effort & HR, bukan pace.'
      ],
      refs: [
        'Daniels J (2014). Daniels\' Running Formula, 3rd ed. Human Kinetics.',
        'Daniels J & Gilbert J (1979). Oxygen Power: Performance Tables for Distance Runners.'
      ],
      keywords: ['vdot', 'pace', 'daniels', 'tempo', 'interval', 'repetisi', 'threshold', 'kecepatan', 'zona pace']
    },
    {
      id: 'periodisasi',
      title: 'Periodisasi & progressive overload',
      cat: 'Perencanaan',
      evidence: 'Sedang',
      summary: 'Rencana yang baik bergerak dari umum ke spesifik: Base (volume aerobik) → Build (threshold & VO2max) → Peak (spesifik lomba) → Taper. Beban naik bertahap, diselingi minggu pemulihan.',
      points: [
        'Adaptasi terjadi saat pemulihan, bukan saat latihan. Stres + istirahat = adaptasi.',
        'Pola 3:1 (3 minggu naik, 1 minggu turun 20–30%) adalah heuristik praktis yang banyak dipakai.',
        'Spesifisitas meningkat mendekati lomba: pace, durasi, medan, dan nutrisi lomba dilatih.',
        'Konsistensi berbulan-bulan mengalahkan satu minggu "heroik".'
      ],
      practice: [
        'Naikkan satu variabel dalam satu waktu: volume ATAU intensitas.',
        'Rencana 12–20 minggu untuk HM/marathon; 8–12 minggu untuk 5K/10K bila sudah punya base.'
      ],
      refs: [
        'Issurin VB (2010). New horizons for the methodology and physiology of training periodization. Sports Med 40(3):189–206.',
        'Mujika I, Halson S, Burke LM, Balagué G, Farrow D (2018). An integrated, multifactorial approach to periodization for optimal performance in individual and team sports. Int J Sports Physiol Perform 13(5):538–561.'
      ],
      keywords: ['periodisasi', 'base', 'build', 'peak', 'fase', 'overload', 'progresi', 'cutback', 'minggu ringan', 'rencana', 'program']
    },
    {
      id: 'taper',
      title: 'Taper sebelum lomba',
      cat: 'Perencanaan',
      evidence: 'Kuat',
      summary: 'Meta-analisis menunjukkan taper paling efektif berlangsung ±2 minggu dengan volume turun 41–60% secara progresif, sementara intensitas dan frekuensi dipertahankan. Hasil tipikal: performa naik ~2–3%.',
      points: [
        'Pertahankan sesi pendek di pace lomba agar "tajam".',
        'Jangan mengurangi frekuensi lari drastis; kurangi durasi tiap sesi.',
        '5K/10K: ~7–10 hari. HM: ~2 minggu. Marathon: 2–3 minggu.',
        'Merasa "berat" atau gelisah saat taper itu normal.'
      ],
      practice: [
        'Tidak ada kebugaran baru yang bisa dibangun 10 hari terakhir; fokus pada segar.',
        'Tidur, karbohidrat, dan logistik lomba jadi prioritas.'
      ],
      refs: [
        'Bosquet L, Montpetit J, Arvisais D, Mujika I (2007). Effects of tapering on performance: a meta-analysis. Med Sci Sports Exerc 39(8):1358–1365.',
        'Mujika I & Padilla S (2003). Scientific bases for precompetition tapering strategies. Med Sci Sports Exerc 35(7):1182–1187.'
      ],
      keywords: ['taper', 'tapering', 'sebelum lomba', 'race week', 'minggu lomba', 'kurangi']
    },
    {
      id: 'beban',
      title: 'Memantau beban: sRPE, monotony, ACWR',
      cat: 'Monitoring',
      evidence: 'Sedang',
      summary: 'Session-RPE (durasi × RPE 0–10) adalah cara murah dan tervalidasi untuk mengukur beban internal. Dari sini dihitung beban mingguan, monotony, strain, dan rasio akut:kronis.',
      points: [
        'sRPE = menit × RPE (skala CR-10), diisi ~30 menit setelah sesi. Satuan: AU.',
        'Monotony = rata-rata beban harian ÷ SD. >2 menandakan latihan terlalu seragam.',
        'Strain = beban mingguan × monotony. Puncak strain berkaitan dengan sakit ringan & overreaching.',
        'ACWR (7 hari vs 28 hari) populer, tetapi validitasnya sebagai prediktor cedera dikritik keras. Pakai sebagai indikator perubahan beban saja.'
      ],
      practice: [
        'Catat SETIAP sesi, termasuk yang buruk; data jujur menghasilkan saran yang berguna.',
        'Perhatikan tren, bukan satu angka harian.'
      ],
      refs: [
        'Foster C et al. (2001). A new approach to monitoring exercise training. J Strength Cond Res 15(1):109–115.',
        'Foster C (1998). Monitoring training in athletes with reference to overtraining syndrome. Med Sci Sports Exerc 30(7):1164–1168.',
        'Gabbett TJ (2016). The training—injury prevention paradox: should athletes be training smarter and harder? Br J Sports Med 50(5):273–280.',
        'Impellizzeri FM et al. (2020). Acute:chronic workload ratio: conceptual issues and fundamental pitfalls. Int J Sports Physiol Perform 15(6):907–913.'
      ],
      keywords: ['rpe', 'beban', 'load', 'acwr', 'monotony', 'strain', 'monitoring', 'srpe', 'overtraining', 'capek']
    },
    {
      id: 'cedera',
      title: 'Mencegah cedera lari',
      cat: 'Kesehatan',
      evidence: 'Sedang',
      summary: 'Sebagian besar cedera lari adalah overuse: beban naik lebih cepat dari kemampuan jaringan beradaptasi. Faktor terkuat yang bisa dikontrol adalah perubahan beban yang mendadak dan riwayat cedera.',
      points: [
        'Lonjakan volume >30% dalam 2 minggu dikaitkan dengan risiko cedera lebih tinggi pada pemula (Nielsen 2014).',
        '"Aturan 10%" tidak terbukti lebih aman dari progresi sedikit lebih cepat (Buist 2008), tetapi tetap pedoman konservatif yang masuk akal.',
        'Tulang, tendon, dan ligamen beradaptasi lebih lambat dari jantung-paru; terasa bugar belum tentu jaringan siap.',
        'Latihan kekuatan menurunkan risiko cedera olahraga secara umum.',
        'Nyeri tulang terlokalisasi yang memburuk = curiga bone stress injury. Hentikan dan periksakan.',
        'Energi kurang (RED-S) meningkatkan risiko stress fracture dan gangguan hormonal.'
      ],
      practice: [
        'Ubah satu hal dalam satu waktu: volume, intensitas, sepatu, atau permukaan.',
        'Aturan nyeri: ≤3/10 dan stabil boleh lanjut; naik selama/sesudah lari = berhenti.'
      ],
      refs: [
        'Nielsen RØ et al. (2014). Excessive progression in weekly running distance and risk of running-related injuries. J Orthop Sports Phys Ther 44(10):739–747.',
        'Buist I et al. (2008). No effect of a graded training program on the number of running-related injuries in novice runners. Am J Sports Med 36(1):33–39.',
        'Videbæk S et al. (2015). Incidence of running-related injuries per 1000 h of running in different types of runners: a systematic review and meta-analysis. Sports Med 45(7):1017–1026.',
        'Lauersen JB, Bertelsen DM, Andersen LB (2014). The effectiveness of exercise interventions to prevent sports injuries: a systematic review and meta-analysis. Br J Sports Med 48(11):871–877.',
        'Mountjoy M et al. (2023). 2023 IOC consensus statement on Relative Energy Deficiency in Sport (REDs). Br J Sports Med 57(17):1073–1097.'
      ],
      keywords: ['cedera', 'injury', 'sakit', 'nyeri', 'shin', 'lutut', 'stress fracture', 'tendon', '10%', 'aturan 10', 'red-s', 'achilles', 'plantar']
    },
    {
      id: 'kekuatan',
      title: 'Latihan kekuatan & plyometrik',
      cat: 'Pelengkap',
      evidence: 'Kuat',
      summary: 'Latihan kekuatan berat (beban tinggi, repetisi rendah) dan plyometrik memperbaiki running economy ~2–8% pada pelari terlatih tanpa menambah massa otot berarti, serta membantu ketahanan jaringan.',
      points: [
        '2 sesi/minggu, 20–40 menit, cukup untuk efek nyata.',
        'Fokus: squat/split squat, deadlift/hip hinge, calf raise (lutut lurus & tekuk), step-up, core anti-rotasi.',
        'Beban berat (~3–6 rep, 2–4 set) lebih efektif untuk economy dibanding banyak repetisi ringan.',
        'Plyometrik: pogo jumps, skipping, bounding, mulai volume rendah (40–60 kontak).'
      ],
      practice: [
        'Letakkan di hari yang sama dengan sesi keras (sesudahnya) agar hari easy tetap easy.',
        'Kurangi volume angkat saat taper, tetapi jangan hilangkan total.'
      ],
      refs: [
        'Balsalobre-Fernández C, Santos-Concejero J, Grivas GV (2016). Effects of strength training on running economy in highly trained runners: a systematic review with meta-analysis of controlled trials. J Strength Cond Res 30(8):2361–2368.',
        'Blagrove RC, Howatson G, Hayes PR (2018). Effects of strength training on the physiological determinants of middle- and long-distance running performance: a systematic review. Sports Med 48(5):1117–1149.'
      ],
      keywords: ['kekuatan', 'strength', 'gym', 'beban', 'squat', 'plyometrik', 'plyo', 'core', 'angkat beban', 'economy']
    },
    {
      id: 'hr',
      title: 'Zona denyut jantung',
      cat: 'Monitoring',
      evidence: 'Sedang',
      summary: 'HR berguna untuk menjaga easy run tetap easy, terutama di cuaca panas. Rumus usia untuk HRmax punya galat ±10 bpm, jadi uji lapangan atau data lomba lebih akurat.',
      points: [
        'HRmax prediksi Tanaka: 208 − 0,7 × usia (lebih akurat dari 220 − usia).',
        'Metode Karvonen memakai HR cadangan (HRmax − HR istirahat), lebih personal dari %HRmax.',
        'Cardiac drift: HR naik perlahan di pace yang sama karena panas & dehidrasi. Normal.',
        'HR terlambat merespons pada interval pendek; untuk rep <3 mnt pakai pace/RPE.',
        'Sensor optik pergelangan kurang akurat saat intensitas tinggi; chest strap lebih andal.'
      ],
      practice: [
        'Ukur HR istirahat pagi hari beberapa hari, ambil rata-rata.',
        'Kenaikan HR istirahat ≥5–7 bpm dari biasa adalah sinyal untuk memperingan latihan.'
      ],
      refs: [
        'Tanaka H, Monahan KD, Seals DR (2001). Age-predicted maximal heart rate revisited. J Am Coll Cardiol 37(1):153–156.',
        'Karvonen MJ, Kentala E, Mustala O (1957). The effects of training on heart rate; a longitudinal study. Ann Med Exp Biol Fenn 35(3):307–315.'
      ],
      keywords: ['heart rate', 'hr', 'denyut', 'jantung', 'bpm', 'zona', 'karvonen', 'hrmax', 'jam', 'garmin', 'cardiac drift']
    },
    {
      id: 'pemulihan',
      title: 'Pemulihan, tidur & overtraining',
      cat: 'Kesehatan',
      evidence: 'Kuat',
      summary: 'Tidur adalah alat pemulihan terkuat yang tersedia. Kelelahan berkepanjangan disertai performa turun berminggu-minggu bisa menandakan non-functional overreaching atau overtraining syndrome.',
      points: [
        'Target 7–9 jam; atlet sering butuh lebih. Perpanjangan tidur memperbaiki performa pada studi atlet.',
        'Functional overreaching (beberapa hari) adalah bagian normal blok latihan; non-functional (minggu–bulan) tidak.',
        'Tanda bahaya: performa turun meski istirahat, mood buruk, sering sakit, gangguan tidur, HR istirahat naik.',
        'Stres hidup (kerja, keluarga) menambah beban total; rencana harus fleksibel.'
      ],
      practice: [
        'Isi cek readiness tiap pagi; turunkan sesi bila skor rendah 2+ hari berturut.',
        'Satu hari libur hampir tidak pernah merugikan.'
      ],
      refs: [
        'Meeusen R et al. (2013). Prevention, diagnosis, and treatment of the overtraining syndrome: joint consensus statement of the ECSS and ACSM. Med Sci Sports Exerc 45(1):186–205.',
        'Fullagar HHK et al. (2015). Sleep and athletic performance: the effects of sleep loss on exercise performance, and physiological and cognitive responses to exercise. Sports Med 45(2):161–186.',
        'Mah CD et al. (2011). The effects of sleep extension on the athletic performance of collegiate basketball players. Sleep 34(7):943–950.'
      ],
      keywords: ['tidur', 'sleep', 'pemulihan', 'recovery', 'overtraining', 'lelah', 'capek', 'istirahat', 'burnout', 'stres']
    },
    {
      id: 'nutrisi',
      title: 'Nutrisi & bahan bakar lomba',
      cat: 'Nutrisi',
      evidence: 'Kuat',
      summary: 'Karbohidrat adalah bahan bakar utama untuk intensitas lomba. Kebutuhan saat lari meningkat dengan durasi; usus juga bisa "dilatih" untuk menyerap lebih banyak.',
      points: [
        'Lari <60 mnt: tidak perlu asupan karbo selama lari.',
        '1–2,5 jam: 30–60 g karbo/jam. >2,5 jam: hingga 90 g/jam dengan campuran glukosa + fruktosa.',
        'Carb loading untuk HM/marathon: ~10–12 g/kg/hari selama 36–48 jam sebelum lomba.',
        'Sarapan lomba 1–4 g/kg karbo, 1–4 jam sebelumnya, rendah serat & lemak.',
        'Protein ~1,2–2,0 g/kg/hari mendukung adaptasi; ~0,3 g/kg per makan.',
        'Makan terlalu sedikit untuk beban latihan (RED-S) merusak performa dan kesehatan tulang.'
      ],
      practice: [
        'Latih gel/minuman lomba di long run, jangan coba hal baru saat lomba.',
        'Contoh: gel 25 g tiap 20–25 mnt ≈ 60–75 g/jam.'
      ],
      refs: [
        'Thomas DT, Erdman KA, Burke LM (2016). American College of Sports Medicine joint position statement. Nutrition and athletic performance. Med Sci Sports Exerc 48(3):543–568.',
        'Jeukendrup A (2014). A step towards personalized sports nutrition: carbohydrate intake during exercise. Sports Med 44(Suppl 1):S25–S33.',
        'Burke LM, Hawley JA, Wong SHS, Jeukendrup AE (2011). Carbohydrates for training and competition. J Sports Sci 29(Suppl 1):S17–S27.'
      ],
      keywords: ['nutrisi', 'makan', 'karbo', 'karbohidrat', 'gel', 'carb loading', 'protein', 'sarapan', 'fueling', 'diet', 'energi']
    },
    {
      id: 'hidrasi',
      title: 'Hidrasi & lari di iklim tropis',
      cat: 'Lingkungan',
      evidence: 'Kuat',
      summary: 'Panas dan kelembapan (seperti di Indonesia) menaikkan HR dan memperlambat pace pada effort yang sama. Aklimatisasi 1–2 minggu memperbaiki toleransi panas secara nyata.',
      points: [
        'Minum sesuai rasa haus umumnya cukup; hindari kehilangan berat badan >2–3% saat lari panjang.',
        'Minum berlebihan berisiko hiponatremia, terutama pelari lambat di marathon.',
        'Lari >1 jam di panas: tambahkan natrium (minuman isotonik/kapsul garam).',
        'Aklimatisasi: 60–90 mnt/hari latihan di panas selama 7–14 hari (adaptasi: volume plasma naik, keringat lebih awal).',
        'Pace melambat beberapa persen di suhu & kelembapan tinggi; pakai effort/HR.',
        'Tanda heat illness: pusing, bingung, berhenti berkeringat, mual. Hentikan & dinginkan segera.'
      ],
      practice: [
        'Lari pagi buta atau sore setelah matahari turun.',
        'Timbang badan sebelum & sesudah long run untuk memperkirakan laju keringat.'
      ],
      refs: [
        'Racinais S et al. (2015). Consensus recommendations on training and competing in the heat. Br J Sports Med 49(18):1164–1173.',
        'Sawka MN et al. (2007). American College of Sports Medicine position stand. Exercise and fluid replacement. Med Sci Sports Exerc 39(2):377–390.',
        'Hew-Butler T et al. (2015). Statement of the Third International Exercise-Associated Hyponatremia Consensus Development Conference. Clin J Sport Med 25(4):303–320.'
      ],
      keywords: ['panas', 'hidrasi', 'minum', 'air', 'cairan', 'lembap', 'tropis', 'cuaca', 'keringat', 'garam', 'elektrolit', 'heat', 'hiponatremia']
    },
    {
      id: 'pacing',
      title: 'Strategi pacing lomba',
      cat: 'Lomba',
      evidence: 'Sedang',
      summary: 'Untuk lomba ≥5K, pacing yang merata atau sedikit negative split umumnya menghasilkan waktu terbaik. Start terlalu cepat adalah kesalahan paling umum dan paling mahal.',
      points: [
        'Rekor dunia jarak jauh hampir selalu dicapai dengan split yang relatif rata.',
        'Kilometer pertama 2–5 detik lebih lambat dari target itu wajar.',
        'Prediksi Riegel (T2 = T1 × (D2/D1)^1,06) akurat untuk jarak dekat; makin jauh lompatan jarak, makin optimis.',
        'Prediksi marathon dari 5K sering terlalu cepat bila volume mingguan rendah.'
      ],
      practice: [
        'Bagi lomba menjadi 3: sabar, fokus, berani.',
        'Siapkan target A (ideal), B (realistis), C (kondisi buruk).'
      ],
      refs: [
        'Abbiss CR & Laursen PB (2008). Describing and understanding pacing strategies during athletic competition. Sports Med 38(3):239–252.',
        'Riegel PS (1981). Athletic records and human endurance. American Scientist 69(3):285–290.'
      ],
      keywords: ['pacing', 'pace lomba', 'negative split', 'strategi', 'lomba', 'race', 'prediksi', 'target', 'riegel', 'split']
    },
    {
      id: 'teknik',
      title: 'Teknik, cadence & sepatu',
      cat: 'Biomekanika',
      evidence: 'Sedang',
      summary: 'Tidak ada satu teknik "benar" untuk semua orang. Menaikkan cadence 5–10% mengurangi beban sendi lutut & panggul, berguna bagi pelari dengan riwayat cedera atau overstriding.',
      points: [
        'Cadence alami bervariasi dengan kecepatan & tinggi badan; angka 180 bukan aturan universal.',
        'Kenaikan step rate +5–10% menurunkan beban di lutut dan panggul.',
        'Pemilihan sepatu: "comfort filter", pilih yang terasa paling nyaman. Klasifikasi pronasi tidak terbukti memprediksi cedera.',
        'Sepatu super (karbon + foam PEBA) memperbaiki economy ~2–4% rata-rata, tapi respons individu bervariasi.'
      ],
      practice: [
        'Strides 2×/minggu cara alami melatih form cepat & rileks.',
        'Ganti sepatu bertahap; jangan langsung long run dengan sepatu baru/berbeda drop.'
      ],
      refs: [
        'Heiderscheit BC et al. (2011). Effects of step rate manipulation on joint mechanics during running. Med Sci Sports Exerc 43(2):296–302.',
        'Nigg BM et al. (2015). Running shoes and running injuries: mythbusting and a proposal for two new paradigms: "preferred movement path" and "comfort filter". Br J Sports Med 49(20):1290–1294.',
        'Hoogkamer W et al. (2018). A comparison of the energetic cost of running in marathon racing shoes. Sports Med 48(4):1009–1019.'
      ],
      keywords: ['teknik', 'form', 'cadence', 'langkah', 'sepatu', 'shoes', 'overstriding', 'heel strike', 'forefoot', 'karbon', 'pronasi']
    },
    {
      id: 'pemula',
      title: 'Untuk pemula: run-walk & konsistensi',
      cat: 'Pemula',
      evidence: 'Praktik',
      summary: 'Bagi pemula, tujuan utama 8–12 minggu pertama adalah membangun kebiasaan dan toleransi jaringan, bukan kecepatan. Metode lari-jalan (run-walk) adalah cara aman memulai.',
      points: [
        'Mulai 3×/minggu, 20–30 mnt, misalnya 1 mnt lari / 1–2 mnt jalan, lalu perpanjang porsi lari.',
        'Hari lari tidak berurutan, minimal awalnya.',
        'Easy terasa "terlalu pelan" justru tanda benar.',
        'Sesi kualitas baru diperlukan setelah bisa lari kontinu ±30–45 mnt dengan nyaman.'
      ],
      practice: [
        'Ukur kemajuan dari konsistensi mingguan, bukan pace.',
        'Pertimbangkan pemeriksaan kesehatan bila punya faktor risiko jantung.'
      ],
      refs: [
        'Videbæk S et al. (2015). Sports Med 45(7):1017–1026 (insiden cedera tertinggi pada pemula).',
        'Daniels J (2014). Daniels\' Running Formula, 3rd ed. — program pemula.'
      ],
      keywords: ['pemula', 'mulai', 'beginner', 'baru', 'run walk', 'jalan', 'pertama', 'couch']
    }
  ];

  function tokenize(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9%/ ]+/g, ' ').split(/\s+/).filter(Boolean);
  }

  /** Cari topik paling relevan untuk sebuah pertanyaan (pencocokan kata kunci berbobot). */
  function search(query, limit) {
    var q = String(query || '').toLowerCase();
    var toks = tokenize(q);
    var scored = TOPICS.map(function (t) {
      var score = 0;
      t.keywords.forEach(function (k) {
        if (k.indexOf(' ') >= 0 || k.length > 4) { if (q.indexOf(k) >= 0) score += 3; }
        else if (toks.indexOf(k) >= 0) score += 3;
      });
      var hay = (t.title + ' ' + t.summary + ' ' + t.points.join(' ')).toLowerCase();
      toks.forEach(function (w) { if (w.length > 3 && hay.indexOf(w) >= 0) score += 1; });
      return { topic: t, score: score };
    }).filter(function (x) { return x.score > 0; });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, limit || 3);
  }

  var api = { TOPICS: TOPICS, search: search };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Knowledge = api;
})(this);
