import { Router } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { authenticateToken, requireRole } from "../auth";
import { sql, count, sum, eq, desc, gte } from "drizzle-orm";
import { users, products, orders, userRoles } from "@shared/schema";
import { invalidateUserCache } from "../utils/userCache";
import { connectedUsers } from "../routes";
import { logger } from "../utils/logger";

const router = Router();

router.get("/stats", authenticateToken, requireRole("admin"), async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [
    totalUsersResult,
    totalProductsResult,
    totalOrdersResult,
    totalRevenueResult,
    pendingOrdersResult,
    recentOrdersResult,
    lastMonthRevenueResult,
    lastMonthOrdersResult,
    lastMonthUsersResult,
    lastMonthProductsResult,
  ] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(products).where(eq(products.isArchived, false)),
    db.select({ count: count() }).from(orders),
    db.select({ 
      total: sql<string>`COALESCE(SUM(CAST(${orders.total} AS DECIMAL)), 0)` 
    }).from(orders).where(eq(orders.paymentStatus, 'paid')),
    db.select({ count: count() }).from(orders).where(eq(orders.status, 'pending')),
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(5),
    db.select({ 
      total: sql<string>`COALESCE(SUM(CAST(${orders.total} AS DECIMAL)), 0)` 
    }).from(orders).where(
      sql`${orders.paymentStatus} = 'paid' AND ${orders.createdAt} >= ${startOfLastMonth} AND ${orders.createdAt} <= ${endOfLastMonth}`
    ),
    db.select({ count: count() }).from(orders).where(
      sql`${orders.createdAt} >= ${startOfLastMonth} AND ${orders.createdAt} <= ${endOfLastMonth}`
    ),
    db.select({ count: count() }).from(users).where(
      sql`${users.createdAt} >= ${startOfLastMonth} AND ${users.createdAt} <= ${endOfLastMonth}`
    ),
    db.select({ count: count() }).from(products).where(
      sql`${products.createdAt} >= ${startOfLastMonth} AND ${products.createdAt} <= ${endOfLastMonth}`
    ),
  ]);

  const totalUsers = totalUsersResult[0]?.count || 0;
  const totalProducts = totalProductsResult[0]?.count || 0;
  const totalOrders = totalOrdersResult[0]?.count || 0;
  const totalRevenue = parseFloat(totalRevenueResult[0]?.total || '0');
  const pendingOrders = pendingOrdersResult[0]?.count || 0;
  const recentOrders = recentOrdersResult || [];

  const lastMonthRevenue = parseFloat(lastMonthRevenueResult[0]?.total || '0');
  const lastMonthOrders = lastMonthOrdersResult[0]?.count || 0;
  const lastMonthUsers = lastMonthUsersResult[0]?.count || 0;
  const lastMonthProducts = lastMonthProductsResult[0]?.count || 0;

  const calculateChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  res.json({
    totalRevenue,
    revenueChange: calculateChange(totalRevenue, lastMonthRevenue),
    totalOrders,
    ordersChange: calculateChange(totalOrders, lastMonthOrders),
    totalCustomers: totalUsers,
    customersChange: calculateChange(totalUsers, lastMonthUsers),
    totalProducts,
    productsChange: calculateChange(totalProducts, lastMonthProducts),
    recentOrders,
    pendingOrders,
  });
});

router.get("/users", authenticateToken, requireRole("admin"), async (req, res) => {
  const users = await storage.getUsers();
  
  const allRoles = await db.select().from(userRoles);
  const rolesMap = new Map<string, string[]>();
  
  for (const roleRecord of allRoles) {
    if (!rolesMap.has(roleRecord.userId)) {
      rolesMap.set(roleRecord.userId, []);
    }
    rolesMap.get(roleRecord.userId)!.push(roleRecord.role);
  }

  const usersWithRoles = users.map((user: any) => ({
    ...user,
    roles: rolesMap.get(user.id) || [],
  }));

  res.json(usersWithRoles);
});

router.post("/users/:userId/ban", authenticateToken, requireRole("admin"), async (req, res) => {
  try {
    const { userId } = req.params;
    
    await storage.updateUser(userId, { banned: true });
    
    await storage.incrementTokenVersion(userId);
    
    await storage.deleteAllRefreshTokens(userId);
    
    const connection = connectedUsers.get(userId);
    if (connection) {
      connection.ws.close(1008, 'Account banned');
      connectedUsers.delete(userId);
      logger.info('WebSocket connection closed on ban', { userId });
    }
    
    invalidateUserCache(userId);
    
    res.json({ success: true, message: "Пользователь заблокирован" });
  } catch (error) {
    logger.error('User ban failed', { userId: req.params.userId, error });
    res.status(500).json({ message: "Ошибка блокировки пользователя" });
  }
});

router.post("/users/:userId/unban", authenticateToken, requireRole("admin"), async (req, res) => {
  try {
    const { userId } = req.params;
    
    await storage.updateUser(userId, { banned: false });
    
    invalidateUserCache(userId);
    
    res.json({ success: true, message: "Пользователь разблокирован" });
  } catch (error) {
    res.status(500).json({ message: "Ошибка разблокировки пользователя" });
  }
});

export default router;
