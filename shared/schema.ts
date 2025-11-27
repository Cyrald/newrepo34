import { sql, relations } from "drizzle-orm";
import { 
  pgTable, 
  text, 
  varchar, 
  boolean, 
  integer, 
  timestamp, 
  decimal,
  jsonb,
  unique,
  index
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// USERS & ROLES
// ============================================

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  patronymic: text("patronymic"),
  phone: text("phone").notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  verificationToken: text("verification_token"),
  verificationTokenExpires: timestamp("verification_token_expires"),
  bonusBalance: integer("bonus_balance").default(100).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userRoles = pgTable("user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'admin' | 'marketer' | 'consultant' | 'customer'
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userRoleUnique: unique().on(table.userId, table.role),
  userIdIdx: index("user_roles_user_id_idx").on(table.userId),
}));

// ============================================
// CATEGORIES & PRODUCTS
// ============================================

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").references(() => categories.id, { onDelete: "set null" }),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  composition: text("composition").notNull(),
  storageConditions: text("storage_conditions").notNull(),
  usageInstructions: text("usage_instructions"),
  contraindications: text("contraindications"),
  weight: decimal("weight"),
  volume: decimal("volume"),
  dimensionsHeight: decimal("dimensions_height"),
  dimensionsLength: decimal("dimensions_length"),
  dimensionsWidth: decimal("dimensions_width"),
  shelfLifeDays: integer("shelf_life_days"),
  stockQuantity: integer("stock_quantity").default(0).notNull(),
  price: decimal("price").notNull(),
  discountPercentage: decimal("discount_percentage").default("0").notNull(),
  discountStartDate: timestamp("discount_start_date"),
  discountEndDate: timestamp("discount_end_date"),
  isNew: boolean("is_new").default(false).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  rating: decimal("rating").default("0").notNull(),
  reviewsCount: integer("reviews_count").default(0).notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  categoryIdIdx: index("products_category_id_idx").on(table.categoryId),
  isArchivedIdx: index("products_is_archived_idx").on(table.isArchived),
  priceIdx: index("products_price_idx").on(table.price),
}));

export const productImages = pgTable("product_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  productIdIdx: index("product_images_product_id_idx").on(table.productId),
}));

// ============================================
// USER ADDRESSES & PAYMENT CARDS
// ============================================

export const userAddresses = pgTable("user_addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  fullAddress: text("full_address").notNull(),
  city: text("city").notNull(),
  street: text("street").notNull(),
  building: text("building").notNull(),
  apartment: text("apartment"),
  postalCode: text("postal_code").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("user_addresses_user_id_idx").on(table.userId),
}));

export const userPaymentCards = pgTable("user_payment_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  yukassaPaymentToken: text("yukassa_payment_token").notNull(),
  cardLastFour: text("card_last_four").notNull(),
  cardType: text("card_type").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("user_payment_cards_user_id_idx").on(table.userId),
}));

// ============================================
// PROMOCODES
// ============================================

export const promocodes = pgTable("promocodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  discountPercentage: decimal("discount_percentage").notNull(),
  minOrderAmount: decimal("min_order_amount").default("0").notNull(),
  maxDiscountAmount: decimal("max_discount_amount"),
  type: text("type").notNull(), // 'single_use' | 'temporary'
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
}, (table) => ({
  codeIdx: index("promocodes_code_idx").on(table.code),
  typeIdx: index("promocodes_type_idx").on(table.type),
  isActiveIdx: index("promocodes_is_active_idx").on(table.isActive),
}));

export const promocodeUsage = pgTable("promocode_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  promocodeId: varchar("promocode_id").notNull().references(() => promocodes.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orderId: varchar("order_id").notNull(),
  usedAt: timestamp("used_at").defaultNow().notNull(),
}, (table) => ({
  promocodeUserUnique: unique().on(table.promocodeId, table.userId),
  promocodeIdIdx: index("promocode_usage_promocode_id_idx").on(table.promocodeId),
  userIdIdx: index("promocode_usage_user_id_idx").on(table.userId),
}));

