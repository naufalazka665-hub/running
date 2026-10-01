const test = require('node:test');
const assert = require('node:assert');
const S = require('../js/science.js');

test('parseTime & fmtTime', () => {
  assert.strictEqual(S.parseTime('25:30'), 1530);
  assert.strictEqual(S.parseTime('1:52:10'), 6730);
  assert.strictEqual(S.parseTime('abc'), null);
  assert.strictEqual(S.fmtTime(6730), '1:52:10');
  assert.strictEqual(S.fmtPace(300), '5:00');
});

test('VDOT cocok dengan tabel Daniels (±0,5)', () => {
  // Tabel Daniels: 5K 19:57 ≈ VDOT 50; 10K 41:21 ≈ VDOT 50; marathon 3:10:49 ≈ VDOT 50
  assert.ok(Math.abs(S.vdot(5000, S.parseTime('19:57')) - 50) < 0.5);
  assert.ok(Math.abs(S.vdot(10000, S.parseTime('41:21')) - 50) < 0.5);
  assert.ok(Math.abs(S.vdot(42195, S.parseTime('3:10:49')) - 50) < 0.5);
});

test('predictTime adalah invers VDOT', () => {
  const t = S.predictTime(45, 21097.5);
  assert.ok(Math.abs(S.vdot(21097.5, t) - 45) < 1e-3);
});

test('pace latihan VDOT 50 mendekati tabel Daniels (±3 dtk/km)', () => {
  const p = S.trainingPaces(50);
  const near = (a, b) => Math.abs(a - b) <= 3;
  assert.ok(near(p.T.pace, 255), 'T ≈ 4:15/km');
  assert.ok(near(p.I.pace, 235), 'I ≈ 3:55/km');
  assert.ok(near(p.M.pace, 271), 'M ≈ 4:31/km');
  assert.ok(p.E.slow > p.E.fast && p.E.fast > p.M.pace);
});

test('Riegel & HR', () => {
  assert.ok(Math.abs(S.riegel(1200, 5000, 10000) - 1200 * Math.pow(2, 1.06)) < 1e-9);
  assert.strictEqual(S.hrMaxTanaka(30), 187);
  const z = S.hrZones(190, 60);
  assert.strictEqual(z[0].bpmLo, 125);
  assert.strictEqual(z[4].bpmHi, 190);
});

test('sRPE, monotony, ACWR', () => {
  assert.strictEqual(S.sessionLoad(60, 5), 300);
  const end = new Date('2026-03-29T12:00:00');
  const logs = [];
  for (let i = 0; i < 28; i++) logs.push({ date: S.dayKey(S.addDays(end, -i)), minutes: 40, rpe: 4 });
  const ac = S.acwr(logs, end);
  assert.ok(Math.abs(ac.ratio - 1) < 1e-9);
  const ms = S.monotonyStrain(S.dailyLoads(logs, end, 7));
  assert.strictEqual(ms.monotony, Infinity); // beban identik tiap hari
});
