/*
 * plan.js — generator rencana latihan berperiodisasi.
 *
 * Prinsip yang diterapkan (lihat knowledge.js untuk referensi lengkap):
 * - Periodisasi blok: Base -> Build -> Peak -> Taper (Issurin 2010; Mujika et al. 2018).
 * - Progresi volume konservatif (maks ~10%/minggu) + minggu pemulihan tiap minggu ke-4
 *   (heuristik praktis; Nielsen et al. 2014 menemukan lonjakan >30% dalam 2 minggu berisiko).
 * - Distribusi intensitas ~80/20 (Seiler & Kjerland 2006; Stöggl & Sperlich 2014).
 * - Batas volume sesi keras: T ≤10%, I ≤8%, R ≤5% volume mingguan (Daniels 2014).
 * - Taper: volume turun 40–60%, intensitas & frekuensi dipertahankan (Bosquet et al. 2007).
 */
(function (root) {
  'use strict';

  var S = (typeof module !== 'undefined' && module.exports) ? require('./science.js') : root.Science;

  var DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

  var GOALS = {
    '5k': { label: '5K', m: 5000, longCap: 16, taper: 1, peak: { beginner: 30, intermediate: 50, advanced: 70 } },
    '10k': { label: '10K', m: 10000, longCap: 19, taper: 1, peak: { beginner: 35, intermediate: 55, advanced: 80 } },
    half: { label: 'Half marathon', m: 21097.5, longCap: 24, taper: 2, peak: { beginner: 40, intermediate: 60, advanced: 90 } },
    marathon: { label: 'Marathon', m: 42195, longCap: 32, taper: 3, peak: { beginner: 50, intermediate: 70, advanced: 100 } }
  };

  var TAPER_FACTORS = { 1: [0.6], 2: [0.75, 0.5], 3: [0.8, 0.65, 0.45] };

  // Pola hari jika long run hari Minggu (index 6). Q = sesi kualitas, E = easy, L = long.
  var PATTERNS = {
    3: { 1: 'Q', 3: 'E', 6: 'L' },
    4: { 1: 'Q', 3: 'Q2', 5: 'E', 6: 'L' },
    5: { 1: 'Q', 2: 'E', 3: 'Q2', 5: 'E', 6: 'L' },
    6: { 0: 'E', 1: 'Q', 2: 'E', 3: 'Q2', 5: 'E', 6: 'L' }
  };

  var LONG_FRAC = { 3: 0.36, 4: 0.31, 5: 0.28, 6: 0.25 };

  function round1(x) { return Math.round(x * 2) / 2; } // kelipatan 0,5 km

  function paceTxt(paces, key) {
    if (!paces) return '';
    if (key === 'E') return ' @ ' + S.fmtPace(paces.E.fast) + '–' + S.fmtPace(paces.E.slow) + '/km';
    return paces[key] ? ' @ ' + S.fmtPace(paces[key].pace) + '/km' : '';
  }

  /** Bagi minggu non-taper menjadi fase base/build/peak. */
  function phaseOf(i, nTrain) {
    var base = Math.max(1, Math.round(nTrain * 0.4));
    var build = Math.max(1, Math.round(nTrain * 0.35));
    if (nTrain <= 3) { base = 1; build = Math.max(0, nTrain - 2); }
    if (i < base) return 'base';
    if (i < base + build) return 'build';
    return 'peak';
  }

  /** Volume mingguan: naik maks 10%/minggu menuju puncak, cutback tiap minggu ke-4, lalu taper. */
  function volumeCurve(opts) {
    var goal = GOALS[opts.goal];
    var nTaper = Math.min(goal.taper, Math.max(1, opts.weeks - 3));
    var nTrain = opts.weeks - nTaper;
    var start = Math.max(10, opts.currentKm);
    var target = Math.max(start, goal.peak[opts.level]);
    var vols = [];
    var running = start;
    for (var i = 0; i < nTrain; i++) {
      var cutback = (i + 1) % 4 === 0 && i < nTrain - 1;
      if (cutback) {
        vols.push({ km: running * 0.8, cutback: true });
      } else {
        if (i > 0) running = Math.min(target, running * 1.1);
        vols.push({ km: running, cutback: false });
      }
    }
    var peakKm = running;
    TAPER_FACTORS[nTaper].forEach(function (f) { vols.push({ km: peakKm * f, cutback: false, taper: true }); });
    return { vols: vols, nTrain: nTrain, nTaper: nTaper, peakKm: peakKm };
  }

  // ---------- Pustaka sesi ----------
  // Setiap fungsi mengembalikan { title, desc, km, hardKm, zone, rpe }.
  var WU = 2, CD = 1.5;

  function easyRun(km, paces) {
    return { type: 'E', title: 'Easy run', km: km, hardKm: 0, zone: 'Z2', rpe: '2–3',
      desc: km + ' km santai' + paceTxt(paces, 'E') + '. Bisa ngobrol (talk test).' };
  }

  function strides(km, paces) {
    return { type: 'E', title: 'Easy + strides', km: km, hardKm: 0, zone: 'Z2', rpe: '2–3 (strides 7)',
      desc: km + ' km easy' + paceTxt(paces, 'E') + ', lalu 6×20 dtk strides (cepat & rileks, bukan sprint) dengan jalan/jog 60 dtk.' };
  }

  function hills(km) {
    return { type: 'Q', title: 'Hill sprints', km: km, hardKm: 0.5, zone: 'Z1 + neuromuskular', rpe: '2–3 (sprint 8–9)',
      desc: km + ' km easy, sisipkan 8×10 dtk sprint tanjakan curam, jalan turun pulih penuh (~90 dtk). Membangun kekuatan & economy dengan risiko rendah.' };
  }

  function fartlek(weekKm) {
    var reps = Math.min(10, Math.max(5, Math.round(weekKm / 8)));
    var km = round1(WU + CD + reps * 0.5);
    return { type: 'Q', title: 'Fartlek', km: km, hardKm: reps * 0.25, zone: 'Z2–Z3', rpe: '6–7',
      desc: 'Pemanasan ' + WU + ' km. ' + reps + '×1 mnt cepat (~pace 10K) / 1 mnt jog. Pendinginan ' + CD + ' km.' };
  }

  function threshold(weekKm, paces, stage) {
    var tKm = Math.max(3, Math.min(weekKm * 0.10, 10));
    var main;
    if (stage === 0) {
      var reps = Math.max(2, Math.round(tKm / 1.6));
      main = reps + '×1,6 km @ T' + paceTxt(paces, 'T') + ', jog 1 mnt';
      tKm = reps * 1.6;
    } else if (stage === 1) {
      var r2 = Math.max(2, Math.round(tKm / 2.4));
      main = r2 + '×2,4 km @ T' + paceTxt(paces, 'T') + ', jog 2 mnt';
      tKm = r2 * 2.4;
    } else {
      tKm = Math.min(tKm, 8);
      main = 'Tempo kontinu ' + round1(tKm) + ' km @ T' + paceTxt(paces, 'T');
    }
    return { type: 'Q', title: 'Threshold', km: round1(WU + CD + tKm + 0.5), hardKm: tKm, zone: 'Z4 (Seiler Z2)', rpe: '6–7',
      desc: 'Pemanasan ' + WU + ' km. ' + main + '. "Comfortably hard": stabil, bisa bicara terpatah. Pendinginan ' + CD + ' km.' };
  }

  function intervals(weekKm, paces, repM) {
    var iKm = Math.max(3, Math.min(weekKm * 0.08, 10));
    var reps = Math.max(3, Math.round(iKm / (repM / 1000)));
    iKm = reps * repM / 1000;
    var rec = repM >= 1000 ? '3 mnt jog' : '2 mnt jog';
    return { type: 'Q', title: 'Interval VO2max', km: round1(WU + CD + iKm * 1.5), hardKm: iKm, zone: 'Z5 (Seiler Z3)', rpe: '8–9',
      desc: 'Pemanasan ' + WU + ' km + 4 strides. ' + reps + '×' + repM + ' m @ I' + paceTxt(paces, 'I') + ', ' + rec + ' (pulih ~ sama dengan waktu kerja). Pendinginan ' + CD + ' km.' };
  }

  function reps(weekKm, paces) {
    var rKm = Math.max(2, Math.min(weekKm * 0.05, 5));
    var n = Math.max(6, Math.round(rKm / 0.2));
    return { type: 'Q', title: 'Repetisi (speed)', km: round1(WU + CD + n * 0.4), hardKm: n * 0.2, zone: 'R / neuromuskular', rpe: '8',
      desc: 'Pemanasan ' + WU + ' km. ' + n + '×200 m @ R' + paceTxt(paces, 'R') + ', jog 200 m pulih penuh. Fokus form & cadence. Pendinginan ' + CD + ' km.' };
  }

  function racePace(goalKey, weekKm, paces) {
    var key = goalKey === 'half' ? 'HM' : goalKey === 'marathon' ? 'M' : goalKey === '10k' ? '10K' : '5K';
    var goal = GOALS[goalKey];
    var blockKm = goalKey === 'half' ? Math.min(8, weekKm * 0.12) : goalKey === 'marathon' ? Math.min(14, weekKm * 0.18) : Math.min(5, weekKm * 0.08);
    var reps = goalKey === 'half' || goalKey === 'marathon' ? 2 : 5;
    var rep = round1(blockKm / reps);
    if (goalKey === '5k' || goalKey === '10k') rep = goalKey === '5k' ? 1 : 2;
    blockKm = rep * reps;
    // pace marathon berada di sekitar ambang aerobik (LT1) sehingga hanya dihitung separuh sebagai "keras"
    return { type: 'Q', title: 'Race pace ' + goal.label, km: round1(WU + CD + blockKm * 1.2), hardKm: goalKey === 'marathon' ? blockKm / 2 : blockKm, zone: 'Spesifik lomba', rpe: '6–8',
      desc: 'Pemanasan ' + WU + ' km. ' + reps + '×' + rep + ' km @ pace target ' + goal.label + paceTxt(paces, key) + ', jog 2–3 mnt. Latih ritme, nutrisi, dan sepatu lomba. Pendinginan ' + CD + ' km.' };
  }

  function longRun(km, phase, goalKey, paces, weekInPhase) {
    var w = { type: 'L', title: 'Long run', km: km, hardKm: 0, zone: 'Z2', rpe: '3–4',
      desc: km + ' km santai' + paceTxt(paces, 'E') + '. Latih asupan cairan & karbohidrat bila >75 mnt.' };
    if (goalKey === 'marathon' && phase === 'peak') {
      var mKm = Math.min(16, Math.round(km * 0.45));
      w.title = 'Long run + M pace';
      w.hardKm = mKm / 2;
      w.desc = km + ' km: ' + round1(km - mKm) + ' km easy lalu ' + mKm + ' km @ M' + paceTxt(paces, 'M') + '. Gladi resik gel/minum tiap 20–30 mnt (target 60–90 g karbo/jam).';
    } else if (goalKey === 'half' && phase === 'peak' && weekInPhase % 2 === 1) {
      w.title = 'Long run progresif';
      w.hardKm = 3;
      w.desc = km + ' km easy, 3 km terakhir naik ke pace HM' + paceTxt(paces, 'HM') + '.';
    } else if (phase === 'build' && weekInPhase % 2 === 1 && km >= 12) {
      w.title = 'Long run finish kuat';
      w.hardKm = 2;
      w.desc = km + ' km easy, 2 km terakhir @ M/steady. Tetap terkontrol.';
    }
    return w;
  }

  /** Pilih sesi kualitas berdasarkan fase, target lomba, dan slot (Q / Q2). */
  function qualitySession(slot, ctx) {
    var p = ctx.phase, g = ctx.goal, wk = ctx.weekKm, pc = ctx.paces, n = ctx.weekInPhase;
    if (ctx.cutback) {
      return slot === 'Q' ? strides(round1(Math.max(5, wk * 0.12)), pc) : easyRun(round1(Math.max(4, wk * 0.1)), pc);
    }
    if (p === 'base') {
      if (slot === 'Q') return n % 2 === 0 ? strides(round1(Math.max(5, wk * 0.13)), pc) : hills(round1(Math.max(5, wk * 0.13)));
      return n >= 2 ? fartlek(wk) : easyRun(round1(Math.max(4, wk * 0.12)), pc);
    }
    if (p === 'build') {
      if (slot === 'Q') return threshold(wk, pc, n % 3);
      if (g === 'marathon') return n % 2 === 0 ? racePace(g, wk, pc) : intervals(wk, pc, 1000);
      return g === '5k' ? intervals(wk, pc, 800) : intervals(wk, pc, 1000);
    }
    if (p === 'peak') {
      if (g === '5k') return slot === 'Q' ? intervals(wk, pc, n % 2 ? 1000 : 800) : (n % 2 ? reps(wk, pc) : threshold(wk, pc, 0));
      if (g === '10k') return slot === 'Q' ? (n % 2 ? racePace(g, wk, pc) : intervals(wk, pc, 1200)) : threshold(wk, pc, n % 3);
      if (g === 'half') return slot === 'Q' ? racePace(g, wk, pc) : threshold(wk, pc, n % 3);
      if (slot === 'Q') return threshold(wk, pc, n % 3);
      // marathon: kualitas utama ada di long run; Q2 jadi medium-long run aerobik
      var ml = round1(Math.max(8, Math.min(18, wk * 0.2)));
      return Object.assign(easyRun(ml, pc), { title: 'Medium-long run', desc: ml + ' km aerobik' + paceTxt(pc, 'E') + '. Membangun daya tahan tanpa stres long run.' });
    }
    // taper: pertahankan intensitas, kurangi volume
    if (slot === 'Q') {
      var rk = g === 'marathon' || g === 'half' ? 3 : 4;
      var key = g === 'half' ? 'HM' : g === 'marathon' ? 'M' : g === '10k' ? '10K' : '5K';
      return { type: 'Q', title: 'Taper sharpener', km: round1(WU + CD + rk * 1.3), hardKm: rk, zone: 'Spesifik lomba', rpe: '6–7',
        desc: 'Pemanasan ' + WU + ' km. ' + rk + '×1 km @ pace lomba' + paceTxt(pc, key) + ', jog 2 mnt. Volume turun, intensitas tetap (Bosquet 2007).' };
    }
    return strides(round1(Math.max(4, wk * 0.12)), pc);
  }

  /**
   * Buat rencana.
   * opts: { goal, weeks, currentKm, days (3–6), level, vdot, longDay (0=Sen..6=Min), startDate (Senin minggu 1) }
   */
  function generatePlan(opts) {
    var o = Object.assign({ goal: '10k', weeks: 12, currentKm: 20, days: 4, level: 'beginner', vdot: null, longDay: 6 }, opts);
    o.weeks = Math.max(4, Math.min(24, Math.round(o.weeks)));
    o.days = Math.max(3, Math.min(6, Math.round(o.days)));
    var goal = GOALS[o.goal];
    var paces = o.vdot ? S.trainingPaces(o.vdot) : null;
    var curve = volumeCurve(o);
    var shift = ((o.longDay - 6) % 7 + 7) % 7;
    var pattern = PATTERNS[o.days];
    var phaseCount = {};
    var weeks = [];

    curve.vols.forEach(function (v, i) {
      var phase = v.taper ? 'taper' : phaseOf(i, curve.nTrain);
      phaseCount[phase] = (phaseCount[phase] || 0);
      var weekInPhase = phaseCount[phase]++;
      var isRaceWeek = i === curve.vols.length - 1;
      var weekKm = round1(v.km);
      var ctx = { phase: phase, goal: o.goal, weekKm: weekKm, paces: paces, weekInPhase: weekInPhase, cutback: v.cutback };
      var days = [];
      for (var d = 0; d < 7; d++) days.push({ dow: d, type: 'R', title: 'Istirahat', desc: 'Istirahat total atau mobilitas/jalan ringan. Adaptasi terjadi saat pemulihan.', km: 0, hardKm: 0 });

      // Long run
      // HM & marathon butuh long run relatif lebih panjang (tetap dibatasi longCap & ~42% volume)
      var frac = Math.min(0.42, LONG_FRAC[o.days] + (o.goal === 'marathon' ? 0.1 : o.goal === 'half' ? 0.04 : 0));
      var longKm = round1(Math.min(goal.longCap, weekKm * frac));
      if (phase === 'taper') longKm = round1(Math.min(longKm, weekKm * 0.3));
      var slots = Object.keys(pattern).map(Number);
      var used = 0;
      var assigned = {};
      slots.forEach(function (s) {
        var role = pattern[s];
        var dow = (s + shift) % 7;
        var sess;
        if (role === 'L') sess = longRun(longKm, phase, o.goal, paces, weekInPhase);
        else if (role === 'Q' || role === 'Q2') sess = qualitySession(role, ctx);
        else return;
        // sesi kualitas pada program 3 hari: hanya satu, bergantian T / I saat build-peak
        if (o.days === 3 && role === 'Q' && (phase === 'build' || phase === 'peak') && weekInPhase % 2 === 1 && !v.cutback) {
          sess = qualitySession('Q2', ctx);
        }
        assigned[dow] = sess;
        used += sess.km;
      });
      var easySlots = slots.filter(function (s) { return pattern[s] === 'E'; });
      var remaining = Math.max(0, weekKm - used);
      easySlots.forEach(function (s) {
        // easy run tidak boleh menyaingi long run; lebih baik volume sedikit di bawah target
        var km = round1(Math.max(3, Math.min(remaining / easySlots.length, Math.max(longKm * 0.7, 5))));
        assigned[(s + shift) % 7] = (phase === 'base' && s === 0) ? strides(km, paces) : easyRun(km, paces);
      });

      Object.keys(assigned).forEach(function (dow) {
        days[dow] = Object.assign({ dow: Number(dow) }, assigned[dow]);
      });

      if (isRaceWeek) {
        // hari lomba: sesuai tanggal lomba bila diketahui, kalau tidak di hari long run
        var raceDow = o.raceDate ? (new Date(o.raceDate + 'T12:00:00').getDay() + 6) % 7 : (6 + shift) % 7;
        if (raceDow !== (6 + shift) % 7) {
          // long run minggu ini dipindah ke easy pendek; lomba menggantikan sesi di hari lomba
          var lr = (6 + shift) % 7;
          if (days[lr].type === 'L') days[lr] = Object.assign({ dow: lr }, easyRun(round1(Math.max(3, days[lr].km * 0.4)), paces));
        }
        days[raceDow] = { dow: raceDow, type: 'RACE', title: 'HARI LOMBA ' + goal.label, km: Math.round(goal.m / 100) / 10, hardKm: goal.m / 1000,
          desc: 'Pemanasan 10–15 mnt (lebih singkat untuk HM/M). Mulai sedikit konservatif, target even/negative split' + (paces ? ' sekitar ' + S.fmtPace(paces[o.goal === 'half' ? 'HM' : o.goal === 'marathon' ? 'M' : o.goal === '10k' ? '10K' : '5K'].pace) + '/km' : '') + '.' };
        if (raceDow >= 2) days[raceDow - 2] = Object.assign({ dow: raceDow - 2 }, strides(4, paces), { title: 'Shakeout + strides' });
        if (raceDow >= 1) days[raceDow - 1] = { dow: raceDow - 1, type: 'R', title: 'Istirahat / jog 15 mnt', desc: 'Karbohidrat cukup, tidur awal, siapkan perlengkapan.', km: 0, hardKm: 0 };
        days.forEach(function (dd) {
          var gap = raceDow - dd.dow;
          // tidak ada sesi kualitas 3 hari sebelum lomba
          if (dd.type === 'Q' && gap > 0 && gap < 4) Object.assign(dd, easyRun(round1(Math.max(3, dd.km * 0.6)), paces));
          // setelah lomba: pemulihan
          if (gap < 0) Object.assign(dd, { type: 'R', title: 'Pemulihan pasca-lomba', desc: 'Istirahat atau jalan santai. Kembali lari easy setelah nyeri otot reda.', km: 0, hardKm: 0, zone: null, rpe: null });
        });
      }

      var total = days.reduce(function (a, d) { return a + d.km; }, 0);
      var hard = days.reduce(function (a, d) { return a + (d.type === 'RACE' ? 0 : d.hardKm); }, 0);
      var start = o.startDate ? S.addDays(o.startDate, i * 7) : null;
      weeks.push({
        index: i + 1,
        phase: phase,
        cutback: v.cutback,
        targetKm: weekKm,
        totalKm: round1(total),
        hardPct: total > 0 ? Math.round(hard / total * 100) : 0,
        start: start ? S.dayKey(start) : null,
        days: days.map(function (d) { return Object.assign({ date: start ? S.dayKey(S.addDays(start, d.dow)) : null }, d); })
      });
    });

    return {
      createdAt: new Date().toISOString(),
      opts: o,
      peakKm: round1(curve.peakKm),
      weeks: weeks
    };
  }

  /** Senin dari minggu yang berisi tanggal d. */
  function mondayOf(d) {
    var x = new Date(d);
    x.setHours(12, 0, 0, 0);
    var dow = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - dow);
    return x;
  }

  /** Senin minggu pertama agar lomba jatuh di minggu terakhir. */
  function startForRace(raceDate, weeks) {
    return S.addDays(mondayOf(raceDate), -(weeks - 1) * 7);
  }

  var api = {
    GOALS: GOALS,
    DAY_NAMES: DAY_NAMES,
    generatePlan: generatePlan,
    volumeCurve: volumeCurve,
    mondayOf: mondayOf,
    startForRace: startForRace
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Plan = api;
})(this);
