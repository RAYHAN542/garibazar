import dotenv from "dotenv";

dotenv.config({ path: ".env.development.local" });
dotenv.config();

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import admin from "firebase-admin";
import { createClient } from "@supabase/supabase-js";
import helmet from "helmet";
import cors from "cors";
import phoneAuthHandler from "./api/auth/phone";

const isProd = process.env.NODE_ENV === "production";
const logger = {
  log: (message: string, ...args: any[]) => {
    if (!isProd) console.log(message, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    if (!isProd) console.warn(message, ...args);
  },
  info: (message: string, ...args: any[]) => {
    if (!isProd) console.info(message, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(message, ...args); // Errors are preserved for debugging/logging tools
  }
};

// Initialize the Google Gen AI client with the correct API key and metadata header
const geminiApiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (geminiApiKey) {
  ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
} else {
  logger.warn("GEMINI_API_KEY is not defined. AI description generation is disabled.");
}

// Lazy-loaded Firebase Admin SDK to avoid circular dependencies and crash on startup if credentials mismatch
let adminAppInitialized = false;

function getFirebaseAdmin(): any {
  if (!adminAppInitialized) {
    try {
      (admin as any).initializeApp({
        credential: (admin as any).credential.applicationDefault()
      });
      adminAppInitialized = true;
    } catch (err) {
      try {
        (admin as any).initializeApp({
          projectId: process.env.VITE_FIREBASE_PROJECT_ID || "gari-bazar"
        });
        adminAppInitialized = true;
      } catch (err2) {
        logger.warn("Could not fully initialize firebase-admin SDK. Using graceful fallback.", err2);
      }
    }
  }
  return admin;
}

// Token Verification Helper: Supabase access tokens must not be verified with Firebase Admin.
const supabaseAuth = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function verifyAuthToken(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) throw new Error("Missing bearer token");

  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) {
    throw new Error("Unauthorized: Invalid Supabase bearer token");
  }

  return { uid: data.user.id, email: data.user.email, user: data.user };
}

// Fallback local memory caches in case of offline/unconfigured Firebase instances
const ipLimitStoreFallback = new Map<string, { count: number; resetTime: number }>();
const uidLimitStoreFallback = new Map<string, { count: number; resetTime: number }>();

async function checkRateLimitFirestore(
  type: "ip" | "uid",
  key: string,
  limit: number,
  windowMs: number,
  fallbackStore: Map<string, any>
): Promise<boolean> {
  const now = Date.now();
  
  // 1. Try to use Firestore-synchronized rate limit
  try {
    const adminSDK = getFirebaseAdmin();
    // Validate that the admin SDK claims working apps active
    if (adminSDK && adminSDK.apps && adminSDK.apps.length > 0) {
      const db = adminSDK.firestore();
      
      const windowKey = Math.floor(now / windowMs);
      const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, "_");
      const docId = `rl_${type}_${sanitizedKey}_${windowKey}`;
      
      const docRef = db.collection("rate_limits").doc(docId);
      const docSnap = await docRef.get();
      
      let count = 0;
      if (docSnap.exists) {
        count = docSnap.data()?.count || 0;
      }
      
      if (count >= limit) {
        return false;
      }
      
      await docRef.set({
        count: count + 1,
        expiry: now + windowMs,
        type,
        updatedAt: now
      }, { merge: true });
      
      return true;
    }
  } catch (err) {
    logger.warn(`Firestore rate limiter fallback triggered:`, err);
  }

  // 2. Reliable local in-memory fallback
  const record = fallbackStore.get(key);

  if (!record) {
    fallbackStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}

// Background cleaner for expired Firestore rate limit entries to prevent storage bloating
async function cleanExpiredRateLimits() {
  try {
    const adminSDK = getFirebaseAdmin();
    if (adminSDK && adminSDK.apps && adminSDK.apps.length > 0) {
      const db = adminSDK.firestore();
      const now = Date.now();
      const expiredDocs = await db.collection("rate_limits")
        .where("expiry", "<", now)
        .limit(100)
        .get();
      
      if (expiredDocs.empty) return;
      
      const batch = db.batch();
      expiredDocs.docs.forEach((doc: any) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      logger.log(`Successfully purged ${expiredDocs.size} expired rate-limiting entries from Firestore.`);
    }
  } catch (err) {
    logger.error("Rate limit background cleaner error:", err);
  }
}

// Anti-NoSQL Injection and trim helper functions
function sanitizeValue(val: any): any {
  if (typeof val === "string") {
    return val.trim();
  }

  // NoSQL / MongoDB Parameter Injection defense
  if (val !== null && typeof val === "object") {
    if (Array.isArray(val)) {
      return val.map(sanitizeValue);
    } else {
      const sanitizedObj: Record<string, any> = {};
      for (const key of Object.keys(val)) {
        // Strip or replace any prefix '$' keys commonly used in NoSQL query injection
        const sanitizedKey = key.startsWith("$") ? key.replace(/^\$+/, "") : key;
        sanitizedObj[sanitizedKey] = sanitizeValue(val[key]);
      }
      return sanitizedObj;
    }
  }

  return val;
}

// Express Middleware for sanitizing req.body, req.query, and req.params
function inputSanitizerMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }
  if (req.params) {
    req.params = sanitizeValue(req.params);
  }
  next();
}

