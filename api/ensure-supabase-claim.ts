/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ============================================================
// api/ensure-supabase-claim.ts
// ============================================================
// Supabase-এর Third-Party Auth (Firebase) ব্যবহার করতে হলে প্রতিটা
// Firebase ইউজারের ID token-এ role: "authenticated" নামের একটা
// custom claim থাকতে হবে -- Firebase ডিফল্টভাবে এটা দেয় না।
//
// এই endpoint লগইন/সাইনআপের ঠিক পরে একবার কল করা হবে (ফ্রন্টএন্ড
// থেকে)। এটা claim-টা আছে কিনা চেক করে, না থাকলে বসিয়ে দেয়।
// ইতিমধ্যে সেট করা থাকলে কিছুই করে না -- তাই বারবার কল করলেও
// সমস্যা নেই, প্রতিবার Firebase-এ write হয় না।

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { applyCors } from "./_lib/cors.js";

if (!getApps().length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      initializeApp({ credential: cert(serviceAccount) });
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e);
    }
  }
}

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    res.status(401).json({ error: "Missing ID token" });
    return;
  }

  try {
    const decoded = await getAuth().verifyIdToken(idToken);

    // ইতিমধ্যে claim সেট করা থাকলে আর কিছু করার দরকার নেই
    if (decoded.role === "authenticated") {
      res.status(200).json({ ok: true, alreadySet: true });
      return;
    }

    const userRecord = await getAuth().getUser(decoded.uid);
    const existingClaims = userRecord.customClaims || {};
    await getAuth().setCustomUserClaims(decoded.uid, {
      ...existingClaims,
      role: "authenticated",
    });

    res.status(200).json({ ok: true, alreadySet: false });
  } catch (err) {
    console.error("ensure-supabase-claim failed:", err);
    res.status(401).json({ error: "Invalid token" });
  }
}