// ============================================
// ORDERS
// ============================================

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  orderNumber: text("order_number").notNull().unique(),
  status: text("status").notNull(), // 'pending' | 'paid' | 'shipped' | 'delivered' | 'completed' | 'cancelled'
  
  // Товары
  items: jsonb("items").notNull(),
  subtotal: decimal("subtotal").notNull(),
  discountAmount: decimal("discount_amount").default("0").notNull(),
  bonusesUsed: decimal("bonuses_used").default("0").notNull(),
  bonusesEarned: decimal("bonuses_earned").default("0").notNull(),
  promocodeId: varchar("promocode_id").references(() => promocodes.id, { onDelete: "set null" }),
  
  // Доставка
  deliveryService: text("delivery_service").notNull(), // 'cdek' | 'boxberry'
  deliveryType: text("delivery_type").notNull(), // 'pvz' | 'postamat' | 'courier'
  deliveryPointCode: text("delivery_point_code"),
  deliveryAddress: jsonb("delivery_address"),
  deliveryCost: decimal("delivery_cost").notNull(),
  deliveryTrackingNumber: text("delivery_tracking_number"),
  
  // Оплата
  paymentMethod: text("payment_method").notNull(), // 'online' | 'on_delivery'
  paymentStatus: text("payment_status").notNull(), // 'pending' | 'paid' | 'failed'
  yukassaPaymentId: text("yukassa_payment_id"),
  
  // Итого
  total: decimal("total").notNull(),
  
  // Временные метки
  paidAt: timestamp("paid_at"),
  shippedAt: timestamp("shipped_at"),
  deliveredAt: timestamp("delivered_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("orders_user_id_idx").on(table.userId),
  statusIdx: index("orders_status_idx").on(table.status),
  createdAtIdx: index("orders_created_at_idx").on(table.createdAt),
}));

// ============================================
// CART, WISHLIST, COMPARISON
// ============================================

export const cartItems = pgTable("cart_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userProductUnique: unique().on(table.userId, table.productId),
  userIdIdx: index("cart_items_user_id_idx").on(table.userId),
}));

export const wishlistItems = pgTable("wishlist_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").defaultNow().notNull(),
}, (table) => ({
  userProductUnique: unique().on(table.userId, table.productId),
  userIdIdx: index("wishlist_items_user_id_idx").on(table.userId),
}));

export const comparisonItems = pgTable("comparison_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").defaultNow().notNull(),
}, (table) => ({
  userProductUnique: unique().on(table.userId, table.productId),
  userIdIdx: index("comparison_items_user_id_idx").on(table.userId),
}));

// ============================================
// SUPPORT CHAT
// ============================================

export const supportConversations = pgTable("support_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("open"), // 'open' | 'archived' | 'closed'
  archivedAt: timestamp("archived_at"),
  closedAt: timestamp("closed_at"),
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("support_conversations_user_id_idx").on(table.userId),
  statusIdx: index("support_conversations_status_idx").on(table.status),
  statusArchivedIdx: index("support_conversations_status_archived_idx").on(table.status, table.archivedAt),
}));

export const supportMessages = pgTable("support_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").references(() => users.id, { onDelete: "set null" }),
  messageText: text("message_text"),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("support_messages_user_id_idx").on(table.userId),
  createdAtIdx: index("support_messages_created_at_idx").on(table.createdAt),
}));

export const supportMessageAttachments = pgTable("support_message_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => supportMessages.id, { onDelete: "cascade" }),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size").notNull(),
  fileType: text("file_type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  messageIdIdx: index("support_message_attachments_message_id_idx").on(table.messageId),
}));

// ============================================
// RELATIONS
// ============================================

