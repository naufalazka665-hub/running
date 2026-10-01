/*
 * science.js — rumus fisiologi & beban latihan.
 * Semua fungsi murni (tanpa DOM) supaya bisa diuji di Node.
 *
 * Sumber utama:
 * - Daniels & Gilbert (1979) Oxygen Power; Daniels (2014) Daniels' Running Formula, 3rd ed.
 * - Riegel (1981) Athletic records and human endurance. American Scientist 69:285-290.
 * - Tanaka, Monahan & Seals (2001) Age-predicted maximal heart rate revisited. JACC 37:153-156.
 * - Karvonen, Kentala & Mustala (1957) Ann Med Exp Biol Fenn 35:307-315.
 * - Foster et al. (2001) A new approach to monitoring exercise training. JSCR 15:109-115.
 * - Foster (1998) Monitoring training in athletes with reference to overtraining syndrome. MSSE 30:1164-1168.
 */
(function (root) {
  'use strict';

  var DISTANCES = {
    '1500': { m: 1500, label: '1500 m' },
    mile: { m: 1609.34, label: '1 mil' },
    '3k': { m: 3000, label: '3 km' },
    '5k': { m: 5000, label: '5K' },
    '10k': { m: 10000, label: '10K' },
    '15k': { m: 15000, label: '15K' },
    half: { m: 21097.5, label: 'Half marathon' },
    marathon: { m: 42195, label: 'Marathon' }
  };

  // ---------- Waktu & pace ----------

  /** "mm:ss", "h:mm:ss" atau angka menit -> detik. Null bila tidak valid. */
  function parseTime(str) {
    if (str === null || str === undefined) return null;
    var s = String(str).trim();
    if (!s) return null;
    if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s) * 60);
    var parts = s.split(':');
    if (parts.length < 2 || parts.length > 3) return null;
    var nums = parts.map(Number);
    if (nums.some(function (n) { return !isFinite(n) || n < 0; })) return null;
    if (parts.length === 2) return nums[0] * 60 + nums[1];
    return nums[0] * 3600 + nums[1] * 60 + nums[2];
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** detik -> "h:mm:ss" atau "m:ss" */
  function fmtTime(sec) {
    if (!isFinite(sec)) return '–';
    sec = Math.round(sec);
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
  }

  /** detik per km -> "m:ss" */
  function fmtPace(secPerKm) {
    if (!isFinite(secPerKm) || secPerKm <= 0) return '–';
    var s = Math.round(secPerKm);
    return Math.floor(s / 60) + ':' + pad(s % 60);
  }

  // ---------- VDOT (Daniels & Gilbert) ----------

  /** Biaya oksigen (ml/kg/menit) pada kecepatan v (m/menit). */
  function vo2Cost(v) {
    return -4.60 + 0.182258 * v + 0.000104 * v * v;
  }

  /** Fraksi VO2max yang bisa dipertahankan selama t menit. */
  function fractionSustained(tMin) {
    return 0.8 + 0.1894393 * Math.exp(-0.012778 * tMin) + 0.2989558 * Math.exp(-0.1932605 * tMin);
  }

  /** VDOT dari hasil lomba: jarak (m), waktu (detik). */
  function vdot(distM, sec) {
    if (!(distM > 0) || !(sec > 0)) return null;
    var tMin = sec / 60;
    var v = distM / tMin;
    return vo2Cost(v) / fractionSustained(tMin);
  }

  /** Kecepatan (m/menit) yang biaya oksigennya = vo2. */
  function velocityAtVO2(vo2) {
    var a = 0.000104, b = 0.182258, c = -4.60 - vo2;
    return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  }

  /** Prediksi waktu lomba (detik) untuk VDOT tertentu, via bisection. */
  function predictTime(vd, distM) {
    var lo = distM / 1000 * 120;   // 2:00/km, lebih cepat dari rekor dunia
    var hi = distM / 1000 * 1200;  // 20:00/km
    for (var i = 0; i < 80; i++) {
      var mid = (lo + hi) / 2;
      // VDOT naik bila waktu lebih cepat
      if (vdot(distM, mid) > vd) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  function paceAtFraction(vd, frac) {
    var v = velocityAtVO2(vd * frac); // m/menit
    return 60000 / v;                 // detik per km
  }

  /**
   * Zona pace latihan ala Daniels.
   * E: 59–74% VO2max, M: pace marathon prediksi, T: ~88%,
   * I: ~97,5% (mendekati vVO2max), R: pace lomba ~1 mil.
   */
  function trainingPaces(vd) {
    if (!(vd > 0)) return null;
    return {
      E: { slow: paceAtFraction(vd, 0.62), fast: paceAtFraction(vd, 0.70) },
      M: { pace: predictTime(vd, 42195) / 42.195 },
      T: { pace: paceAtFraction(vd, 0.88) },
      I: { pace: paceAtFraction(vd, 0.975) },
      R: { pace: predictTime(vd, 1609.34) / 1.60934 },
      HM: { pace: predictTime(vd, 21097.5) / 21.0975 },
      '10K': { pace: predictTime(vd, 10000) / 10 },
      '5K': { pace: predictTime(vd, 5000) / 5 }
    };
  }

  /** Rumus Riegel: T2 = T1 * (D2/D1)^k, k default 1,06. */
  function riegel(t1, d1, d2, k) {
    return t1 * Math.pow(d2 / d1, k || 1.06);
  }

  // ---------- Denyut jantung ----------

  /** HRmax prediksi Tanaka (2001): 208 − 0,7 × usia. SD ±~10 bpm. */
  function hrMaxTanaka(age) {
    return Math.round(208 - 0.7 * age);
  }

  /**
   * Zona HR metode Karvonen (heart-rate reserve).
   * Dipetakan ke model 3 zona Seiler (Z1 < VT1, Z2 VT1–VT2, Z3 > VT2).
   */
  function hrZones(hrMax, hrRest) {
    var bands = [
      { z: 1, name: 'Pemulihan', lo: 0.50, hi: 0.60, seiler: 1, daniels: 'Recovery' },
      { z: 2, name: 'Aerobik mudah', lo: 0.60, hi: 0.70, seiler: 1, daniels: 'E' },
      { z: 3, name: 'Steady / Marathon', lo: 0.70, hi: 0.80, seiler: 1, daniels: 'M' },
      { z: 4, name: 'Threshold', lo: 0.80, hi: 0.90, seiler: 2, daniels: 'T' },
      { z: 5, name: 'VO2max', lo: 0.90, hi: 1.00, seiler: 3, daniels: 'I / R' }
    ];
    var reserve = hrMax - hrRest;
    return bands.map(function (b) {
      return Object.assign({}, b, {
        bpmLo: Math.round(hrRest + reserve * b.lo),
        bpmHi: Math.round(hrRest + reserve * b.hi)
      });
    });
  }

  // ---------- Beban latihan ----------

  /** Session-RPE load (Foster 2001): durasi (menit) × RPE (skala CR-10). Satuan: AU. */
  function sessionLoad(minutes, rpe) {
    return Math.round((Number(minutes) || 0) * (Number(rpe) || 0));
  }

  function dayKey(d) {
    var x = new Date(d);
    return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
  }

  function addDays(d, n) {
    var x = new Date(d);
    x.setHours(12, 0, 0, 0);
    x.setDate(x.getDate() + n);
    return x;
  }

  /** Array beban harian untuk `days` hari terakhir sampai `endDate` (inklusif). */
  function dailyLoads(logs, endDate, days) {
    var map = {};
    (logs || []).forEach(function (l) {
      var k = l.date;
      map[k] = (map[k] || 0) + sessionLoad(l.minutes, l.rpe);
    });
    var out = [];
    for (var i = days - 1; i >= 0; i--) {
      var k = dayKey(addDays(endDate, -i));
      out.push({ date: k, load: map[k] || 0 });
    }
    return out;
  }

  function sum(arr) { return arr.reduce(function (a, b) { return a + b; }, 0); }

  function mean(arr) { return arr.length ? sum(arr) / arr.length : 0; }

  function sd(arr) {
    if (arr.length < 2) return 0;
    var m = mean(arr);
    return Math.sqrt(sum(arr.map(function (x) { return (x - m) * (x - m); })) / arr.length);
  }

  /**
   * Monotony & strain mingguan (Foster 1998).
   * monotony = rata-rata beban harian / SD; strain = total beban minggu × monotony.
   */
  function monotonyStrain(loads7) {
    var vals = loads7.map(function (d) { return d.load; });
    var s = sd(vals);
    var total = sum(vals);
    var mono = s > 0 ? mean(vals) / s : (total > 0 ? Infinity : 0);
    return { weekly: total, monotony: mono, strain: isFinite(mono) ? total * mono : Infinity };
  }

  /**
   * Rasio beban akut:kronis (rolling average, 7 vs 28 hari).
   * Dipakai sebagai indikator perubahan beban, BUKAN prediktor cedera (lihat Impellizzeri et al. 2020).
   */
  function acwr(logs, endDate) {
    var loads = dailyLoads(logs, endDate, 28).map(function (d) { return d.load; });
    var acute = sum(loads.slice(21)) / 7;
    var chronic = sum(loads) / 28;
    return { acute: acute * 7, chronic: chronic * 7, ratio: chronic > 0 ? acute / chronic : null };
  }

  var api = {
    DISTANCES: DISTANCES,
    parseTime: parseTime,
    fmtTime: fmtTime,
    fmtPace: fmtPace,
    vo2Cost: vo2Cost,
    fractionSustained: fractionSustained,
    vdot: vdot,
    velocityAtVO2: velocityAtVO2,
    predictTime: predictTime,
    trainingPaces: trainingPaces,
    riegel: riegel,
    hrMaxTanaka: hrMaxTanaka,
    hrZones: hrZones,
    sessionLoad: sessionLoad,
    dailyLoads: dailyLoads,
    monotonyStrain: monotonyStrain,
    acwr: acwr,
    dayKey: dayKey,
    addDays: addDays,
    sum: sum,
    mean: mean
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Science = api;
})(this);
