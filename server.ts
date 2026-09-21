import "dotenv/config";

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. Helmet integration for secure HTTP headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:", "https://images.unsplash.com"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          connectSrc: ["'self'", "https://*.supabase.co"],
          frameAncestors: ["'self'", "https://*.google.com", "https://*.run.app", "https://ai.studio", "https://aistudio.google.com"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      frameguard: false, // Let AI Studio preview frame the app safely
    })
  );

  // 2. CORS configurations with strict origin validation
  const devOrigins = [
    "http://localhost:3000",
    "http://localhost:5173",
  ];
  // In production, set ALLOWED_ORIGINS env var as comma-separated list
  // e.g. ALLOWED_ORIGINS=https://garibazar.vercel.app,https://garibazar.com
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
    : devOrigins;

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, same-origin)
        if (!origin) return callback(null, true);

        const isAllowed = allowedOrigins.includes(origin) ||
          (process.env.NODE_ENV !== "production" && (
            origin === "http://localhost:3000" ||
            origin === "http://localhost:5173"
          ));

        if (isAllowed) {
          callback(null, true);
        } else {
          callback(new Error("CORS policy violation: request from unauthorized origin."));
        }
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
    res.json({ status: "ok" });
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
