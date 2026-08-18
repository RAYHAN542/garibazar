import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

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

// এই এন্ডপয়েন্ট দিয়েই নতুন অ্যাডমিন বানানো যাবে — শুধু যিনি ইতিমধ্যে অ্যাডমিন,
// তিনিই আরেকজনকে অ্যাডমিন বানাতে পারবেন। প্রথম/মূল অ্যাডমিন এখনো Firestore-এ
// সরাসরি ডকুমেন্ট বসিয়েই (Firebase Console থেকে) বানাতে হবে — এটা তার জন্য না,
// এরপর থেকে দ্বিতীয়/তৃতীয় অ্যাডমিন যোগ করার জন্য এটা ব্যবহার হবে।
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!getApps().length) {
      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
    }

    // ১) কলারের আইডি টোকেন যাচাই করা (হেডার থেকে)
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) {
      return res.status(401).json({ error: "লগইন প্রয়োজন।" });
    }

    const auth = getAuth();
    let callerUid: string;
    try {
      const decoded = await auth.verifyIdToken(idToken);
      callerUid = decoded.uid;
    } catch (e) {
      return res.status(401).json({ error: "টোকেন অবৈধ বা মেয়াদোত্তীর্ণ।" });
    }

    // ২) কলার নিজে অ্যাডমিন কিনা যাচাই করা (নতুন custom claim, অথবা পুরনো
    // Firestore ডকুমেন্ট পদ্ধতি — যেভাবেই আগে অ্যাডমিন বানানো হয়ে থাকুক)
    const callerRecord = await auth.getUser(callerUid);
    let callerIsAdmin = callerRecord.customClaims?.admin === true;

    if (!callerIsAdmin) {
      const db = getFirestore();
      const callerAdminDoc = await db.collection("admins").doc(callerUid).get();
      callerIsAdmin = callerAdminDoc.exists;
    }

    if (!callerIsAdmin) {
      return res.status(403).json({ error: "শুধু বিদ্যমান অ্যাডমিনরাই নতুন অ্যাডমিন যোগ করতে পারবেন।" });
    }

    // ৩) টার্গেট ইউজার — uid অথবা email দিয়ে খুঁজে বের করা
    const targetUid = String(req.body?.uid || "").trim();
    const targetEmail = String(req.body?.email || "").trim();

    let targetUser;
    if (targetUid) {
      targetUser = await auth.getUser(targetUid);
    } else if (targetEmail) {
      targetUser = await auth.getUserByEmail(targetEmail);
    } else {
      return res.status(400).json({ error: "টার্গেট ইউজারের uid অথবা email দিতে হবে।" });
    }

    // ৪) Custom claim বসানো/সরানো
    const makeAdmin = req.body?.revoke !== true;
    await auth.setCustomUserClaims(targetUser.uid, { admin: makeAdmin });

    // ৫) পুরনো Firestore-ভিত্তিক isAdmin() চেকের সাথে সামঞ্জস্য রাখতে
    // admins/ কালেকশনও sync রাখা হলো
    const db = getFirestore();
    const adminDocRef = db.collection("admins").doc(targetUser.uid);
    if (makeAdmin) {
      await adminDocRef.set({
        email: targetUser.email || null,
        grantedBy: callerUid,
        grantedAt: new Date().toISOString(),
      });
    } else {
      await adminDocRef.delete().catch(() => {});
    }

    return res.status(200).json({
      success: true,
      uid: targetUser.uid,
      email: targetUser.email,
      admin: makeAdmin,
    });
  } catch (err: any) {
    console.error("grant-admin error:", err);
    return res.status(500).json({ error: "কিছু একটা সমস্যা হয়েছে।" });
  }
}

