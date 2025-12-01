import cors from 'cors';
import { logger } from '../utils/logger';
import { env } from '../env';

/**
 * Гибридная CORS стратегия:
 * - Production: Белый список доменов из env переменной ALLOWED_ORIGINS
 * - Development: Разреши любой текущий хост (для удобства разработки)
 * 
 * Это решает конфликт: Access-Control-Allow-Origin: * + credentials: true
 * Браузер блокирует cookies при такой комбинации. Решение: всегда использовать конкретный origin!
 */

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // 🔒 PRODUCTION MODE: Строгая валидация
    if (env.NODE_ENV === 'production') {
      const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
      
      if (!allowedOriginsEnv) {
        logger.error('CORS: ALLOWED_ORIGINS not configured in production!');
        callback(new Error('CORS not allowed - ALLOWED_ORIGINS not configured'));
        return;
      }
      
      const allowedList = allowedOriginsEnv.split(',').map(d => d.trim());
      
      // Проверяем что origin в whitelist
      const isAllowed = allowedList.some(allowed => {
        return origin === allowed || origin === `https://${allowed}` || origin === `http://${allowed}`;
      });
      
      if (isAllowed) {
        logger.info('CORS allowed origin', { origin });
        callback(null, true);
      } else {
        logger.warn('CORS blocked - origin not in whitelist', {
          origin,
          allowedList,
        });
        callback(new Error('CORS not allowed'));
      }
      return;
    }
    
    // 🚀 DEVELOPMENT MODE: Удобство разработки
    // ⚠️  ВНИМАНИЕ: Этот режим НАМЕРЕННО НЕ ЗАЩИЩЕН для удобства!
    // На development мы разрешаем любой origin потому что:
    // 1. Много разных dev доменов (localhost:5000, Replit, Docker, etc)
    // 2. Это локальная разработка, нет реальных атак
    // 3. NODE_ENV=production на VPS будет использовать строгую валидацию
    if (env.NODE_ENV === 'development') {
      logger.debug('CORS development mode - allowing all origins', { origin });
      callback(null, true);
      return;
    }
    
    // Fallback: отклонить
    callback(new Error('CORS not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'idempotency-key'],
  maxAge: 604800,
  optionsSuccessStatus: 200,
});