export const usersRelations = relations(users, ({ many }) => ({
  roles: many(userRoles),
  addresses: many(userAddresses),
  paymentCards: many(userPaymentCards),
  orders: many(orders),
  cartItems: many(cartItems),
  wishlistItems: many(wishlistItems),
  comparisonItems: many(comparisonItems),
  supportMessages: many(supportMessages),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  images: many(productImages),
  cartItems: many(cartItems),
  wishlistItems: many(wishlistItems),
  comparisonItems: many(comparisonItems),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  promocode: one(promocodes, {
    fields: [orders.promocodeId],
    references: [promocodes.id],
  }),
}));

export const supportConversationsRelations = relations(supportConversations, ({ one }) => ({
  user: one(users, {
    fields: [supportConversations.userId],
    references: [users.id],
  }),
}));

export const supportMessagesRelations = relations(supportMessages, ({ one, many }) => ({
  user: one(users, {
    fields: [supportMessages.userId],
    references: [users.id],
  }),
  sender: one(users, {
    fields: [supportMessages.senderId],
    references: [users.id],
  }),
  attachments: many(supportMessageAttachments),
}));

// ============================================
// INSERT SCHEMAS & TYPES
// ============================================

export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email("Неверный формат email"),
  passwordHash: z.string().min(8, "Пароль должен быть не менее 8 символов"),
  firstName: z.string().min(1, "Имя обязательно"),
  phone: z.string().min(10, "Неверный формат телефона"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isVerified: true,
  verificationToken: true,
  verificationTokenExpires: true,
  bonusBalance: true,
});

