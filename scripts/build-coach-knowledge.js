/*
 * Salin pustaka sains (js/knowledge.js) ke Edge Function coach-chat sebagai teks
 * agar Coach AI menjawab berdasarkan materi yang sama dengan yang dilihat pelari.
 * Jalankan: npm run build:coach  (otomatis dicek oleh npm test)
 */
const fs = require('fs');
const path = require('path');
const K = require('../js/knowledge.js');

function render() {
  return K.TOPICS.map(t => [
    `## ${t.title} [${t.cat}; bukti: ${t.evidence}]`,
    t.summary,
    'Poin kunci:',
    ...t.points.map(p => `- ${p}`),
    'Penerapan:',
    ...t.practice.map(p => `- ${p}`),
    'Referensi:',
    ...t.refs.map(r => `- ${r}`)
  ].join('\n')).join('\n\n');
}

const out = '// FILE HASIL GENERATE dari js/knowledge.js — jangan diedit manual. Jalankan: npm run build:coach\n' +
  'export const KNOWLEDGE = ' + JSON.stringify(render()) + ';\n';
const target = path.join(__dirname, '..', 'supabase', 'functions', 'coach-chat', 'knowledge.ts');

if (process.argv.includes('--check')) {
  const cur = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (cur !== out) { console.error('knowledge.ts usang. Jalankan: npm run build:coach'); process.exit(1); }
} else {
  fs.writeFileSync(target, out);
  console.log('Ditulis', path.relative(process.cwd(), target), (out.length / 1024).toFixed(1) + ' KB');
}
