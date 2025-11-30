import { Request, Response, NextFunction } from 'express';
import { doubleCsrf } from 'csrf-csrf';
import { env } from '../env';
import { logger } from '../utils/logger';

const {
  invalidCsrfTokenError,
  generateCsrfToken,
  doubleCsrfProtection,
} = doubleCsrf({
  getSecret: () => env.SESSION_SECRET,
  // Use connect-pg-simple session ID format (sid column)
  getSessionIdentifier: (req: Request) => {
    const sessionId = req.sessionID || req.session?.id;
    
    if (!sessionId) {
      logger.error('CSRF protection requires active session', {
        hasSession: !!req.session,
        hasSessionID: !!req.sessionID,
        path: req.path,
        method: req.method,
      });
      
      // Выбросить ошибку вместо генерации временного ID
      // Это предотвратит создание невалидных CSRF токенов
      throw new Error('Session required for CSRF protection');
    }
    
    return sessionId;
  },
  cookieName: 'csrf-token',
  cookieOptions: {
    httpOnly: false,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // Same as session cookie (30 days)
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req: Request) => req.headers['x-csrf-token'] as string,
});

export function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip CSRF for webhooks (they use signature verification)
  if (req.path.startsWith('/api/webhooks/')) {
    return next();
  }
  
  // Skip CSRF for initial token endpoint (used after login/register)
  if (req.path === '/api/csrf-token-init') {
    return next();
  }
  
  // Skip CSRF for login and register (chicken-and-egg: can't get CSRF token without session)
  if (req.path === '/api/auth/login' || req.path === '/api/auth/register') {
    return next();
  }
  
  doubleCsrfProtection(req, res, (err) => {
    if (err) {
      if (err === invalidCsrfTokenError) {
        logger.warn('CSRF validation failed', {
          path: req.path,
          method: req.method,
          ip: req.ip,
          sessionID: req.sessionID,
          hasSession: !!req.session,
          userId: req.session?.userId,
        });
        
        // Check if user has a valid session
        if (req.session && req.session.userId) {
          // Valid session but invalid CSRF token - likely token expired
          // Generate new token and return it in response
          const newToken = generateCsrfToken(req, res);
          return res.status(403).json({ 
            message: 'Токен безопасности устарел. Попробуйте ещё раз.',
            csrfToken: newToken
          });
        } else {
          // No valid session - clear session cookie and return 401
          res.clearCookie('sessionId');
          res.clearCookie('csrf-token');
          return res.status(401).json({ 
            message: 'Сессия истекла. Пожалуйста, войдите снова.' 
          });
        }
      }
      return next(err);
    }
    next();
  });
}

export function csrfTokenEndpoint(req: Request, res: Response): void {
  const csrfToken = generateCsrfToken(req, res);
  res.json({ csrfToken });
}

export { generateCsrfToken };
