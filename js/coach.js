/*
 * coach.js — logika "pelatih": readiness harian, analisis log, penyesuaian sesi.
 * Aturan transparan berbasis bukti; setiap saran menyebut dasarnya.
 *
 * Dasar:
 * - Kuesioner wellness (Hooper & Mackinnon 1995; McLean et al. 2010): tidur, stres, nyeri otot, mood.
 * - Meeusen et al. (2013) MSSE — konsensus overtraining (ECSS/ACSM).
 * - Foster (1998) monotony/strain; Gabbett (2016) & kritik Impellizzeri et al. (2020) untuk ACWR.
 * - Nielsen et al. (2014) JOSPT — lonjakan volume >30% dalam 2 minggu.
 * - Seiler (2010) IJSPP — distribusi intensitas.
 */
(function (root) {
  'use strict';

  var S = (typeof module !== 'undefined' && module.exports) ? require('./science.js') : root.Science;

  /**
   * Readiness 0–100 dari input 1–5 (5 = terbaik) + tanda bahaya.
   * r: { sleepH, sleepQ, soreness, stress, mood, rhrDelta, pain, illness }
   *   soreness/stress: 5 = tidak ada (sudah dibalik di UI), pain: 'none'|'mild'|'sharp',
   *   illness: 'none'|'above'|'below' (aturan "neck check").
   */
  function readiness(r) {
    var sleepHScore = Math.max(0, Math.min(1, ((r.sleepH || 0) - 5) / 3)); // 5 jam = 0, 8 jam = 1
    var parts = [
      sleepHScore,
      ((r.sleepQ || 3) - 1) / 4,
      ((r.soreness || 3) - 1) / 4,
      ((r.stress || 3) - 1) / 4,
      ((r.mood || 3) - 1) / 4
    ];
    var score = S.mean(parts) * 100;
    var rhr = Number(r.rhrDelta) || 0;
    if (rhr >= 8) score -= 20; else if (rhr >= 5) score -= 10;
    score = Math.max(0, Math.min(100, Math.round(score)));

    var flags = [];
    var level;
    if (r.pain === 'sharp') {
      level = 'red';
      flags.push('Nyeri tajam/terlokalisasi atau mengubah cara berlari: jangan lari hari ini. Nyeri tulang yang menetap bisa tanda bone stress injury, periksakan ke dokter/fisioterapis.');
    } else if (r.illness === 'below') {
      level = 'red';
      flags.push('Gejala di bawah leher (demam, nyeri dada, badan pegal menyeluruh, diare): istirahat total. Latihan saat demam berisiko miokarditis.');
    } else if (score < 40) {
      level = 'red';
    } else if (score < 65 || r.pain === 'mild' || r.illness === 'above' || rhr >= 5) {
      level = 'amber';
    } else {
      level = 'green';
    }
    if (r.illness === 'above' && level !== 'red') flags.push('Gejala hanya di atas leher (pilek ringan): boleh easy run pendek; hentikan bila memburuk. Ini heuristik klinis, bukan hasil RCT.');
    if (r.pain === 'mild') flags.push('Nyeri ringan yang hilang saat pemanasan biasanya aman untuk easy run. Bila nyeri naik selama lari, berhenti.');
    if (rhr >= 5) flags.push('HR istirahat naik ' + rhr + ' bpm dari biasanya: tanda kelelahan, kurang tidur, dehidrasi, atau awal sakit.');
    if ((r.sleepH || 0) < 6) flags.push('Tidur <6 jam menurunkan performa dan meningkatkan risiko cedera; prioritaskan tidur malam ini.');

    return { score: score, level: level, flags: flags };
  }

  /** Sesuaikan sesi terencana berdasarkan readiness. */
  function adjustSession(session, ready) {
    if (!session) return null;
    var s = Object.assign({}, session);
    if (ready.level === 'green' || s.type === 'R') {
      s.advice = ready.level === 'green' ? 'Siap. Jalankan sesi sesuai rencana.' : 'Hari istirahat sesuai rencana.';
      return s;
    }
    if (ready.level === 'red') {
      s.advice = 'Ganti dengan istirahat total, atau jalan kaki/mobilitas 20–30 mnt. Satu hari libur tidak menghapus kebugaran; memaksakan diri bisa menghapus berminggu-minggu.';
      s.adjusted = { title: 'Istirahat / pemulihan aktif', km: 0 };
      return s;
    }
    // amber
    if (s.type === 'Q' || s.type === 'RACE') {
      s.advice = 'Turunkan jadi easy run ' + Math.max(3, Math.round(s.km * 0.6)) + ' km. Pindahkan sesi kualitas 1–2 hari bila readiness membaik; jangan ditumpuk.';
      s.adjusted = { title: 'Easy run (pengganti ' + s.title + ')', km: Math.max(3, Math.round(s.km * 0.6)) };
    } else if (s.type === 'L') {
      s.advice = 'Pendekkan long run ~25% (' + Math.round(s.km * 0.75) + ' km) dan jaga di zona easy.';
      s.adjusted = { title: 'Long run dipersingkat', km: Math.round(s.km * 0.75) };
    } else {
      s.advice = 'Lari lebih pendek (' + Math.max(3, Math.round(s.km * 0.7)) + ' km) dan lebih pelan dari biasa.';
      s.adjusted = { title: 'Easy run dipersingkat', km: Math.max(3, Math.round(s.km * 0.7)) };
    }
    return s;
  }

  function weekKm(logs, endDate, offsetWeeks) {
    var end = S.addDays(endDate, -7 * offsetWeeks);
    var start = S.addDays(end, -6);
    var a = S.dayKey(start), b = S.dayKey(end);
    return (logs || []).filter(function (l) { return l.date >= a && l.date <= b; })
      .reduce(function (s, l) { return s + (Number(l.km) || 0); }, 0);
  }

  /**
   * Analisis log dan hasilkan insight bertingkat (info/warn/alert).
   * logs: [{ date:'YYYY-MM-DD', km, minutes, rpe, type, notes }]
   */
  function analyze(logs, today) {
    var insights = [];
    var t = today || new Date();
    if (!logs || logs.length === 0) {
      return { insights: [{ level: 'info', title: 'Belum ada data latihan', text: 'Catat setiap sesi (durasi + RPE) agar coach bisa menghitung beban, tren, dan distribusi intensitas.' }], metrics: null };
    }

    var loads7 = S.dailyLoads(logs, t, 7);
    var ms = S.monotonyStrain(loads7);
    var ac = S.acwr(logs, t);
    var km0 = weekKm(logs, t, 0), km1 = weekKm(logs, t, 1), km2 = weekKm(logs, t, 2);

    // 1. Perubahan volume
    if (km1 > 0) {
      var ch = (km0 - km1) / km1 * 100;
      if (ch > 30) insights.push({ level: 'alert', title: 'Volume melonjak ' + Math.round(ch) + '%', text: '7 hari terakhir ' + km0.toFixed(1) + ' km vs ' + km1.toFixed(1) + ' km minggu sebelumnya. Nielsen et al. (2014) mengaitkan lonjakan >30% dengan risiko cedera lebih tinggi pada pelari pemula. Tahan volume minggu depan.' });
      else if (ch > 10) insights.push({ level: 'warn', title: 'Volume naik ' + Math.round(ch) + '%', text: 'Masih wajar bila tubuh terasa baik, tetapi jangan naik lagi minggu depan. Pertimbangkan minggu ringan setelah 3 minggu naik.' });
    }
    if (km1 > 0 && km2 > 0 && km0 > km1 && km1 > km2 && weekKm(logs, t, 3) > 0 && km2 > weekKm(logs, t, 3)) {
      insights.push({ level: 'warn', title: '3 minggu naik berturut-turut', text: 'Saatnya minggu pemulihan (volume −20–30%) untuk konsolidasi adaptasi (pola 3:1).' });
    }

    // 2. ACWR (indikator perubahan beban, bukan prediktor cedera)
    var firstLog = logs.reduce(function (m, l) { return l.date < m ? l.date : m; }, '9999');
    var spanDays = Math.round((new Date(S.dayKey(t)) - new Date(firstLog)) / 86400000) + 1;
    if (ac.ratio !== null && spanDays >= 21) {
      if (ac.ratio > 1.5) insights.push({ level: 'alert', title: 'Beban akut jauh di atas kebiasaan (ACWR ' + ac.ratio.toFixed(2) + ')', text: 'Beban 7 hari ' + Math.round(ac.acute) + ' AU vs rata-rata mingguan 4 minggu ' + Math.round(ac.chronic) + ' AU. Kurangi intensitas beberapa hari. Catatan: ACWR menunjukkan perubahan beban, bukan alat prediksi cedera yang valid (Impellizzeri et al. 2020).' });
      else if (ac.ratio < 0.8 && ac.chronic > 0) insights.push({ level: 'info', title: 'Beban turun (ACWR ' + ac.ratio.toFixed(2) + ')', text: 'Wajar saat taper atau minggu pemulihan. Jika tidak disengaja, naikkan bertahap supaya kebugaran tidak menurun.' });
    }

    // 3. Monotony & strain
    if (isFinite(ms.monotony) && ms.monotony > 2 && ms.weekly > 0) {
      insights.push({ level: 'warn', title: 'Latihan monoton (monotony ' + ms.monotony.toFixed(1) + ')', text: 'Hari-hari terlalu seragam. Foster (1998) menemukan monotony >2 bersama strain tinggi berkaitan dengan sakit/overreaching. Buat hari mudah benar-benar mudah, dan hari keras benar-benar keras.' });
    }

    // 4. Distribusi intensitas (berbasis waktu dari RPE)
    var cutoff = S.dayKey(S.addDays(t, -27));
    var recent = logs.filter(function (l) { return l.date >= cutoff; });
    var tot = 0, easy = 0, mod = 0, hard = 0;
    recent.forEach(function (l) {
      var m = Number(l.minutes) || 0, r = Number(l.rpe) || 0;
      tot += m;
      if (r <= 4) easy += m; else if (r <= 6) mod += m; else hard += m;
    });
    var dist = tot > 0 ? { easy: easy / tot, moderate: mod / tot, hard: hard / tot } : null;
    if (dist && recent.length >= 4) {
      if (dist.easy < 0.7) insights.push({ level: 'warn', title: 'Terlalu banyak intensitas sedang–tinggi', text: 'Hanya ' + Math.round(dist.easy * 100) + '% waktu lari di RPE ≤4. Atlet ketahanan elite menghabiskan ~75–80% sesi (≈90% waktu) di intensitas rendah (Seiler 2010). Perlambat easy run Anda.' });
      else if (dist.moderate > 0.25) insights.push({ level: 'info', title: 'Zona abu-abu', text: Math.round(dist.moderate * 100) + '% waktu di RPE 5–6. Sering terjadi saat easy run "kebablasan". Pilih: benar-benar santai, atau sesi kualitas yang terstruktur.' });
      else insights.push({ level: 'good', title: 'Distribusi intensitas sehat', text: Math.round(dist.easy * 100) + '% waktu di intensitas rendah dalam 4 minggu terakhir. Pertahankan.' });
    }

    // 5. Hari istirahat
    var restDays = loads7.filter(function (d) { return d.load === 0; }).length;
    if (restDays === 0) insights.push({ level: 'warn', title: 'Tidak ada hari istirahat 7 hari terakhir', text: 'Minimal 1 hari tanpa lari per minggu sangat dianjurkan bagi pelari rekreasi.' });

    // 6. Sesi RPE tinggi berturut-turut
    var sorted = logs.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var last2 = sorted.slice(-2);
    if (last2.length === 2 && last2.every(function (l) { return Number(l.rpe) >= 7; })) {
      insights.push({ level: 'warn', title: 'Dua sesi keras berturut-turut', text: 'Beri ≥48 jam di antara sesi keras. Sesi berikutnya sebaiknya easy.' });
    }

    if (!insights.length) insights.push({ level: 'good', title: 'Beban terkendali', text: 'Tidak ada sinyal peringatan dari data. Lanjutkan rencana dan tetap dengarkan tubuh.' });

    return {
      insights: insights,
      metrics: { km7: km0, kmPrev: km1, load7: ms.weekly, monotony: ms.monotony, strain: ms.strain, acwr: ac.ratio, chronic: ac.chronic, dist: dist, restDays: restDays }
    };
  }

  /** Bandingkan hasil log dengan rencana minggu ini: kepatuhan (compliance). */
  function compliance(plan, logs, today) {
    if (!plan) return null;
    var key = S.dayKey(today || new Date());
    var wk = plan.weeks.find(function (w) { return w.start && w.days[0].date <= key && w.days[6].date >= key; });
    if (!wk) return null;
    var a = wk.days[0].date, b = wk.days[6].date;
    var done = (logs || []).filter(function (l) { return l.date >= a && l.date <= b; })
      .reduce(function (s, l) { return s + (Number(l.km) || 0); }, 0);
    return { week: wk, plannedKm: wk.totalKm, doneKm: done, pct: wk.totalKm > 0 ? done / wk.totalKm : 0 };
  }

  var api = { readiness: readiness, adjustSession: adjustSession, analyze: analyze, compliance: compliance, weekKm: weekKm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Coach = api;
})(this);
