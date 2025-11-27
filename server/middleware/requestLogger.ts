import { Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  req.requestId = nanoid(10);
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logMessage = `[${req.requestId}] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`;
    
    if (res.statusCode >= 500) {
      console.error(logMessage);
    } else if (res.statusCode >= 400) {
      console.warn(logMessage);
    } else if (process.env.NODE_ENV === 'development') {
      console.log(logMessage);
    }
  });

  next();
}
