import { Router } from "express";
import { storage } from "../storage";
import { hashPassword, comparePassword, safePasswordCompare, authenticateToken, invalidateUserCache } from "../auth";
import { generateVerificationToken, sendVerificationEmail } from "../email";
import { registerSchema, loginSchema, updateProfileSchema, changePasswordSchema } from "@shared/schema";
import { z } from "zod";
import { authLimiter, registerLimiter, passwordChangeLimiter, refreshTokenLimiter } from "../middleware/rateLimiter";
import { logLoginAttempt, logRegistration } from "../utils/securityLogger";
import { logger } from "../utils/logger";
import { validatePassword } from "../utils/sanitize";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { env } from "../env";
import { connectedUsers } from "../routes";

const router = Router();

router.post("/register", registerLimiter, async (req, res) => {
  const data = registerSchema.parse(req.body);
  
  const sanitizedEmail = data.email.toLowerCase().trim();

  const existingUser = await storage.getUserByEmail(sanitizedEmail);
  if (existingUser) {
    return res.status(400).json({ message: "Email уже зарегистрирован" });
  }

  validatePassword(data.password);
  const passwordHash = await hashPassword(data.password);
  const verificationToken = generateVerificationToken();
  const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const user = await storage.createUser({
    email: sanitizedEmail,
    passwordHash,
    firstName: data.firstName.trim(),
    lastName: data.lastName?.trim() || null,
    patronymic: data.patronymic?.trim() || null,
    phone: data.phone.trim(),
  });

  await storage.updateUser(user.id, {
    verificationToken,
    verificationTokenExpires,
  });

  await storage.addUserRole({
    userId: user.id,
    role: "customer",
  });

  await sendVerificationEmail(user.email, verificationToken, user.firstName);

  const roles = await storage.getUserRoles(user.id);
  const roleNames = roles.map(r => r.role);
  
  const accessToken = generateAccessToken(user.id, roleNames, 1);
  const { token: refreshToken, jti } = generateRefreshToken(user.id);
  
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await storage.createRefreshToken({
    userId: user.id,
    jti,
    expiresAt,
    userAgent: req.get('user-agent') || null,
    ipAddress: req.ip || null,
  });
  
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
    path: '/',
  });
  
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });
  
  logRegistration({
    email: user.email,
    userId: user.id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      isVerified: user.isVerified,
      bonusBalance: user.bonusBalance,
      roles: roleNames,
    },
  });
});

router.post("/login", authLimiter, async (req, res) => {
  const data = loginSchema.parse(req.body);
  
  const sanitizedEmail = data.email.toLowerCase().trim();
  const user = await storage.getUserByEmail(sanitizedEmail);

  const isPasswordValid = await safePasswordCompare(
    data.password, 
    user?.passwordHash || null
  );

  if (!user || !isPasswordValid) {
    logLoginAttempt({
      email: sanitizedEmail,
      userId: user?.id,
      success: false,
      failureReason: !user ? 'user_not_found' : 'invalid_password',
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    return res.status(401).json({ message: "Неверный email или пароль" });
  }

  const roles = await storage.getUserRoles(user.id);
  const roleNames = roles.map(r => r.role);
  
  const accessToken = generateAccessToken(user.id, roleNames, user.tokenVersion || 1);
  const { token: refreshToken, jti } = generateRefreshToken(user.id);
  
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await storage.createRefreshToken({
    userId: user.id,
    jti,
    expiresAt,
    userAgent: req.get('user-agent') || null,
    ipAddress: req.ip || null,
  });
  
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
    path: '/',
  });
  
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });
  
  logLoginAttempt({
    email: user.email,
    userId: user.id,
    success: true,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      isVerified: user.isVerified,
      bonusBalance: user.bonusBalance,
      roles: roleNames,
    },
  });
});

router.post("/logout", authenticateToken, async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        await storage.deleteRefreshToken(payload.jti);
      } catch (error) {
        logger.warn('Invalid refresh token during logout', { error });
      }
    }
    
    const connection = connectedUsers.get(req.userId!);
    if (connection) {
      connection.ws.close(1000, 'User logged out');
      connectedUsers.delete(req.userId!);
      logger.info('WebSocket connection closed on logout', { userId: req.userId });
    }
    
    invalidateUserCache(req.userId!);
    
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/api/auth' });
    
    res.json({ message: "Выход выполнен" });
  } catch (error) {
    logger.error('Logout error', { error });
    
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/api/auth' });
    
    res.status(500).json({ message: "Ошибка выхода" });
  }
});

router.post("/refresh", refreshTokenLimiter, async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token отсутствует' });
    }
    
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(401).json({ message: 'Невалидный refresh token' });
    }
    
    const isValid = await storage.validateRefreshToken(payload.jti);
    if (!isValid) {
      return res.status(401).json({ message: 'Refresh token отозван' });
    }
    
    const user = await storage.getUser(payload.userId);
    if (!user) {
      return res.status(401).json({ message: 'Пользователь не найден' });
    }
    
    const userRoles = await storage.getUserRoles(user.id);
    const roles = userRoles.map(r => r.role);
    
    const newAccessToken = generateAccessToken(user.id, roles, user.tokenVersion || 1);
    
    const { token: newRefreshToken, jti: newJti } = generateRefreshToken(user.id);
    
    await storage.deleteRefreshToken(payload.jti);
    
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await storage.createRefreshToken({
      userId: user.id,
      jti: newJti,
      expiresAt,
      userAgent: req.get('user-agent') || null,
      ipAddress: req.ip || null,
    });
    
    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
    
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Token refresh error', { error });
    res.status(500).json({ message: 'Ошибка обновления токена' });
  }
});

