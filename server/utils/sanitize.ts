import { ValidationError } from './errors';

export function sanitizeSearchQuery(query: string | undefined): string {
  if (!query || typeof query !== 'string') {
    return '';
  }
  
  if (query.length > 100) {
    throw new ValidationError('Поисковый запрос не должен превышать 100 символов');
  }
  
  return query
    .trim()
    .replace(/[;'"`<>]/g, '')
    .replace(/\s+/g, ' ');
}

export function sanitizeProductName(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new ValidationError('Название товара обязательно');
  }
  if (name.length > 200) {
    throw new ValidationError('Название товара не должно превышать 200 символов');
  }
  return name.trim().replace(/[<>]/g, '');
}

export function sanitizeDescription(desc: string): string {
  if (!desc || typeof desc !== 'string') {
    throw new ValidationError('Описание обязательно');
  }
  if (desc.length > 5000) {
    throw new ValidationError('Описание не должно превышать 5000 символов');
  }
  return desc.trim().replace(/[<>]/g, '');
}

export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    throw new ValidationError('Email обязателен');
  }
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Неверный формат email');
  }
  return email.toLowerCase().trim();
}

export function sanitizePhoneNumber(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    throw new ValidationError('Телефон обязателен');
  }
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 10 || cleaned.length > 15) {
    throw new ValidationError('Неверный формат номера телефона');
  }
  return '+' + cleaned;
}

export function sanitizePostalCode(code: string): string {
  const russianPostalRegex = /^\d{6}$/;
  if (!russianPostalRegex.test(code)) {
    throw new ValidationError('Почтовый индекс должен состоять из 6 цифр');
  }
  return code;
}

export function sanitizeAddress(address: string): string {
  if (!address || typeof address !== 'string') {
    throw new ValidationError('Адрес обязателен');
  }
  if (address.length > 500) {
    throw new ValidationError('Адрес не должен превышать 500 символов');
  }
  return address.trim().replace(/[<>]/g, '');
}

export function sanitizeNumericParam(param: string | undefined, min = 0, max = 10000, defaultValue = 0): number {
  if (!param) return defaultValue;
  const num = parseInt(param, 10);
  
  if (isNaN(num)) {
    return defaultValue;
  }
  
  if (num < min || num > max) {
    throw new ValidationError(`Значение должно быть между ${min} и ${max}`);
  }
  
  return num;
}

export function sanitizeId(id: string | undefined): string | null {
  if (!id || typeof id !== 'string') {
    return null;
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(id)) {
    return null;
  }
  
  return id;
}

export function validatePasswordStrength(password: string): boolean {
  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return strongPasswordRegex.test(password);
}
