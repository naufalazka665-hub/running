/* app.js — UI, penyimpanan lokal, dan render semua tampilan. */
(function () {
  'use strict';

  var S = window.Science, P = window.Plan, C = window.Coach, K = window.Knowledge;
  var KEY = 'lintasan.v1';
  var $ = function (id) { return document.getElementById(id); };
  var TODAY = S.dayKey(new Date());

  var TYPE_LABEL = { E: 'Easy', L: 'Long run', Q: 'Kualitas', RACE: 'Lomba', R: 'Istirahat', X: 'Cross-training' };
  var PHASE_LABEL = { base: 'Base', build: 'Build', peak: 'Peak', taper: 'Taper' };
  var PHASE_COLOR = { base: 'var(--easy)', build: 'var(--track)', peak: 'var(--mod)', taper: 'var(--hard)' };
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

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage diblokir: tetap jalan di memori */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* abaikan */ }
    return null;
  }

  function profileVdot(p) {
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
    return { profile: profile, plan: plan, logs: logs, readiness: {}, sample: true };
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
        ['Rasio akut:kronis', m.acwr === null ? '–' : num(m.acwr, 2), 'nyaman ±0,8–1,3'],
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
    wrap.innerHTML = pl.weeks.map(function (w, wi) {
      var cur = w.days[0].date <= TODAY && w.days[6].date >= TODAY;
      return '<article class="wk' + (cur ? ' current' : '') + '" id="wk-' + w.index + '">' +
        '<div class="wk-head"><h3>Minggu ' + w.index + '</h3>' +
        '<span class="pill ' + (w.phase === 'taper' ? 'red' : w.phase === 'peak' ? 'amber' : w.phase === 'build' ? 'blue' : 'green') + '">' + PHASE_LABEL[w.phase] + '</span>' +
        (w.cutback ? '<span class="pill grey">Minggu ringan</span>' : '') +
        (cur ? '<span class="pill blue">Minggu ini</span>' : '') +
        '<span class="mono">' + (w.days[0].date ? fmtDate(w.days[0].date) + '–' + fmtDate(w.days[6].date) + ' · ' : '') + num(w.totalKm) + ' km · ' + w.hardPct + '% keras</span></div>' +
        '<div class="week" data-wi="' + wi + '">' + w.days.map(function (d) { return dayCell(d, { week: wi }); }).join('') + '</div>' +
        '<div class="wk-detail"></div></article>';
    }).join('');
    wrap.querySelectorAll('.wk').forEach(function (el) { bindWeek(el.querySelector('.week'), el.querySelector('.wk-detail')); });
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
    save();
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
        return '<tr><td>' + fmtDate(l.date) + '</td><td>' + esc(TYPE_LABEL[l.type] || l.type) + '</td><td class="num mono">' + num(l.km) + '</td><td class="num mono">' + l.minutes + '</td><td class="num mono">' + pace + '</td>' +
          '<td class="num"><span class="pill ' + rc + '">' + l.rpe + '</span></td><td class="num mono">' + S.sessionLoad(l.minutes, l.rpe) + '</td><td>' + esc(l.notes || '') + '</td>' +
          '<td><button type="button" class="btn danger sm" data-del="' + esc(l.id) + '" aria-label="Hapus sesi ' + fmtDate(l.date) + '">Hapus</button></td></tr>';
      }).join('') + '</tbody>';
  }

  function onLogSubmit(e) {
    e.preventDefault();
    state.logs.push({
      id: uid(), date: $('l-date').value, type: $('l-type').value, km: Number($('l-km').value), minutes: Number($('l-min').value),
      rpe: Number($('l-rpe').value), hr: $('l-hr').value ? Number($('l-hr').value) : null, notes: $('l-notes').value.trim()
    });
    leaveSample();
    save();
    $('l-km').value = ''; $('l-min').value = ''; $('l-hr').value = ''; $('l-notes').value = '';
    renderAll();
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
    $('vdot-block').innerHTML = '<div class="score"><b>' + num(vd) + '</b><span class="muted">VDOT dari ' + esc(S.DISTANCES[p.dist].label) + ' ' + esc(p.time) + '</span></div>';
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
    if (state.plan) {
      var o = Object.assign({}, state.plan.opts, { vdot: vd, startDate: new Date(state.plan.opts.startDate + 'T12:00:00') });
      var np = P.generatePlan(o);
      np.opts.startDate = state.plan.opts.startDate;
      np.opts.raceDate = state.plan.opts.raceDate;
      state.plan = np;
    }
    save();
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
    renderToday();
    renderPlan();
    renderLog();
    renderProfile();
  }

  function init() {
    state = load() || sampleState();

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
      save(); renderToday();
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
      state.logs = state.logs.filter(function (l) { return l.id !== b.dataset.del; });
      save(); renderAll();
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

    renderAll();
    renderLibrary([]);
    show((location.hash || '#today').slice(1));
  }

  init();
})();
