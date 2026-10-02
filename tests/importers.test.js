const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const I = require('../js/importers.js');

process.env.TZ = process.env.TZ || 'Asia/Jakarta';
const fx = f => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');
const profile = { age: 30, rest: 60, max: 190, vdot: 40 };

test('CSV parser: kutip & koma ribuan', () => {
  assert.deepStrictEqual(I.parseCSV('a,"b,c",d\n1,"x ""y""",3'), [['a', 'b,c', 'd'], ['1', 'x "y"', '3']]);
  assert.strictEqual(I.toNum('1,018.00'), 1018);
  assert.strictEqual(I.toNum('8,02'), 8.02);
  assert.strictEqual(I.hmsToSec('01:45:30'), 6330);
});

test('Garmin CSV: hanya lari, jarak & durasi benar', () => {
  const raw = I.parseFile('Activities.csv', fx('garmin-activities.csv'));
  assert.strictEqual(raw.length, 4);
  const res = I.merge([], raw, { profile });
  assert.strictEqual(res.notRun, 1);
  assert.strictEqual(res.invalid, 1); // 1.018 km: salah satuan
  assert.strictEqual(res.added.length, 2);
  const first = res.added[0];
  assert.strictEqual(first.date, '2026-09-28');
  assert.strictEqual(first.km, 8.02);
  assert.strictEqual(first.seconds, 2890);
  assert.strictEqual(first.source, 'garmin');
  assert.ok(first.rpeEst);
});

test('Strava CSV: tanggal UTC jadi tanggal lokal, moving time, sepeda dilewati', () => {
  const raw = I.parseFile('activities.csv', fx('strava-activities.csv'));
  const res = I.merge([], raw, { profile });
  assert.strictEqual(res.added.length, 1);
  assert.strictEqual(res.notRun, 1);
  const r = res.added[0];
  assert.strictEqual(r.km, 8.02);
  assert.strictEqual(r.seconds, 2890);
  assert.strictEqual(r.hr, 142);
  assert.strictEqual(r.extId, 'strava:11122233');
  // 28 Sep 23:01 UTC = 29 Sep pagi WIB
  if (process.env.TZ === 'Asia/Jakarta') assert.strictEqual(r.date, '2026-09-29');
});

test('Strava API: workout_type race & long run', () => {
  const base = { id: 9, sport_type: 'Run', start_date_local: '2026-09-27T06:00:00Z', distance: 10000, moving_time: 2900, elapsed_time: 3000, has_heartrate: true, average_heartrate: 175 };
  const race = I.fromStravaApi({ ...base, workout_type: 1 });
  assert.strictEqual(race.seconds, 3000);
  assert.strictEqual(race.date, '2026-09-27');
  const res = I.merge([], [race, I.fromStravaApi({ ...base, id: 10, workout_type: 2, distance: 20000, moving_time: 7200 })], { profile });
  assert.strictEqual(res.added[0].type, 'RACE');
  assert.strictEqual(res.added[1].type, 'L');
});

test('GPX & TCX', () => {
  const g = I.parseFile('run.gpx', fx('run.gpx'))[0];
  assert.ok(Math.abs(g.km - 1.0) < 0.02, String(g.km));
  assert.strictEqual(g.seconds, 360);
  assert.strictEqual(g.hr, 143);
  const t = I.parseFile('run.tcx', fx('run.tcx'))[0];
  assert.strictEqual(t.km, 5);
  assert.strictEqual(t.seconds, 1800);
  assert.strictEqual(t.hr, 160);
  assert.throws(() => I.parseFile('x.fit', ''), /TCX/);
});

test('dedup: extId, kembaran entri manual, dan aktivitas yang dihapus', () => {
  const raw = I.parseFile('Activities.csv', fx('garmin-activities.csv'));
  const once = I.merge([], raw, { profile });
  const twice = I.merge(once.logs, raw, { profile });
  assert.strictEqual(twice.added.length, 0);
  assert.strictEqual(twice.duplicate, 2);
  const manual = [{ id: 'm', date: '2026-09-28', km: 8, minutes: 48, rpe: 3 }];
  assert.strictEqual(I.merge(manual, raw, { profile }).added.length, 1);
  const ignored = I.merge([], raw, { profile, ignore: [once.added[0].extId] });
  assert.strictEqual(ignored.added.length, 1);
  // lari yang sama dari Strava setelah impor Garmin -> duplikat
  const fromStrava = [{ type: 'Run', date: '2026-09-28', km: 8.0, seconds: 2880, hr: 142, extId: 'strava:1', source: 'strava' }];
  assert.strictEqual(I.merge(once.logs, fromStrava, { profile }).duplicate, 1);
});

test('taksiran RPE dari HR, pace, dan jenis sesi', () => {
  // HRR = (HR - 60) / (190 - 60)
  assert.strictEqual(I.estimateRpe({ hr: 140, seconds: 2400, km: 6 }, profile), 3);   // 62% HRR
  assert.strictEqual(I.estimateRpe({ hr: 140, seconds: 6000, km: 15 }, profile), 4);  // +1 untuk >90 mnt
  assert.strictEqual(I.estimateRpe({ hr: 178, seconds: 1800, km: 6 }, profile), 7);   // 91% HRR
  // tanpa HR: pace vs zona VDOT 40 (T ≈ 5:06/km, E lambat ≈ 6:2x/km)
  assert.strictEqual(I.estimateRpe({ seconds: 3600, km: 8.5 }, profile), 3);          // 7:04/km
  assert.strictEqual(I.estimateRpe({ seconds: 1500, km: 5.2 }, profile), 7);          // 4:48/km
  assert.strictEqual(I.estimateRpe({ seconds: 3600, km: 10, race: true }, profile), 8);
  assert.strictEqual(I.estimateRpe({ hr: 172, seconds: 2700, km: 8 }, null), 6);     // tanpa profil: asumsi 60/190 -> 86% HRR
  assert.strictEqual(I.estimateRpe({ seconds: 2700, km: 8, workout: 'Q' }, null), 6);
  assert.strictEqual(I.classify({ seconds: 3000 }, 3, 'Q'), 'Q');
  assert.strictEqual(I.classify({ seconds: 5000 }, 4, null), 'L');
  assert.strictEqual(I.classify({ seconds: 2400 }, 7, null), 'Q');
});
