/*
 * config.js — koneksi ke proyek Supabase "lintasan" (region Singapore).
 * Publishable key memang publik (aman ditaruh di sini); keamanan data dijaga Row Level Security
 * di database, bukan oleh kerahasiaan key ini. JANGAN pernah menaruh service_role / secret key di sini.
 * Kosongkan kedua nilai untuk menjalankan Lintasan tanpa akun (data hanya di browser).
 */
window.LINTASAN_CONFIG = {
  supabaseUrl: 'https://hybqzlactjhnsxldrsxz.supabase.co',
  supabaseAnonKey: 'sb_publishable_syWu7VUq1dfHQhLe9JKvqQ_ALZHxdB7'
};
