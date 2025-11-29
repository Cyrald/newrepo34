import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { db } from "./db";
import * as cookieSignature from "cookie-signature";
import { env } from "./env";
import { logger } from "./utils/logger";
import { sql } from "drizzle-orm";

import healthRoutes from "./routes/health.routes";
import authRoutes from "./routes/auth.routes";
import productsRoutes from "./routes/products.routes";
import cartRoutes from "./routes/cart.routes";
import wishlistRoutes from "./routes/wishlist.routes";
import addressesRoutes from "./routes/addresses.routes";
import paymentCardsRoutes from "./routes/payment-cards.routes";
import categoriesRoutes from "./routes/categories.routes";
import promocodesRoutes from "./routes/promocodes.routes";
import { createOrdersRoutes } from "./routes/orders.routes";
import adminRoutes from "./routes/admin.routes";
import { createSupportRoutes } from "./routes/support.routes";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  const connectedUsers = new Map<string, { ws: any, roles: string[] }>();

  const SESSION_ID_REGEX = /^[a-zA-Z0-9_-]{20,128}$/;

  async function validateSessionFromCookie(cookieHeader: string | undefined): Promise<{ userId: string; userRoles: string[] } | null> {
    if (!cookieHeader) return null;
    
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    
    const sessionCookie = cookies['sessionId'];
    if (!sessionCookie) return null;
    
    const decodedCookie = decodeURIComponent(sessionCookie);
    
    if (!decodedCookie.startsWith('s:')) {
      return null;
    }
    
    const signedValue = decodedCookie.slice(2);
    const unsignedValue = cookieSignature.unsign(signedValue, env.SESSION_SECRET);
    
    if (unsignedValue === false) {
      return null;
    }
    
    const sid = unsignedValue;
    
    if (!SESSION_ID_REGEX.test(sid)) {
      logger.warn('Invalid session ID format detected');
      return null;
    }
    
    try {
      const result = await db.execute(sql`SELECT sess FROM session WHERE sid = ${sid}`);
      if (!result.rows || result.rows.length === 0) return null;
      
      const sessionData = result.rows[0].sess as any;
      if (!sessionData || !sessionData.userId) return null;
      
      return {
        userId: sessionData.userId,
        userRoles: sessionData.userRoles || []
      };
    } catch (error) {
      logger.error('Session validation error', { error });
      return null;
    }
  }

  const connectionRateLimits = new Map<string, { count: number; resetAt: number }>();
  const messageRateLimits = new Map<string, { count: number; resetAt: number }>();
  const CONNECTION_LIMIT = 10;
  const CONNECTION_WINDOW = 60 * 1000;
  const MESSAGE_LIMIT = 60;
  const MESSAGE_WINDOW = 60 * 1000;

  setInterval(() => {
    const now = Date.now();
    
    Array.from(connectionRateLimits.entries()).forEach(([key, value]) => {
      if (now > value.resetAt) {
        connectionRateLimits.delete(key);
      }
    });
    
    Array.from(messageRateLimits.entries()).forEach(([key, value]) => {
      if (now > value.resetAt) {
        messageRateLimits.delete(key);
      }
    });
    
    const cleanedConnections = connectionRateLimits.size;
    const cleanedMessages = messageRateLimits.size;
    if (cleanedConnections > 0 || cleanedMessages > 0) {
      logger.debug('Rate limit maps cleanup', { 
        connectionRateLimits: cleanedConnections,
        messageRateLimits: cleanedMessages 
      });
    }
  }, 60000);

  wss.on("connection", async (ws: any, req: any) => {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
    
    const now = Date.now();
    const ipLimit = connectionRateLimits.get(clientIp) || { count: 0, resetAt: now + CONNECTION_WINDOW };
    
    if (now > ipLimit.resetAt) {
      ipLimit.count = 0;
      ipLimit.resetAt = now + CONNECTION_WINDOW;
    }
    
    if (ipLimit.count >= CONNECTION_LIMIT) {
      logger.warn('WebSocket connection rate limit exceeded', { clientIp });
      ws.close(1008, 'Too many connections');
      return;
    }
    
    ipLimit.count++;
    connectionRateLimits.set(clientIp, ipLimit);
    
    const sessionData = await validateSessionFromCookie(req.headers.cookie);
    
    if (!sessionData) {
      logger.warn('WebSocket connection rejected - invalid session', { clientIp });
      ws.close(1008, 'Unauthorized - invalid session');
      return;
    }
    
    const userId = sessionData.userId;
    const userRoleRecords = await storage.getUserRoles(userId);
    const userRoles = userRoleRecords.map(r => r.role);
    connectedUsers.set(userId, { ws, roles: userRoles });
    
    logger.info('WebSocket connection established', { userId, roles: userRoles });
    
    ws.send(JSON.stringify({
      type: "auth_success",
      message: "Подключение установлено",
    }));

    ws.on("message", async (data: any) => {
      try {
        const msgNow = Date.now();
        const userMsgLimit = messageRateLimits.get(userId) || { count: 0, resetAt: msgNow + MESSAGE_WINDOW };
        
        if (msgNow > userMsgLimit.resetAt) {
          userMsgLimit.count = 0;
          userMsgLimit.resetAt = msgNow + MESSAGE_WINDOW;
        }
        
        if (userMsgLimit.count >= MESSAGE_LIMIT) {
          logger.warn('WebSocket message rate limit exceeded', { userId });
          ws.send(JSON.stringify({
            type: "rate_limit",
            message: "Слишком много сообщений, подождите минуту",
          }));
          return;
        }
        
        userMsgLimit.count++;
        messageRateLimits.set(userId, userMsgLimit);
        
        const message = JSON.parse(data.toString());
        
      } catch (error) {
        logger.error("WebSocket message error", { error, userId });
      }
    });

    ws.on("close", () => {
      connectedUsers.delete(userId);
      messageRateLimits.delete(userId);
    });
  });

  app.use('/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/products', productsRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/wishlist', wishlistRoutes);
  app.use('/api/addresses', addressesRoutes);
  app.use('/api/payment-cards', paymentCardsRoutes);
  app.use('/api/categories', categoriesRoutes);
  app.use('/api/promocodes', promocodesRoutes);
  app.use('/api/orders', createOrdersRoutes(connectedUsers));
  app.use('/api/admin', adminRoutes);
  app.use('/api/support', createSupportRoutes(connectedUsers));

  return httpServer;
}
