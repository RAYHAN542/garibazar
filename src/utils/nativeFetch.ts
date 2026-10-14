import { Capacitor, registerPlugin } from "@capacitor/core";

// On the Android app, requests to our own hosts go through a native plugin
// (DohHttpPlugin.java) that falls back to DNS-over-HTTPS when the mobile
// network's DNS can't resolve the domain (seen on Robi). On web this is
// just the normal fetch.

interface DohHttpPlugin {
  request(opts: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
  }): Promise<{ status: number; headers: Record<string, string>; body: string }>;
}

const DohHttp = registerPlugin<DohHttpPlugin>("DohHttp");

const NATIVE_HOSTS = new Set([
  "garibazar.shop",
  "www.garibazar.shop",
  "opppnxkrnhyzjzbbiity.supabase.co",
]);

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const nativeFetch: typeof fetch = async (input, init) => {
  if (!Capacitor.isNativePlatform()) return fetch(input as any, init);

  const req = new Request(input as any, init);
  let host = "";
  try {
    host = new URL(req.url).host;
  } catch {
    /* not a URL -- use normal fetch */
  }
  if (!NATIVE_HOSTS.has(host)) return fetch(req);

  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    headers[k] = v;
  });

  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const buf = await req.arrayBuffer();
    if (buf.byteLength > 0) body = toBase64(buf);
  }

  if (req.signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const res = await DohHttp.request({ url: req.url, method: req.method, headers, body });
  const noBody = [101, 204, 205, 304].includes(res.status) || req.method === "HEAD";
  return new Response(noBody ? null : fromBase64(res.body), {
    status: res.status,
    headers: res.headers,
  });
};

export function isNetworkError(err: unknown): boolean {
  const msg = String((err as any)?.message || err || "");
  return (
    err instanceof TypeError ||
    /failed to fetch|network|name_not_resolved|unable to resolve|unknownhost|load failed/i.test(msg)
  );
}
