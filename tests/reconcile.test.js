const test = require('node:test');
const assert = require('node:assert');
const P = require('../js/plan.js');

// Minggu ke-6 rencana 10K, hari lari Sel/Kam/Sab/Min, long run Minggu
const plan = P.generatePlan({ goal: '10k', weeks: 10, currentKm: 30, days: 4, level: 'intermediate', vdot: 42,
  startDate: new Date('2026-10-05T12:00:00'), raceDate: '2026-12-13', runDays: [1, 3, 5, 6], longDay: 6 });
const w = plan.weeks[5];
const d = i => w.days[i].date;
const byDow = (r, i) => r.days[i];
const hard = x => x.type === 'Q' || x.type === 'L';

function noNewBackToBack(r) {
  for (let i = 0; i < 6; i++) {
    const a = r.days[i], b = r.days[i + 1];
    const aHard = (a.status === 'done' || a.status === 'pending') && hard(a);
    const bHard = (b.status === 'done' || b.status === 'pending') && hard(b);
    const original = hard(w.days[i]) && hard(w.days[i + 1]);
    if (aHard && bHard && !original) return false;
  }
  return true;
}

test('hari lari pilihan pelari: peran sesi berjarak', () => {
  assert.deepStrictEqual(P.dayRoles([0, 2, 4, 6], 6), { 0: 'E', 2: 'Q', 4: 'Q2', 6: 'L' });
  assert.deepStrictEqual(P.dayRoles([1, 3, 5], 5), { 1: 'Q', 3: 'E', 5: 'L' });
  // 6 hari, long Sabtu: sesi kualitas tidak di Minggu (sehari setelah long) dan tidak berdampingan
  const r = P.dayRoles([0, 1, 2, 3, 4, 6], 6);
  const qs = Object.keys(r).filter(k => r[k] !== 'E' && r[k] !== 'L').map(Number);
  assert.strictEqual(qs.length, 2);
  assert.ok(!qs.includes(0) && Math.abs(qs[0] - qs[1]) >= 2, JSON.stringify(r));
});

test('rencana memakai tepat hari yang dipilih', () => {
  for (const runDays of [[0, 2, 4, 6], [1, 3, 5], [0, 1, 3, 4, 5], [0, 1, 2, 3, 4, 5]]) {
    const p = P.generatePlan({ goal: 'half', weeks: 12, currentKm: 30, level: 'intermediate', runDays, longDay: runDays[runDays.length - 1] });
    p.weeks.slice(0, -1).forEach(wk => {
      wk.days.forEach(x => { if (x.km > 0) assert.ok(runDays.includes(x.dow), `w${wk.index} ${x.dow} ${runDays}`); });
    });
    assert.strictEqual(p.opts.days, runDays.length);
  }
});

test('tanpa log: jadwal tidak berubah', () => {
  const r = P.reconcileWeek(w, [], d(0));
  assert.strictEqual(r.changed, false);
  r.days.forEach((x, i) => assert.strictEqual(x.title, w.days[i].title));
});

test('sesi sesuai jadwal ditandai selesai, sisanya tetap', () => {
  const r = P.reconcileWeek(w, [{ date: d(1), type: 'Q', km: 9, rpe: 7 }], d(2));
  assert.strictEqual(byDow(r, 1).status, 'done');
  assert.strictEqual(byDow(r, 3).title, w.days[3].title);
  assert.strictEqual(r.changed, false);
});

test('sesi kualitas terlewat dipindah, tanpa menumpuk hari keras', () => {
  const r = P.reconcileWeek(w, [], d(2)); // hari ini Rabu, threshold Selasa terlewat
  assert.strictEqual(byDow(r, 3).title, w.days[1].title);
  assert.strictEqual(byDow(r, 3).movedFrom, d(1));
  assert.strictEqual(byDow(r, 1).status, 'rescheduled');
  assert.ok(noNewBackToBack(r));
  assert.ok(r.notes.some(n => /dibatalkan/.test(n)));
});

test('long run dimajukan ke Sabtu: tampil di Sabtu, easy pindah ke Minggu', () => {
  const r = P.reconcileWeek(w, [{ date: d(1), type: 'Q', km: 9, rpe: 7 }, { date: d(3), type: 'Q', km: 9.5, rpe: 8 }, { date: d(5), type: 'L', km: 13.5, rpe: 4 }], d(6));
  assert.strictEqual(byDow(r, 5).type, 'L');
  assert.strictEqual(byDow(r, 5).status, 'done');
  assert.strictEqual(byDow(r, 6).type, 'E');
  assert.strictEqual(byDow(r, 6).movedFrom, d(5));
});

test('sesi keras di hari lain tidak membuat dua hari keras berturut-turut', () => {
  const r = P.reconcileWeek(w, [{ date: d(2), type: 'Q', km: 9, rpe: 8 }], d(3));
  assert.ok(noNewBackToBack(r));
  assert.notStrictEqual(byDow(r, 3).type, 'Q');
});

test('lari tambahan jauh dari jadwal tidak menggantikan sesi', () => {
  const r = P.reconcileWeek(w, [{ date: d(0), type: 'E', km: 5, rpe: 3 }], d(1));
  assert.strictEqual(byDow(r, 0).status, 'extra');
  assert.strictEqual(byDow(r, 5).status, 'pending');
});

test('easy terlewat tidak ditumpuk', () => {
  const r = P.reconcileWeek(w, [{ date: d(1), type: 'Q', km: 9, rpe: 7 }, { date: d(3), type: 'Q', km: 9.5, rpe: 7 }], d(6)); // Sabtu easy terlewat
  assert.strictEqual(byDow(r, 5).status, 'missed');
  assert.strictEqual(byDow(r, 6).type, 'L');
  assert.ok(r.notes.some(n => /tidak perlu diganti/i.test(n)));
});

test('minggu lomba tidak disusun ulang', () => {
  const last = plan.weeks.at(-1);
  const r = P.reconcileWeek(last, [], last.days[3].date);
  const race = r.days.find(x => x.type === 'RACE');
  assert.strictEqual(race.date, '2026-12-13');
  assert.ok(!r.days.some(x => x.movedFrom));
});
