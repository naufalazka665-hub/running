/*
 * strava.js — koneksi Strava langsung dari browser (tanpa server).
 *
 * Alur OAuth 2.0 (Strava API v3):
 *   1. authorize: https://www.strava.com/oauth/authorize?client_id&redirect_uri&response_type=code&scope=activity:read_all
 *   2. Strava kembali ke halaman ini dengan ?code=...
 *   3. tukar code -> access_token + refresh_token di https://www.strava.com/oauth/token
 *   4. access_token berlaku ±6 jam; diperbarui otomatis dengan refresh_token.
 *
 * Konsekuensi tanpa server: Client Secret aplikasi Strava pribadi Anda disimpan di browser ini.
 * Aman untuk pemakaian pribadi (aplikasi Strava baru hanya bisa dipakai pemiliknya),
 * jangan dipakai untuk aplikasi publik banyak pengguna. Untuk itu pindahkan langkah 3–4 ke server.
 */
(function (root) {
  'use strict';

  var AUTH = 'https://www.strava.com/oauth/authorize';
  var TOKEN = 'https://www.strava.com/oauth/token';
  var API = 'https://www.strava.com/api/v3';
  var KEY = 'lintasan.strava';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function store(c) {
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* abaikan */ }
  }

  function redirectUri() {
    return location.origin + location.pathname;
  }

  /** Bisa dipakai hanya di halaman http(s) biasa (mis. GitHub Pages / localhost). */
  function supported() {
    return /^https?:$/.test(location.protocol);
  }

  function connected() {
    var c = load();
    return !!(c.refresh_token && c.client_id);
  }

  function authorize(clientId, clientSecret) {
    var c = load();
    c.client_id = String(clientId).trim();
    c.client_secret = String(clientSecret).trim();
    c.state = Math.random().toString(36).slice(2);
    store(c);
    location.href = AUTH + '?client_id=' + encodeURIComponent(c.client_id) +
      '&redirect_uri=' + encodeURIComponent(redirectUri()) +
      '&response_type=code&approval_prompt=auto&scope=read,activity:read_all&state=' + c.state;
  }

  async function tokenRequest(params) {
    var body = new URLSearchParams(params);
    var res = await fetch(TOKEN, { method: 'POST', body: body });
    if (!res.ok) throw new Error('Strava menolak token (' + res.status + '). Periksa Client ID/Secret dan Authorization Callback Domain.');
    return res.json();
  }

  /** Dipanggil saat halaman dimuat: tangani ?code= dari Strava. Mengembalikan pesan atau null. */
  async function handleCallback() {
    var q = new URLSearchParams(location.search);
    if (!q.has('code') && !q.has('error')) return null;
    var c = load();
    history.replaceState(null, '', redirectUri() + location.hash);
    if (q.get('error')) return { ok: false, msg: 'Akses Strava dibatalkan.' };
    if (!c.state || q.get('state') !== c.state) return { ok: false, msg: 'Respons Strava tidak cocok (state). Coba hubungkan ulang.' };
    if (!/activity:read/.test(q.get('scope') || '')) return { ok: false, msg: 'Izin "lihat aktivitas" tidak dicentang. Hubungkan ulang dan centang izin aktivitas.' };
    var t = await tokenRequest({ client_id: c.client_id, client_secret: c.client_secret, code: q.get('code'), grant_type: 'authorization_code' });
    c.access_token = t.access_token;
    c.refresh_token = t.refresh_token;
    c.expires_at = t.expires_at;
    c.athlete = t.athlete ? { id: t.athlete.id, name: [t.athlete.firstname, t.athlete.lastname].filter(Boolean).join(' ') } : null;
    delete c.state;
    store(c);
    return { ok: true, msg: 'Strava terhubung' + (c.athlete && c.athlete.name ? ' sebagai ' + c.athlete.name : '') + '.' };
  }

  async function accessToken() {
    var c = load();
    if (!c.refresh_token) throw new Error('Strava belum terhubung.');
    if (c.access_token && c.expires_at && c.expires_at - 300 > Date.now() / 1000) return c.access_token;
    var t = await tokenRequest({ client_id: c.client_id, client_secret: c.client_secret, refresh_token: c.refresh_token, grant_type: 'refresh_token' });
    c.access_token = t.access_token;
    c.refresh_token = t.refresh_token || c.refresh_token;
    c.expires_at = t.expires_at;
    store(c);
    return c.access_token;
  }

  /**
   * Ambil aktivitas sejak `afterSec` (epoch detik). Maks 5 halaman × 100 per sinkron
   * agar aman terhadap batas laju (rate limit) Strava.
   */
  async function fetchActivities(afterSec) {
    var token = await accessToken();
    var all = [];
    for (var page = 1; page <= 5; page++) {
      var res = await fetch(API + '/athlete/activities?per_page=100&page=' + page + '&after=' + Math.floor(afterSec), {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (res.status === 429) throw new Error('Batas permintaan Strava tercapai. Coba lagi 15 menit lagi.');
      if (res.status === 401) throw new Error('Izin Strava kedaluwarsa atau dicabut. Hubungkan ulang.');
      if (!res.ok) throw new Error('Strava error ' + res.status + '.');
      var batch = await res.json();
      all = all.concat(batch);
      if (batch.length < 100) break;
    }
    return all;
  }

  function lastSync() { return load().last_sync || null; }
  function setLastSync(iso) { var c = load(); c.last_sync = iso; store(c); }
  function athlete() { return load().athlete || null; }
  function clientId() { return load().client_id || ''; }

  function disconnect() {
    var c = load();
    var token = c.access_token;
    try { localStorage.removeItem(KEY); } catch (e) { /* abaikan */ }
    // cabut izin di sisi Strava (best effort)
    if (token) fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', headers: { Authorization: 'Bearer ' + token } }).catch(function () {});
  }

  root.Strava = {
    supported: supported, connected: connected, authorize: authorize, handleCallback: handleCallback,
    fetchActivities: fetchActivities, lastSync: lastSync, setLastSync: setLastSync,
    athlete: athlete, clientId: clientId, disconnect: disconnect, redirectUri: redirectUri
  };
})(this);
