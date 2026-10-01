const test = require('node:test');
const assert = require('node:assert');
const P = require('../js/plan.js');
const C = require('../js/coach.js');
const S = require('../js/science.js');

function mkPlan() {
  const race = new Date('2027-03-07T12:00:00'); // Minggu
  const start = P.startForRace(race, 12);
  const p = P.generatePlan({ goal: 'half', weeks: 12, currentKm: 25, days: 4, level: 'intermediate', vdot: 40, startDate: start, raceDate: '2027-03-07' });
  return p;
}

// catat semua sesi minggu `idx` dengan faktor jarak & RPE tertentu
function logsFor(plan, idx, factor, rpe) {
  return plan.weeks[idx].days.filter(d => d.km > 0).map(d => ({
    date: d.date, type: d.type, km: d.km * factor, minutes: Math.round(d.km * factor * 6.5), rpe: rpe ?? (d.type === 'Q' ? 7 : 3)
  }));
}

test('review: patuh → lanjut sesuai rencana', () => {
  const p = mkPlan();
  const rv = C.weeklyReview(p, logsFor(p, 1, 1), {}, 1, 40);
  assert.strictEqual(rv.decision, 'progress');
  assert.strictEqual(rv.nextKm, p.weeks[2].targetKm);
});

test('review: hanya 40% terlaksana → turunkan', () => {
  const p = mkPlan();
  const rv = C.weeklyReview(p, logsFor(p, 1, 0.4), {}, 1, 40);
  assert.strictEqual(rv.decision, 'reduce');
  assert.ok(rv.nextKm < p.weeks[2].targetKm);
});

test('review: easy run terasa berat → tahan', () => {
  const p = mkPlan();
  const rv = C.weeklyReview(p, logsFor(p, 1, 1, 6), {}, 1, 40);
  assert.strictEqual(rv.decision, 'hold');
  assert.ok(rv.nextKm <= p.weeks[2].targetKm);
});

test('review: nyeri tajam → turunkan', () => {
  const p = mkPlan();
  const r = { [p.weeks[1].days[2].date]: { sleepH: 8, sleepQ: 4, soreness: 4, stress: 4, mood: 4, rhrDelta: 0, pain: 'sharp', illness: 'none' } };
  assert.strictEqual(C.weeklyReview(p, logsFor(p, 1, 1), r, 1, 40).decision, 'reduce');
});

test('review: time trial lebih cepat → VDOT naik', () => {
  const p = mkPlan();
  const logs = logsFor(p, 1, 1).concat([{ date: p.weeks[1].days[5].date, type: 'RACE', km: 5, minutes: 22, seconds: 22 * 60, rpe: 9 }]);
  const rv = C.weeklyReview(p, logs, {}, 1, 40);
  assert.ok(rv.newVdot > 43);
});

test('adaptPlan: minggu lalu tidak berubah, minggu ini sesuai startKm, progresi ≤10%, lomba tetap', () => {
  const p = mkPlan();
  const a = P.adaptPlan(p, 2, { startKm: 20 });
  assert.strictEqual(a.weeks.length, p.weeks.length);
  assert.deepStrictEqual(a.weeks.slice(0, 2), p.weeks.slice(0, 2));
  assert.strictEqual(a.weeks[2].targetKm, 20);
  for (let i = 3; i < a.weeks.length; i++) {
    const prev = a.weeks[i - 1], w = a.weeks[i];
    if (!prev.cutback) assert.ok(w.targetKm <= prev.targetKm * 1.1 + 0.5, `w${w.index}`);
    assert.strictEqual(w.phase, p.weeks[i].phase);
    assert.strictEqual(w.start, p.weeks[i].start);
  }
  const race = a.weeks.at(-1).days.find(d => d.type === 'RACE');
  assert.strictEqual(race.date, '2027-03-07');
});

test('adaptPlan tanpa perubahan volume mempertahankan kurva (hanya pace baru)', () => {
  const p = mkPlan();
  const a = P.adaptPlan(p, 3, { vdot: 45 });
  a.weeks.forEach((w, i) => assert.ok(Math.abs(w.targetKm - p.weeks[i].targetKm) <= 0.5, `w${w.index} ${p.weeks[i].targetKm} -> ${w.targetKm}`));
  assert.notStrictEqual(a.weeks[5].days.find(d => d.type === 'Q').desc, p.weeks[5].days.find(d => d.type === 'Q').desc);
});

test('adaptPlan di tengah taper tetap menurun', () => {
  const p = mkPlan();
  const ti = p.weeks.findIndex(w => w.phase === 'taper');
  const a = P.adaptPlan(p, ti + 1, { startKm: 15 });
  assert.ok(a.weeks.at(-1).targetKm <= 15);
  assert.ok(a.weeks.at(-1).days.some(d => d.type === 'RACE'));
});
