/* app.js — UI, penyimpanan lokal, dan render semua tampilan. */
(function () {
  'use strict';

  var S = window.Science, P = window.Plan, C = window.Coach, K = window.Knowledge, I = window.Importers, ST = window.Strava;
  var KEY = 'lintasan.v1';
  var $ = function (id) { return document.getElementById(id); };
  var TODAY = S.dayKey(new Date());

  var TYPE_LABEL = { E: 'Easy', L: 'Long run', Q: 'Kualitas', RACE: 'Lomba', R: 'Istirahat', X: 'Cross-training' };
  var PHASE_LABEL = { base: 'Base', build: 'Build', peak: 'Peak', taper: 'Taper' };
  var PHASE_COLOR = { base: 'var(--easy)', build: 'var(--track)', peak: 'var(--mod)', taper: 'var(--hard)' };
  var SOURCE_LABEL = { strava: 'Strava', garmin: 'Garmin', file: 'File' };
  var RPE_DESC = ['Istirahat', 'Sangat, sangat ringan', 'Ringan', 'Sedang', 'Agak berat', 'Berat', 'Berat', 'Sangat berat', 'Sangat berat', 'Hampir maksimal', 'Maksimal'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var DAYS_LONG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  // ---------- Util ----------
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDate(key, withDay) {
    var d = new Date(key + 'T12:00:00');
    return (withDay ? DAYS_LONG[d.getDay()] + ', ' : '') + d.getDate() + ' ' + MONTHS[d.getMonth()] + (withDay ? ' ' + d.getFullYear() : '');
  }
  function num(x, d) { return (Number(x) || 0).toFixed(d === undefined ? 1 : d).replace('.', ','); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // ---------- State ----------
  var state;

  var saveOk = true;
  function save(msg) {
    try {
      state.savedAt = new Date().toISOString();
      localStorage.setItem(KEY, JSON.stringify(state));
      saveOk = true;
    } catch (e) {
      saveOk = false; // storage diblokir: tetap jalan di memori
    }
    renderSaveState();
    if (msg) toast(saveOk ? msg : 'Browser ini memblokir penyimpanan. Gunakan Ekspor JSON agar data tidak hilang.');
  }

  function renderSaveState() {
    var el = $('save-state');
    if (!el) return;
    if (state.sample) { el.textContent = 'Data contoh, belum disimpan'; return; }
    if (!saveOk) { el.textContent = 'Tidak tersimpan: penyimpanan browser diblokir'; return; }
    var t = state.savedAt ? new Date(state.savedAt) : null;
    el.textContent = t ? 'Tersimpan otomatis · ' + t.getDate() + ' ' + MONTHS[t.getMonth()] + ', ' + ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2) : 'Tersimpan otomatis di perangkat ini';
  }

  var toastTimer;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 3500);
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* abaikan */ }
    return null;
  }

  function profileVdot(p) {
    if (p && p.vdotOverride) return p.vdotOverride; // dari lomba/time trial yang tercatat di log
    if (!p || !p.time || !p.dist) return null;
    var sec = S.parseTime(p.time);
    var d = S.DISTANCES[p.dist];
    return sec && d ? S.vdot(d.m, sec) : null;
  }

  /** Data contoh: pelari 10K 55:00, rencana half marathon 12 minggu, sedang di minggu ke-5. */
  function sampleState() {
    var profile = { name: 'Pelari contoh', age: 30, rest: 58, max: null, dist: '10k', time: '55:00' };
    var vd = profileVdot(profile);
    var monday = P.mondayOf(new Date());
    var raceDate = S.addDays(monday, 7 * 7 + 6);
    var opts = { goal: 'half', weeks: 12, currentKm: 25, days: 4, level: 'intermediate', vdot: vd, longDay: 6, raceDate: S.dayKey(raceDate) };
    opts.startDate = P.startForRace(raceDate, opts.weeks);
    var plan = P.generatePlan(opts);
    plan.opts.startDate = S.dayKey(opts.startDate);
    var paces = S.trainingPaces(vd);
    var logs = [];
    var seed = 7;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    plan.weeks.forEach(function (w) {
      w.days.forEach(function (d) {
        if (!d.date || d.date >= TODAY || d.type === 'R' || d.km <= 0) return;
        if (rnd() < 0.08) return; // sesekali bolos, realistis
        var km = Math.round(d.km * (0.9 + rnd() * 0.15) * 10) / 10;
        var easyPace = (paces.E.fast + paces.E.slow) / 2;
        var pace = d.type === 'Q' ? easyPace * 0.9 : easyPace * (0.97 + rnd() * 0.06);
        var rpe = d.type === 'Q' ? 7 : d.type === 'L' ? 4 : (rnd() < 0.25 ? 5 : 3);
        logs.push({ id: uid(), date: d.date, type: d.type, km: km, minutes: Math.round(km * pace / 60), rpe: rpe, hr: null, notes: d.title });
      });
    });
    // anggap rencana dibuat di awal minggu 1 supaya review mingguan contoh bisa ditampilkan
    plan.createdAt = plan.opts.startDate + 'T06:00:00';
    var st = { profile: profile, plan: plan, logs: logs, readiness: {}, sample: true };
    return st;
  }

  function emptyState() { return { profile: null, plan: null, logs: [], readiness: {}, sample: false }; }

  // ---------- Navigasi ----------
  var VIEWS = ['today', 'plan', 'log', 'profile', 'library'];
  function show(view) {
    if (VIEWS.indexOf(view) < 0) view = 'today';
    VIEWS.forEach(function (v) {
      $('view-' + v).hidden = v !== view;
      $('tab-' + v).setAttribute('aria-selected', v === view ? 'true' : 'false');
    });
    try { history.replaceState(null, '', '#' + view); } catch (e) { /* abaikan */ }
    window.scrollTo(0, 0);
  }

  // ---------- Rencana: helper ----------
  function findDay(key) {
    if (!state.plan) return null;
    for (var i = 0; i < state.plan.weeks.length; i++) {
      var w = state.plan.weeks[i];
      for (var j = 0; j < 7; j++) if (w.days[j].date === key) return { week: w, day: w.days[j] };
    }
    return null;
  }
  function loggedOn(key) { return state.logs.filter(function (l) { return l.date === key; }); }

  function dayCell(d, opts) {
    var done = d.date && d.type !== 'R' && loggedOn(d.date).length > 0;
    var cls = 'day ' + d.type + (d.date === TODAY ? ' today-mark' : '') + (done ? ' done' : '');
    return '<button type="button" class="' + cls + '" data-date="' + esc(d.date || '') + '" data-week="' + opts.week + '" data-dow="' + d.dow + '">' +
      '<span class="d">' + P.DAY_NAMES[d.dow] + (d.date ? ' ' + Number(d.date.slice(8)) : '') + '</span>' +
      '<span class="t">' + esc(d.title) + '</span>' +
      '<span class="k">' + (d.km ? num(d.km) + ' km' : '–') + '</span></button>';
  }

  function dayDetail(d) {
    var done = d.date ? loggedOn(d.date) : [];
    var html = '<div class="detail"><div class="row"><b>' + esc(d.title) + '</b>' +
      (d.zone ? '<span class="pill grey">' + esc(d.zone) + '</span>' : '') +
      (d.rpe ? '<span class="pill grey">RPE ' + esc(d.rpe) + '</span>' : '') + '</div>' +
      '<p>' + esc(d.desc) + '</p>';
    if (done.length) html += '<p class="small muted">Tercatat: ' + done.map(function (l) { return num(l.km) + ' km, ' + l.minutes + ' mnt, RPE ' + l.rpe; }).join(' · ') + '</p>';
    else if (d.type !== 'R' && d.date && d.date <= TODAY) html += '<div><button type="button" class="btn sm" data-logfrom="' + esc(d.date) + '">Catat sesi ini</button></div>';
    return html + '</div>';
  }

  function bindWeek(container, detailEl) {
    container.addEventListener('click', function (e) {
      var b = e.target.closest('.day');
      if (!b) return;
      var w = state.plan.weeks[Number(b.dataset.week)];
      var d = w.days[Number(b.dataset.dow)];
      container.querySelectorAll('.day').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      detailEl.innerHTML = dayDetail(d);
    });
    detailEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-logfrom]');
      if (b) prefillLog(b.dataset.logfrom);
    });
  }

  // ---------- REVIEW MINGGUAN (rencana adaptif) ----------
  function weekIdxOf(key) {
    if (!state.plan) return -1;
    return state.plan.weeks.findIndex(function (w) { return w.days[0].date <= key && w.days[6].date >= key; });
  }

  /**
   * Saat minggu baru dimulai: review minggu lalu sekali, lalu sesuaikan minggu ini & sisanya.
   * Minggu yang dimulai sebelum rencana dibuat tidak direview (datanya tidak adil).
   */
  function runWeeklyReview(force) {
    var plan = state.plan;
    if (!plan) return null;
    plan.reviews = plan.reviews || {};
    plan.adaptations = plan.adaptations || [];
    var cur = weekIdxOf(TODAY);
    if (cur <= 0) return null;
    var prevIdx = cur - 1;
    var prev = plan.weeks[prevIdx];
    var created = S.dayKey(plan.createdAt || TODAY);
    if (prev.days[0].date < created) return null;
    var key = String(prev.index);
    if (plan.reviews[key] && !force) return null;

    // review ulang: kembalikan dulu kondisi sebelum penyesuaian sebelumnya
    var snap = plan.snapshot;
    if (plan.reviews[key] && snap && snap.week === prev.index) {
      plan.weeks = plan.weeks.slice(0, cur).concat(snap.weeks);
      plan.peakKm = snap.peakKm;
      if (state.profile) state.profile.vdotOverride = snap.vdotOverride || null;
      plan.adaptations = plan.adaptations.filter(function (a) { return a.afterWeek !== prev.index; });
    }

    var vdNow = profileVdot(state.profile);
    var rv = C.weeklyReview(plan, state.logs, state.readiness, prevIdx, vdNow);
    plan.snapshot = { week: prev.index, weeks: JSON.parse(JSON.stringify(plan.weeks.slice(cur))), peakKm: plan.peakKm, vdotOverride: state.profile ? state.profile.vdotOverride || null : null };

    var changes = {};
    var curWeek = plan.weeks[cur];
    if (rv.nextKm !== null && Math.abs(rv.nextKm - curWeek.targetKm) >= 0.5) changes.startKm = rv.nextKm;
    if (rv.newVdot) {
      changes.vdot = rv.newVdot;
      state.profile = Object.assign({}, state.profile || {}, { vdotOverride: rv.newVdot });
    }
    if (changes.startKm !== undefined || changes.vdot) {
      var before = curWeek.targetKm;
      state.plan = plan = Object.assign(P.adaptPlan(plan, cur, changes), { reviews: plan.reviews, adaptations: plan.adaptations, snapshot: plan.snapshot, createdAt: plan.createdAt });
      plan.adaptations.push({ date: TODAY, afterWeek: prev.index, week: plan.weeks[cur].index, decision: rv.decision, fromKm: before, toKm: plan.weeks[cur].targetKm, vdot: rv.newVdot || null });
    }
    rv.appliedKm = plan.weeks[cur].targetKm;
    plan.reviews[key] = rv;
    return rv;
  }

  function latestReview() {
    if (!state.plan || !state.plan.reviews) return null;
    var keys = Object.keys(state.plan.reviews).map(Number).sort(function (a, b) { return b - a; });
    return keys.length ? state.plan.reviews[keys[0]] : null;
  }

  var DECISION = {
    progress: ['green', 'Lanjut sesuai rencana'],
    hold: ['amber', 'Tahan progresi'],
    reduce: ['red', 'Turunkan beban']
  };

  function renderReview() {
    var box = $('review-panel');
    var rv = latestReview();
    if (!rv) { box.hidden = true; return; }
    box.hidden = false;
    var d = DECISION[rv.decision];
    var cur = weekIdxOf(TODAY);
    var stale = cur < 0 || state.plan.weeks[cur].index !== rv.nextWeek;
    $('review-title').textContent = 'Laporan minggu ' + rv.week + ' · ' + fmtDate(rv.from) + '–' + fmtDate(rv.to);
    var tiles = [
      ['Volume', num(rv.doneKm) + ' / ' + num(rv.plannedKm) + ' km', Math.round(rv.compliance * 100) + '% terlaksana'],
      ['Sesi lari', rv.sessionsDone + ' / ' + rv.sessionsPlanned, 'hari dengan lari tercatat'],
      ['Sesi kualitas', rv.qualityDone + ' / ' + rv.qualityPlanned, 'threshold, interval, race pace'],
      ['RPE easy', rv.easyRpe === null ? '–' : num(rv.easyRpe), 'target ≤ 4'],
      ['Hari merah / kuning', rv.redDays + ' / ' + rv.amberDays, 'dari cek kesiapan pagi']
    ];
    var change = '';
    if (rv.nextWeek) {
      change = rv.appliedKm !== rv.nextPlannedKm
        ? 'Minggu ' + rv.nextWeek + ' disesuaikan: <b class="mono">' + num(rv.nextPlannedKm) + ' → ' + num(rv.appliedKm) + ' km</b>. Sisa rencana dihitung ulang dari angka ini, naik maks 10%/minggu.'
        : 'Minggu ' + rv.nextWeek + ' tetap <b class="mono">' + num(rv.appliedKm) + ' km</b> sesuai rencana.';
    }
    $('review-body').innerHTML =
      '<div class="row"><span class="pill ' + d[0] + '">' + d[1] + '</span>' + (rv.newVdot ? '<span class="pill blue">VDOT baru ' + num(rv.newVdot) + '</span>' : '') + '</div>' +
      '<div class="tiles">' + tiles.map(function (t) { return '<div class="tile"><span class="label">' + t[0] + '</span><b>' + t[1] + '</b><span class="small">' + t[2] + '</span></div>'; }).join('') + '</div>' +
      '<ul class="insights">' + rv.reasons.map(function (r) { return '<li class="insight ' + (rv.decision === 'reduce' ? 'alert' : rv.decision === 'hold' ? 'warn' : 'good') + '">' + esc(r) + '</li>'; }).join('') + '</ul>' +
      (change ? '<p>' + change + '</p>' : '') +
      (stale ? '' : '<div class="row"><button type="button" class="btn ghost sm" id="review-rerun">Review ulang</button><span class="hint">Pakai ini bila Anda baru mencatat sesi minggu lalu.</span></div>');
    var rb = $('review-rerun');
    if (rb) rb.addEventListener('click', function () { runWeeklyReview(true); save('Review diperbarui dan rencana disesuaikan.'); renderAll(); });
  }

  /** Teks program satu minggu, siap disalin ke catatan/WhatsApp. */
  function weekText(w) {
    var o = state.plan.opts;
    var lines = ['Program lari minggu ' + w.index + '/' + state.plan.weeks.length + ' (' + PHASE_LABEL[w.phase] + (w.cutback ? ', minggu ringan' : '') + ') · target ' + P.GOALS[o.goal].label + ' ' + (o.raceDate ? fmtDate(o.raceDate, true) : ''),
      'Total ' + num(w.totalKm) + ' km', ''];
    w.days.forEach(function (d) {
      lines.push(DAYS_LONG[(d.dow + 1) % 7] + ' ' + fmtDate(d.date) + ': ' + d.title + (d.km ? ' (' + num(d.km) + ' km)' : ''));
      if (d.type !== 'R') lines.push('   ' + d.desc);
    });
    return lines.join('\n');
  }

  function copyWeek(w, btn) {
    var txt = weekText(w);
    var done = function () { toast('Program minggu ' + w.index + ' disalin.'); };
    var fallback = function () {
      var ta = $('copy-fallback');
      ta.hidden = false; ta.value = txt; ta.focus(); ta.select();
      toast('Salin manual: teks sudah dipilih.');
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, fallback);
      else fallback();
    } catch (e) { fallback(); }
  }

  // ---------- HARI INI ----------
  function renderToday() {
    $('today-date').textContent = fmtDate(TODAY, true);
    var hit = findDay(TODAY);
    var card = $('session-card');
    var r = state.readiness[TODAY];
    var ready = r ? C.readiness(r) : null;

    if (!state.plan) {
      card.innerHTML = '<p class="label">Belum ada rencana</p><div class="session-title">Susun rencana</div>' +
        '<p class="session-desc">Pilih target lomba dan tanggalnya. Coach akan menyusun periodisasi lengkap dan menampilkan sesi harian di sini.</p>' +
        '<div><button class="btn ghost" style="background:var(--track-ink);color:var(--track)" type="button" data-go="plan">Buat rencana</button></div>';
      $('today-week').textContent = '';
    } else if (!hit) {
      var first = state.plan.weeks[0].days[0].date;
      card.innerHTML = '<p class="label">Di luar rencana</p><div class="session-title">' + (TODAY < first ? 'Rencana belum mulai' : 'Rencana selesai') + '</div>' +
        '<p class="session-desc">' + (TODAY < first ? 'Minggu pertama mulai ' + fmtDate(first, true) + '. Sampai saat itu, lari easy 3–4×/minggu.' : 'Selamat! Ambil 1–2 minggu pemulihan dengan lari santai sebelum blok berikutnya.') + '</p>';
      $('today-week').textContent = '';
    } else {
      var w = hit.week, d = hit.day;
      var adj = ready ? C.adjustSession(d, ready) : null;
      $('today-week').textContent = 'Minggu ' + w.index + ' dari ' + state.plan.weeks.length + ' · fase ' + PHASE_LABEL[w.phase] + (w.cutback ? ' (minggu ringan)' : '');
      card.innerHTML = '<div class="row"><span class="pill">' + esc(TYPE_LABEL[d.type] || d.type) + '</span>' +
        (d.zone ? '<span class="label">' + esc(d.zone) + (d.rpe ? ' · RPE ' + esc(d.rpe) : '') + '</span>' : '') + '</div>' +
        '<div class="session-title">' + esc(adj && adj.adjusted ? adj.adjusted.title : d.title) + '</div>' +
        '<div class="session-km">' + (d.km ? num(adj && adj.adjusted ? adj.adjusted.km : d.km) + ' km' : 'Tanpa lari') + '</div>' +
        '<p class="session-desc">' + esc(d.desc) + '</p>' +
        (adj ? '<p class="advice">' + esc(adj.advice) + '</p>' : '<p class="small" style="opacity:.85">Isi cek kesiapan untuk penyesuaian otomatis.</p>');
    }

    // readiness hasil
    var res = $('ready-result');
    if (ready) {
      var lvl = { green: ['green', 'Siap latihan'], amber: ['amber', 'Kurangi beban'], red: ['red', 'Pulihkan dulu'] }[ready.level];
      res.hidden = false;
      res.innerHTML = '<div class="score"><b>' + ready.score + '</b><span class="muted">/100</span><span class="pill ' + lvl[0] + '">' + lvl[1] + '</span></div>' +
        (ready.flags.length ? '<ul class="insights">' + ready.flags.map(function (f) { return '<li class="insight ' + (ready.level === 'red' ? 'alert' : 'warn') + '">' + esc(f) + '</li>'; }).join('') + '</ul>' : '');
      fillReadyForm(r);
    } else {
      res.hidden = true;
    }

    renderReview();
    renderAnalysis();
    renderThisWeek();
  }

  function fillReadyForm(r) {
    $('r-sleepH').value = r.sleepH; $('r-rhr').value = r.rhrDelta;
    [['r-sleepQ', 'sleepQ', 'v-sleepQ'], ['r-sore', 'soreness', 'v-sore'], ['r-stress', 'stress', 'v-stress'], ['r-mood', 'mood', 'v-mood']].forEach(function (x) {
      $(x[0]).value = r[x[1]]; $(x[2]).textContent = r[x[1]];
    });
    document.querySelector('input[name="r-pain"][value="' + r.pain + '"]').checked = true;
    document.querySelector('input[name="r-ill"][value="' + r.illness + '"]').checked = true;
  }

  function renderAnalysis() {
    var a = C.analyze(state.logs, new Date());
    var m = a.metrics;
    var tiles = $('metric-tiles');
    if (m) {
      var ch = m.kmPrev > 0 ? Math.round((m.km7 - m.kmPrev) / m.kmPrev * 100) : null;
      tiles.innerHTML = [
        ['Jarak 7 hari', num(m.km7) + ' km', ch === null ? 'minggu lalu –' : (ch >= 0 ? '+' : '') + ch + '% vs 7 hari sebelumnya'],
        ['Beban 7 hari', Math.round(m.load7) + ' AU', 'menit × RPE'],
        ['Rasio akut:kronis', m.acwr === null ? '–' : num(m.acwr, 2), m.acwr === null ? 'butuh data ≥3 minggu' : 'nyaman ±0,8–1,3'],
        ['Monotony', isFinite(m.monotony) ? num(m.monotony, 2) : '–', '> 2 = terlalu seragam'],
        ['Hari istirahat', String(m.restDays), 'dalam 7 hari terakhir']
      ].map(function (t) { return '<div class="tile"><span class="label">' + t[0] + '</span><b>' + t[1] + '</b><span class="small">' + t[2] + '</span></div>'; }).join('');
    } else tiles.innerHTML = '';

    var db = $('dist-block');
    if (m && m.dist) {
      var e = Math.round(m.dist.easy * 100), mo = Math.round(m.dist.moderate * 100), h = 100 - e - mo;
      db.innerHTML = '<div class="panel-head"><span class="label">Distribusi intensitas (waktu, 28 hari)</span><span class="small muted">target ±80% rendah</span></div>' +
        '<div class="dist" role="img" aria-label="Rendah ' + e + '%, sedang ' + mo + '%, tinggi ' + h + '%"><i style="width:' + e + '%;background:var(--easy)"></i><i style="width:' + mo + '%;background:var(--mod)"></i><i style="width:' + h + '%;background:var(--hard)"></i></div>' +
        '<div class="legend"><span><i style="background:var(--easy)"></i>Rendah, RPE ≤4: ' + e + '%</span><span><i style="background:var(--mod)"></i>Sedang, RPE 5–6: ' + mo + '%</span><span><i style="background:var(--hard)"></i>Tinggi, RPE ≥7: ' + h + '%</span></div>';
    } else db.innerHTML = '';

    $('insights').innerHTML = a.insights.map(function (i) {
      return '<li class="insight ' + i.level + '"><b>' + esc(i.title) + '</b><span>' + esc(i.text) + '</span></li>';
    }).join('');
  }

  function renderThisWeek() {
    var panel = $('this-week-panel');
    var hit = findDay(TODAY);
    if (!hit) { panel.hidden = true; return; }
    panel.hidden = false;
    var w = hit.week, wi = state.plan.weeks.indexOf(w);
    var comp = C.compliance(state.plan, state.logs, new Date());
    $('this-week-meta').textContent = (comp ? num(comp.doneKm) + ' / ' + num(comp.plannedKm) + ' km' : '') + ' · ' + w.hardPct + '% volume intensitas tinggi';
    $('this-week').innerHTML = w.days.map(function (d) { return dayCell(d, { week: wi }); }).join('');
    $('copy-week').onclick = function () { copyWeek(w); };
    $('this-week-detail').innerHTML = dayDetail(hit.day);
  }

  // ---------- RENCANA ----------
  function renderPlanForm() {
    var vd = profileVdot(state.profile);
    $('plan-vdot-hint').textContent = vd
      ? 'Pace latihan memakai VDOT ' + num(vd) + ' dari profil Anda.'
      : 'Isi hasil lomba di Profil agar setiap sesi menampilkan pace target. Tanpa itu, sesi memakai RPE & zona HR.';
    var o = state.plan && state.plan.opts;
    if (o) {
      $('p-goal').value = o.goal; $('p-weeks').value = o.weeks; $('p-km').value = o.currentKm;
      $('p-days').value = String(o.days); $('p-level').value = o.level; $('p-long').value = String(o.longDay);
      if (o.raceDate) $('p-date').value = o.raceDate;
    } else if (!$('p-date').value) {
      $('p-date').value = S.dayKey(S.addDays(P.mondayOf(new Date()), 12 * 7 - 1));
    }
    $('plan-delete').hidden = !state.plan;
  }

  function planChart() {
    var weeks = state.plan.weeks;
    var W = Math.max(520, weeks.length * 34), H = 200, pl = 34, pb = 24, pt = 10;
    var max = Math.max.apply(null, weeks.map(function (w) { return w.targetKm; }));
    var top = Math.ceil(max / 20) * 20 || 20;
    var bw = (W - pl - 8) / weeks.length;
    var y = function (v) { return pt + (H - pt - pb) * (1 - v / top); };
    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Volume mingguan rencana">';
    for (var g = 0; g <= 4; g++) {
      var v = top / 4 * g;
      svg += '<line class="grid" x1="' + pl + '" x2="' + (W - 4) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="' + (pl - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + Math.round(v) + '</text>';
    }
    weeks.forEach(function (w, i) {
      var x = pl + i * bw + 3, h = H - pb - y(w.targetKm);
      var isRace = i === weeks.length - 1;
      var fill = w.cutback ? 'var(--rest)' : (isRace ? 'var(--hard)' : PHASE_COLOR[w.phase]);
      var cur = w.days[0].date <= TODAY && w.days[6].date >= TODAY;
      svg += '<rect x="' + x + '" y="' + y(w.targetKm) + '" width="' + (bw - 6) + '" height="' + h + '" rx="3" fill="' + fill + '"' + (cur ? ' stroke="var(--ink)" stroke-width="2"' : '') + '><title>Minggu ' + w.index + ': ' + num(w.targetKm) + ' km</title></rect>';
      svg += '<text x="' + (x + (bw - 6) / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + w.index + '</text>';
    });
    return svg + '</svg>';
  }

  function renderPlan() {
    renderPlanForm();
    var wrap = $('plan-weeks');
    if (!state.plan) {
      $('plan-chart').innerHTML = '<p class="muted">Belum ada rencana. Isi formulir untuk menyusun periodisasi.</p>';
      $('plan-summary').textContent = '';
      wrap.innerHTML = '';
      return;
    }
    var pl = state.plan;
    $('plan-chart').innerHTML = planChart();
    $('plan-summary').textContent = P.GOALS[pl.opts.goal].label + ' · ' + pl.weeks.length + ' minggu · puncak ' + num(pl.peakKm) + ' km';
    var ad = (pl.adaptations || []).slice().reverse();
    $('adapt-list').innerHTML = ad.length ? ad.map(function (a) {
      var d = DECISION[a.decision];
      return '<li class="row"><span class="mono small">' + fmtDate(a.date) + '</span><span class="pill ' + d[0] + '">' + d[1] + '</span><span>Minggu ' + a.week + ': <span class="mono">' + num(a.fromKm) + ' → ' + num(a.toKm) + ' km</span>' + (a.vdot ? ' · VDOT ' + num(a.vdot) : '') + '</span></li>';
    }).join('') : '<li class="muted small">' + (Object.keys(pl.reviews || {}).length ? 'Semua minggu yang sudah direview berjalan sesuai rencana, jadi volume belum perlu diubah.' : 'Belum ada penyesuaian. Review pertama berjalan otomatis saat minggu berikutnya dimulai.') + '</li>';
    wrap.innerHTML = pl.weeks.map(function (w, wi) {
      var cur = w.days[0].date <= TODAY && w.days[6].date >= TODAY;
      return '<article class="wk' + (cur ? ' current' : '') + '" id="wk-' + w.index + '">' +
        '<div class="wk-head"><h3>Minggu ' + w.index + '</h3>' +
        '<span class="pill ' + (w.phase === 'taper' ? 'red' : w.phase === 'peak' ? 'amber' : w.phase === 'build' ? 'blue' : 'green') + '">' + PHASE_LABEL[w.phase] + '</span>' +
        (w.cutback ? '<span class="pill grey">Minggu ringan</span>' : '') +
        (cur ? '<span class="pill blue">Minggu ini</span>' : '') +
        '<span class="mono">' + (w.days[0].date ? fmtDate(w.days[0].date) + '–' + fmtDate(w.days[6].date) + ' · ' : '') + num(w.totalKm) + ' km · ' + w.hardPct + '% keras</span>' +
        (pl.reviews && pl.reviews[String(w.index)] ? '<span class="pill ' + DECISION[pl.reviews[String(w.index)].decision][0] + '">Direview · ' + Math.round(pl.reviews[String(w.index)].compliance * 100) + '%</span>' : '') +
        '<button type="button" class="btn ghost sm wk-copy" data-copy="' + wi + '">Salin program</button></div>' +
        '<div class="week" data-wi="' + wi + '">' + w.days.map(function (d) { return dayCell(d, { week: wi }); }).join('') + '</div>' +
        '<div class="wk-detail"></div></article>';
    }).join('');
    wrap.querySelectorAll('.wk').forEach(function (el) { bindWeek(el.querySelector('.week'), el.querySelector('.wk-detail')); });
    wrap.querySelectorAll('[data-copy]').forEach(function (b) { b.addEventListener('click', function () { copyWeek(pl.weeks[Number(b.dataset.copy)]); }); });
  }

  function onPlanSubmit(e) {
    e.preventDefault();
    var raceDate = new Date($('p-date').value + 'T12:00:00');
    if (isNaN(raceDate)) return;
    var weeks = Number($('p-weeks').value);
    var opts = {
      goal: $('p-goal').value, weeks: weeks, currentKm: Number($('p-km').value), days: Number($('p-days').value),
      level: $('p-level').value, longDay: Number($('p-long').value), vdot: profileVdot(state.profile), raceDate: $('p-date').value
    };
    opts.startDate = P.startForRace(raceDate, weeks);
    var plan = P.generatePlan(opts);
    plan.opts.startDate = S.dayKey(opts.startDate);
    state.plan = plan;
    leaveSample();
    save('Rencana tersimpan. Program akan ditinjau & disesuaikan otomatis tiap awal minggu.');
    renderAll();
    var curEl = document.querySelector('.wk.current');
    if (curEl) curEl.scrollIntoView({ block: 'start' });
  }

  // ---------- LOG ----------
  function prefillLog(date) {
    var hit = findDay(date);
    show('log');
    $('l-date').value = date;
    if (hit) {
      $('l-type').value = hit.day.type === 'R' ? 'E' : hit.day.type;
      $('l-km').value = hit.day.km || '';
      $('l-rpe').value = hit.day.type === 'Q' ? 7 : hit.day.type === 'L' ? 4 : 3;
      updateRpe();
      $('l-notes').value = hit.day.title;
    }
    $('l-min').focus();
  }

  function updateRpe() {
    var v = Number($('l-rpe').value);
    $('v-rpe').textContent = v;
    var zone = v <= 4 ? 'intensitas rendah (zona 1)' : v <= 6 ? 'sedang (zona 2, sekitar threshold)' : 'tinggi (zona 3)';
    $('rpe-desc').textContent = RPE_DESC[v] + ' · ' + zone;
  }

  function logChart() {
    var W = 520, H = 200, pl = 34, pr = 40, pb = 24, pt = 10;
    var end = new Date();
    var weeks = [];
    for (var i = 7; i >= 0; i--) {
      var e = S.addDays(end, -7 * i), s = S.addDays(e, -6);
      var a = S.dayKey(s), b = S.dayKey(e);
      var ls = state.logs.filter(function (l) { return l.date >= a && l.date <= b; });
      weeks.push({ label: fmtDate(a), km: ls.reduce(function (x, l) { return x + Number(l.km || 0); }, 0), load: ls.reduce(function (x, l) { return x + S.sessionLoad(l.minutes, l.rpe); }, 0) });
    }
    var maxKm = Math.max(20, Math.ceil(Math.max.apply(null, weeks.map(function (w) { return w.km; })) / 20) * 20);
    var maxLoad = Math.max(400, Math.ceil(Math.max.apply(null, weeks.map(function (w) { return w.load; })) / 400) * 400);
    var bw = (W - pl - pr) / weeks.length;
    var yk = function (v) { return pt + (H - pt - pb) * (1 - v / maxKm); };
    var yl = function (v) { return pt + (H - pt - pb) * (1 - v / maxLoad); };
    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Kilometer dan beban per minggu, 8 minggu terakhir">';
    for (var g = 0; g <= 4; g++) {
      var v = maxKm / 4 * g;
      svg += '<line class="grid" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yk(v) + '" y2="' + yk(v) + '"/>' +
        '<text x="' + (pl - 6) + '" y="' + (yk(v) + 4) + '" text-anchor="end">' + Math.round(v) + '</text>' +
        '<text x="' + (W - pr + 6) + '" y="' + (yk(v) + 4) + '">' + Math.round(maxLoad / 4 * g) + '</text>';
    }
    var pts = [];
    weeks.forEach(function (w, i) {
      var x = pl + i * bw + 4;
      svg += '<rect x="' + x + '" y="' + yk(w.km) + '" width="' + (bw - 8) + '" height="' + (H - pb - yk(w.km)) + '" rx="3" fill="var(--track-soft)" stroke="var(--track)"><title>' + w.label + ': ' + num(w.km) + ' km, ' + w.load + ' AU</title></rect>';
      if (i % 2 === 1 || weeks.length < 6) svg += '<text x="' + (x + (bw - 8) / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + w.label + '</text>';
      pts.push([x + (bw - 8) / 2, yl(w.load)]);
    });
    svg += '<polyline fill="none" stroke="var(--hard)" stroke-width="2" points="' + pts.map(function (p) { return p.join(','); }).join(' ') + '"/>';
    var lp = pts[pts.length - 1];
    svg += '<circle cx="' + lp[0] + '" cy="' + lp[1] + '" r="4" fill="var(--hard)"/>';
    return svg + '</svg>';
  }

  function renderLog() {
    if (!$('l-date').value) $('l-date').value = TODAY;
    updateRpe();
    $('log-chart').innerHTML = logChart();
    var logs = state.logs.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    $('log-count').textContent = logs.length + ' sesi';
    if (!logs.length) { $('log-table').innerHTML = '<tbody><tr><td class="muted">Belum ada sesi. Catat lari pertama Anda di formulir.</td></tr></tbody>'; return; }
    $('log-table').innerHTML = '<thead><tr><th>Tanggal</th><th>Jenis</th><th class="num">Km</th><th class="num">Menit</th><th class="num">Pace</th><th class="num">RPE</th><th class="num">Beban</th><th>Catatan</th><th></th></tr></thead><tbody>' +
      logs.slice(0, 120).map(function (l) {
        var pace = l.km > 0 ? S.fmtPace(l.minutes * 60 / l.km) : '–';
        var rc = l.rpe >= 7 ? 'red' : l.rpe >= 5 ? 'amber' : 'green';
        return '<tr><td>' + fmtDate(l.date) + '</td><td>' + esc(TYPE_LABEL[l.type] || l.type) + '</td><td class="num mono">' + num(l.km) + '</td><td class="num mono">' + Math.round(l.minutes) + '</td><td class="num mono">' + pace + '</td>' +
          '<td class="num"><label class="rpe-edit ' + rc + '" title="' + (l.rpeEst ? 'RPE ditaksir dari ' + (l.hr ? 'HR' : 'pace') + '. Koreksi bila tidak sesuai.' : 'RPE sesi') + '">' + (l.rpeEst ? '≈' : '') +
          '<select data-rpe="' + esc(l.id) + '" aria-label="RPE sesi ' + fmtDate(l.date) + '">' + RPE_DESC.map(function (_, v) { return '<option' + (v === Number(l.rpe) ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></label></td>' +
          '<td class="num mono">' + S.sessionLoad(l.minutes, l.rpe) + '</td><td>' + (l.source ? '<span class="pill grey src">' + esc(SOURCE_LABEL[l.source] || l.source) + '</span> ' : '') + esc(l.notes || '') + '</td>' +
          '<td><button type="button" class="btn danger sm" data-del="' + esc(l.id) + '" aria-label="Hapus sesi ' + fmtDate(l.date) + '">Hapus</button></td></tr>';
      }).join('') + '</tbody>';
  }

  function onLogSubmit(e) {
    e.preventDefault();
    var sec = S.parseTime($('l-time').value);
    var minutes = sec ? Math.round(sec / 6) / 10 : Number($('l-min').value);
    if (!(minutes > 0)) { toast('Isi durasi (menit) atau waktu tepat.'); return; }
    var date = $('l-date').value;
    state.logs.push({
      id: uid(), date: date, type: $('l-type').value, km: Number($('l-km').value), minutes: minutes, seconds: sec || null,
      rpe: Number($('l-rpe').value), hr: $('l-hr').value ? Number($('l-hr').value) : null, notes: $('l-notes').value.trim()
    });
    leaveSample();
    var msg = 'Sesi tersimpan.';
    if (afterLogChange([date])) msg = 'Sesi tersimpan. Review minggu lalu diperbarui.';
    save(msg);
    $('l-km').value = ''; $('l-min').value = ''; $('l-time').value = ''; $('l-hr').value = ''; $('l-notes').value = '';
    renderAll();
  }

  /**
   * Setelah log berubah: bila ada tanggal di minggu lalu yang sudah direview, review ulang.
   * Lalu jalankan review normal (bila minggu baru belum direview). true bila review berubah.
   */
  function afterLogChange(dates) {
    var prevIdx = weekIdxOf(TODAY) - 1;
    var touched = state.plan && prevIdx >= 0 && (dates || []).some(function (d) { return d && weekIdxOf(d) === prevIdx; });
    var key = touched ? String(state.plan.weeks[prevIdx].index) : null;
    if (touched && state.plan.reviews && state.plan.reviews[key]) { runWeeklyReview(true); return true; }
    return !!runWeeklyReview(false);
  }

  // ---------- IMPOR & SINKRON ----------
  function importCtx() {
    var p = state.profile || {};
    return {
      profile: { age: p.age, rest: p.rest, max: p.max, vdot: profileVdot(p) },
      plannedTypeOn: function (date) { var h = findDay(date); return h ? h.day.type : null; },
      uid: uid,
      ignore: state.ignoredExt || []
    };
  }

  /** Gabungkan aktivitas mentah ke log, review ulang, simpan. Mengembalikan ringkasan teks. */
  function applyImport(raw, label) {
    if (state.sample) {
      // jangan campur aktivitas asli dengan data contoh
      state = emptyState();
    }
    var res = I.merge(state.logs, raw, importCtx());
    state.logs = res.logs;
    var reviewed = afterLogChange(res.added.map(function (l) { return l.date; }));
    var parts = [res.added.length + ' lari baru dari ' + label];
    if (res.duplicate) parts.push(res.duplicate + ' sudah ada');
    if (res.notRun) parts.push(res.notRun + ' bukan lari');
    if (res.invalid) parts.push(res.invalid + ' tidak valid');
    var msg = parts.join(' · ') + '.' + (reviewed ? ' Review mingguan diperbarui.' : '');
    save(msg);
    renderAll();
    return msg;
  }

  var syncing = false;
  async function syncStrava(manual) {
    if (syncing || !ST || !ST.connected()) return null;
    syncing = true;
    renderSync('Menyinkronkan Strava…');
    try {
      var last = ST.lastSync();
      // sinkron pertama: sejak awal rencana (atau 8 minggu); berikutnya mundur 2 hari untuk unggahan terlambat
      var since = last ? new Date(last).getTime() / 1000 - 2 * 86400
        : (state.plan && state.plan.weeks[0].days[0].date ? new Date(state.plan.weeks[0].days[0].date + 'T00:00:00').getTime() / 1000 : Date.now() / 1000 - 56 * 86400);
      var acts = await ST.fetchActivities(since);
      ST.setLastSync(new Date().toISOString());
      var msg = applyImport(acts.map(I.fromStravaApi), 'Strava');
      renderSync(msg);
      return msg;
    } catch (err) {
      var m = /Failed to fetch|NetworkError|Load failed/i.test(err.message)
        ? 'Tidak bisa menghubungi Strava dari halaman ini (jaringan atau halaman tidak di-host). Gunakan versi GitHub Pages, atau impor file.'
        : err.message;
      renderSync(m, true);
      if (manual) toast(m);
      return null;
    } finally {
      syncing = false;
    }
  }

  function renderSync(status, isErr) {
    var box = $('strava-box');
    if (!box || !ST) return;
    if (!ST.supported()) {
      box.innerHTML = '<p class="muted small">Sinkron Strava butuh halaman yang di-host (GitHub Pages atau localhost), bukan file yang dibuka langsung. Untuk sekarang gunakan impor file di sebelah.</p>';
      return;
    }
    if (!ST.connected()) {
      box.innerHTML =
        '<ol class="steps small">' +
        '<li>Buka <a href="https://www.strava.com/settings/api" target="_blank" rel="noopener">strava.com/settings/api</a> dan buat aplikasi (nama bebas, mis. "Lintasan pribadi").</li>' +
        '<li>Isi <b>Authorization Callback Domain</b> dengan <code>' + esc(location.hostname) + '</code>.</li>' +
        '<li>Salin <b>Client ID</b> dan <b>Client Secret</b> ke sini, lalu hubungkan.</li></ol>' +
        '<form id="strava-form" class="fields">' +
        '<label class="field"><span>Client ID</span><input id="s-id" inputmode="numeric" required value="' + esc(ST.clientId()) + '"></label>' +
        '<label class="field"><span>Client Secret</span><input id="s-secret" type="password" autocomplete="off" required></label>' +
        '<button class="btn" type="submit">Hubungkan Strava</button></form>' +
        '<p class="hint">Secret disimpan hanya di browser ini dan hanya dipakai untuk menukar token dengan Strava. Aplikasi Strava baru hanya bisa mengakses akun pemiliknya.</p>' +
        (status ? '<p class="small ' + (isErr ? 'err' : 'muted') + '">' + esc(status) + '</p>' : '');
      $('strava-form').addEventListener('submit', function (e) {
        e.preventDefault();
        ST.authorize($('s-id').value, $('s-secret').value);
      });
      return;
    }
    var a = ST.athlete(), last = ST.lastSync();
    box.innerHTML = '<div class="row"><span class="pill green">Terhubung</span><span class="small">' + esc(a && a.name ? a.name : 'Akun Strava') + '</span></div>' +
      '<p class="small muted">Sinkron otomatis setiap aplikasi dibuka. Terakhir: ' + (last ? fmtDate(S.dayKey(new Date(last))) + ', ' + ('0' + new Date(last).getHours()).slice(-2) + ':' + ('0' + new Date(last).getMinutes()).slice(-2) : 'belum pernah') + '.</p>' +
      (status ? '<p class="small ' + (isErr ? 'err' : '') + '">' + esc(status) + '</p>' : '') +
      '<div class="row"><button type="button" class="btn sm" id="strava-sync"' + (syncing ? ' disabled' : '') + '>Sinkron sekarang</button>' +
      '<button type="button" class="btn ghost sm" id="strava-off">Putuskan</button></div>';
    $('strava-sync').addEventListener('click', function () { syncStrava(true).then(function (m) { if (m) toast(m); }); });
    $('strava-off').addEventListener('click', function () { ST.disconnect(); renderSync('Strava diputus. Log yang sudah diimpor tetap ada.'); });
  }

  function onImportFiles(files) {
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) return;
    var raw = [], errors = [];
    var pending = list.length;
    list.forEach(function (f) {
      var fr = new FileReader();
      fr.onload = function () {
        try { raw = raw.concat(I.parseFile(f.name, String(fr.result), { miles: $('imp-miles').checked })); }
        catch (err) { errors.push(err.message); }
        if (--pending === 0) {
          var msg = raw.length ? applyImport(raw, list.length === 1 ? list[0].name : list.length + ' file') : 'Tidak ada aktivitas yang terbaca.';
          $('import-msg').textContent = msg + (errors.length ? ' ' + errors.join(' ') : '');
          toast(msg);
          $('import-files').value = '';
        }
      };
      fr.onerror = function () { errors.push('Gagal membaca ' + f.name); if (--pending === 0) $('import-msg').textContent = errors.join(' '); };
      fr.readAsText(f);
    });
  }

  // ---------- PROFIL ----------
  function renderProfile() {
    var p = state.profile;
    if (p) {
      $('f-name').value = p.name || ''; $('f-age').value = p.age; $('f-rest').value = p.rest; $('f-max').value = p.max || '';
      $('f-dist').value = p.dist; $('f-time').value = p.time;
    }
    var vd = profileVdot(p);
    if (!vd) {
      $('vdot-block').innerHTML = '<p class="muted">Isi data pelari untuk melihat VDOT, pace latihan, zona HR, dan prediksi lomba.</p>';
      ['pace-table', 'hr-table', 'pred-table'].forEach(function (id) { $(id).innerHTML = ''; });
      $('hr-meta').textContent = '';
      return;
    }
    var pc = S.trainingPaces(vd);
    $('vdot-block').innerHTML = '<div class="score"><b>' + num(vd) + '</b><span class="muted">' + (p.vdotOverride ? 'VDOT dari lomba/time trial di log (otomatis)' : 'VDOT dari ' + esc(S.DISTANCES[p.dist].label) + ' ' + esc(p.time)) + '</span></div>';
    var per400 = function (secKm) { return S.fmtTime(secKm * 0.4); };
    $('pace-table').innerHTML = '<thead><tr><th>Zona</th><th class="num">Pace /km</th><th class="num">/400 m</th><th>Tujuan</th></tr></thead><tbody>' + [
      ['E · Easy', S.fmtPace(pc.E.fast) + '–' + S.fmtPace(pc.E.slow), '–', 'Fondasi aerobik, pemulihan, long run'],
      ['M · Marathon', S.fmtPace(pc.M.pace), per400(pc.M.pace), 'Ritme & bahan bakar lomba marathon'],
      ['T · Threshold', S.fmtPace(pc.T.pace), per400(pc.T.pace), 'Menaikkan ambang laktat'],
      ['I · Interval', S.fmtPace(pc.I.pace), per400(pc.I.pace), 'Menaikkan VO2max (rep 3–5 mnt)'],
      ['R · Repetisi', S.fmtPace(pc.R.pace), per400(pc.R.pace), 'Kecepatan & running economy']
    ].map(function (r) { return '<tr><td><b>' + r[0] + '</b></td><td class="num mono">' + r[1] + '</td><td class="num mono">' + r[2] + '</td><td class="small">' + r[3] + '</td></tr>'; }).join('') + '</tbody>';

    var hrMax = p.max || S.hrMaxTanaka(p.age);
    $('hr-meta').textContent = 'HRmax ' + hrMax + (p.max ? ' (terukur)' : ' (Tanaka)') + ' · istirahat ' + p.rest;
    var zc = ['var(--rest)', 'var(--easy)', 'var(--easy)', 'var(--mod)', 'var(--hard)'];
    $('hr-table').innerHTML = '<thead><tr><th>Zona</th><th class="num">% HRR</th><th class="num">BPM</th><th>Setara</th></tr></thead><tbody>' +
      S.hrZones(hrMax, p.rest).map(function (z, i) {
        return '<tr><td><span class="zone-chip" style="background:' + zc[i] + '"></span><b>Z' + z.z + '</b> ' + z.name + '</td><td class="num mono">' + Math.round(z.lo * 100) + '–' + Math.round(z.hi * 100) + '</td><td class="num mono">' + z.bpmLo + '–' + z.bpmHi + '</td><td class="small">Daniels ' + z.daniels + ' · Seiler Z' + z.seiler + '</td></tr>';
      }).join('') + '</tbody>';

    var src = S.DISTANCES[p.dist], srcSec = S.parseTime(p.time);
    $('pred-table').innerHTML = '<thead><tr><th>Jarak</th><th class="num">VDOT</th><th class="num">Riegel</th><th class="num">Pace (VDOT)</th></tr></thead><tbody>' +
      ['5k', '10k', 'half', 'marathon'].map(function (k) {
        var d = S.DISTANCES[k], t = S.predictTime(vd, d.m), rg = S.riegel(srcSec, src.m, d.m);
        return '<tr><td>' + d.label + '</td><td class="num mono">' + S.fmtTime(t) + '</td><td class="num mono">' + S.fmtTime(rg) + '</td><td class="num mono">' + S.fmtPace(t / (d.m / 1000)) + '/km</td></tr>';
      }).join('') + '</tbody>';
  }

  function onProfileSubmit(e) {
    e.preventDefault();
    var p = {
      name: $('f-name').value.trim(), age: Number($('f-age').value), rest: Number($('f-rest').value),
      max: $('f-max').value ? Number($('f-max').value) : null, dist: $('f-dist').value, time: $('f-time').value.trim()
    };
    var sec = S.parseTime(p.time);
    var d = S.DISTANCES[p.dist];
    var vd = sec ? S.vdot(d.m, sec) : null;
    if (!vd || vd < 15 || vd > 90) {
      $('profile-msg').textContent = 'Waktu tidak terbaca atau tidak masuk akal. Tulis seperti 25:30 atau 1:52:10.';
      return;
    }
    state.profile = p;
    leaveSample();
    // perbarui pace di rencana yang ada tanpa mengubah strukturnya
    // hanya minggu ini dan seterusnya; minggu yang sudah lewat & penyesuaian sebelumnya tetap
    if (state.plan) {
      var from = Math.max(0, weekIdxOf(TODAY));
      if (TODAY > state.plan.weeks[state.plan.weeks.length - 1].days[6].date) from = state.plan.weeks.length;
      if (from < state.plan.weeks.length) state.plan = Object.assign({}, state.plan, P.adaptPlan(state.plan, from, { vdot: vd }), { reviews: state.plan.reviews, adaptations: state.plan.adaptations, snapshot: state.plan.snapshot, createdAt: state.plan.createdAt });
    }
    save('Profil tersimpan.');
    $('profile-msg').textContent = 'Tersimpan. VDOT ' + num(vd) + (state.plan ? '; pace di rencana sudah diperbarui.' : '.');
    renderAll();
  }

  // ---------- PUSTAKA ----------
  function topicCard(t, hit) {
    var ev = { Kuat: 'green', Sedang: 'blue', Praktik: 'amber' }[t.evidence];
    return '<article class="topic' + (hit ? ' hit' : '') + '" id="topic-' + t.id + '">' +
      '<div class="topic-meta"><span class="pill grey">' + esc(t.cat) + '</span><span class="pill ' + ev + '">Bukti: ' + esc(t.evidence) + '</span></div>' +
      '<h3>' + esc(t.title) + '</h3><p>' + esc(t.summary) + '</p>' +
      '<details' + (hit ? ' open' : '') + '><summary>Poin kunci &amp; praktik</summary><ul>' + t.points.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '<p class="label" style="margin-top:12px">Terapkan</p><ul>' + t.practice.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></details>' +
      '<details><summary>Referensi (' + t.refs.length + ')</summary><ul class="refs">' + t.refs.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></details></article>';
  }

  function renderLibrary(hits) {
    var ids = (hits || []).map(function (h) { return h.topic.id; });
    $('topics').innerHTML = K.TOPICS.map(function (t) { return topicCard(t, ids.indexOf(t.id) >= 0); }).join('');
  }

  function onAsk(e) {
    e.preventDefault();
    var q = $('ask-q').value.trim();
    if (!q) return;
    var hits = K.search(q, 3);
    var out = $('answer');
    if (!hits.length) {
      out.innerHTML = '<p class="muted">Belum ada materi yang cocok. Coba kata kunci lain, misalnya: zona 2, taper, cedera, carb loading, cadence, panas.</p>';
      renderLibrary([]);
      return;
    }
    out.innerHTML = '<p class="small muted">Jawaban disusun dari pustaka di bawah (pencocokan kata kunci, bukan AI generatif).</p>' + hits.map(function (h, i) {
      var t = h.topic;
      return '<div class="insight ' + (i === 0 ? 'info' : 'good') + '"><b>' + esc(t.title) + '</b><span>' + esc(t.summary) + '</span>' +
        '<span class="small"><b>Praktik:</b> ' + esc(t.practice[0]) + ' <a href="#topic-' + t.id + '" data-topic="' + t.id + '">Baca selengkapnya</a></span></div>';
    }).join('');
    renderLibrary(hits);
  }

  // ---------- Data ----------
  function leaveSample() {
    if (state.sample) { state.sample = false; $('sample-banner').hidden = true; }
  }

  function exportData() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lintasan-' + TODAY + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    $('data-msg').textContent = 'File ekspor dibuat.';
  }

  function importData(file) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var d = JSON.parse(fr.result);
        if (!d || !Array.isArray(d.logs)) throw new Error('format');
        state = Object.assign(emptyState(), d, { sample: false });
        save(); renderAll();
        $('data-msg').textContent = 'Data berhasil diimpor: ' + state.logs.length + ' sesi.';
      } catch (err) {
        $('data-msg').textContent = 'File tidak dikenali. Gunakan file hasil "Ekspor JSON" dari Lintasan.';
      }
    };
    fr.readAsText(file);
  }

  // ---------- Init ----------
  function renderAll() {
    $('sample-banner').hidden = !state.sample;
    renderSaveState();
    renderToday();
    renderPlan();
    renderLog();
    renderProfile();
  }

  function init() {
    state = load() || sampleState();
    var stravaOn = ST && ST.supported() && ST.connected();
    var hasCallback = ST && ST.supported() && /[?&](code|error)=/.test(location.search);
    // awal minggu baru: review minggu lalu & sesuaikan rencana.
    // Bila Strava terhubung, review menunggu sinkron agar lari minggu lalu ikut terhitung.
    if (!stravaOn && !hasCallback && runWeeklyReview(false) && !state.sample) save('Minggu baru: program minggu ini sudah disesuaikan dengan latihan Anda minggu lalu.');

    document.querySelectorAll('.tab').forEach(function (t) { t.addEventListener('click', function () { show(t.dataset.view); }); });
    document.addEventListener('click', function (e) {
      var go = e.target.closest('[data-go]');
      if (go) show(go.dataset.go);
      var tp = e.target.closest('[data-topic]');
      if (tp) { e.preventDefault(); var el = $('topic-' + tp.dataset.topic); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });

    $('clear-sample').addEventListener('click', function () { state = emptyState(); save(); renderAll(); show('profile'); });

    $('ready-form').addEventListener('submit', function (e) {
      e.preventDefault();
      state.readiness[TODAY] = {
        sleepH: Number($('r-sleepH').value), sleepQ: Number($('r-sleepQ').value), soreness: Number($('r-sore').value),
        stress: Number($('r-stress').value), mood: Number($('r-mood').value), rhrDelta: Number($('r-rhr').value),
        pain: document.querySelector('input[name="r-pain"]:checked').value,
        illness: document.querySelector('input[name="r-ill"]:checked').value
      };
      save('Cek kesiapan tersimpan.'); renderToday();
    });
    [['r-sleepQ', 'v-sleepQ'], ['r-sore', 'v-sore'], ['r-stress', 'v-stress'], ['r-mood', 'v-mood']].forEach(function (x) {
      $(x[0]).addEventListener('input', function () { $(x[1]).textContent = $(x[0]).value; });
    });

    bindWeek($('this-week'), $('this-week-detail'));
    $('plan-form').addEventListener('submit', onPlanSubmit);
    $('plan-delete').addEventListener('click', function () { state.plan = null; save(); renderAll(); });
    $('log-form').addEventListener('submit', onLogSubmit);
    $('l-rpe').addEventListener('input', updateRpe);
    $('log-table').addEventListener('click', function (e) {
      var b = e.target.closest('[data-del]');
      if (!b) return;
      var gone = state.logs.find(function (l) { return l.id === b.dataset.del; });
      if (gone && gone.extId) state.ignoredExt = (state.ignoredExt || []).concat(gone.extId);
      state.logs = state.logs.filter(function (l) { return l.id !== b.dataset.del; });
      afterLogChange([gone && gone.date]);
      save('Sesi dihapus.'); renderAll();
    });
    $('log-table').addEventListener('change', function (e) {
      var sel = e.target.closest('[data-rpe]');
      if (!sel) return;
      var l = state.logs.find(function (x) { return x.id === sel.dataset.rpe; });
      if (!l) return;
      l.rpe = Number(sel.value); l.rpeEst = false;
      afterLogChange([l.date]);
      save('RPE diperbarui.'); renderAll();
    });
    $('profile-form').addEventListener('submit', onProfileSubmit);
    $('ask-form').addEventListener('submit', onAsk);
    $('export-btn').addEventListener('click', exportData);
    $('import-file').addEventListener('change', function (e) { if (e.target.files[0]) importData(e.target.files[0]); });
    $('reset-btn').addEventListener('click', function () { $('reset-confirm').hidden = false; });
    $('reset-no').addEventListener('click', function () { $('reset-confirm').hidden = true; });
    $('reset-yes').addEventListener('click', function () {
      state = emptyState(); save(); $('reset-confirm').hidden = true; renderAll();
      $('data-msg').textContent = 'Semua data dihapus.';
    });

    $('import-files').addEventListener('change', function (e) { onImportFiles(e.target.files); });
    var drop = $('import-drop');
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function () { drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); onImportFiles(e.dataTransfer.files); });

    renderAll();
    renderSync();
    if (hasCallback) {
      ST.handleCallback().then(function (r) {
        if (!r) return;
        toast(r.msg);
        renderSync(r.ok ? null : r.msg, !r.ok);
        if (r.ok) return syncStrava(true);
      }).catch(function (err) { renderSync(err.message, true); toast(err.message); })
        .then(function () { if (runWeeklyReview(false)) { save(); renderAll(); } });
    } else if (stravaOn) {
      var last = ST.lastSync();
      var due = !last || Date.now() - new Date(last).getTime() > 30 * 60 * 1000;
      (due ? syncStrava(false) : Promise.resolve(null)).then(function () {
        if (runWeeklyReview(false)) { save('Minggu baru: program minggu ini sudah disesuaikan dengan latihan Anda minggu lalu.'); renderAll(); }
      });
    }
    renderLibrary([]);
    show((location.hash || '#today').slice(1));
  }

  init();
})();
