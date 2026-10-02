/*
 * sync.js — akun pelari & sinkron data ke cloud (Supabase: Auth + Postgres).
 *
 * Model: local-first. Data tetap disimpan di browser (cepat, bisa offline) dan disalin ke
 * satu baris per pengguna di tabel `runner_data` (kolom JSON). Row Level Security memastikan
 * setiap pelari hanya bisa membaca & menulis datanya sendiri (lihat supabase/schema.sql).
 *
 * Bagian `merge` murni (tanpa DOM/jaringan) agar bisa diuji di Node.
 */
(function (root) {
  'use strict';

  function isEmpty(s) {
    return !s || s.sample || (!s.profile && !s.plan && !(s.logs && s.logs.length));
  }

  function union(a, b) {
    var seen = {}, out = [];
    (a || []).concat(b || []).forEach(function (x) { if (!seen[x]) { seen[x] = true; out.push(x); } });
    return out;
  }

  /**
   * Gabungkan data perangkat ini dengan data di akun.
   * - Salah satu kosong/contoh -> pakai yang lain.
   * - Profil & rencana: dari versi yang terakhir disimpan (savedAt).
   * - Log: gabungan per id; entri yang pernah dihapus (deletedLogIds) tidak dihidupkan lagi.
   * - Cek kesiapan: gabungan per tanggal, versi terbaru menang.
   */
  function merge(local, remote) {
    if (isEmpty(remote)) return { state: local, changed: false, source: 'local' };
    if (isEmpty(local)) return { state: Object.assign({}, remote, { sample: false }), changed: true, source: 'remote' };
    var lt = local.savedAt || '', rt = remote.savedAt || '';
    var newer = lt >= rt ? local : remote, older = newer === local ? remote : local;
    var deleted = union(local.deletedLogIds, remote.deletedLogIds);
    var gone = {};
    deleted.forEach(function (id) { gone[id] = true; });
    var byId = {};
    (older.logs || []).forEach(function (l) { byId[l.id] = l; });
    (newer.logs || []).forEach(function (l) { byId[l.id] = l; });
    var logs = Object.keys(byId).map(function (k) { return byId[k]; }).filter(function (l) { return !gone[l.id]; });
    logs.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var merged = Object.assign({}, older, newer, {
      logs: logs,
      readiness: Object.assign({}, older.readiness || {}, newer.readiness || {}),
      ignoredExt: union(local.ignoredExt, remote.ignoredExt),
      deletedLogIds: deleted,
      sample: false,
      savedAt: lt > rt ? lt : rt
    });
    var changed = JSON.stringify(merged) !== JSON.stringify(local);
    return { state: merged, changed: changed, source: 'merged' };
  }

  // ---------- Klien cloud (browser) ----------

  var client = null;
  var user = null;
  var TABLE = 'runner_data';

  function config() {
    var c = root.LINTASAN_CONFIG || {};
    return c.supabaseUrl && c.supabaseAnonKey ? c : null;
  }

  var LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js';

  function enabled() { return !!config(); }

  function loadLib() {
    if (root.supabase && root.supabase.createClient) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var sc = document.createElement('script');
      sc.src = LIB;
      sc.onload = function () { resolve(); };
      sc.onerror = function () { reject(new Error('Gagal memuat modul akun. Periksa koneksi internet.')); };
      document.head.appendChild(sc);
    });
  }

  /** Buat klien & pulihkan sesi (juga memproses tautan konfirmasi/reset dari email). */
  async function init(onChange) {
    if (!enabled()) return null;
    await loadLib();
    var c = config();
    client = root.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey, {
      // implicit flow: token dari tautan email datang di #hash, tidak bentrok dengan ?code= milik Strava
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit', storageKey: 'lintasan.auth' }
    });
    client.auth.onAuthStateChange(function (event, session) {
      user = session ? session.user : null;
      if (onChange) onChange(event, user);
    });
    var res = await client.auth.getSession();
    user = res.data && res.data.session ? res.data.session.user : null;
    return user;
  }

  function redirectTo() { return location.origin + location.pathname; }

  function msg(err) {
    var m = (err && err.message) || String(err);
    if (/Invalid login credentials/i.test(m)) return 'Email atau password salah.';
    if (/already registered|already exists/i.test(m)) return 'Email ini sudah terdaftar. Silakan masuk.';
    if (/Email not confirmed/i.test(m)) return 'Email belum dikonfirmasi. Buka tautan di email pendaftaran Anda.';
    if (/Password should be at least/i.test(m)) return 'Password minimal 8 karakter.';
    if (/rate limit/i.test(m)) return 'Terlalu banyak percobaan. Tunggu beberapa menit.';
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Tidak bisa terhubung ke server akun. Periksa koneksi internet.';
    return m;
  }

  function ready() { if (!client) throw new Error('Modul akun belum siap. Muat ulang halaman.'); }

  async function signUp(email, password) {
    ready();
    var r = await client.auth.signUp({ email: email, password: password, options: { emailRedirectTo: redirectTo() } });
    if (r.error) throw new Error(msg(r.error));
    // tanpa sesi = Supabase meminta konfirmasi email dulu
    return { needsConfirm: !r.data.session, user: r.data.user };
  }

  async function signIn(email, password) {
    ready();
    var r = await client.auth.signInWithPassword({ email: email, password: password });
    if (r.error) throw new Error(msg(r.error));
    user = r.data.user;
    return user;
  }

  async function resetPassword(email) {
    ready();
    var r = await client.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() });
    if (r.error) throw new Error(msg(r.error));
  }

  async function updatePassword(password) {
    var r = await client.auth.updateUser({ password: password });
    if (r.error) throw new Error(msg(r.error));
  }

  async function signOut() {
    if (client) await client.auth.signOut();
    user = null;
  }

  async function pull() {
    if (!user) return null;
    var r = await client.from(TABLE).select('data, updated_at').eq('user_id', user.id).maybeSingle();
    if (r.error) throw new Error(msg(r.error));
    return r.data ? r.data.data : null;
  }

  async function push(state) {
    if (!user) return;
    var r = await client.from(TABLE).upsert({ user_id: user.id, data: state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (r.error) throw new Error(msg(r.error));
  }

  root.Cloud = {
    merge: merge,
    isEmpty: isEmpty,
    enabled: enabled,
    init: init,
    user: function () { return user; },
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    resetPassword: resetPassword,
    updatePassword: updatePassword,
    pull: pull,
    push: push
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Cloud;
})(typeof window !== 'undefined' ? window : globalThis);