export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  createdAt: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductSchema = createInsertSchema(products, {
  name: z.string().min(1, "Название обязательно"),
  sku: z.string().min(1, "Артикул обязателен"),
  description: z.string().min(10, "Описание должно быть не менее 10 символов"),
  composition: z.string().min(1, "Состав обязателен"),
  storageConditions: z.string().min(1, "Условия хранения обязательны"),
  price: z.string().refine((val) => parseFloat(val) > 0, "Цена должна быть больше 0"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  rating: true,
  reviewsCount: true,
  viewCount: true,
});

export const insertProductImageSchema = createInsertSchema(productImages).omit({
  id: true,
  createdAt: true,
});

export const insertUserAddressSchema = createInsertSchema(userAddresses).omit({
  id: true,
  createdAt: true,
});

export const insertUserPaymentCardSchema = createInsertSchema(userPaymentCards).omit({
  id: true,
  createdAt: true,
});

export const insertPromocodeSchema = createInsertSchema(promocodes, {
  code: z.string().regex(/^[A-Z0-9]{4,20}$/, "Промокод должен содержать только буквы и цифры (4-20 символов)"),
  discountPercentage: z.string().refine((val) => {
    const num = parseFloat(val);
    return num > 0 && num <= 100;
  }, "Скидка должна быть от 1 до 100%"),
}).omit({
  id: true,
  createdAt: true,
});

export const insertPromocodeUsageSchema = createInsertSchema(promocodeUsage).omit({
  id: true,
  usedAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  paidAt: true,
  shippedAt: true,
  deliveredAt: true,
  completedAt: true,
});

export const insertCartItemSchema = createInsertSchema(cartItems).omit({
  id: true,
  addedAt: true,
  updatedAt: true,
});

export const insertWishlistItemSchema = createInsertSchema(wishlistItems).omit({
  id: true,
  addedAt: true,
});

export const insertComparisonItemSchema = createInsertSchema(comparisonItems).omit({
  id: true,
  addedAt: true,
});

export const insertSupportMessageSchema = createInsertSchema(supportMessages).omit({
  id: true,
  createdAt: true,
});

export const insertSupportMessageAttachmentSchema = createInsertSchema(supportMessageAttachments).omit({
  id: true,
  createdAt: true,
});

// ============================================
// TYPESCRIPT TYPES
// ============================================

export type User = typeof users.$inferSelect & {
  roles?: string[];
};
export type InsertUser = z.infer<typeof insertUserSchema>;

export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type ProductImage = typeof productImages.$inferSelect;
export type InsertProductImage = z.infer<typeof insertProductImageSchema>;

export type UserAddress = typeof userAddresses.$inferSelect;
export type InsertUserAddress = z.infer<typeof insertUserAddressSchema>;

export type UserPaymentCard = typeof userPaymentCards.$inferSelect;
export type InsertUserPaymentCard = z.infer<typeof insertUserPaymentCardSchema>;

export type Promocode = typeof promocodes.$inferSelect;
export type InsertPromocode = z.infer<typeof insertPromocodeSchema>;

export type PromocodeUsage = typeof promocodeUsage.$inferSelect;
export type InsertPromocodeUsage = z.infer<typeof insertPromocodeUsageSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;

// Cart item with joined product data (DTO for GET /api/cart)
export type CartItemWithProduct = CartItem & {
  product: Product | null;
};

export type WishlistItem = typeof wishlistItems.$inferSelect;
export type InsertWishlistItem = z.infer<typeof insertWishlistItemSchema>;

// Wishlist item with joined product data
export type WishlistItemWithProduct = WishlistItem & {
  product: Product;
};

export type ComparisonItem = typeof comparisonItems.$inferSelect;
export type InsertComparisonItem = z.infer<typeof insertComparisonItemSchema>;

// Comparison item with joined product data
export type ComparisonItemWithProduct = ComparisonItem & {
  product: Product;
};

// Order with computed total amount
export type OrderWithTotal = Order & {
  totalAmount: number;
};

export type SupportConversation = typeof supportConversations.$inferSelect;

export type SupportMessage = typeof supportMessages.$inferSelect;
export type InsertSupportMessage = z.infer<typeof insertSupportMessageSchema>;

export type SupportMessageAttachment = typeof supportMessageAttachments.$inferSelect;
export type InsertSupportMessageAttachment = z.infer<typeof insertSupportMessageAttachmentSchema>;

// ============================================
// ADDITIONAL VALIDATION SCHEMAS
// ============================================

// Регистрация
export const registerSchema = z.object({
  email: z.string().email("Неверный формат email").max(255, "Email слишком длинный"),
  password: z.string().min(8, "Пароль должен быть не менее 8 символов").max(100, "Пароль слишком длинный"),
  confirmPassword: z.string(),
  firstName: z.string().min(1, "Имя обязательно").max(100, "Имя слишком длинное"),
  lastName: z.string().max(100, "Фамилия слишком длинная").optional(),
  patronymic: z.string().max(100, "Отчество слишком длинное").optional(),
  phone: z.string().min(10, "Неверный формат телефона").max(20, "Телефон слишком длинный"),
  agreeToTerms: z.boolean().refine((val) => val === true, "Необходимо согласие с условиями"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Пароли не совпадают",
  path: ["confirmPassword"],
});

// Вход
export const loginSchema = z.object({
  email: z.string().email("Неверный формат email").max(255, "Email слишком длинный"),
  password: z.string().min(1, "Пароль обязателен").max(100, "Пароль слишком длинный"),
});

// Создание заказа
export const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    name: z.string(),
    price: z.string(),
    quantity: z.number().min(1),
    discount: z.string().optional(),
  })).min(1, "Корзина пуста"),
  deliveryService: z.enum(['cdek', 'boxberry']),
  deliveryType: z.enum(['pvz', 'postamat', 'courier']),
  deliveryPointCode: z.string().optional(),
  deliveryAddress: z.object({
    city: z.string(),
    street: z.string(),
    building: z.string(),
    apartment: z.string().optional(),
    postalCode: z.string(),
  }).optional(),
  paymentMethod: z.enum(['online', 'on_delivery']),
  promocodeId: z.string().optional(),
  bonusesUsed: z.number().min(0).default(0),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
