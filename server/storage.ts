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
  type WishlistItemWithProduct,
  type SupportConversation,
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
import { eq, and, desc, sql, like, gte, lte, or, inArray, isNull, isNotNull } from "drizzle-orm";
import { escapeLikePattern } from "./utils/sanitize";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  deleteUserAccount(userId: string): Promise<void>;
  
  getUserRoles(userId: string): Promise<UserRole[]>;
  addUserRole(role: InsertUserRole): Promise<UserRole>;
  removeUserRole(userId: string, role: string): Promise<void>;
  incrementTokenVersion(userId: string): Promise<number>;
  
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
  permanentDeleteProduct(id: string): Promise<void>;
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
  
  getCartItems(userId: string): Promise<CartItemWithProduct[]>;
  getCartItem(userId: string, productId: string): Promise<CartItem | undefined>;
  addCartItem(item: InsertCartItem): Promise<CartItem>;
  updateCartItem(userId: string, productId: string, quantity: number): Promise<CartItem | undefined>;
  deleteCartItem(userId: string, productId: string): Promise<void>;
  clearCart(userId: string): Promise<void>;
  
  getWishlistItems(userId: string): Promise<WishlistItemWithProduct[]>;
  addWishlistItem(item: InsertWishlistItem): Promise<WishlistItem>;
  deleteWishlistItem(userId: string, productId: string): Promise<void>;
  
  getSupportMessages(userId: string): Promise<SupportMessage[]>;
  getAllSupportConversations(status?: 'open' | 'archived' | 'closed'): Promise<{ userId: string; lastMessage: SupportMessage; status: string; archivedAt: Date | null; closedAt: Date | null }[]>;
  createSupportMessage(message: InsertSupportMessage): Promise<SupportMessage>;
  markMessageAsRead(id: string): Promise<void>;
  
  getSupportMessageAttachments(messageId: string): Promise<SupportMessageAttachment[]>;
  addSupportMessageAttachment(attachment: InsertSupportMessageAttachment): Promise<SupportMessageAttachment>;
  deleteSupportMessageAttachment(id: string): Promise<void>;
  
  getOrCreateConversation(userId: string): Promise<SupportConversation>;
  getSupportConversation(userId: string): Promise<SupportConversation | undefined>;
  getActiveConversation(userId: string): Promise<SupportConversation | undefined>;
  getConversationStatus(userId: string): Promise<{ status: string } | undefined>;
  archiveConversation(userId: string): Promise<void>;
  closeConversation(userId: string): Promise<void>;
  reopenConversation(userId: string): Promise<void>;
  updateLastMessageTime(userId: string): Promise<void>;
  searchClosedConversations(filters: { email?: string; dateFrom?: Date; dateTo?: Date }): Promise<{ userId: string; lastMessage: SupportMessage; status: string; closedAt: Date | null }[]>;
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

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.verificationToken, token)).limit(1);
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

  async incrementTokenVersion(userId: string): Promise<number> {
    const [updated] = await db.update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, userId))
      .returning({ newVersion: users.tokenVersion });
    return updated.newVersion;
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
      const sanitized = escapeLikePattern(filters.search);
      const searchTerm = `%${sanitized}%`;
      conditions.push(
        or(
          sql`${products.name} ILIKE ${searchTerm} ESCAPE '\\'`,
          sql`${products.description} ILIKE ${searchTerm} ESCAPE '\\'`
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
    
    const imagesByProductId = allImages.reduce((acc: any, img: ProductImage) => {
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
    await db.update(products).set({ isArchived: true, updatedAt: new Date() }).where(eq(products.id, id));
  }

  async permanentDeleteProduct(id: string): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async incrementProductView(id: string): Promise<void> {
    await db.execute(
      sql`UPDATE products SET view_count = view_count + 1, updated_at = NOW() WHERE id = ${id}`
    );
  }

  async getProductImages(productId: string): Promise<ProductImage[]> {
    return db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(productImages.sortOrder);
  }

  async addProductImage(image: InsertProductImage): Promise<ProductImage> {
    const [newImage] = await db.insert(productImages).values(image).returning();
    return newImage;
  }

  async updateProductImageOrder(imageId: string, sortOrder: number): Promise<void> {
    await db
      .update(productImages)
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
    const [address] = await db
      .select()
      .from(userAddresses)
      .where(eq(userAddresses.id, id))
      .limit(1);
    return address;
  }

  async createUserAddress(address: InsertUserAddress): Promise<UserAddress> {
    const [newAddress] = await db.insert(userAddresses).values(address).returning();
    return newAddress;
  }

  async updateUserAddress(
    id: string,
    data: Partial<InsertUserAddress>
  ): Promise<UserAddress | undefined> {
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
    await db
      .update(userAddresses)
      .set({ isDefault: false })
      .where(and(eq(userAddresses.userId, userId), eq(userAddresses.isDefault, true)));

    await db
      .update(userAddresses)
      .set({ isDefault: true })
      .where(eq(userAddresses.id, addressId));
  }

  async getUserPaymentCards(userId: string): Promise<UserPaymentCard[]> {
    return db.select().from(userPaymentCards).where(eq(userPaymentCards.userId, userId));
  }

  async getUserPaymentCard(id: string): Promise<UserPaymentCard | undefined> {
    const [card] = await db
      .select()
      .from(userPaymentCards)
      .where(eq(userPaymentCards.id, id))
      .limit(1);
    return card;
  }

  async createUserPaymentCard(card: InsertUserPaymentCard): Promise<UserPaymentCard> {
    const [newCard] = await db.insert(userPaymentCards).values(card).returning();
    return newCard;
  }

  async deleteUserPaymentCard(id: string): Promise<void> {
    await db.delete(userPaymentCards).where(eq(userPaymentCards.id, id));
  }

  async setDefaultPaymentCard(userId: string, cardId: string): Promise<void> {
    await db
      .update(userPaymentCards)
      .set({ isDefault: false })
      .where(and(eq(userPaymentCards.userId, userId), eq(userPaymentCards.isDefault, true)));

    await db
      .update(userPaymentCards)
      .set({ isDefault: true })
      .where(eq(userPaymentCards.id, cardId));
  }

  async getPromocodes(): Promise<Promocode[]> {
    return db.select().from(promocodes);
  }

  async getPromocode(id: string): Promise<Promocode | undefined> {
    const [promo] = await db
      .select()
      .from(promocodes)
      .where(eq(promocodes.id, id))
      .limit(1);
    return promo;
  }

  async getPromocodeByCode(code: string): Promise<Promocode | undefined> {
    const [promo] = await db
      .select()
      .from(promocodes)
      .where(eq(promocodes.code, code.toUpperCase()))
      .limit(1);
    return promo;
  }

  async createPromocode(promo: InsertPromocode): Promise<Promocode> {
    const [newPromo] = await db.insert(promocodes).values(promo).returning();
    return newPromo;
  }

  async updatePromocode(id: string, data: Partial<InsertPromocode>): Promise<Promocode | undefined> {
    const [promo] = await db
      .update(promocodes)
      .set(data)
      .where(eq(promocodes.id, id))
      .returning();
    return promo;
  }

  async deletePromocode(id: string): Promise<void> {
    await db.delete(promocodes).where(eq(promocodes.id, id));
  }

  async getOrders(filters?: { userId?: string; status?: string }): Promise<Order[]> {
    const conditions = [];
    if (filters?.userId) {
      conditions.push(eq(orders.userId, filters.userId));
    }
    if (filters?.status) {
      conditions.push(eq(orders.status, filters.status));
    }
    return db
      .select()
      .from(orders)
      .where(conditions.length > 0 ? and(...conditions)! : undefined)
      .orderBy(desc(orders.createdAt));
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
      .select()
      .from(cartItems)
      .leftJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.userId, userId));

    const validItems = items.filter(item => item.products && !item.products.isArchived);

    const itemsWithImages: CartItemWithProduct[] = [];
    
    for (const item of validItems) {
      if (!item.products || item.products.isArchived) {
        continue;
      }
      
      const images = await this.getProductImages(item.products.id);
      
      itemsWithImages.push({
        ...item.cart_items,
        product: {
          ...item.products,
          images,
        },
      });
    }

    return itemsWithImages;
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
    const [newItem] = await db.insert(cartItems).values(item).returning();
    return newItem;
  }

  async updateCartItem(
    userId: string,
    productId: string,
    quantity: number
  ): Promise<CartItem | undefined> {
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

  async getWishlistItems(userId: string): Promise<WishlistItemWithProduct[]> {
    const items = await db
      .select()
      .from(wishlistItems)
      .leftJoin(products, eq(wishlistItems.productId, products.id))
      .where(eq(wishlistItems.userId, userId));

    const validItems = items.filter(item => item.products && !item.products.isArchived);

    const itemsWithImages: WishlistItemWithProduct[] = [];
    
    for (const item of validItems) {
      if (!item.products || item.products.isArchived) {
        continue;
      }
      
      const images = await this.getProductImages(item.products.id);
      
      itemsWithImages.push({
        ...item.wishlist_items,
        product: {
          ...item.products,
          images,
        },
      });
    }

    return itemsWithImages;
  }

  async addWishlistItem(item: InsertWishlistItem): Promise<WishlistItem> {
    const [newItem] = await db.insert(wishlistItems).values(item).returning();
    return newItem;
  }

  async deleteWishlistItem(userId: string, productId: string): Promise<void> {
    await db
      .delete(wishlistItems)
      .where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.productId, productId)));
  }

  async getSupportMessages(userId: string): Promise<SupportMessage[]> {
    const messages = await db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.userId, userId))
      .orderBy(desc(supportMessages.createdAt));
    
    return Promise.all(
      messages.map(async (msg) => {
        const attachments = await this.getSupportMessageAttachments(msg.id);
        return { ...msg, attachments } as any;
      })
    );
  }

  async getAllSupportConversations(status?: 'open' | 'archived' | 'closed'): Promise<any[]> {
    const conditions = [];
    if (status === 'archived') {
      conditions.push(isNotNull(supportConversations.archivedAt));
    } else if (status === 'closed') {
      conditions.push(isNotNull(supportConversations.closedAt));
    } else if (status === 'open') {
      conditions.push(isNull(supportConversations.closedAt));
      conditions.push(isNull(supportConversations.archivedAt));
    }

    const convs = await db
      .select()
      .from(supportConversations)
      .where(conditions.length > 0 ? and(...conditions)! : undefined)
      .orderBy(desc(supportConversations.updatedAt));

    return Promise.all(
      convs.map(async (conv) => {
        const [lastMsg] = await db
          .select()
          .from(supportMessages)
          .where(eq(supportMessages.userId, conv.userId))
          .orderBy(desc(supportMessages.createdAt))
          .limit(1);

        return {
          userId: conv.userId,
          lastMessage: lastMsg,
          status: conv.closedAt ? 'closed' : conv.archivedAt ? 'archived' : 'open',
          archivedAt: conv.archivedAt,
          closedAt: conv.closedAt,
        };
      })
    );
  }

  async createSupportMessage(message: InsertSupportMessage): Promise<SupportMessage> {
    const [newMsg] = await db.insert(supportMessages).values(message).returning();
    return newMsg;
  }

  async markMessageAsRead(id: string): Promise<void> {
    await db
      .update(supportMessages)
      .set({ isRead: true })
      .where(eq(supportMessages.id, id));
  }

  async getSupportMessageAttachments(messageId: string): Promise<SupportMessageAttachment[]> {
    return db
      .select()
      .from(supportMessageAttachments)
      .where(eq(supportMessageAttachments.messageId, messageId));
  }

  async addSupportMessageAttachment(
    attachment: InsertSupportMessageAttachment
  ): Promise<SupportMessageAttachment> {
    const [newAttachment] = await db
      .insert(supportMessageAttachments)
      .values(attachment)
      .returning();
    return newAttachment;
  }

  async deleteSupportMessageAttachment(id: string): Promise<void> {
    await db.delete(supportMessageAttachments).where(eq(supportMessageAttachments.id, id));
  }

  async getOrCreateConversation(userId: string): Promise<SupportConversation> {
    let conv = await this.getSupportConversation(userId);
    if (!conv) {
      [conv] = await db
        .insert(supportConversations)
        .values({ userId })
        .returning();
    }
    return conv;
  }

  async getSupportConversation(userId: string): Promise<SupportConversation | undefined> {
    const [conv] = await db
      .select()
      .from(supportConversations)
      .where(eq(supportConversations.userId, userId))
      .limit(1);
    return conv;
  }

  async getActiveConversation(userId: string): Promise<SupportConversation | undefined> {
    const [conv] = await db
      .select()
      .from(supportConversations)
      .where(
        and(
          eq(supportConversations.userId, userId),
          eq(supportConversations.closedAt, null),
          eq(supportConversations.archivedAt, null)
        )
      )
      .limit(1);
    return conv;
  }

  async getConversationStatus(
    userId: string
  ): Promise<{ status: string } | undefined> {
    const conv = await this.getSupportConversation(userId);
    if (!conv) return undefined;
    return {
      status: conv.closedAt ? 'closed' : conv.archivedAt ? 'archived' : 'open',
    };
  }

  async archiveConversation(userId: string): Promise<void> {
    await db
      .update(supportConversations)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(supportConversations.userId, userId));
  }

  async closeConversation(userId: string): Promise<void> {
    await db
      .update(supportConversations)
      .set({ closedAt: new Date(), updatedAt: new Date() })
      .where(eq(supportConversations.userId, userId));
  }

  async reopenConversation(userId: string): Promise<void> {
    await db
      .update(supportConversations)
      .set({ closedAt: null, archivedAt: null, updatedAt: new Date() })
      .where(eq(supportConversations.userId, userId));
  }

  async updateLastMessageTime(userId: string): Promise<void> {
    await db
      .update(supportConversations)
      .set({ updatedAt: new Date() })
      .where(eq(supportConversations.userId, userId));
  }

  async searchClosedConversations(filters: {
    email?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<any[]> {
    const conditions = [isNotNull(supportConversations.closedAt)];

    if (filters.email) {
      const [user] = await db
        .select()
        .from(users)
        .where(like(users.email, `%${filters.email}%`))
        .limit(1);
      if (user) {
        conditions.push(eq(supportConversations.userId, user.id));
      }
    }

    if (filters.dateFrom) {
      conditions.push(gte(supportConversations.closedAt, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(supportConversations.closedAt, filters.dateTo));
    }

    const convs = await db
      .select()
      .from(supportConversations)
      .where(and(...conditions)!)
      .orderBy(desc(supportConversations.closedAt));

    return Promise.all(
      convs.map(async (conv) => {
        const [lastMsg] = await db
          .select()
          .from(supportMessages)
          .where(eq(supportMessages.userId, conv.userId))
          .orderBy(desc(supportMessages.createdAt))
          .limit(1);

        return {
          userId: conv.userId,
          lastMessage: lastMsg,
          status: 'closed',
          closedAt: conv.closedAt,
        };
      })
    );
  }

  async deleteOldMessages(olderThanMonths: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - olderThanMonths);
    
    const result = await db
      .delete(supportMessages)
      .where(lte(supportMessages.createdAt, cutoffDate))
      .returning();
    return result.length;
  }

  async deleteUserAccount(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  async anonymizeOldOrders(olderThanMonths: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - olderThanMonths);

    const result = await db
      .update(orders)
      .set({
        userId: null,
        deliveryAddress: null,
        updatedAt: new Date(),
      })
      .where(lte(orders.createdAt, cutoffDate))
      .returning();
    
    return result.length;
  }
}

export const storage = new DatabaseStorage();
