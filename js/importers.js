/*
 * importers.js — ubah aktivitas dari Strava (API / CSV ekspor) dan Garmin Connect (CSV)
 * serta file GPX/TCX menjadi entri log Lintasan. Fungsi murni, tanpa DOM, agar bisa diuji di Node.
 *
 * Entri log: { id, date, type, km, minutes, seconds, rpe, rpeEst, hr, notes, source, extId }
 * - rpeEst = true bila RPE ditaksir (dari HR atau pace), bukan diisi pelari. Pelari bisa mengoreksinya.
 */
(function (root) {
  'use strict';

  var S = (typeof module !== 'undefined' && module.exports) ? require('./science.js') : root.Science;

  var RUN_TYPES = /^(run|trailrun|virtualrun|running|treadmill running|trail running|track running|indoor running|street running|virtual run|lari|lari treadmill|lari trail|lari lintasan|lari dalam ruangan|ultra run|ultra running)$/i;

  function isRun(type) { return RUN_TYPES.test(String(type || '').trim()); }

  // ---------- CSV ----------

  /** Parser CSV sederhana yang mendukung tanda kutip & koma di dalam kutip. */
  function parseCSV(text) {
    var rows = [], row = [], cell = '', q = false;
    text = String(text || '').replace(/^﻿/, '');
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
        } else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x.trim() !== ''; }); });
  }

  /** "1,234.5" atau "12.3" -> angka. Garmin memakai koma ribuan. */
  function toNum(s) {
    if (s === null || s === undefined) return NaN;
    var t = String(s).trim().replace(/"/g, '');
    if (!t || t === '--') return NaN;
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
    else if (/^\d+,\d+$/.test(t)) t = t.replace(',', '.'); // desimal koma (locale Indonesia/Eropa)
    return parseFloat(t);
  }

  /** "01:02:03", "45:12", "45:12.4" -> detik. */
  function hmsToSec(s) {
    var t = String(s || '').trim();
    if (!t || t === '--') return NaN;
    var parts = t.split(':').map(parseFloat);
    if (parts.some(isNaN)) return NaN;
    return parts.reduce(function (acc, p) { return acc * 60 + p; }, 0);
  }

  function localDayKey(d) { return S.dayKey(d); }

  function col(header, patterns) {
    for (var p = 0; p < patterns.length; p++) {
      for (var i = 0; i < header.length; i++) if (patterns[p].test(header[i].trim())) return i;
    }
    return -1;
  }

  /**
   * CSV daftar aktivitas Garmin Connect (Activities → Export CSV).
   * Kolom yang dipakai: Activity Type, Date, Title, Distance (km), Time / Moving Time, Avg HR.
   * Catatan: jarak mengikuti satuan akun Garmin; bila akun memakai mil, set opts.miles = true.
   */
  function fromGarminCsv(text, opts) {
    var rows = parseCSV(text);
    if (rows.length < 2) return [];
    var h = rows[0];
    var cType = col(h, [/^activity type$/i, /^jenis aktivitas$/i, /^tipe aktivitas$/i]);
    var cDate = col(h, [/^date$/i, /^tanggal$/i]);
    var cTitle = col(h, [/^title$/i, /^judul$/i]);
    var cDist = col(h, [/^distance$/i, /^jarak$/i]);
    var cTime = col(h, [/^moving time$/i, /^waktu bergerak$/i, /^time$/i, /^waktu$/i, /^elapsed time$/i]);
    var cHr = col(h, [/^avg hr$/i, /^hr rata-rata$/i, /^average heart rate$/i]);
    if (cDate < 0 || cDist < 0 || cTime < 0) throw new Error('Kolom Garmin (Date, Distance, Time) tidak ditemukan.');
    var factor = opts && opts.miles ? 1.60934 : 1;
    return rows.slice(1).map(function (r) {
      var d = new Date(String(r[cDate]).replace(' ', 'T'));
      return {
        type: cType >= 0 ? r[cType] : 'Running',
        date: isNaN(d) ? null : localDayKey(d),
        km: toNum(r[cDist]) * factor,
        seconds: hmsToSec(r[cTime]),
        hr: cHr >= 0 ? toNum(r[cHr]) : NaN,
        title: cTitle >= 0 ? r[cTitle] : '',
        race: false,
        workout: null,
        extId: 'garmin:' + (isNaN(d) ? '' : d.toISOString()) + ':' + (r[cDist] || ''),
        source: 'garmin'
      };
    });
  }

  /**
   * activities.csv dari ekspor akun Strava (Settings → My Account → Download or Delete Your Account).
   * Kolom "Distance" pertama dalam km, "Elapsed Time"/"Moving Time" dalam detik, tanggal dalam UTC.
   */
  function fromStravaCsv(text) {
    var rows = parseCSV(text);
    if (rows.length < 2) return [];
    var h = rows[0];
    var cId = col(h, [/^activity id$/i]);
    var cDate = col(h, [/^activity date$/i]);
    var cName = col(h, [/^activity name$/i]);
    var cType = col(h, [/^activity type$/i]);
    var cDist = col(h, [/^distance$/i]);
    var cMove = col(h, [/^moving time$/i]);
    var cElap = col(h, [/^elapsed time$/i]);
    var cHr = col(h, [/^average heart rate$/i]);
    if (cDate < 0 || cDist < 0 || (cMove < 0 && cElap < 0)) throw new Error('Kolom Strava (Activity Date, Distance, Elapsed Time) tidak ditemukan.');
    return rows.slice(1).map(function (r) {
      var d = new Date(r[cDate] + ' UTC');
      var sec = cMove >= 0 ? toNum(r[cMove]) : NaN;
      if (!(sec > 0)) sec = toNum(r[cElap]);
      return {
        type: cType >= 0 ? r[cType] : 'Run',
        date: isNaN(d) ? null : localDayKey(d),
        km: toNum(r[cDist]),
        seconds: sec,
        hr: cHr >= 0 ? toNum(r[cHr]) : NaN,
        title: cName >= 0 ? r[cName] : '',
        race: false,
        workout: null,
        extId: 'strava:' + (cId >= 0 ? r[cId] : r[cDate]),
        source: 'strava'
      };
    });
  }

  /**
   * Objek SummaryActivity dari Strava API v3 (/athlete/activities).
   * workout_type lari: 0 default, 1 race, 2 long run, 3 workout.
   */
  function fromStravaApi(a) {
    var d = new Date(a.start_date_local ? a.start_date_local.replace('Z', '') : a.start_date);
    return {
      type: a.sport_type || a.type,
      date: isNaN(d) ? null : localDayKey(d),
      km: (a.distance || 0) / 1000,
      seconds: a.workout_type === 1 ? a.elapsed_time : (a.moving_time || a.elapsed_time),
      hr: a.has_heartrate ? a.average_heartrate : NaN,
      title: a.name || '',
      race: a.workout_type === 1,
      workout: a.workout_type === 2 ? 'L' : a.workout_type === 3 ? 'Q' : null,
      extId: 'strava:' + a.id,
      source: 'strava'
    };
  }

  // ---------- GPX / TCX ----------

  function haversine(a, b) {
    var R = 6371000, toR = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  /** GPX (ekspor Garmin/Strava/jam lain): jarak dari titik GPS, durasi dari waktu awal-akhir. */
  function fromGpx(text, name) {
    var pts = [];
    var re = /<trkpt\b[^>]*?lat="([-\d.]+)"[^>]*?lon="([-\d.]+)"[^>]*>([\s\S]*?)<\/trkpt>/g, m;
    while ((m = re.exec(text))) {
      var t = /<time>([^<]+)<\/time>/.exec(m[3]);
      var hr = /<(?:\w+:)?hr>(\d+)<\/(?:\w+:)?hr>/.exec(m[3]);
      pts.push({ lat: +m[1], lon: +m[2], t: t ? new Date(t[1]) : null, hr: hr ? +hr[1] : null });
    }
    if (pts.length < 2) throw new Error('GPX tanpa titik rute: ' + (name || 'file'));
    var dist = 0;
    for (var i = 1; i < pts.length; i++) dist += haversine(pts[i - 1], pts[i]);
    var t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    var hrs = pts.map(function (p) { return p.hr; }).filter(Boolean);
    var typeM = /<trk>[\s\S]*?<type>([^<]+)<\/type>/.exec(text);
    var nameM = /<trk>[\s\S]*?<name>([^<]+)<\/name>/.exec(text);
    return [{
      type: typeM ? typeM[1] : 'running',
      date: t0 ? localDayKey(t0) : null,
      km: dist / 1000,
      seconds: t0 && t1 ? (t1 - t0) / 1000 : NaN,
      hr: hrs.length ? S.mean(hrs) : NaN,
      title: nameM ? nameM[1] : (name || ''),
      race: false, workout: null,
      extId: 'gpx:' + (t0 ? t0.toISOString() : name),
      source: 'file'
    }];
  }

  /** TCX (Garmin Connect "Export to TCX"): jumlahkan semua Lap. */
  function fromTcx(text, name) {
    var acts = [];
    var re = /<Activity\b[^>]*Sport="([^"]*)"[^>]*>([\s\S]*?)<\/Activity>/g, m;
    while ((m = re.exec(text))) {
      var body = m[2];
      var id = /<Id>([^<]+)<\/Id>/.exec(body);
      var laps = body.split(/<Lap\b/).slice(1);
      var sec = 0, dist = 0, hrW = 0;
      laps.forEach(function (l) {
        var ts = /<TotalTimeSeconds>([\d.]+)<\/TotalTimeSeconds>/.exec(l);
        var dm = /<DistanceMeters>([\d.]+)<\/DistanceMeters>/.exec(l);
        var ah = /<AverageHeartRateBpm>\s*<Value>(\d+)<\/Value>/.exec(l);
        var s = ts ? +ts[1] : 0;
        sec += s; dist += dm ? +dm[1] : 0;
        if (ah) hrW += +ah[1] * s;
      });
      var d = id ? new Date(id[1]) : null;
      acts.push({
        type: m[1] === 'Running' ? 'running' : m[1],
        date: d && !isNaN(d) ? localDayKey(d) : null,
        km: dist / 1000,
        seconds: sec,
        hr: hrW > 0 && sec > 0 ? hrW / sec : NaN,
        title: name || '',
        race: false, workout: null,
        extId: 'tcx:' + (id ? id[1] : name),
        source: 'file'
      });
    }
    if (!acts.length) throw new Error('TCX tanpa aktivitas: ' + (name || 'file'));
    return acts;
  }

  // ---------- Taksiran RPE & jenis sesi ----------

  /**
   * Taksir RPE sesi (CR-10) bila pelari tidak mengisinya.
   * 1) Dari HR rata-rata (% heart-rate reserve, Karvonen) — sesi >90 mnt +1 karena kelelahan kumulatif.
   * 2) Tanpa HR: dari pace dibanding zona VDOT.
   * 3) Tanpa keduanya: 3 (easy) atau 4 (>90 mnt).
   * Ini taksiran kasar; korelasi sRPE–HR baik di tingkat kelompok (Foster 2001), tidak sempurna per sesi.
   */
  function estimateRpe(act, profile) {
    var r = baseRpe(act, profile);
    // tanda dari Strava: sesi "workout" minimal 6, "long run" minimal 4
    if (act.workout === 'Q') r = Math.max(r, 6);
    if (act.workout === 'L') r = Math.max(r, 4);
    return r;
  }

  function baseRpe(act, profile) {
    var minutes = act.seconds / 60;
    var long = minutes > 90 ? 1 : 0;
    if (act.race) return act.km >= 21 ? 9 : 8;
    if (act.hr > 0) {
      // profil belum diisi: asumsi HR istirahat 60 & HRmax 190 (kasar, tetap lebih baik daripada mengabaikan HR)
      var rest = profile && profile.rest ? profile.rest : 60;
      var max = profile && profile.max ? profile.max : profile && profile.age ? S.hrMaxTanaka(profile.age) : 190;
      var f = (act.hr - rest) / (max - rest);
      var r = f < 0.6 ? 2 : f < 0.7 ? 3 : f < 0.78 ? 4 : f < 0.84 ? 5 : f < 0.88 ? 6 : f < 0.92 ? 7 : f < 0.95 ? 8 : 9;
      return Math.min(10, r + long);
    }
    var paces = profile && profile.vdot ? S.trainingPaces(profile.vdot) : null;
    if (paces && act.km > 0) {
      var pace = act.seconds / act.km;
      var r2 = pace > paces.E.fast ? 3 : pace > paces.M.pace ? 4 : pace > paces.T.pace * 1.03 ? 5 : pace > paces.I.pace * 1.02 ? 7 : 8;
      return Math.min(10, r2 + long);
    }
    return 3 + long;
  }

  /** Tentukan jenis sesi: lomba > tanda workout Strava > sesi terencana hari itu > taksiran RPE/durasi. */
  function classify(act, rpe, plannedType) {
    if (act.race) return 'RACE';
    if (act.workout) return act.workout;
    if (plannedType && plannedType !== 'R' && plannedType !== 'RACE') return plannedType;
    if (rpe >= 7) return 'Q';
    if (act.seconds / 60 >= 75) return 'L';
    return 'E';
  }

  /**
   * Gabungkan aktivitas mentah ke log.
   * ctx: { profile: {age, rest, max, vdot}, plannedTypeOn: fn(dateKey) -> 'E'|'Q'|..., uid: fn }
   * Lewati: bukan lari, data tidak valid, sudah pernah diimpor (extId), atau mirip entri manual
   * di tanggal yang sama (selisih jarak <10%).
   */
  function merge(logs, raw, ctx) {
    var out = logs.slice();
    var seen = {};
    logs.forEach(function (l) { if (l.extId) seen[l.extId] = true; });
    // aktivitas yang sengaja dihapus pelari tidak diimpor ulang
    ((ctx && ctx.ignore) || []).forEach(function (id) { seen[id] = true; });
    var res = { added: [], duplicate: 0, notRun: 0, invalid: 0 };
    raw.forEach(function (a) {
      if (!isRun(a.type)) { res.notRun++; return; }
      // validasi: jarak 0,2–300 km dan pace 2:30–20:00 /km (menyaring salah satuan / GPS rusak)
      var pace = a.seconds / a.km;
      if (!a.date || !(a.km > 0.2) || a.km > 300 || !(a.seconds > 60) || pace < 150 || pace > 1200) { res.invalid++; return; }
      if (seen[a.extId]) { res.duplicate++; return; }
      // lari yang sama dari sumber lain (manual, Garmin CSV vs Strava): tanggal sama & jarak ±10%
      var twin = out.some(function (l) {
        return l.date === a.date && (!l.extId || l.source !== a.source) && Math.abs((Number(l.km) || 0) - a.km) <= Math.max(0.3, a.km * 0.1);
      });
      if (twin) { res.duplicate++; return; }
      var rpe = estimateRpe(a, ctx && ctx.profile);
      var entry = {
        id: ctx && ctx.uid ? ctx.uid() : a.extId,
        date: a.date,
        type: classify(a, rpe, ctx && ctx.plannedTypeOn ? ctx.plannedTypeOn(a.date) : null),
        km: Math.round(a.km * 100) / 100,
        minutes: Math.round(a.seconds / 6) / 10,
        seconds: Math.round(a.seconds),
        rpe: rpe,
        rpeEst: true,
        hr: a.hr > 0 ? Math.round(a.hr) : null,
        notes: a.title || '',
        source: a.source,
        extId: a.extId
      };
      seen[a.extId] = true;
      out.push(entry);
      res.added.push(entry);
    });
    res.logs = out;
    return res;
  }

  /** Deteksi format file berdasarkan nama & isi. */
  function parseFile(name, text, opts) {
    var n = String(name || '').toLowerCase();
    if (/\.gpx$/.test(n) || /<gpx[\s>]/.test(text.slice(0, 500))) return fromGpx(text, name);
    if (/\.tcx$/.test(n) || /<TrainingCenterDatabase/.test(text.slice(0, 1000))) return fromTcx(text, name);
    if (/\.csv$/.test(n)) {
      var head = text.slice(0, 2000);
      if (/Activity ID/.test(head) && /Activity Date/.test(head)) return fromStravaCsv(text);
      return fromGarminCsv(text, opts);
    }
    if (/\.fit$/.test(n)) throw new Error('File .FIT belum didukung. Di Garmin Connect pilih "Export to TCX" atau "Export to GPX".');
    throw new Error('Format tidak dikenali: ' + name);
  }

  var api = {
    isRun: isRun, parseCSV: parseCSV, toNum: toNum, hmsToSec: hmsToSec,
    fromGarminCsv: fromGarminCsv, fromStravaCsv: fromStravaCsv, fromStravaApi: fromStravaApi,
    fromGpx: fromGpx, fromTcx: fromTcx, parseFile: parseFile,
    estimateRpe: estimateRpe, classify: classify, merge: merge
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Importers = api;
})(this);