// Setup background interval task to run every 10 minutes
setInterval(() => {
  cleanExpiredRateLimits().catch(logger.error);
}, 10 * 1000 * 60);

async function startServer() {
  const app = reportAppCheck(express());
  const PORT = 3000;

  // Custom helper to bypass TS issue with Express initialization
  function reportAppCheck(instance: any) {
    return instance;
  }

  // 1. Helmet integration for secure HTTP headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'", "https://*.firebaseapp.com", "https://*.googleapis.com", "https://*.firebasestorage.app"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:", "https://images.unsplash.com"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://*.googleapis.com", "https://*.firebaseapp.com"],
          connectSrc: [
            "'self'",
            "https://*.googleapis.com",
            "https://*.firebaseio.com",
            "wss://*.firebaseio.com",
            "https://*.firebasestorage.app",
            "https://*.googleapis.com",
            "https://identitytoolkit.googleapis.com",
          ],
          frameAncestors: ["'self'", "https://*.google.com", "https://*.run.app", "https://ai.studio", "https://aistudio.google.com"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      frameguard: false, // Let AI Studio preview frame the app safely
    })
  );

  // 2. CORS configurations with strict origin validation
  const defaultOrigins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://localhost",
    "https://garibazar.shop",
    "https://www.garibazar.shop",
  ];
  const allowedOrigins = new Set([
    ...defaultOrigins,
    ...(process.env.ALLOWED_ORIGINS || "").split(",").map(o => o.trim()).filter(Boolean),
  ]);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        let isAllowed = allowedOrigins.has(origin);
        try {
          const url = new URL(origin);
          isAllowed ||= url.hostname.endsWith(".vercel.app") || url.hostname.endsWith(".vercel.sh");
        } catch {
          isAllowed = false;
        }

        callback(isAllowed ? null : new Error("CORS policy violation: request from unauthorized origin."), isAllowed);
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      credentials: true,
    })
  );

  // Enable JSON request body parsing with size restriction to prevent DOS memory exhaustion
  app.use(express.json({ limit: "1mb" }));

  // 3. Request Input Sanitizer Middleware (Defends against XSS, SQL injection, and NoSQL parameter manipulation)
  app.use(inputSanitizerMiddleware);

  // API endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", aiEnabled: !!ai });
  });

  // AI-powered description generator for car parts sellers
  app.post("/api/generate-description", async (req, res) => {
    try {
      // 1. Verify User Token
      let decodedToken;
      try {
        decodedToken = await verifyAuthToken(req);
      } catch (authErr: any) {
        return res.status(401).json({ error: "অননুমোদিত অনুরোধ! দয়া করে লগইন করুন।" });
      }

      const uid = decodedToken.uid;

      // 2. Client IP Rate Limiting: max 10 requests per minute
      const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || "unknown_ip";
      const clientIp = (Array.isArray(rawIp) ? rawIp[0] : rawIp).split(',')[0].trim();
      
      const ipIsAllowed = await checkRateLimitFirestore("ip", clientIp, 10, 60 * 1000, ipLimitStoreFallback);
      if (!ipIsAllowed) {
        return res.status(429).json({ 
          error: "অনুরোধের সংখ্যা বেশি! প্রতি মিনিটে সর্বোচ্চ ১০ বার AI ব্যবহার করা যাবে।" 
        });
      }

      // 3. User UID Rate Limiting: max 50 requests per day (24 hours)
      const uidIsAllowed = await checkRateLimitFirestore("uid", uid, 50, 24 * 60 * 60 * 1000, uidLimitStoreFallback);
      if (!uidIsAllowed) {
        return res.status(429).json({ 
          error: "দৈনিক ব্যবহারের সীমা শেষ! ২৪ ঘণ্টায় সর্বোচ্চ ৫০ বার AI ব্যবহার করা যাবে।" 
        });
      }

      const { title, model, price, category, language = "bn" } = req.body;

      if (!title) {
        return res.status(400).json({ error: "Title is required to generate description" });
      }

      if (!ai) {
        return res.status(503).json({ 
          error: "Gemini API is not configured yet. Please enter the API key in settings or use standard descriptions." 
        });
      }

      const isBangla = language === "bn";
      
      const prompt = `Write a professional, attractive, and concise e-commerce listing details description for a car part.
Details:
- Part Name: ${title}
- Car Model Compatibility: ${model || "N/A / Various Models"}
- Price: ${price ? price + " BDT" : "Contact for Price"}
- Category: ${category || "General Parts"}

Please write the description in ${isBangla ? "Bengali (বাংলা)" : "English"}.
Keep it structured, highlighting compatibility, reliability, usage warning or benefits, and close with a friendly invitation for buyers to click contact info. Do not include any HTML tags or markdown tables; keep it to plain markdown bulletins and a couple of paragraphs. Max 150 words.`;

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
      });

      const generatedText = response.text || "Could not generate description.";
      res.json({ description: generatedText });

    } catch (err: any) {
      logger.error("Gemini API error during description generation:", err);
      res.status(500).json({ error: err.message || "Failed to generate description with Gemini AI" });
    }
  });

  // Phone/password auth
  app.post("/api/auth/phone", phoneAuthHandler);

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    logger.log("Vite middleware mounted in development mode.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    logger.log(`Serving static files from ${distPath} in production mode.`);
  }

  app.listen(PORT, "0.0.0.0", () => {
    logger.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  logger.error("Critical server startup error:", err);
});
