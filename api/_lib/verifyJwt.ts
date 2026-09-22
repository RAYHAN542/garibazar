import { jwtVerify } from "jose";

// Verifies a Supabase Auth access token LOCALLY (HS256, shared secret) --
// no network round-trip to Supabase's Auth server, unlike
// supabaseAdmin.auth.getUser(token). This matches how Firebase's
// verifyIdToken() used to work (cryptographic check against a cached key),
// which is why removing the Firebase bridge made things feel slower --
// every authenticated request was paying for an extra network hop that
// didn't exist before.
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const secretKey = JWT_SECRET ? new TextEncoder().encode(JWT_SECRET) : null;

export async function verifySupabaseToken(token: string): Promise<string | null> {
  if (!secretKey) {
    console.error("[verifyJwt] SUPABASE_JWT_SECRET not set -- cannot verify tokens locally.");
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
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
