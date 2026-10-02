const test = require('node:test');
const assert = require('node:assert');
const P = require('../js/plan.js');
const C = require('../js/coach.js');

// Jadwal awal: Sen, Rab, Kam, Sab, Min (long Minggu)
const plan = P.generatePlan({ goal: 'half', weeks: 12, currentKm: 30, level: 'intermediate', vdot: 42,
  startDate: new Date('2026-10-05T12:00:00'), raceDate: '2026-12-27', runDays: [0, 2, 3, 5, 6], longDay: 6 });
const w = plan.weeks[1];
const day = i => w.days[i].date;
const run = (i, km, type) => ({ date: day(i), km, minutes: km * 6.5, rpe: type === 'Q' ? 7 : 3, type: type || 'E' });

// Pelari lari Sel, Kam, Jum, Sab, Min (long run Minggu)
const actualLogs = [run(1, 6), run(3, 8, 'Q'), run(4, 5), run(5, 6), run(6, 12, 'L')];

test('hari lari aktual terbaca dari log', () => {
  assert.deepStrictEqual(P.actualRunDays(w, actualLogs), { runDays: [1, 3, 4, 5, 6], longDay: 6 });
});

test('long run mengikuti hari lari terpanjang', () => {
  const logs = [run(1, 6), run(3, 8, 'Q'), run(4, 5), run(5, 14), run(6, 6)];
  assert.strictEqual(P.actualRunDays(w, logs).longDay, 5);
});

test('minggu dengan <3 hari lari tidak mengubah pola', () => {
  assert.strictEqual(P.actualRunDays(w, [run(1, 6), run(6, 10)]), null);
});

test('lari 7 hari: tetap disisakan 1 hari istirahat (hari terpendek dibuang)', () => {
  const logs = [0, 1, 2, 3, 4, 5, 6].map(i => run(i, i === 2 ? 3 : 6));
  const r = P.actualRunDays(w, logs);
  assert.strictEqual(r.runDays.length, 6);
  assert.ok(!r.runDays.includes(2));
});

test('review mingguan: jadwal berbeda → minggu depan mengikuti hari pelari', () => {
  const rv = C.weeklyReview(plan, actualLogs, {}, 1, 42);
  assert.deepStrictEqual(rv.schedule.from, [0, 2, 3, 5, 6]);
  assert.deepStrictEqual(rv.schedule.to, [1, 3, 4, 5, 6]);
  assert.ok(rv.reasons.some(r => /Sel, Kam, Jum, Sab, Min/.test(r)));
  const next = P.adaptPlan(plan, 2, { runDays: rv.schedule.to, longDay: rv.schedule.toLong });
  // minggu yang sudah lewat tidak berubah
  assert.deepStrictEqual(next.weeks.slice(0, 2), plan.weeks.slice(0, 2));
  // minggu depan & seterusnya hanya memakai hari pelari, volume target tetap
  next.weeks.slice(2, -1).forEach((wk, k) => {
    wk.days.forEach(d => { if (d.km > 0) assert.ok([1, 3, 4, 5, 6].includes(d.dow), `w${wk.index} dow ${d.dow}`); });
    assert.ok(Math.abs(wk.targetKm - plan.weeks[k + 2].targetKm) <= 0.5);
  });
  assert.deepStrictEqual(next.opts.runDays, [1, 3, 4, 5, 6]);
  assert.strictEqual(next.opts.longDay, 6);
  // tanggal lomba tetap
  assert.strictEqual(next.weeks.at(-1).days.find(d => d.type === 'RACE').date, '2026-12-27');
});

test('review mingguan: lari sesuai jadwal → tidak ada perubahan hari', () => {
  const logs = [run(0, 6), run(2, 8, 'Q'), run(3, 5), run(5, 6), run(6, 12, 'L')];
  assert.strictEqual(C.weeklyReview(plan, logs, {}, 1, 42).schedule, null);
});
