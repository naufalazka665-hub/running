const test = require('node:test');
const assert = require('node:assert');
const C = require('../js/coach.js');
const S = require('../js/science.js');

const good = { sleepH: 8, sleepQ: 5, soreness: 5, stress: 5, mood: 5, rhrDelta: 0, pain: 'none', illness: 'none' };

test('readiness: hijau, amber, merah', () => {
  assert.strictEqual(C.readiness(good).level, 'green');
  assert.strictEqual(C.readiness({ ...good, rhrDelta: 6 }).level, 'amber');
  assert.strictEqual(C.readiness({ ...good, pain: 'sharp' }).level, 'red');
  assert.strictEqual(C.readiness({ ...good, illness: 'below' }).level, 'red');
  assert.strictEqual(C.readiness({ sleepH: 4, sleepQ: 1, soreness: 1, stress: 1, mood: 2, rhrDelta: 0, pain: 'none', illness: 'none' }).level, 'red');
});

test('adjustSession menurunkan sesi kualitas saat amber', () => {
  const s = C.adjustSession({ type: 'Q', title: 'Threshold', km: 10 }, { level: 'amber' });
  assert.strictEqual(s.adjusted.km, 6);
});

test('analyze mendeteksi lonjakan volume & intensitas berlebih', () => {
  const end = new Date('2026-03-29T12:00:00');
  const logs = [];
  for (let i = 7; i < 14; i += 2) logs.push({ date: S.dayKey(S.addDays(end, -i)), km: 5, minutes: 30, rpe: 6 });
  for (let i = 0; i < 7; i += 1) logs.push({ date: S.dayKey(S.addDays(end, -i)), km: 8, minutes: 45, rpe: 6 });
  const a = C.analyze(logs, end);
  const titles = a.insights.map(i => i.title).join(' | ');
  assert.match(titles, /melonjak/);
  assert.match(titles, /intensitas sedang/);
  assert.match(titles, /istirahat/);
});

test('analyze tanpa data', () => {
  assert.strictEqual(C.analyze([], new Date()).metrics, null);
});
