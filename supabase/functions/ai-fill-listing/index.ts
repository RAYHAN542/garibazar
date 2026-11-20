// @ts-nocheck
// ai-fill-listing: fills EMPTY brand/model of vehicle listings using Gemini (photo + description).
// Only processes rows that the database queue (public.listing_ai) marked 'pending'.
// Never touches title/description/price. Seller-written brand is never overwritten.
// Policy: brand is applied at confidence >= 0.85; model is applied only when the seller's text states it.
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash"];
const APPLY_MIN = 0.85;
const BATCH_DAILY_CAP = 350;
const SINGLE_DAILY_CAP = 480;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sleep = (ms: number) => new Promise((s) => setTimeout(s, ms));
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

const PROMPT = `You extract structured data for a Bangladeshi vehicle marketplace listing.
Input: ONE photo from the listing and the seller's description (Bengali and/or English, messy, may be empty).
Rules:
- Use BOTH the photo and the text. If the text clearly states brand/model/year, trust the text over the photo.
- If no description is provided, rely on the photo only. Use null for anything you cannot read or are not certain about.
- Write brand and model in English letters (e.g. Toyota, Premio; Tata, 1613; Mahindra, Bolero).
- If you are not sure about a field, return null. Never guess a model or year.
- year only if written in the text or printed on the vehicle; otherwise null.
- Do NOT describe condition or quality (no words like excellent/fresh). A dealership or seller name is NOT a brand.
- vehicle_type: car, microbus, bus, truck, pickup, bike, excavator, heavy_equipment, parts, other.
- brand_source and model_source: text, photo, both, or none. Use photo only if you can read a badge/logo/model text in the image, or the vehicle is unmistakable.
- confidence is 0 to 1 for brand+model together. Use 0.9 or higher ONLY if the description states them explicitly or a badge/model text is clearly legible in the photo. If brand or model comes only from the overall shape/style of the vehicle, confidence must be 0.7 or lower.
- evidence: one short English sentence saying what you based brand/model on.
- suggested_title: only brand + model (+ year if known), English, max 60 chars; null if brand and model are both null.`;

const SRC = { type: "STRING", format: "enum", enum: ["text", "photo", "both", "none"] };
const schema = {
  type: "OBJECT",
  properties: {
    brand: { type: "STRING", nullable: true },
    brand_source: SRC,
    model: { type: "STRING", nullable: true },
    model_source: SRC,
    year: { type: "INTEGER", nullable: true },
    vehicle_type: { type: "STRING", format: "enum", enum: ["car", "microbus", "bus", "truck", "pickup", "bike", "excavator", "heavy_equipment", "parts", "other"] },
    fuel: { type: "STRING", nullable: true },
    transmission: { type: "STRING", nullable: true },
    color: { type: "STRING", nullable: true },
    confidence: { type: "NUMBER" },
    evidence: { type: "STRING" },
    suggested_title: { type: "STRING", nullable: true },
  },
  required: ["brand", "brand_source", "model", "model_source", "year", "vehicle_type", "confidence", "evidence", "suggested_title"],
};

function clean(s: string): string {
  const bn = "০১২৩৪৫৬৭৮৯";
  let t = (s || "").replace(/[০-৯]/g, (d) => String(bn.indexOf(d)));
  t = t.replace(/(?:\+?88[\s-]?)?0?1[3-9](?:[\s-]?\d){8}/g, "[phone]");
  return t.slice(0, 1200);
}

