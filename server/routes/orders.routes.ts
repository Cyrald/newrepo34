import { Router } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { authenticateToken, requireRole } from "../auth";
import { createOrderSchema, orders, promocodes, promocodeUsage, cartItems } from "@shared/schema";
import { validatePromocode } from "../promocodes";
import { calculateCashback, canUseBonuses } from "../bonuses";
import { orderLimiter } from "../middleware/rateLimiter";
import { sql, eq } from "drizzle-orm";
import { z } from "zod";
import { logger } from "../utils/logger";
import type { WebSocket } from "ws";

interface ConnectedUser {
  ws: WebSocket;
  roles: string[];
}

export function createOrdersRoutes(connectedUsers: Map<string, ConnectedUser>) {
  const router = Router();

router.get("/", authenticateToken, async (req, res) => {
  const roles = await storage.getUserRoles(req.userId!);
  const isAdmin = roles.some(r => r.role === "admin");

  const allOrders = await storage.getOrders(
    isAdmin ? {} : { userId: req.userId! }
  );
  res.json(allOrders);
});

router.get("/:id", authenticateToken, async (req, res) => {
  const order = await storage.getOrder(req.params.id);
  if (!order) {
    return res.status(404).json({ message: "Заказ не найден" });
  }
  res.json(order);
});

router.post("/", authenticateToken, orderLimiter, async (req, res) => {
  try {
    const data = createOrderSchema.parse(req.body);
    const user = await storage.getUser(req.userId!);

  if (!user) {
    return res.status(404).json({ message: "Пользователь не найден" });
  }

  const bonusesUsed = data.bonusesUsed || 0;

  if (data.promocodeId && bonusesUsed > 0) {
    return res.status(400).json({ 
      message: "Нельзя одновременно использовать промокод и бонусы. Выберите что-то одно." 
    });
  }

  let subtotal = 0;
  for (const item of data.items) {
    const price = parseFloat(item.price);
    subtotal += price * item.quantity;
  }

  let discountAmount = 0;
  let promocodeId = null;

  if (data.promocodeId) {
    const promocodeValidation = await validatePromocode(
      data.promocodeId,
      req.userId!,
      subtotal
    );
    if (promocodeValidation.valid && promocodeValidation.discountAmount) {
      discountAmount = promocodeValidation.discountAmount;
      promocodeId = promocodeValidation.promocode!.id;
    }
  }

  const subtotalAfterPromocode = subtotal - discountAmount;
  const { maxUsable } = canUseBonuses(user.bonusBalance, subtotalAfterPromocode);
  
  if (bonusesUsed > maxUsable) {
    return res.status(400).json({ message: `Можно использовать максимум ${maxUsable} бонусов` });
  }

  const subtotalAfterBonuses = subtotalAfterPromocode - bonusesUsed;
  const deliveryCost = 300;
  const total = subtotalAfterBonuses + deliveryCost;

  const bonusesEarned = calculateCashback(
    total,
    bonusesUsed > 0,
    discountAmount > 0
  );

  const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

  const order = await db.transaction(async (tx) => {
    for (const item of data.items) {
      const updateResult = await tx.execute(
        sql`UPDATE products 
            SET stock_quantity = stock_quantity - ${item.quantity},
                updated_at = NOW()
            WHERE id = ${item.productId}
              AND stock_quantity >= ${item.quantity}
            RETURNING id, name, stock_quantity`
      );
      
      if (!updateResult.rows || updateResult.rows.length === 0) {
        const checkProduct = await tx.execute(
          sql`SELECT id, name, stock_quantity FROM products WHERE id = ${item.productId}`
        );
        if (!checkProduct.rows || checkProduct.rows.length === 0) {
          throw new Error(`PRODUCT_NOT_FOUND:${item.productId}`);
        }
        const product = checkProduct.rows[0] as any;
        throw new Error(`INSUFFICIENT_STOCK:${product.name}:${product.stock_quantity}:${item.quantity}`);
      }
    }

    if (bonusesUsed > 0) {
      const bonusResult = await tx.execute(
        sql`UPDATE users 
            SET bonus_balance = bonus_balance - ${bonusesUsed},
                updated_at = NOW()
            WHERE id = ${req.userId}
              AND bonus_balance >= ${bonusesUsed}
            RETURNING id`
      );
      
      if (!bonusResult.rows || bonusResult.rows.length === 0) {
        throw new Error('INSUFFICIENT_BONUS');
      }
    }

    if (promocodeId) {
      const [promocode] = await tx
        .select()
        .from(promocodes)
        .where(eq(promocodes.id, promocodeId))
        .limit(1);

      if (promocode) {
        if (promocode.type === "single_use") {
          await tx.delete(promocodes).where(eq(promocodes.id, promocodeId));
        } else if (promocode.type === "temporary") {
          const existingUsage = await tx.execute(
            sql`SELECT id FROM promocode_usage 
                WHERE promocode_id = ${promocodeId} AND user_id = ${req.userId}
                LIMIT 1`
          );
          if (existingUsage.rows && existingUsage.rows.length > 0) {
            throw new Error('PROMOCODE_ALREADY_USED');
          }
        }
      }
    }

    const [createdOrder] = await tx
      .insert(orders)
      .values({
        userId: req.userId!,
        orderNumber,
        status: "pending",
        items: data.items as any,
        subtotal: subtotal.toString(),
        discountAmount: discountAmount.toString(),
        bonusesUsed: bonusesUsed.toString(),
        bonusesEarned: bonusesEarned.toString(),
        promocodeId,
        deliveryService: data.deliveryService,
        deliveryType: data.deliveryType,
        deliveryPointCode: data.deliveryPointCode || null,
        deliveryAddress: data.deliveryAddress as any,
        deliveryCost: deliveryCost.toString(),
        deliveryTrackingNumber: null,
        paymentMethod: data.paymentMethod,
        paymentStatus: "pending",
        yukassaPaymentId: null,
        total: total.toString(),
      })
      .returning();

    if (promocodeId) {
      const [promocode] = await tx
        .select()
        .from(promocodes)
        .where(eq(promocodes.id, promocodeId))
        .limit(1);

      if (promocode && promocode.type === "temporary") {
        await tx.insert(promocodeUsage).values({
          promocodeId,
          userId: req.userId!,
          orderId: createdOrder.id,
        });
      }
    }

    await tx.delete(cartItems).where(eq(cartItems.userId, req.userId!));

    return createdOrder;
  });

  try {
    for (const [userId, connection] of Array.from(connectedUsers.entries())) {
      const isStaff = connection.roles.some((role: string) => ['admin', 'consultant'].includes(role));
      if (isStaff && connection.ws.readyState === 1) {
        connection.ws.send(JSON.stringify({
          type: "new_order",
          order: order,
        }));
      }
    }
    
    const customerConnection = connectedUsers.get(req.userId!);
    if (customerConnection?.ws && customerConnection.ws.readyState === 1) {
      customerConnection.ws.send(JSON.stringify({
        type: "order_created",
        order: order,
      }));
    }
  } catch (broadcastError) {
    logger.error('Order notification broadcast failed', { error: broadcastError, orderId: order.id });
  }

  res.json(order);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    
    if (error.message?.startsWith('PRODUCT_NOT_FOUND:')) {
      const productId = error.message.split(':')[1];
      return res.status(404).json({ message: `Товар ${productId} не найден` });
    }
    
    if (error.message?.startsWith('INSUFFICIENT_STOCK:')) {
      const [, productName, available, requested] = error.message.split(':');
      return res.status(400).json({ 
        message: `Недостаточно товара "${productName}". Доступно: ${available}, запрошено: ${requested}` 
      });
    }
    
    if (error.message === 'INSUFFICIENT_BONUS') {
      return res.status(400).json({ message: "Недостаточно бонусов на счёте" });
    }
    
    if (error.message === 'PROMOCODE_ALREADY_USED') {
      return res.status(400).json({ message: "Вы уже использовали этот промокод" });
    }
    
    logger.error('Order creation error', { error, userId: req.userId });
    res.status(500).json({ message: "Ошибка создания заказа" });
  }
});

router.put("/:id/status", authenticateToken, requireRole("admin"), async (req, res) => {
  const { status } = req.body;
  const updateData: any = { status };

  if (status === "paid") {
    updateData.paidAt = new Date();
    updateData.paymentStatus = "paid";
  } else if (status === "shipped") {
    updateData.shippedAt = new Date();
  } else if (status === "delivered") {
    updateData.deliveredAt = new Date();
  } else if (status === "completed") {
    updateData.completedAt = new Date();

    const order = await storage.getOrder(req.params.id);
    if (order && order.userId) {
      const userObj = await storage.getUser(order.userId);
      if (userObj) {
        const bonusesEarned = parseFloat(order.bonusesEarned);
        await storage.updateUser(order.userId, {
          bonusBalance: userObj.bonusBalance + bonusesEarned,
        });
      }
    }
  }

  const order = await storage.updateOrder(req.params.id, updateData);
  
  try {
    for (const [userId, connection] of Array.from(connectedUsers.entries())) {
      const isStaff = connection.roles.some((role: string) => ['admin', 'consultant'].includes(role));
      if (isStaff && connection.ws.readyState === 1) {
        connection.ws.send(JSON.stringify({
          type: "order_status_updated",
          order: order,
        }));
      }
    }
    
    if (order && order.userId) {
      const customerConnection = connectedUsers.get(order.userId);
      if (customerConnection?.ws && customerConnection.ws.readyState === 1) {
        customerConnection.ws.send(JSON.stringify({
          type: "order_status_updated",
          order: order,
        }));
      }
    }
  } catch (broadcastError) {
    logger.error('Order status update notification failed', { error: broadcastError, orderId: req.params.id });
  }

  res.json(order);
});

  return router;
}

export default createOrdersRoutes;
