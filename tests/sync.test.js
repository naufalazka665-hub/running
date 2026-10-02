const test = require('node:test');
const assert = require('node:assert');
const Cloud = require('../js/sync.js');

const log = (id, date, km) => ({ id, date, km, minutes: km * 6, rpe: 3 });
const base = (over) => Object.assign({ profile: { age: 30 }, plan: null, logs: [], readiness: {}, sample: false, savedAt: '2026-10-01T00:00:00Z' }, over);

test('akun kosong -> data perangkat dipakai & diunggah', () => {
  const local = base({ logs: [log('a', '2026-09-30', 5)] });
  const m = Cloud.merge(local, null);
  assert.strictEqual(m.source, 'local');
  assert.strictEqual(m.state, local);
});

test('perangkat baru (kosong/contoh) -> data akun dipakai utuh', () => {
  const remote = base({ logs: [log('a', '2026-09-30', 5)] });
  for (const local of [{ sample: true, logs: [log('x', '2026-09-01', 3)] }, { profile: null, plan: null, logs: [] }]) {
    const m = Cloud.merge(local, remote);
    assert.strictEqual(m.source, 'remote');
    assert.deepStrictEqual(m.state.logs, remote.logs);
    assert.strictEqual(m.state.sample, false);
  }
});

test('dua perangkat sama-sama berisi: log digabung, profil dari versi terbaru', () => {
  const local = base({ profile: { age: 31 }, savedAt: '2026-10-02T00:00:00Z', logs: [log('a', '2026-09-30', 5), log('b', '2026-10-01', 6)], readiness: { '2026-10-02': { sleepH: 7 } } });
  const remote = base({ profile: { age: 30 }, savedAt: '2026-10-01T00:00:00Z', logs: [log('a', '2026-09-30', 5), log('c', '2026-09-29', 8)], readiness: { '2026-09-29': { sleepH: 6 } } });
  const m = Cloud.merge(local, remote);
  assert.strictEqual(m.source, 'merged');
  assert.deepStrictEqual(m.state.logs.map(l => l.id), ['c', 'a', 'b']);
  assert.strictEqual(m.state.profile.age, 31);
  assert.deepStrictEqual(Object.keys(m.state.readiness).sort(), ['2026-09-29', '2026-10-02']);
  assert.strictEqual(m.state.savedAt, '2026-10-02T00:00:00Z');
});

test('log yang dihapus di satu perangkat tidak hidup lagi', () => {
  const local = base({ savedAt: '2026-10-02T00:00:00Z', logs: [log('b', '2026-10-01', 6)], deletedLogIds: ['a'] });
  const remote = base({ logs: [log('a', '2026-09-30', 5), log('b', '2026-10-01', 6)] });
  const m = Cloud.merge(local, remote);
  assert.deepStrictEqual(m.state.logs.map(l => l.id), ['b']);
  // dan sebaliknya: penghapusan dari akun dihormati perangkat lain
  const m2 = Cloud.merge(remote, Object.assign({}, local, { savedAt: '2026-09-01T00:00:00Z' }));
  assert.deepStrictEqual(m2.state.logs.map(l => l.id), ['b']);
});

test('koreksi RPE terbaru menang', () => {
  const local = base({ savedAt: '2026-10-03T00:00:00Z', logs: [Object.assign(log('a', '2026-09-30', 5), { rpe: 6 })] });
  const remote = base({ logs: [log('a', '2026-09-30', 5)] });
  assert.strictEqual(Cloud.merge(local, remote).state.logs[0].rpe, 6);
  assert.strictEqual(Cloud.merge(remote, local).state.logs[0].rpe, 6);
});

test('tanpa perubahan -> changed false', () => {
  const s = base({ logs: [log('a', '2026-09-30', 5)], ignoredExt: [], deletedLogIds: [] });
  assert.strictEqual(Cloud.merge(s, JSON.parse(JSON.stringify(s))).changed, false);
});
