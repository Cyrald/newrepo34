import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  skipSuccessfulRequests: true,
  message: 'Слишком много попыток входа. Попробуйте через 15 минут.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Слишком много регистраций. Попробуйте позже.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: 'Слишком много запросов. Попробуйте через минуту.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: 'Слишком много загрузок. Лимит: 30 в час.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: 'Слишком много поисковых запросов.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const promocodeValidationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Слишком много попыток валидации промокода.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalApiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  message: 'Слишком много запросов.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Слишком много заказов. Максимум 10 в минуту.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Слишком много попыток смены пароля. Попробуйте через час.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skipSuccessfulRequests: false,
  message: 'Слишком много запросов refresh. Попробуйте позже.',
  standardHeaders: true,
  legacyHeaders: false,
});
