import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { ZodError } from 'zod';

export function errorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Error:', {
    name: error.name,
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    path: req.path,
    method: req.method,
  });

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        message: error.message,
        code: error.code,
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        message: 'Ошибка валидации данных',
        code: 'VALIDATION_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.errors : undefined,
      },
    });
    return;
  }

  if (error.code === '23505') {
    res.status(409).json({
      success: false,
      error: {
        message: 'Запись уже существует',
        code: 'DUPLICATE_ERROR',
      },
    });
    return;
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      message: process.env.NODE_ENV === 'production'
        ? 'Внутренняя ошибка сервера'
        : error.message,
      code: 'INTERNAL_SERVER_ERROR',
    },
  });
}
