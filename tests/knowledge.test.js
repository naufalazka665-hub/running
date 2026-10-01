const test = require('node:test');
const assert = require('node:assert');
const K = require('../js/knowledge.js');

test('setiap topik lengkap dengan referensi', () => {
  for (const t of K.TOPICS) {
    assert.ok(t.refs.length > 0 && t.points.length > 0 && t.practice.length > 0, t.id);
    assert.ok(['Kuat', 'Sedang', 'Praktik'].includes(t.evidence), t.id);
  }
});

test('pencarian menemukan topik relevan', () => {
  assert.strictEqual(K.search('kenapa easy run harus pelan di zona 2')[0].topic.id, 'intensitas');
  assert.strictEqual(K.search('berapa gel saat marathon, carb loading')[0].topic.id, 'nutrisi');
  assert.strictEqual(K.search('kapan mulai taper')[0].topic.id, 'taper');
  assert.strictEqual(K.search('lari di cuaca panas lembap')[0].topic.id, 'hidrasi');
});
