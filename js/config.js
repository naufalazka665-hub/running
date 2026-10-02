/*
 * config.js — isi setelah membuat proyek Supabase (lihat README, bagian "Akun pelari").
 * Anon key memang publik (aman ditaruh di sini); keamanan data dijaga Row Level Security
 * di database, bukan oleh kerahasiaan key ini. JANGAN pernah menaruh service_role key di sini.
 * Biarkan kosong untuk menjalankan Lintasan tanpa akun (data hanya di browser).
 */
window.LINTASAN_CONFIG = {
  supabaseUrl: '',      // contoh: 'https://abcdefghijkl.supabase.co'
  supabaseAnonKey: ''   // Project Settings → API → anon public key
};
