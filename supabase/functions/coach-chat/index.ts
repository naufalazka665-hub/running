// coach-chat — Coach AI Lintasan (Supabase Edge Function, Deno).
//
// Alur: browser (pelari yang sudah login) → function ini → Claude API → jawaban.
// - Kunci API Claude hanya ada di server (secret ANTHROPIC_API_KEY), tidak pernah ke browser.
// - Hanya pelari yang login: token Supabase diverifikasi.
// - Kuota harian per pelari dicatat atomik di database (fungsi coach_take_quota_for,
//   hanya bisa dipanggil server dengan service role).
// - Pustaka sains di-cache (prompt caching), data pelari dikirim per permintaan.

import Anthropic from "npm:@anthropic-ai/sdk@0.131.0";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { KNOWLEDGE } from "./knowledge.ts";

const MODEL = "claude-opus-5-5";
const DAILY_LIMIT = Number(Deno.env.get("COACH_DAILY_LIMIT") ?? "30");
const MAX_TURNS = 12;
const MAX_MSG_CHARS = 2000;
const MAX_CONTEXT_CHARS = 16000;

const ALLOWED_ORIGINS = [
  "https://naufalazka665-hub.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

const SYSTEM_PROMPT = `Anda adalah Coach Lintasan, pelatih lari berbasis sport science untuk pelari rekreasi di Indonesia.

Cara Anda bekerja:
- Jawab dalam bahasa Indonesia yang hangat, lugas, dan praktis, seperti pelatih yang mengenal atletnya. Istilah teknis lari (easy run, threshold, VDOT, taper) boleh dipakai.
- Gunakan DATA PELARI yang diberikan: profil, pace & zona, jadwal minggu ini beserta status tiap sesi, log terbaru, cek kesiapan, dan review mingguan. Sebut angka spesifik dari data bila relevan (mis. "easy run Anda Kamis 5:48/km, lebih cepat dari zona E 6:10–6:45").
- Dasarkan saran pada PUSTAKA SAINS di bawah. Bila saran Anda bersandar pada satu topik pustaka, sebut judul topiknya singkat, mis. (Pustaka: Taper sebelum lomba). Bedakan bukti kuat dari praktik pelatih bila itu penting untuk keputusan.
- Jangan mengarang data yang tidak ada. Bila data kurang (mis. belum ada log atau profil), katakan apa yang perlu diisi.
- Aplikasi Lintasan sudah otomatis menyesuaikan jadwal (review mingguan, pemindahan sesi, hari lari). Anda tidak bisa mengubah rencana secara langsung; bila menyarankan perubahan, jelaskan apa yang sebaiknya pelari lakukan atau ubah di aplikasi.
- Prinsip yang Anda jaga: ±80% volume di intensitas rendah, hari keras tidak berurutan, progresi volume bertahap, sesi terlewat tidak ditumpuk, konsistensi lebih penting dari satu sesi.

Keselamatan:
- Anda bukan dokter. Untuk nyeri tajam/terlokalisasi, nyeri tulang yang memburuk, nyeri dada, pingsan, sesak tidak wajar, demam, atau gejala heat stroke: sarankan berhenti berlatih dan segera memeriksakan diri ke tenaga medis. Jangan mendiagnosis.
- Jangan menyarankan suplemen/obat dengan dosis spesifik, diet ekstrem, atau penurunan berat badan agresif.

Format jawaban:
- Mulai dengan jawaban atau rekomendasi inti di kalimat pertama.
- Ringkas: umumnya 80–200 kata. Gunakan poin-poin pendek bila ada langkah. Panjangkan hanya bila diminta.
- Markdown sederhana saja: paragraf, **tebal**, dan daftar "- ". Tanpa tabel dan tanpa heading besar.`;

function cors(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json" },
  });
}

type ChatTurn = { role: "user" | "assistant"; content: string };

function validTurns(x: unknown): ChatTurn[] | null {
  if (!Array.isArray(x) || x.length === 0 || x.length > MAX_TURNS) return null;
  const turns: ChatTurn[] = [];
  for (const t of x) {
    if (!t || (t.role !== "user" && t.role !== "assistant") || typeof t.content !== "string") return null;
    const content = t.content.trim().slice(0, MAX_MSG_CHARS);
    if (!content) return null;
    turns.push({ role: t.role, content });
  }
  if (turns[0].role !== "user" || turns[turns.length - 1].role !== "user") return null;
  return turns;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json(405, { error: "Metode tidak didukung." }, origin);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json(503, { error: "Coach AI belum diaktifkan oleh pemilik situs (kunci API belum dipasang)." }, origin);

  // 1) pelari harus login
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
  if (userErr || !userData?.user) return json(401, { error: "Silakan masuk ke akun untuk memakai Coach AI." }, origin);

  // 2) validasi input
  let body: { messages?: unknown; context?: unknown };
  try { body = await req.json(); } catch { return json(400, { error: "Permintaan tidak valid." }, origin); }
  const turns = validTurns(body.messages);
  if (!turns) return json(400, { error: "Format percakapan tidak valid." }, origin);
  const context = typeof body.context === "string" ? body.context.slice(0, MAX_CONTEXT_CHARS) : "{}";

  // 3) kuota harian (atomik, di database; hanya service role yang boleh memanggil fungsinya)
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data: quota, error: quotaErr } = await admin.rpc("coach_take_quota_for", { p_user: userData.user.id, daily_limit: DAILY_LIMIT });
  if (quotaErr) return json(500, { error: "Gagal memeriksa kuota. Coba lagi." }, origin);
  const q = Array.isArray(quota) ? quota[0] : quota;
  if (!q?.allowed) return json(429, { error: `Kuota Coach AI hari ini (${DAILY_LIMIT} pesan) sudah habis. Coba lagi besok.`, remaining: 0 }, origin);

  // 4) panggil Claude
  const anthropic = new Anthropic({ apiKey });
  try {
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // bila classifier menolak, API mencoba ulang di model fallback yang direkomendasikan
      output_config: { effort: "medium" },
      system: [
        // stabil → di-cache; jangan sisipkan data yang berubah-ubah di blok ini
        { type: "text", text: SYSTEM_PROMPT + "\n\n# PUSTAKA SAINS LINTASAN\n\n" + KNOWLEDGE, cache_control: { type: "ephemeral" } },
        { type: "text", text: "# DATA PELARI (JSON, dari aplikasi)\n" + context },
      ],
      messages: turns,
    });

    if (response.stop_reason === "refusal") {
      return json(200, { reply: "Maaf, saya tidak bisa membantu pertanyaan itu. Coba tanyakan hal lain seputar latihan lari Anda.", remaining: q.remaining }, origin);
    }
    const reply = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return json(200, {
      reply: reply || "Maaf, coach belum bisa menjawab. Coba ulangi pertanyaan Anda.",
      remaining: q.remaining,
      truncated: response.stop_reason === "max_tokens",
    }, origin);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json(429, { error: "Coach AI sedang sibuk. Coba lagi sebentar lagi." }, origin);
    if (err instanceof Anthropic.AuthenticationError) return json(503, { error: "Kunci API Coach AI tidak valid. Pemilik situs perlu memeriksanya." }, origin);
    if (err instanceof Anthropic.APIError) {
      console.error("Claude API error", err.status, err.message);
      return json(502, { error: "Coach AI sedang bermasalah. Coba lagi nanti." }, origin);
    }
    console.error("Unexpected error", err);
    return json(500, { error: "Terjadi kesalahan tak terduga." }, origin);
  }
});
