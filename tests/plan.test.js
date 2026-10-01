const test = require('node:test');
const assert = require('node:assert');
const P = require('../js/plan.js');
const S = require('../js/science.js');

const combos = [];
for (const goal of ['5k', '10k', 'half', 'marathon'])
  for (const days of [3, 4, 5, 6])
    for (const level of ['beginner', 'intermediate', 'advanced'])
      combos.push({ goal, days, level, weeks: goal === 'marathon' ? 18 : 12, currentKm: 25, vdot: 45 });

test('jumlah minggu, hari lari, dan lomba di akhir', () => {
  for (const o of combos) {
    const p = P.generatePlan(o);
    assert.strictEqual(p.weeks.length, o.weeks);
    const last = p.weeks[p.weeks.length - 1];
    assert.ok(last.days.some(d => d.type === 'RACE'), JSON.stringify(o));
    for (const w of p.weeks.slice(0, -1)) {
      const runs = w.days.filter(d => d.km > 0).length;
      assert.strictEqual(runs, o.days, `minggu ${w.index} ${JSON.stringify(o)}`);
    }
  }
});

test('progresi volume ≤10% per minggu (kecuali setelah minggu ringan)', () => {
  for (const o of combos) {
    const p = P.generatePlan(o);
    for (let i = 1; i < p.weeks.length; i++) {
      const a = p.weeks[i - 1], b = p.weeks[i];
      if (a.cutback) continue;
      assert.ok(b.targetKm <= a.targetKm * 1.1 + 0.5, `${o.goal} w${b.index}: ${a.targetKm} -> ${b.targetKm}`);
    }
  }
});

test('taper menurunkan volume 40–60% di minggu lomba', () => {
  const p = P.generatePlan({ goal: 'marathon', weeks: 16, currentKm: 40, days: 5, level: 'intermediate' });
  const tapers = p.weeks.filter(w => w.phase === 'taper');
  assert.strictEqual(tapers.length, 3);
  const last = tapers[tapers.length - 1].targetKm / p.peakKm;
  assert.ok(last >= 0.4 && last <= 0.6);
});

test('tidak ada sesi kualitas pada 3 hari sebelum lomba & sesudahnya', () => {
  for (const o of combos) {
    const last = P.generatePlan(o).weeks.at(-1);
    const r = last.days.findIndex(d => d.type === 'RACE');
    last.days.forEach((d, i) => {
      if (i > r) assert.strictEqual(d.km, 0);
      if (i < r && r - i < 4) assert.notStrictEqual(d.type, 'Q');
    });
  }
});

test('easy run tidak lebih panjang dari long run', () => {
  for (const o of combos) {
    for (const w of P.generatePlan(o).weeks) {
      const long = w.days.find(d => d.type === 'L');
      if (!long) continue;
      w.days.filter(d => d.type === 'E').forEach(d => assert.ok(d.km <= long.km, `${o.goal} w${w.index}`));
    }
  }
});

test('hari lomba mengikuti tanggal lomba', () => {
  const race = new Date('2026-12-05T12:00:00'); // Sabtu
  const start = P.startForRace(race, 10);
  const p = P.generatePlan({ goal: '10k', weeks: 10, currentKm: 30, days: 4, level: 'intermediate', startDate: start, raceDate: '2026-12-05' });
  const rd = p.weeks.at(-1).days.find(d => d.type === 'RACE');
  assert.strictEqual(rd.date, '2026-12-05');
  assert.strictEqual(S.dayKey(start), '2026-09-28');
});
