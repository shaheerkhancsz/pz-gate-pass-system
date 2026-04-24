/// <reference path="./types.d.ts" />
// Set timezone to Pakistan Standard Time (UTC+5) for all timestamps
process.env.TZ = 'Asia/Karachi';
import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import * as notificationService from "./services/notification";
import { storage } from "./storage";
import session from "express-session";
import MySQLStore from 'express-mysql-session';
import { pool } from "./db";

const app = express();

// Body parsing middleware
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: false, limit: '20mb' }));

// Session configuration
const MySQLSessionStore = MySQLStore(session as any);
// Use the pool from db.ts which is a connection pool
// express-mysql-session can accept a pool directly, but sometimes types need casting or it expects a slightly different pool object.
// We can also pass options.
const sessionStore = new MySQLSessionStore({
  expiration: 24 * 60 * 60 * 1000,
  createDatabaseTable: true,
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
}, pool as any);

// Trust the reverse-proxy / tunnel (ngrok, cloudflare, etc.) so that
// secure cookies work when accessed over HTTPS tunnels during demos.
app.set("trust proxy", 1);

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production" || process.env.TRUST_PROXY === "1",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === "production" || process.env.TRUST_PROXY === "1" ? "none" : "lax",
  }
}));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// =============================================
// Phase 11: Automated Overdue Alert Scheduling
// Runs the overdue returnable check daily at 09:00 server time.
// =============================================
function scheduleOverdueCheck() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(9, 0, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1); // schedule for tomorrow if 9am already passed
  }
  const msUntilNext = next.getTime() - now.getTime();

  setTimeout(async () => {
    log("Running scheduled overdue returnable check...");
    try {
      const result = await notificationService.checkAndNotifyOverduePasses();
      log(`Overdue check complete — found ${result.overdueCount} overdue, notified ${result.notified} creator(s)`);
      await storage.logUserActivity({
        userId: null as any,
        userEmail: "system",
        actionType: "system_task",
        entityType: "system",
        entityId: null as any,
        description: `Scheduled overdue check: ${result.overdueCount} overdue passes, ${result.notified} creators notified`,
        ipAddress: "localhost",
      }).catch(() => {});
    } catch (err) {
      log(`Overdue check error: ${err}`);
    }
    scheduleOverdueCheck(); // re-schedule for the next day
  }, msUntilNext);

  const hours = Math.floor(msUntilNext / 3600000);
  const mins = Math.floor((msUntilNext % 3600000) / 60000);
  log(`Next overdue check scheduled in ${hours}h ${mins}m (at 09:00)`);
}

(async () => {
  const server = await registerRoutes(app);

  // Setup Vite for development only
  if (app.get("env") === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    // In production, serve static files from public directory
    app.use(express.static("public"));
  }

  const port = 3000;
  server.listen(port, () => {
    log(`serving on port ${port}`);
    scheduleOverdueCheck(); // Phase 11: start the daily overdue alert scheduler
  });
})();