const H = { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" };

async function rpc(name: string, args: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST", headers: H, body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`rpc ${name} ${r.status}: ${(await r.text()).slice(0, 150)}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

async function countToday(): Promise<number> {
  const dhakaNow = new Date(Date.now() + 6 * 3600 * 1000);
  dhakaNow.setUTCHours(0, 0, 0, 0);
  const startUtc = new Date(dhakaNow.getTime() - 6 * 3600 * 1000).toISOString();
  const r = await fetch(`${SUPABASE_URL}/rest/v1/listing_ai?select=listing_id&processed_at=gte.${encodeURIComponent(startUtc)}&status=in.(done,failed)`, {
    headers: { ...H, Prefer: "count=exact", "Range-Unit": "items", Range: "0-0" },
  });
  const cr = r.headers.get("content-range") ?? "";
  const n = Number(cr.split("/")[1]);
  return Number.isFinite(n) ? n : 0;
}

function normBrand(b: string, known: string[]): string | null {
  const x = String(b ?? "").trim().replace(/\s+/g, " ");
  if (x.length < 2 || x.length > 30 || !/^[A-Za-z][A-Za-z0-9 .&'-]*$/.test(x)) return null;
  const hit = known.find((k) => k.toLowerCase() === x.toLowerCase());
  return hit ?? x;
}

async function analyze(imageUrl: string, description: string) {
  try {
    const ir = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    if (!ir.ok) return { error: "image " + ir.status };
    const buf = new Uint8Array(await ir.arrayBuffer());
    if (buf.length > 6_000_000) return { error: "image too large" };
    let mime = (ir.headers.get("content-type") ?? "").split(";")[0];
    if (!mime.startsWith("image/")) mime = "image/jpeg";
    const body = JSON.stringify({
      contents: [{ role: "user", parts: [
        { text: PROMPT + "\n\nDescription:\n" + (clean(description) || "(no description provided)") },
        { inline_data: { mime_type: mime, data: encodeBase64(buf) } },
      ] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.1 },
    });
    let lastErr = "";
    for (const model of MODELS) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY }, body, signal: AbortSignal.timeout(60000) });
        const j = await r.json().catch(() => ({}));
        if (r.ok) {
          const txt = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
          try { return { ai: JSON.parse(txt), model }; } catch { lastErr = model + ": bad json"; break; }
        }
        lastErr = `${model} ${r.status}: ` + String(j?.error?.message ?? "").slice(0, 100);
        if ([429, 500, 503].includes(r.status) && attempt === 0) { await sleep(6000); continue; }
        break;
      }
    }
    return { error: lastErr };
  } catch (e) {
    return { error: String(e).slice(0, 150) };
  }
}

async function finish(id: string, status: string, ai: unknown, usedModel: string | null, note: string | null, apply: boolean, nb: string | null, nm: string | null) {
  return await rpc("ai_finish", { p_id: id, p_status: status, p_ai: ai, p_used_model: usedModel, p_note: note, p_apply: apply, p_new_brand: nb, p_new_model: nm });
}

async function handle(item: any, known: string[]): Promise<boolean> {
  const id = item.listing_id as string;
  const lastTry = Number(item.attempts) >= 4;
  try {
    if (String(item.brand ?? "").trim() !== "") { await finish(id, "skipped", null, null, "brand already set", false, null, null); return false; }
    if (item.sub_category === "general" || item.category !== "vehicles") { await finish(id, "skipped", null, null, "not a vehicle listing", false, null, null); return false; }
    const img = Array.isArray(item.images) ? item.images.find((x: unknown) => typeof x === "string") : null;
    if (!img) { await finish(id, lastTry ? "failed" : "pending", null, null, "no image yet", false, null, null); return false; }
    const r: any = await analyze(img, String(item.description ?? ""));
    if (r.error) { await finish(id, lastTry ? "failed" : "pending", null, null, r.error, false, null, null); return false; }
    const ai = r.ai;
    const conf = Number(ai?.confidence) || 0;
    let apply = false, nb: string | null = null, nm: string | null = null, note: string | null = null;
    if (ai?.brand && conf >= APPLY_MIN && ai?.vehicle_type !== "parts") {
      nb = normBrand(ai.brand, known);
      if (nb) {
        apply = true;
        const t = String(ai.suggested_title ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 80);
        const modelFromText = ai.model_source === "text" || ai.model_source === "both";
        if (ai.model && t.length >= 3 && modelFromText) nm = t;
        else if (ai.model) note = "model withheld: not stated in seller text";
      }
    }
    return Boolean(await finish(id, "done", ai, r.model, note, apply, nb, nm));
  } catch (e) {
    try { await finish(id, lastTry ? "failed" : "pending", null, null, String(e).slice(0, 150), false, null, null); } catch { /* ignore */ }
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "post only" }, 405);
  if (!GEMINI_KEY) return json({ error: "not configured" }, 500);
  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" && UUID.test(body.id) ? body.id : null;
  const batch = Math.max(0, Math.min(Number(body?.batch) || 0, 9));
  if (!id && !batch) return json({ error: "bad request" }, 400);
  try {
    const used = await countToday();
    if (used >= (id ? SINGLE_DAILY_CAP : BATCH_DAILY_CAP)) return json({ ok: true, skipped: "daily cap", used });
    const claimed: any[] = (await rpc("ai_claim", { p_limit: id ? 1 : batch, p_id: id })) ?? [];
    if (!claimed.length) return json({ ok: true, processed: 0 });
    const known: string[] = (await rpc("ai_known_brands", {})) ?? [];
    let applied = 0;
    for (let i = 0; i < claimed.length; i += 3) {
      const t0 = Date.now();
      const res = await Promise.all(claimed.slice(i, i + 3).map((x) => handle(x, known)));
      applied += res.filter(Boolean).length;
      const wait = 15000 - (Date.now() - t0);
      if (i + 3 < claimed.length && wait > 0) await sleep(wait);
    }
    return json({ ok: true, processed: claimed.length, applied });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
});