router.get("/verify-email", async (req, res) => {
  const { token } = req.query;

  if (!token || typeof token !== "string") {
    return res.status(400).json({ message: "Токен не предоставлен" });
  }

  const user = await storage.getUserByVerificationToken(token);

  if (!user) {
    return res.status(400).json({ message: "Недействительный токен" });
  }

  if (user.verificationTokenExpires && new Date(user.verificationTokenExpires) < new Date()) {
    return res.status(400).json({ message: "Срок действия токена истёк" });
  }

  await storage.updateUser(user.id, {
    isVerified: true,
    verificationToken: null,
    verificationTokenExpires: null,
  });

  res.json({ message: "Email успешно подтверждён" });
});

router.post("/resend-verification", authenticateToken, authLimiter, async (req, res) => {
  const user = await storage.getUser(req.userId!);

  if (!user) {
    return res.status(404).json({ message: "Пользователь не найден" });
  }

  if (user.isVerified) {
    return res.status(400).json({ message: "Email уже подтверждён" });
  }

  const verificationToken = generateVerificationToken();
  const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await storage.updateUser(user.id, {
    verificationToken,
    verificationTokenExpires,
  });

  await sendVerificationEmail(user.email, verificationToken, user.firstName);

  res.json({ message: "Письмо для подтверждения отправлено повторно" });
});

router.get("/me", authenticateToken, async (req, res) => {
  const user = await storage.getUser(req.userId!);
  
  if (!user) {
    return res.status(404).json({ message: "Пользователь не найден" });
  }

  const roles = await storage.getUserRoles(user.id);
  const roleNames = roles.map(r => r.role);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      patronymic: user.patronymic,
      phone: user.phone,
      isVerified: user.isVerified,
      bonusBalance: user.bonusBalance,
      roles: roleNames,
    },
  });
});


router.put("/profile", authenticateToken, async (req, res) => {
  try {
    const data = updateProfileSchema.parse(req.body);

    await storage.updateUser(req.userId!, {
      firstName: data.firstName.trim(),
      lastName: data.lastName,
      patronymic: data.patronymic,
      phone: data.phone.trim(),
    });

    const updatedUser = await storage.getUser(req.userId!);
    const roles = await storage.getUserRoles(req.userId!);
    const roleNames = roles.map(r => r.role);

    res.json({
      user: {
        id: updatedUser!.id,
        email: updatedUser!.email,
        firstName: updatedUser!.firstName,
        lastName: updatedUser!.lastName,
        patronymic: updatedUser!.patronymic,
        phone: updatedUser!.phone,
        isVerified: updatedUser!.isVerified,
        bonusBalance: updatedUser!.bonusBalance,
        roles: roleNames,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    throw error;
  }
});

router.put("/password", authenticateToken, passwordChangeLimiter, async (req, res) => {
  try {
    const data = changePasswordSchema.parse(req.body);

    const user = await storage.getUser(req.userId!);
    
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    const isPasswordValid = await comparePassword(data.currentPassword, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Неверный текущий пароль" });
    }

    validatePassword(data.newPassword);
    const newPasswordHash = await hashPassword(data.newPassword);

    await storage.updateUser(req.userId!, {
      passwordHash: newPasswordHash,
    });

    const newVersion = await storage.incrementTokenVersion(req.userId!);
    
    await storage.deleteAllRefreshTokens(req.userId!);
    
    invalidateUserCache(req.userId!);
    
    const userRoles = await storage.getUserRoles(req.userId!);
    const roles = userRoles.map(r => r.role);
    
    const accessToken = generateAccessToken(req.userId!, roles, newVersion);
    const { token: refreshToken, jti } = generateRefreshToken(req.userId!);
    
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await storage.createRefreshToken({
      userId: req.userId!,
      jti,
      expiresAt,
      userAgent: req.get('user-agent') || null,
      ipAddress: req.ip || null,
    });
    
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
    
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });
    
    res.json({ 
      message: "Пароль успешно изменён. Все устройства отключены, вы вошли заново на этом устройстве." 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    throw error;
  }
});

router.delete("/account", authenticateToken, passwordChangeLimiter, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ message: "Пароль обязателен для удаления аккаунта" });
    }

    const user = await storage.getUser(req.userId!);
    
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    const isPasswordValid = await comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Неверный пароль" });
    }

    await storage.deleteAllRefreshTokens(req.userId!);

    await storage.deleteUserAccount(req.userId!);

    invalidateUserCache(req.userId!);

    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/api/auth' });
    
    logger.info('User account deleted', { 
      userId: req.userId,
      email: user.email,
      ip: req.ip,
    });

    res.json({ 
      message: "Аккаунт успешно удалён" 
    });
  } catch (error) {
    logger.error('Account deletion failed', { 
      userId: req.userId, 
      error 
    });
    throw error;
  }
});

export default router;
