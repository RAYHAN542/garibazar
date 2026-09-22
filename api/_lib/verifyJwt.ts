import { createRemoteJWKSet, jwtVerify } from "jose";

// 🔧 FIX: this project signs session tokens with an asymmetric key
// (ES256), not the legacy shared HS256 secret -- SUPABASE_JWT_SECRET
// doesn't apply here. Verify against Supabase's own public JWKS instead.
// `jose`'s createRemoteJWKSet caches the keys in memory after the first
// fetch (keeping this warm across invocations on the same serverless
// instance), so this is still a locally-verified check on almost every
// request -- not a getUser() network round-trip every time.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

const JWKS = SUPABASE_URL
  ? createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
  : null;

export async function verifySupabaseToken(token: string): Promise<string | null> {
  if (!JWKS) {
    console.error("[verifyJwt] SUPABASE_URL not set -- cannot verify tokens.");
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, JWKS);
    if (payload.sub && payload.aud === "authenticated") {
      return payload.sub as string;
    }
    console.error("[verifyJwt] token verified but aud/sub unexpected:", JSON.stringify({ aud: payload.aud, hasSub: !!payload.sub }));
    return null;
  } catch (e: any) {
    console.error("[verifyJwt] verification failed:", e?.code || e?.name, e?.message);
    return null;
  }
}
