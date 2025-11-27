import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./env";
import { sessionMiddleware } from "./session";
import { corsMiddleware } from "./middleware/cors";
import { requestLogger } from "./middleware/requestLogger";
import { errorHandler } from "./middleware/errorHandler";
import { generalApiLimiter } from "./middleware/rateLimiter";

const app = express();

app.set('trust proxy', 1);

app.use(corsMiddleware);

app.use(helmet({
  contentSecurityPolicy: env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"],
    },
  } : false,
  crossOriginEmbedderPolicy: false,
}));

app.use(requestLogger);
app.use(cookieParser());
app.use(sessionMiddleware);

if (env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });
}

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

// JSON parser - только для application/json запросов
app.use(express.json({
  limit: '50mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
  type: (req) => {
    const contentType = req.headers['content-type'] || '';
    return contentType.includes('application/json');
  }
}));

// URL-encoded parser - только для application/x-www-form-urlencoded
app.use(express.urlencoded({ 
  limit: '50mb', 
  extended: false,
  type: 'application/x-www-form-urlencoded' // Явно указываем тип
}));


(async () => {
  app.use('/uploads', express.static('uploads'));
  
  app.use('/api', generalApiLimiter);
  
  const server = await registerRoutes(app);

  app.use(errorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(env.PORT, 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
