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

  /** Hari lari bawaan (0=Sen..6=Min) untuk jumlah hari & hari long run tertentu. */
  function defaultRunDays(n, longDay) {
    var shift = (((longDay === undefined ? 6 : longDay) - 6) % 7 + 7) % 7;
    return Object.keys(PATTERNS[n]).map(function (k) { return (Number(k) + shift) % 7; }).sort(function (a, b) { return a - b; });
  }

  function cyc(a, b) { var d = Math.abs(a - b); return Math.min(d, 7 - d); }

  /**
   * Bagi peran sesi ke hari lari pilihan pelari.
   * Long run di longDay; 1 sesi kualitas (3 hari lari) atau 2 (≥4 hari) ditempatkan sejauh mungkin
   * dari long run dan dari satu sama lain. Hari sesudah long run dihindari untuk sesi keras
   * (prinsip hard–easy; ≥48 jam antar sesi keras). Minggu dianggap berputar (Min → Sen).
   */
  function dayRoles(runDays, longDay) {
    var days = runDays.slice().sort(function (a, b) { return a - b; });
    var long = days.indexOf(longDay) >= 0 ? longDay : days[days.length - 1];
    var others = days.filter(function (d) { return d !== long; });
    var nQ = days.length >= 4 ? 2 : 1;
    var best = null;
    function cost(qs) {
      var c = 0;
      qs.forEach(function (q) {
        if ((long + 1) % 7 === q) c += 6;      // sehari setelah long run
        else if ((q + 1) % 7 === long) c += 4; // sehari sebelum long run
      });
      if (qs.length === 2 && cyc(qs[0], qs[1]) === 1) c += 10;
      var gaps = qs.reduce(function (a, q) { return a + cyc(q, long); }, 0) + (qs.length === 2 ? cyc(qs[0], qs[1]) : 0);
      return c - 0.1 * gaps;
    }
    for (var i = 0; i < others.length; i++) {
      if (nQ === 1) { var c1 = cost([others[i]]); if (!best || c1 < best.c - 1e-9) best = { c: c1, qs: [others[i]] }; continue; }
      for (var j = i + 1; j < others.length; j++) {
        var c2 = cost([others[i], others[j]]);
        if (!best || c2 < best.c - 1e-9) best = { c: c2, qs: [others[i], others[j]] };
      }
    }
    var roles = {};
    days.forEach(function (d) { roles[d] = 'E'; });
    roles[long] = 'L';
    if (best) { roles[best.qs[0]] = 'Q'; if (best.qs[1] !== undefined) roles[best.qs[1]] = 'Q2'; }
    return roles;
  }

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

  /** Susun 7 hari untuk satu minggu. v: { km, cutback, taper }. */
  function buildWeek(o, i, v, phase, weekInPhase, isRaceWeek) {
    var goal = GOALS[o.goal];
    var paces = o.vdot ? S.trainingPaces(o.vdot) : null;
    var runDays = o.runDays && o.runDays.length >= 3 ? o.runDays : defaultRunDays(o.days, o.longDay);
    var roles = dayRoles(runDays, o.longDay);
    var longDow = Number(Object.keys(roles).find(function (k) { return roles[k] === 'L'; }));
    var nDays = runDays.length;
    var weekKm = round1(v.km);
    var ctx = { phase: phase, goal: o.goal, weekKm: weekKm, paces: paces, weekInPhase: weekInPhase, cutback: v.cutback };
    var days = [];
    for (var d = 0; d < 7; d++) days.push({ dow: d, type: 'R', title: 'Istirahat', desc: 'Istirahat total atau mobilitas/jalan ringan. Adaptasi terjadi saat pemulihan.', km: 0, hardKm: 0 });

    // HM & marathon butuh long run relatif lebih panjang (tetap dibatasi longCap & ~42% volume)
    var frac = Math.min(0.42, LONG_FRAC[nDays] + (o.goal === 'marathon' ? 0.1 : o.goal === 'half' ? 0.04 : 0));
    var longKm = round1(Math.min(goal.longCap, weekKm * frac));
    if (phase === 'taper') longKm = round1(Math.min(longKm, weekKm * 0.3));
    var slots = Object.keys(roles).map(Number);
    var used = 0;
    var assigned = {};
    slots.forEach(function (dow) {
      var role = roles[dow];
      var sess;
      if (role === 'L') sess = longRun(longKm, phase, o.goal, paces, weekInPhase);
      else if (role === 'Q' || role === 'Q2') sess = qualitySession(role, ctx);
      else return;
      // sesi kualitas pada program 3 hari: hanya satu, bergantian T / I saat build-peak
      if (nDays === 3 && role === 'Q' && (phase === 'build' || phase === 'peak') && weekInPhase % 2 === 1 && !v.cutback) {
        sess = qualitySession('Q2', ctx);
      }
      assigned[dow] = sess;
      used += sess.km;
    });
    var easySlots = slots.filter(function (d) { return roles[d] === 'E'; });
    var remaining = Math.max(0, weekKm - used);
    easySlots.forEach(function (d, k) {
      // easy run tidak boleh menyaingi long run; lebih baik volume sedikit di bawah target
      var km = round1(Math.max(3, Math.min(remaining / easySlots.length, Math.max(longKm * 0.7, 5))));
      assigned[d] = (phase === 'base' && k === 0 && easySlots.length >= 2) ? strides(km, paces) : easyRun(km, paces);
    });

    Object.keys(assigned).forEach(function (dow) {
      days[dow] = Object.assign({ dow: Number(dow) }, assigned[dow]);
    });

    if (isRaceWeek) {
      // hari lomba: sesuai tanggal lomba bila diketahui, kalau tidak di hari long run
      var raceDow = o.raceDate ? (new Date(o.raceDate + 'T12:00:00').getDay() + 6) % 7 : longDow;
      if (raceDow !== longDow) {
        // long run minggu ini dipindah ke easy pendek; lomba menggantikan sesi di hari lomba
        var lr = longDow;
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

    // volume kecil (mis. setelah penyesuaian turun): sesi minimum bisa melebihi target jauh.
    // Hapus easy run terpendek (bukan kualitas/long) selama total >120% target, minimal 3 hari lari.
    var sumKm = function () { return days.reduce(function (a, d) { return a + d.km; }, 0); };
    while (!isRaceWeek && sumKm() > weekKm * 1.2) {
      var runs = days.filter(function (d) { return d.km > 0; });
      var easies = runs.filter(function (d) { return d.type === 'E'; }).sort(function (x, y) { return x.km - y.km; });
      if (runs.length <= 3 || !easies.length) break;
      var drop = easies[0];
      days[drop.dow] = { dow: drop.dow, type: 'R', title: 'Istirahat', desc: 'Hari lari diganti istirahat karena volume minggu ini diturunkan.', km: 0, hardKm: 0 };
    }

    var total = sumKm();
    var hard = days.reduce(function (a, d) { return a + (d.type === 'RACE' ? 0 : d.hardKm); }, 0);
    var start = o.startDate ? S.addDays(o.startDate, i * 7) : null;
    return {
      index: i + 1,
      phase: phase,
      weekInPhase: weekInPhase,
      cutback: v.cutback,
      targetKm: weekKm,
      totalKm: round1(total),
      hardPct: total > 0 ? Math.round(hard / total * 100) : 0,
      start: start ? S.dayKey(start) : null,
      days: days.map(function (d) { return Object.assign({ date: start ? S.dayKey(S.addDays(start, d.dow)) : null }, d); })
    };
  }

  /**
   * Buat rencana.
   * opts: { goal, weeks, currentKm, days (3–6), level, vdot, longDay (0=Sen..6=Min), startDate (Senin minggu 1), raceDate }
   */
  function generatePlan(opts) {
    var o = Object.assign({ goal: '10k', weeks: 12, currentKm: 20, days: 4, level: 'beginner', vdot: null, longDay: 6 }, opts);
    o.weeks = Math.max(4, Math.min(24, Math.round(o.weeks)));
    if (o.runDays && o.runDays.length) {
      // hari lari pilihan pelari menentukan jumlah hari; long run harus salah satunya
      o.runDays = o.runDays.map(Number).filter(function (d, i, a) { return d >= 0 && d <= 6 && a.indexOf(d) === i; }).sort(function (a, b) { return a - b; }).slice(0, 6);
      if (o.runDays.length < 3) o.runDays = null;
    }
    if (o.runDays) {
      o.days = o.runDays.length;
      if (o.runDays.indexOf(o.longDay) < 0) o.longDay = o.runDays[o.runDays.length - 1];
    }
    o.days = Math.max(3, Math.min(6, Math.round(o.days)));
    var curve = volumeCurve(o);
    var phaseCount = {};
    var weeks = curve.vols.map(function (v, i) {
      var phase = v.taper ? 'taper' : phaseOf(i, curve.nTrain);
      phaseCount[phase] = phaseCount[phase] || 0;
      return buildWeek(o, i, v, phase, phaseCount[phase]++, i === curve.vols.length - 1);
    });
    return {
      createdAt: new Date().toISOString(),
      opts: o,
      peakKm: round1(curve.peakKm),
      weeks: weeks,
      reviews: {},
      adaptations: []
    };
  }

  /**
   * Rencana adaptif: susun ulang minggu ke-`fromIdx` (0-based) dan seterusnya.
   * Minggu yang sudah lewat tidak disentuh. Fase & minggu ringan dipertahankan;
   * volume dihitung ulang dari `startKm` (volume minggu `fromIdx`) dengan progresi ≤10%/minggu
   * menuju puncak semula, lalu taper proporsional dari puncak baru.
   * changes: { startKm?, vdot? }
   */
  function adaptPlan(plan, fromIdx, changes) {
    var o = Object.assign({}, plan.opts);
    if (changes.vdot) o.vdot = changes.vdot;
    if (changes.runDays) {
      o.runDays = changes.runDays.slice().sort(function (a, b) { return a - b; });
      o.days = o.runDays.length;
      o.longDay = changes.longDay !== undefined && o.runDays.indexOf(changes.longDay) >= 0 ? changes.longDay
        : o.runDays.indexOf(o.longDay) >= 0 ? o.longDay : o.runDays[o.runDays.length - 1];
    }
    if (o.startDate && !(o.startDate instanceof Date)) o.startDate = new Date(o.startDate + 'T12:00:00');
    var goal = GOALS[o.goal];
    var target = Math.max(Math.max(10, o.currentKm), goal.peak[o.level]);
    var weeks = plan.weeks.slice(0, fromIdx);
    var rest = plan.weeks.slice(fromIdx);
    var taperIdx = rest.map(function (w) { return w.phase; }).indexOf('taper');
    var running = changes.startKm !== undefined ? changes.startKm : (rest[0] ? rest[0].targetKm : 0);
    var first = true;
    var lastBuild = fromIdx > 0 ? plan.weeks[fromIdx - 1].targetKm : running;
    var taperN = rest.filter(function (w) { return w.phase === 'taper'; }).length;
    var factors = TAPER_FACTORS[Math.min(3, Math.max(1, plan.weeks.filter(function (w) { return w.phase === 'taper'; }).length))];
    var taperOffset = factors.length - taperN; // taper yang sudah berjalan sebagian
    var peak = null;

    rest.forEach(function (w, k) {
      var i = fromIdx + k;
      var v;
      if (w.phase === 'taper') {
        if (peak === null) {
          // puncak = minggu non-taper terakhir (yang sudah lewat atau baru disusun)
          var prev = weeks.slice().reverse().find(function (x) { return x.phase !== 'taper' && !x.cutback; });
          peak = prev ? prev.targetKm : running;
          if (first && changes.startKm !== undefined) peak = Math.min(peak, changes.startKm / factors[taperOffset]);
        }
        v = { km: peak * factors[taperOffset + (k - taperIdx)], cutback: false, taper: true };
      } else if (w.cutback) {
        v = { km: (first ? running : lastBuild) * (first ? 1 : 0.8), cutback: true };
      } else {
        if (!first) running = Math.min(target, lastBuild * 1.1);
        lastBuild = running;
        v = { km: running, cutback: false };
      }
      if (!w.cutback && w.phase !== 'taper') lastBuild = v.km;
      first = false;
      weeks.push(buildWeek(o, i, v, w.phase, w.weekInPhase || 0, i === plan.weeks.length - 1));
    });

    var o2 = Object.assign({}, plan.opts, { vdot: o.vdot, runDays: o.runDays || plan.opts.runDays, days: o.days, longDay: o.longDay });
    var peakKm = Math.max.apply(null, weeks.map(function (w) { return w.phase === 'taper' ? 0 : w.targetKm; }));
    return Object.assign({}, plan, { opts: o2, weeks: weeks, peakKm: round1(peakKm) });
  }

  /** Hari lari yang dipakai rencana (pilihan pelari atau pola bawaan). */
  function planRunDays(opts) {
    return opts.runDays && opts.runDays.length >= 3 ? opts.runDays.slice().sort(function (a, b) { return a - b; }) : defaultRunDays(opts.days, opts.longDay);
  }

  /**
   * Hari yang benar-benar dipakai lari dalam satu minggu (dari log), untuk diadopsi minggu berikutnya.
   * - Lari < 3 hari: tidak cukup sebagai pola (minggu sakit/sibuk) → null.
   * - Lari 7 hari: buang hari dengan lari terpendek; minimal 1 hari istirahat tetap dijaga.
   * - Hari long run = hari lari terpanjang (atau yang ditandai long run).
   */
  function actualRunDays(week, logs) {
    var a = week.days[0].date, b = week.days[6].date;
    var perDay = {};
    (logs || []).forEach(function (l) {
      if (l.date < a || l.date > b || l.type === 'X' || !(Number(l.km) > 0)) return;
      var dow = (new Date(l.date + 'T12:00:00').getDay() + 6) % 7;
      var e = perDay[dow] = perDay[dow] || { km: 0, long: false };
      e.km += Number(l.km);
      if (l.type === 'L') e.long = true;
    });
    var days = Object.keys(perDay).map(Number);
    if (days.length < 3) return null;
    while (days.length > 6) {
      days.sort(function (x, y) { return perDay[x].km - perDay[y].km; });
      days.shift();
    }
    days.sort(function (x, y) { return x - y; });
    var marked = days.filter(function (d) { return perDay[d].long; });
    var longDay = (marked.length ? marked : days).reduce(function (m, d) { return perDay[d].km > perDay[m].km ? d : m; }, (marked.length ? marked : days)[0]);
    return { runDays: days, longDay: longDay };
  }

  // ---------- Jadwal minggu berjalan mengikuti log ----------

  var DROP_COST = { L: 100, Q: 40, Q2: 30, E: 3 };
  var ADJ_HARD = 45;  // dua hari keras berturut-turut yang tidak ada di rencana awal (lebih mahal dari membuang 1 sesi kualitas)
  var MOVE_COST = 2;

  function logRole(l, longKm) {
    if (l.type === 'RACE') return 'RACE';
    if (l.type === 'L' || (Number(l.km) >= Math.max(10, (longKm || 0) * 0.8))) return 'L';
    if (l.type === 'Q' || Number(l.rpe) >= 7) return 'Q';
    return 'E';
  }

  function dayDiff(a, b) { return Math.round((new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / 86400000); }
  function nextDay(k) { return S.dayKey(S.addDays(new Date(k + 'T12:00:00'), 1)); }

  /**
   * Cocokkan log dengan jadwal satu minggu lalu susun ulang hari yang tersisa.
   * - Log dicocokkan ke sesi terencana: hari & jenis sama → jenis sama terdekat → hari sama → "lari tambahan".
   *   Sesi yang dilakukan di hari lain ditampilkan di hari dilakukannya.
   * - Sesi yang tergeser (harinya dipakai sesi lain), sesi yang belum lewat, serta long run & sesi kualitas
   *   yang terlewat masuk ke "kolam" untuk dijadwalkan ulang. Easy yang terlewat dibiarkan (jangan ditumpuk).
   * - Kolam ditempatkan ke hari lari yang masih kosong (hari ini dan sesudahnya) lewat pencarian menyeluruh
   *   yang meminimalkan: sesi dibuang (L > Q > Q2 > E), dua hari keras berturut-turut yang baru
   *   (≥48 jam antar sesi keras), dan perpindahan dari jadwal semula.
   * - Minggu lomba tidak disusun ulang (hanya status).
   * Murni: tidak mengubah `week`; mengembalikan { days, notes, changed }.
   */
  function reconcileWeek(week, logs, todayKey) {
    var a = week.days[0].date, b = week.days[6].date;
    var wl = (logs || []).filter(function (l) { return l.date >= a && l.date <= b && l.type !== 'X'; })
      .slice().sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : 0; });
    var planned = week.days.filter(function (d) { return d.type !== 'R'; }).map(function (d) { return Object.assign({}, d); });
    var qSeen = 0;
    planned.forEach(function (d) { d.role = d.type === 'Q' ? (qSeen++ ? 'Q2' : 'Q') : d.type; });
    var longKm = (planned.find(function (d) { return d.type === 'L'; }) || {}).km || 0;
    var hasRace = planned.some(function (d) { return d.type === 'RACE'; });
    var notes = [];

    // 1) cocokkan log
    var matched = [];   // { p, l }
    var extras = [];
    var taken = {};
    function pick(l, cands) {
      cands.sort(function (x, y) { return Math.abs(dayDiff(x.date, l.date)) - Math.abs(dayDiff(y.date, l.date)) || (x.date < y.date ? 1 : -1); });
      return cands[0] || null;
    }
    wl.forEach(function (l) {
      var r = logRole(l, longKm);
      var free = planned.filter(function (d) { return !taken[d.date]; });
      var same = free.find(function (d) { return d.date === l.date; });
      // lintas hari hanya bila jenisnya sama dan selisih ≤2 hari; selebihnya dianggap lari tambahan
      var near = free.filter(function (d) { return d.type === r && Math.abs(dayDiff(d.date, l.date)) <= 2; });
      var t = same && same.type === r ? same : pick(l, near) || same || null;
      if (t) { taken[t.date] = true; matched.push({ p: t, l: l }); } else extras.push(l);
    });
    var loggedOn = {};
    wl.forEach(function (l) { (loggedOn[l.date] = loggedOn[l.date] || []).push(l); });
    var doneByDate = {};
    matched.forEach(function (m) { doneByDate[m.l.date] = doneByDate[m.l.date] || m; });

    // 2) kolam sesi yang perlu tempat
    var pool = [];
    planned.forEach(function (p) {
      if (taken[p.date]) return;
      var displaced = !!loggedOn[p.date];      // harinya terpakai sesi lain
      if (p.date >= todayKey && !displaced) pool.push(p);
      else if (displaced || p.role !== 'E') pool.push(Object.assign(p, { overdue: p.date < todayKey || displaced }));
      else notes.push('Easy ' + dayLabel(p.date) + ' terlewat. Tidak perlu diganti; jangan ditumpuk ke hari lain.');
    });

    // 3) slot: hari lari terencana mulai hari ini yang belum ada lognya
    var slots = planned.filter(function (p) { return p.date >= todayKey && !loggedOn[p.date]; }).map(function (p) { return p.date; });
    var baseHard = {};
    planned.forEach(function (p) { if (p.role !== 'E') baseHard[p.date] = true; });
    var hardLogged = {};
    wl.forEach(function (l) { if (logRole(l, longKm) !== 'E') hardLogged[l.date] = 'log'; });

    var bySlot = {};
    if (hasRace) {
      pool.forEach(function (p) { if (slots.indexOf(p.date) >= 0 && !p.overdue) bySlot[p.date] = p; });
    } else if (pool.length && slots.length) {
      var best = { cost: Infinity, plan: null };
      var assign = new Array(slots.length).fill(null);
      var used = new Array(pool.length).fill(false);
      var evaluate = function () {
        var cost = 0, hard = Object.assign({}, hardLogged), placed = {};
        for (var i = 0; i < slots.length; i++) {
          var k = assign[i];
          if (k === null) continue;
          placed[k] = true;
          if (pool[k].date !== slots[i]) cost += MOVE_COST;
          if (pool[k].role !== 'E') hard[slots[i]] = 'new';
        }
        pool.forEach(function (p, k) { if (!placed[k]) cost += DROP_COST[p.role] || 3; });
        Object.keys(hard).forEach(function (dt) {
          var nx = nextDay(dt);
          if (!hard[nx] || (hard[dt] !== 'new' && hard[nx] !== 'new')) return;
          if (baseHard[dt] && baseHard[nx]) return; // pasangan yang memang ada di rencana awal
          cost += ADJ_HARD;
        });
        return cost;
      };
      (function dfs(i) {
        if (i === slots.length) {
          var c = evaluate();
          if (c < best.cost - 1e-9) best = { cost: c, plan: assign.slice() };
          return;
        }
        for (var k = 0; k < pool.length; k++) {
          if (used[k]) continue;
          used[k] = true; assign[i] = k; dfs(i + 1); used[k] = false;
        }
        assign[i] = null; dfs(i + 1);
      })(0);
      best.plan.forEach(function (k, i) { if (k !== null) bySlot[slots[i]] = pool[k]; });
    }
    var placedAt = {};
    Object.keys(bySlot).forEach(function (dt) { placedAt[bySlot[dt].date] = dt; });

    // 4) susun tampilan 7 hari
    var days = week.days.map(function (orig) {
      var dt = orig.date, base = { dow: orig.dow, date: dt };
      var m = doneByDate[dt];
      if (m) return Object.assign({}, m.p, base, { status: 'done', log: m.l, movedFrom: m.p.date !== dt ? m.p.date : null });
      if (loggedOn[dt]) {
        var l = loggedOn[dt][0];
        return Object.assign(base, { type: 'X', role: null, title: 'Lari tambahan', km: Number(l.km) || 0, hardKm: 0, status: 'extra', log: l, desc: 'Lari di luar jadwal. Sudah dihitung dalam beban mingguan.' });
      }
      if (slots.indexOf(dt) >= 0) {
        var p = bySlot[dt];
        if (p) return Object.assign({}, p, base, { status: 'pending', movedFrom: p.date !== dt ? p.date : null });
        return Object.assign(base, { type: 'R', role: null, title: 'Kosong (opsional)', km: 0, hardKm: 0, status: 'freed',
          desc: 'Sesi hari ini sudah dilakukan di hari lain atau dibatalkan agar tidak menumpuk. Istirahat, atau easy 20–30 mnt bila tubuh segar.' });
      }
      if (orig.type === 'R') return Object.assign({}, orig, { status: 'rest' });
      var pm = matched.find(function (x) { return x.p.date === dt; });
      if (pm) return Object.assign({}, orig, { status: 'elsewhere', doneOn: pm.l.date });
      if (placedAt[dt]) return Object.assign({}, orig, { status: 'rescheduled', movedTo: placedAt[dt] });
      return Object.assign({}, orig, { status: 'missed' });
    });

    // 5) catatan
    matched.forEach(function (m) {
      if (m.l.date !== m.p.date) notes.push(m.p.title + ' sudah Anda lakukan ' + dayLabel(m.l.date) + ' (jadwal semula ' + dayLabel(m.p.date) + ').');
    });
    extras.forEach(function (l) { notes.push('Lari tambahan ' + dayLabel(l.date) + ' (' + Math.round(l.km * 10) / 10 + ' km) tercatat di luar jadwal.'); });
    pool.forEach(function (p) {
      var to = placedAt[p.date];
      if (to && to !== p.date) notes.push(p.title + ' dipindah dari ' + dayLabel(p.date) + ' ke ' + dayLabel(to) + '.');
      else if (!to && !hasRace) {
        if (p.role === 'E') notes.push('Easy ' + dayLabel(p.date) + ' ditiadakan: harinya sudah terpakai sesi lain dan tidak ada hari kosong tersisa.');
        else notes.push(p.title + ' (' + dayLabel(p.date) + ') dibatalkan minggu ini: tidak ada hari tersisa yang cukup jauh dari sesi keras lain. Lebih baik melewatkannya daripada menumpuk.');
      }
    });
    return { days: days, notes: notes, changed: notes.length > 0 };
  }

  var DAY_LONG = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  function dayLabel(key) { return DAY_LONG[(new Date(key + 'T12:00:00').getDay() + 6) % 7]; }

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
    adaptPlan: adaptPlan,
    dayRoles: dayRoles,
    defaultRunDays: defaultRunDays,
    reconcileWeek: reconcileWeek,
    actualRunDays: actualRunDays,
    planRunDays: planRunDays,
    buildWeek: buildWeek,
    volumeCurve: volumeCurve,
    mondayOf: mondayOf,
    startForRace: startForRace
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Plan = api;
})(this);
