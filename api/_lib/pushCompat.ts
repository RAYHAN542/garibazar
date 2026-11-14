import { getMessaging } from "firebase-admin/messaging";

// New app (native GariFcmService + badge) marks itself with interests.v === 2.
// Those devices get DATA-ONLY push so the app builds the notification and sets the icon badge.
// Old app versions keep getting normal notification push, exactly as before.

let cache: { at: number; set: Set<string> } | null = null;

async function v2Tokens(sb: any): Promise<Set<string>> {
  if (cache && Date.now() - cache.at < 60_000) return cache.set;
  const set = new Set<string>();
  try {
    for (let from = 0; from < 20000; from += 1000) {
      const { data, error } = await sb
        .from("device_push_tokens")
        .select("fcm_token")
        .eq("interests->>v", "2")
        .range(from, from + 999);
      if (error || !data) break;
      for (const r of data as any[]) if (r.fcm_token) set.add(r.fcm_token as string);
      if (data.length < 1000) break;
    }
  } catch (_) {}
  cache = { at: Date.now(), set };
  return set;
}

function toDataOnly(msg: any): any {
  const { notification, data, android, ...rest } = msg;
  const n = notification || {};
  return {
    ...rest,
    data: {
      ...(data || {}),
      gb: "1",
      gb_title: String(n.title || ""),
      gb_body: String(n.body || ""),
      ...(n.imageUrl ? { gb_image: String(n.imageUrl) } : {}),
    },
    android: {
      priority: "high",
      ...(android && android.ttl !== undefined ? { ttl: android.ttl } : {}),
    },
  };
}

export async function sendSmart(sb: any, msg: any): Promise<string> {
  const m = getMessaging();
  let isNew = false;
  try {
    isNew = (await v2Tokens(sb)).has(String(msg.token));
  } catch (_) {}
  return m.send(isNew ? toDataOnly(msg) : msg);
}

export async function sendMulticastSmart(sb: any, msg: any): Promise<any> {
  const m = getMessaging();
  const tokens: string[] = msg.tokens || [];
  let set = new Set<string>();
  try {
    set = await v2Tokens(sb);
  } catch (_) {}
  const idxNew: number[] = [];
  const idxOld: number[] = [];
  tokens.forEach((t, i) => (set.has(t) ? idxNew : idxOld).push(i));
  if (idxNew.length === 0) return m.sendEachForMulticast(msg);
  const responses: any[] = new Array(tokens.length);
  let successCount = 0;
  let failureCount = 0;
  const run = async (idx: number[], base: any) => {
    if (!idx.length) return;
    const r = await m.sendEachForMulticast({ ...base, tokens: idx.map((i) => tokens[i]) });
    r.responses.forEach((resp: any, k: number) => {
      responses[idx[k]] = resp;
    });
    successCount += r.successCount;
    failureCount += r.failureCount;
  };
  await run(idxOld, msg);
  await run(idxNew, toDataOnly(msg));
  return { responses, successCount, failureCount };
}
