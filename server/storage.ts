import { db } from "./db";
import {
  type User,
  type InsertUser,
  type UserRole,
  type InsertUserRole,
  type Category,
  type InsertCategory,
  type Product,
  type InsertProduct,
  type ProductImage,
  type InsertProductImage,
  type UserAddress,
  type InsertUserAddress,
  type UserPaymentCard,
  type InsertUserPaymentCard,
  type Promocode,
  type InsertPromocode,
  type PromocodeUsage,
  type InsertPromocodeUsage,
  type Order,
  type InsertOrder,
  type CartItem,
  type InsertCartItem,
  type CartItemWithProduct,
  type WishlistItem,
  type InsertWishlistItem,
  type SupportMessage,
  type InsertSupportMessage,
  type SupportMessageAttachment,
  type InsertSupportMessageAttachment,
  users,
  userRoles,
  categories,
  products,
  productImages,
  userAddresses,
  userPaymentCards,
  promocodes,
  promocodeUsage,
  orders,
  cartItems,
  wishlistItems,
  supportConversations,
  supportMessages,
  supportMessageAttachments,
} from "@shared/schema";
import { eq, and, desc, sql, like, gte, lte, or, inArray } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  
  getUserRoles(userId: string): Promise<UserRole[]>;
  addUserRole(role: InsertUserRole): Promise<UserRole>;
  removeUserRole(userId: string, role: string): Promise<void>;
  
  getCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<void>;
  
  getProducts(filters?: {
    categoryId?: string;
    categoryIds?: string[];
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    isNew?: boolean;
    sortBy?: "price_asc" | "price_desc" | "popularity" | "newest" | "rating";
    limit?: number;
    offset?: number;
  }): Promise<{ products: Product[], total: number }>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<void>;
  incrementProductView(id: string): Promise<void>;
  
  getProductImages(productId: string): Promise<ProductImage[]>;
  addProductImage(image: InsertProductImage): Promise<ProductImage>;
  updateProductImageOrder(imageId: string, sortOrder: number): Promise<void>;
  deleteProductImage(id: string): Promise<void>;
  
  getUserAddresses(userId: string): Promise<UserAddress[]>;
  getUserAddress(id: string): Promise<UserAddress | undefined>;
  createUserAddress(address: InsertUserAddress): Promise<UserAddress>;
  updateUserAddress(id: string, data: Partial<InsertUserAddress>): Promise<UserAddress | undefined>;
  deleteUserAddress(id: string): Promise<void>;
  setDefaultAddress(userId: string, addressId: string): Promise<void>;
  
  getUserPaymentCards(userId: string): Promise<UserPaymentCard[]>;
  getUserPaymentCard(id: string): Promise<UserPaymentCard | undefined>;
  createUserPaymentCard(card: InsertUserPaymentCard): Promise<UserPaymentCard>;
  deleteUserPaymentCard(id: string): Promise<void>;
  setDefaultPaymentCard(userId: string, cardId: string): Promise<void>;
  
  getPromocodes(): Promise<Promocode[]>;
  getPromocode(id: string): Promise<Promocode | undefined>;
  getPromocodeByCode(code: string): Promise<Promocode | undefined>;
  createPromocode(promocode: InsertPromocode): Promise<Promocode>;
  updatePromocode(id: string, data: Partial<InsertPromocode>): Promise<Promocode | undefined>;
  deletePromocode(id: string): Promise<void>;
  
  getOrders(filters?: { userId?: string; status?: string }): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, data: Partial<InsertOrder>): Promise<Order | undefined>;
  
  getCartItems(userId: string): Promise<CartItem[]>;
  getCartItem(userId: string, productId: string): Promise<CartItem | undefined>;
  addCartItem(item: InsertCartItem): Promise<CartItem>;
  updateCartItem(userId: string, productId: string, quantity: number): Promise<CartItem | undefined>;
  deleteCartItem(userId: string, productId: string): Promise<void>;
  clearCart(userId: string): Promise<void>;
  
  getWishlistItems(userId: string): Promise<WishlistItem[]>;
  addWishlistItem(item: InsertWishlistItem): Promise<WishlistItem>;
  deleteWishlistItem(userId: string, productId: string): Promise<void>;
  
  getSupportMessages(userId: string): Promise<SupportMessage[]>;
  getAllSupportConversations(status?: 'active' | 'archived'): Promise<{ userId: string; lastMessage: SupportMessage; unreadCount: number; status: string }[]>;
  createSupportMessage(message: InsertSupportMessage): Promise<SupportMessage>;
  markMessageAsRead(id: string): Promise<void>;
  
  getSupportMessageAttachments(messageId: string): Promise<SupportMessageAttachment[]>;
  addSupportMessageAttachment(attachment: InsertSupportMessageAttachment): Promise<SupportMessageAttachment>;
  deleteSupportMessageAttachment(id: string): Promise<void>;
  
  getOrCreateConversation(userId: string): Promise<SupportConversation>;
  archiveConversation(userId: string): Promise<void>;
  activateConversation(userId: string): Promise<void>;
  deleteOldMessages(olderThanDays: number): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getUserRoles(userId: string): Promise<UserRole[]> {
    return db.select().from(userRoles).where(eq(userRoles.userId, userId));
  }

  async addUserRole(role: InsertUserRole): Promise<UserRole> {
    const [userRole] = await db.insert(userRoles).values(role).returning();
    return userRole;
  }

  async removeUserRole(userId: string, role: string): Promise<void> {
    await db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)));
  }

  async getCategories(): Promise<Category[]> {
    return db.select().from(categories).orderBy(categories.sortOrder);
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    return category;
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
    return category;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category | undefined> {
    const [category] = await db
      .update(categories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
    return category;
  }

  async deleteCategory(id: string): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  async getProducts(filters?: {
    categoryId?: string;
    categoryIds?: string[];
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    isNew?: boolean;
    includeArchived?: boolean;
    sortBy?: "price_asc" | "price_desc" | "popularity" | "newest" | "rating";
    limit?: number;
    offset?: number;
  }): Promise<{ products: Product[], total: number }> {
    const conditions = [];
    
    if (!filters?.includeArchived) {
      conditions.push(eq(products.isArchived, false));
    }
    
    if (filters?.categoryId) {
      conditions.push(eq(products.categoryId, filters.categoryId));
    }
    if (filters?.categoryIds && filters.categoryIds.length > 0) {
      const categoryConditions = filters.categoryIds.map(id => eq(products.categoryId, id));
      conditions.push(or(...categoryConditions)!);
    }
    if (filters?.search) {
      conditions.push(
        or(
          like(products.name, `%${filters.search}%`),
          like(products.description, `%${filters.search}%`)
        )!
      );
    }
    if (filters?.minPrice !== undefined) {
      conditions.push(gte(products.price, filters.minPrice.toString()));
    }
    if (filters?.maxPrice !== undefined) {
      conditions.push(lte(products.price, filters.maxPrice.toString()));
    }
    if (filters?.isNew !== undefined) {
      conditions.push(eq(products.isNew, filters.isNew));
    }

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(and(...conditions)!);
    
    const total = Number(countResult.count);

    let query = db.select().from(products).where(and(...conditions)!) as any;

    switch (filters?.sortBy) {
      case "price_asc":
        query = query.orderBy(products.price);
        break;
      case "price_desc":
        query = query.orderBy(desc(products.price));
        break;
      case "popularity":
        query = query.orderBy(desc(products.viewCount));
        break;
      case "rating":
        query = query.orderBy(desc(products.rating));
        break;
      case "newest":
      default:
        query = query.orderBy(desc(products.createdAt));
        break;
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    const productsResult = await query;
    
    if (productsResult.length === 0) {
      return { products: [], total };
    }
    
    const productIds = productsResult.map((p: Product) => p.id);
    const allImages = await db
      .select()
      .from(productImages)
      .where(inArray(productImages.productId, productIds))
      .orderBy(productImages.sortOrder);
    
    const imagesByProductId = allImages.reduce((acc, img) => {
      if (!acc[img.productId]) acc[img.productId] = [];
      acc[img.productId].push(img);
      return acc;
    }, {} as Record<string, typeof allImages>);
    
    const productsWithImages = productsResult.map((product: Product) => ({
      ...product,
      images: imagesByProductId[product.id] || [],
    }));
    
    return { products: productsWithImages, total };
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    return product;
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.sku, sku)).limit(1);
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product | undefined> {
    const [product] = await db
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  async deleteProduct(id: string): Promise<void> {
    await db.update(products).set({ isArchived: true }).where(eq(products.id, id));
  }

  async incrementProductView(id: string): Promise<void> {
    await db
      .update(products)
      .set({ viewCount: sql`${products.viewCount} + 1` })
      .where(eq(products.id, id));
  }

  async decreaseProductStock(id: string, quantity: number): Promise<void> {
    await db
      .update(products)
      .set({ 
        stockQuantity: sql`${products.stockQuantity} - ${quantity}`,
        updatedAt: new Date()
      })
      .where(eq(products.id, id));
  }

  async getProductImages(productId: string): Promise<ProductImage[]> {
    return db.select().from(productImages).where(eq(productImages.productId, productId)).orderBy(productImages.sortOrder);
  }

  async addProductImage(image: InsertProductImage): Promise<ProductImage> {
    const [productImage] = await db.insert(productImages).values(image).returning();
    return productImage;
  }

  async updateProductImageOrder(imageId: string, sortOrder: number): Promise<void> {
    await db.update(productImages)
      .set({ sortOrder })
      .where(eq(productImages.id, imageId));
  }

  async deleteProductImage(id: string): Promise<void> {
    await db.delete(productImages).where(eq(productImages.id, id));
  }

  async getUserAddresses(userId: string): Promise<UserAddress[]> {
    return db.select().from(userAddresses).where(eq(userAddresses.userId, userId));
  }

  async getUserAddress(id: string): Promise<UserAddress | undefined> {
    const [address] = await db.select().from(userAddresses).where(eq(userAddresses.id, id)).limit(1);
    return address;
  }

  async createUserAddress(address: InsertUserAddress): Promise<UserAddress> {
    const [userAddress] = await db.insert(userAddresses).values(address).returning();
    return userAddress;
  }

  async updateUserAddress(id: string, data: Partial<InsertUserAddress>): Promise<UserAddress | undefined> {
    const [address] = await db
      .update(userAddresses)
      .set(data)
      .where(eq(userAddresses.id, id))
      .returning();
    return address;
  }

  async deleteUserAddress(id: string): Promise<void> {
    await db.delete(userAddresses).where(eq(userAddresses.id, id));
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<void> {
    await db.update(userAddresses).set({ isDefault: false }).where(eq(userAddresses.userId, userId));
    await db.update(userAddresses).set({ isDefault: true }).where(eq(userAddresses.id, addressId));
  }

  async getUserPaymentCards(userId: string): Promise<UserPaymentCard[]> {
    return db.select().from(userPaymentCards).where(eq(userPaymentCards.userId, userId));
  }

  async getUserPaymentCard(id: string): Promise<UserPaymentCard | undefined> {
    const [card] = await db.select().from(userPaymentCards).where(eq(userPaymentCards.id, id)).limit(1);
    return card;
  }

  async createUserPaymentCard(card: InsertUserPaymentCard): Promise<UserPaymentCard> {
    const [paymentCard] = await db.insert(userPaymentCards).values(card).returning();
    return paymentCard;
  }

  async deleteUserPaymentCard(id: string): Promise<void> {
    await db.delete(userPaymentCards).where(eq(userPaymentCards.id, id));
  }

  async setDefaultPaymentCard(userId: string, cardId: string): Promise<void> {
    await db.update(userPaymentCards).set({ isDefault: false }).where(eq(userPaymentCards.userId, userId));
    await db.update(userPaymentCards).set({ isDefault: true }).where(eq(userPaymentCards.id, cardId));
  }

  async getPromocodes(): Promise<Promocode[]> {
    return db.select().from(promocodes).orderBy(desc(promocodes.createdAt));
  }

  async getPromocode(id: string): Promise<Promocode | undefined> {
    const [promocode] = await db.select().from(promocodes).where(eq(promocodes.id, id)).limit(1);
    return promocode;
  }

  async getPromocodeByCode(code: string): Promise<Promocode | undefined> {
    const [promocode] = await db.select().from(promocodes).where(eq(promocodes.code, code)).limit(1);
    return promocode;
  }

  async createPromocode(promocode: InsertPromocode): Promise<Promocode> {
    const [newPromocode] = await db.insert(promocodes).values(promocode).returning();
    return newPromocode;
  }

  async updatePromocode(id: string, data: Partial<InsertPromocode>): Promise<Promocode | undefined> {
    const [promocode] = await db
      .update(promocodes)
      .set(data)
      .where(eq(promocodes.id, id))
      .returning();
    return promocode;
  }

  async deletePromocode(id: string): Promise<void> {
    await db.delete(promocodes).where(eq(promocodes.id, id));
  }

  async getOrders(filters?: { userId?: string; status?: string }): Promise<Order[]> {
    let query = db.select().from(orders);

    const conditions = [];
    if (filters?.userId) {
      conditions.push(eq(orders.userId, filters.userId));
    }
    if (filters?.status) {
      conditions.push(eq(orders.status, filters.status));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)!) as any;
    }

    return query.orderBy(desc(orders.createdAt));
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    return order;
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    return newOrder;
  }

  async updateOrder(id: string, data: Partial<InsertOrder>): Promise<Order | undefined> {
    const [order] = await db
      .update(orders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return order;
  }

  async getCartItems(userId: string): Promise<CartItemWithProduct[]> {
    const items = await db
      .select({
        id: cartItems.id,
        userId: cartItems.userId,
        productId: cartItems.productId,
        quantity: cartItems.quantity,
        addedAt: cartItems.addedAt,
        updatedAt: cartItems.updatedAt,
        product: products,
      })
      .from(cartItems)
      .leftJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.userId, userId));
    
    if (items.length === 0) {
      return [];
    }
    
    const productIds = items
      .map((item) => item.product?.id)
      .filter((id): id is string => !!id);
    
    if (productIds.length === 0) {
      return items.map(item => ({
        id: item.id,
        userId: item.userId,
        productId: item.productId,
        quantity: item.quantity,
        addedAt: item.addedAt,
        updatedAt: item.updatedAt,
        product: null,
      })) as CartItemWithProduct[];
    }
    
    const allImages = await db
      .select()
      .from(productImages)
      .where(inArray(productImages.productId, productIds))
      .orderBy(productImages.sortOrder);
    
    const imagesByProductId = allImages.reduce((acc, img) => {
      if (!acc[img.productId]) acc[img.productId] = [];
      acc[img.productId].push(img);
      return acc;
    }, {} as Record<string, typeof allImages>);
    
    return items.map((item) => ({
      id: item.id,
      userId: item.userId,
      productId: item.productId,
      quantity: item.quantity,
      addedAt: item.addedAt,
      updatedAt: item.updatedAt,
      product: item.product?.id ? {
        ...item.product,
        price: item.product.price?.toString() || "0",
        discountPercentage: item.product.discountPercentage?.toString() || "0",
        rating: item.product.rating?.toString() || "0",
        weight: item.product.weight?.toString() || null,
        volume: item.product.volume?.toString() || null,
        dimensionsHeight: item.product.dimensionsHeight?.toString() || null,
        dimensionsLength: item.product.dimensionsLength?.toString() || null,
        dimensionsWidth: item.product.dimensionsWidth?.toString() || null,
        images: imagesByProductId[item.product.id] || [],
      } : null,
    })) as CartItemWithProduct[];
  }

  async getCartItem(userId: string, productId: string): Promise<CartItem | undefined> {
    const [item] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
      .limit(1);
    return item;
  }

  async addCartItem(item: InsertCartItem): Promise<CartItem> {
    const existing = await this.getCartItem(item.userId, item.productId);
    if (existing) {
      const [updated] = await db
        .update(cartItems)
        .set({ 
          quantity: existing.quantity + item.quantity,
          updatedAt: new Date()
        })
        .where(eq(cartItems.id, existing.id))
        .returning();
      return updated;
    }
    const [cartItem] = await db.insert(cartItems).values(item).returning();
    return cartItem;
  }

  async updateCartItem(userId: string, productId: string, quantity: number): Promise<CartItem | undefined> {
    const [item] = await db
      .update(cartItems)
      .set({ quantity, updatedAt: new Date() })
      .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
      .returning();
    return item;
  }

  async deleteCartItem(userId: string, productId: string): Promise<void> {
    await db
      .delete(cartItems)
      .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)));
  }

  async clearCart(userId: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.userId, userId));
  }

  async getWishlistItems(userId: string): Promise<WishlistItem[]> {
    const items = await db
      .select()
      .from(wishlistItems)
      .where(eq(wishlistItems.userId, userId));
    
    if (items.length === 0) {
      return [];
    }
    
    const uniqueProductIds = Array.from(new Set(items.map((item) => item.productId)));
    const productsData = await db
      .select()
      .from(products)
      .where(inArray(products.id, uniqueProductIds));
    
    const allImages = await db
      .select()
      .from(productImages)
      .where(inArray(productImages.productId, uniqueProductIds))
      .orderBy(productImages.sortOrder);
    
    const imagesByProductId = allImages.reduce((acc, img) => {
      if (!acc[img.productId]) acc[img.productId] = [];
      acc[img.productId].push(img);
      return acc;
    }, {} as Record<string, typeof allImages>);
    
    const productById = productsData.reduce((acc, p) => {
      acc[p.id] = {
        ...p,
        price: p.price?.toString() || "0",
        discountPercentage: p.discountPercentage?.toString() || "0",
        rating: p.rating?.toString() || "0",
        weight: p.weight?.toString() || null,
        volume: p.volume?.toString() || null,
        dimensionsHeight: p.dimensionsHeight?.toString() || null,
        dimensionsLength: p.dimensionsLength?.toString() || null,
        dimensionsWidth: p.dimensionsWidth?.toString() || null,
      };
      return acc;
    }, {} as Record<string, any>);
    
    return items.map((item) => ({
      ...item,
      product: productById[item.productId] 
        ? { ...productById[item.productId], images: imagesByProductId[item.productId] || [] }
        : undefined,
    })) as any;
  }

  async addWishlistItem(item: InsertWishlistItem): Promise<WishlistItem> {
    const [wishlistItem] = await db.insert(wishlistItems).values(item).returning();
    return wishlistItem;
  }

  async deleteWishlistItem(userId: string, productId: string): Promise<void> {
    await db
      .delete(wishlistItems)
      .where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.productId, productId)));
  }

  async getSupportMessages(userId: string): Promise<SupportMessage[]> {
    return db.select().from(supportMessages).where(eq(supportMessages.userId, userId)).orderBy(supportMessages.createdAt);
  }

  async getAllSupportConversations(status?: 'active' | 'archived'): Promise<{ userId: string; lastMessage: SupportMessage; unreadCount: number; status: string }[]> {
    // Get all conversations with optional status filter
    let conversationQuery = db.select().from(supportConversations);
    
    if (status) {
      conversationQuery = conversationQuery.where(eq(supportConversations.status, status)) as any;
    }
    
    const allConversations = await conversationQuery;
    
    const result = [];
    
    for (const conv of allConversations) {
      // Get last message for this conversation
      const [lastMessage] = await db
        .select()
        .from(supportMessages)
        .where(eq(supportMessages.userId, conv.userId))
        .orderBy(desc(supportMessages.createdAt))
        .limit(1);
      
      if (lastMessage) {
        const unreadCount = await db.select({ count: sql<number>`count(*)` })
          .from(supportMessages)
          .where(and(
            eq(supportMessages.userId, conv.userId),
            eq(supportMessages.isRead, false)
          ));
        
        result.push({
          userId: conv.userId,
          lastMessage,
          unreadCount: Number(unreadCount[0]?.count || 0),
          status: conv.status
        });
      }
    }
    
    return result;
  }

  async createSupportMessage(message: InsertSupportMessage): Promise<SupportMessage> {
    const [supportMessage] = await db.insert(supportMessages).values(message).returning();
    return supportMessage;
  }

  async markMessageAsRead(id: string): Promise<void> {
    await db.update(supportMessages).set({ isRead: true }).where(eq(supportMessages.id, id));
  }

  async getSupportMessageAttachments(messageId: string): Promise<SupportMessageAttachment[]> {
    return db.select().from(supportMessageAttachments).where(eq(supportMessageAttachments.messageId, messageId));
  }

  async addSupportMessageAttachment(attachment: InsertSupportMessageAttachment): Promise<SupportMessageAttachment> {
    const [messageAttachment] = await db.insert(supportMessageAttachments).values(attachment).returning();
    return messageAttachment;
  }

  async deleteSupportMessageAttachment(id: string): Promise<void> {
    await db.delete(supportMessageAttachments).where(eq(supportMessageAttachments.id, id));
  }

  async getOrCreateConversation(userId: string): Promise<SupportConversation> {
    const [existing] = await db
      .select()
      .from(supportConversations)
      .where(eq(supportConversations.userId, userId))
      .limit(1);
    
    if (existing) {
      // If conversation is archived, activate it when user sends a message
      if (existing.status === 'archived') {
        const [activated] = await db
          .update(supportConversations)
          .set({ status: 'active', updatedAt: new Date(), archivedAt: null })
          .where(eq(supportConversations.userId, userId))
          .returning();
        return activated;
      }
      return existing;
    }
    
    const [conversation] = await db
      .insert(supportConversations)
      .values({ userId, status: 'active' })
      .returning();
    return conversation;
  }

  async archiveConversation(userId: string): Promise<void> {
    await db
      .update(supportConversations)
      .set({ status: 'archived', archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(supportConversations.userId, userId));
  }

  async activateConversation(userId: string): Promise<void> {
    await db
      .update(supportConversations)
      .set({ status: 'active', archivedAt: null, updatedAt: new Date() })
      .where(eq(supportConversations.userId, userId));
  }

  async deleteOldMessages(olderThanDays: number): Promise<number> {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - olderThanDays);
    
    const result = await db
      .delete(supportMessages)
      .where(lte(supportMessages.createdAt, dateThreshold));
    
    return result.rowCount || 0;
  }
}

export const storage = new DatabaseStorage();
