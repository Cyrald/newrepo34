import type {
  RegisterInput,
  LoginInput,
  User,
  Category,
  Product,
  CartItem,
  CartItemWithProduct,
  WishlistItem,
  WishlistItemWithProduct,
  Order,
  OrderWithTotal,
  UserAddress,
  UserPaymentCard,
  Promocode,
  SupportMessage,
} from "@shared/schema";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let accessToken: string | null = null;
let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

const PROTECTED_ENDPOINTS = [
  '/api/cart',
  '/api/wishlist',
  '/api/addresses',
  '/api/payment-cards',
  '/api/orders',
  '/api/admin',
  '/api/support',
  '/api/promocodes',
  '/api/auth/me',
  '/api/auth/logout',
  '/api/auth/password',
  '/api/auth/sessions',
];

function isProtectedEndpoint(endpoint: string): boolean {
  return PROTECTED_ENDPOINTS.some(protectedPath => endpoint.startsWith(protectedPath));
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function refreshAccessToken(): Promise<string> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        accessToken = null;
        throw new Error("REFRESH_FAILED");
      }

      const data = await response.json();
      accessToken = data.accessToken;
      return data.accessToken;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function initializeAuth(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      accessToken = null;
      return false;
    }

    const data = await response.json();
    accessToken = data.accessToken;
    return true;
  } catch (error) {
    accessToken = null;
    return false;
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  retryCount = 0,
): Promise<T> {
  const isFormData = options.body instanceof FormData;
  
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (accessToken && !endpoint.includes("/auth/refresh")) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && retryCount === 0) {
    if (endpoint.includes("/auth/login") || endpoint.includes("/auth/register") || endpoint.includes("/auth/refresh")) {
      const errorData = await response.json().catch(() => ({
        message: "Произошла ошибка",
      }));
      throw new ApiError(
        response.status, 
        errorData.message || "Произошла ошибка",
        errorData.code
      );
    }
    
    if (!isProtectedEndpoint(endpoint)) {
      const errorData = await response.json().catch(() => ({
        message: "Произошла ошибка",
      }));
      throw new ApiError(
        response.status, 
        errorData.message || "Произошла ошибка",
        errorData.code
      );
    }
    
    try {
      await refreshAccessToken();
      return fetchApi<T>(endpoint, options, retryCount + 1);
    } catch (refreshError) {
      accessToken = null;
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = "/login";
        return new Promise(() => {}) as Promise<T>;
      }
      throw new ApiError(401, "Сессия истекла", "SESSION_EXPIRED");
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: "Произошла ошибка",
    }));
    throw new ApiError(
      response.status, 
      errorData.message || "Произошла ошибка",
      errorData.code
    );
  }

  return response.json();
}

export const authApi = {
  register: async (data: RegisterInput) => {
    const result = await fetchApi<{ user: User; accessToken: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    setAccessToken(result.accessToken);
    return result;
  },

  login: async (data: LoginInput) => {
    const result = await fetchApi<{ user: User; accessToken: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
    setAccessToken(result.accessToken);
    return result;
  },

  logout: async () => {
    const result = await fetchApi<{ message: string }>("/api/auth/logout", {
      method: "POST",
    });
    setAccessToken(null);
    return result;
  },

  verifyEmail: (token: string) =>
    fetchApi<{ success: boolean }>(`/api/auth/verify-email?token=${token}`),

  me: () => fetchApi<{ user: User }>("/api/auth/me"),

  updateProfile: (data: {
    firstName?: string;
    lastName?: string;
    patronymic?: string;
    phone?: string;
  }) =>
    fetchApi<{ user: User }>("/api/auth/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  updatePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const result = await fetchApi<{ message: string }>("/api/auth/password", {
      method: "PUT",
      body: JSON.stringify(data),
    });
    setAccessToken(null);
    return result;
  },
  
  getSessions: () =>
    fetchApi<{ sessions: Array<{
      id: string;
      tfid: string;
      userAgent: string | null;
      ipAddress: string | null;
      lastActivityAt: Date;
      expiresAt: Date;
      createdAt: Date;
    }> }>("/api/auth/sessions"),
  
  deleteSession: (sessionId: string) =>
    fetchApi<{ message: string }>(`/api/auth/sessions/${sessionId}`, {
      method: "DELETE",
    }),
};

export const categoriesApi = {
  getAll: () => fetchApi<Category[]>("/api/categories"),
  
  getById: (id: string) => fetchApi<Category>(`/api/categories/${id}`),

  create: (data: { name: string; slug: string; description?: string; sortOrder?: number }) =>
    fetchApi<Category>("/api/categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Category>) =>
    fetchApi<Category>(`/api/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/categories/${id}`, {
      method: "DELETE",
    }),
};

export const productsApi = {
  getAll: (params?: {
    categoryId?: string;
    categoryIds?: string[];
    minPrice?: number;
    maxPrice?: number;
    search?: string;
    sortBy?: "price_asc" | "price_desc" | "popularity" | "newest" | "rating";
    page?: number;
    limit?: number;
    includeArchived?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === 'categoryIds' && Array.isArray(value)) {
            searchParams.append('categoryIds', value.join(','));
          } else if (key !== 'categoryIds') {
            searchParams.append(key, value.toString());
          }
        }
      });
    }
    const queryString = searchParams.toString();
    return fetchApi<{
      products: Product[];
      total: number;
      page: number;
      totalPages: number;
    }>(`/api/products${queryString ? `?${queryString}` : ""}`);
  },

  getById: (id: string) => fetchApi<Product>(`/api/products/${id}`),

  create: (data: FormData) =>
    fetchApi<Product>("/api/products", {
      method: "POST",
      body: data,
      headers: {},
    }),

  update: (id: string, data: Partial<Product>) =>
    fetchApi<Product>(`/api/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/products/${id}`, {
      method: "DELETE",
    }),

  permanentDelete: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/products/${id}/permanent`, {
      method: "DELETE",
    }),

  uploadImages: (productId: string, images: FormData) =>
    fetchApi<{ images: string[] }>(`/api/products/${productId}/images`, {
      method: "POST",
      body: images,
      headers: {},
    }),

  deleteImage: (imageId: string) =>
    fetchApi<{ success: boolean }>(`/api/products/images/${imageId}`, {
      method: "DELETE",
    }),
  
  reorderImages: (productId: string, imageOrders: Array<{ imageId: string; sortOrder: number }>) =>
    fetchApi<{ message: string }>(`/api/products/${productId}/images/reorder`, {
      method: "PATCH",
      body: JSON.stringify({ imageOrders }),
    }),
};

export const cartApi = {
  get: () => fetchApi<CartItemWithProduct[]>("/api/cart"),

  add: (data: { productId: string; quantity: number }) =>
    fetchApi<{ success: boolean }>("/api/cart", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (productId: string, quantity: number) =>
    fetchApi<{ success: boolean }>(`/api/cart/${productId}`, {
      method: "PUT",
      body: JSON.stringify({ quantity }),
    }),

  remove: (productId: string) =>
    fetchApi<{ success: boolean }>(`/api/cart/${productId}`, {
      method: "DELETE",
    }),

  clear: () =>
    fetchApi<{ success: boolean }>("/api/cart", {
      method: "DELETE",
    }),
};

export const wishlistApi = {
  get: () => fetchApi<WishlistItemWithProduct[]>("/api/wishlist"),

  add: (productId: string) =>
    fetchApi<{ success: boolean }>("/api/wishlist", {
      method: "POST",
      body: JSON.stringify({ productId }),
    }),

  remove: (productId: string) =>
    fetchApi<{ success: boolean }>(`/api/wishlist/${productId}`, {
      method: "DELETE",
    }),
};

export const addressesApi = {
  getAll: () => fetchApi<UserAddress[]>("/api/addresses"),

  create: (data: {
    label: string;
    fullAddress: string;
    city: string;
    street: string;
    building: string;
    apartment?: string;
    postalCode: string;
    isDefault?: boolean;
  }) =>
    fetchApi<UserAddress>("/api/addresses", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<UserAddress>) =>
    fetchApi<UserAddress>(`/api/addresses/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/addresses/${id}`, {
      method: "DELETE",
    }),

  setDefault: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/addresses/${id}/set-default`, {
      method: "PUT",
    }),
};

export const paymentCardsApi = {
  getAll: () => fetchApi<UserPaymentCard[]>("/api/payment-cards"),

  create: (data: {
    yukassaPaymentToken: string;
    cardLastFour: string;
    cardType: string;
    isDefault?: boolean;
  }) =>
    fetchApi<UserPaymentCard>("/api/payment-cards", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/payment-cards/${id}`, {
      method: "DELETE",
    }),

  setDefault: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/payment-cards/${id}/set-default`, {
      method: "PUT",
    }),
};

export const promocodesApi = {
  getAll: () => fetchApi<Promocode[]>("/api/promocodes"),

  validate: (code: string, orderAmount: number) =>
    fetchApi<{
      valid: boolean;
      promocode?: Promocode;
      error?: string;
      discountAmount?: number;
    }>("/api/promocodes/validate", {
      method: "POST",
      body: JSON.stringify({ code, orderAmount }),
    }),

  create: (data: {
    code: string;
    discountPercentage: number;
    minOrderAmount?: number;
    maxOrderAmount?: number;
    type: "single_use" | "temporary";
    expiresAt?: Date;
    isActive?: boolean;
  }) =>
    fetchApi<Promocode>("/api/promocodes", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Promocode>) =>
    fetchApi<Promocode>(`/api/promocodes/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/promocodes/${id}`, {
      method: "DELETE",
    }),
};

export const ordersApi = {
  getAll: () => fetchApi<OrderWithTotal[]>("/api/orders"),

  getById: (id: string) => fetchApi<OrderWithTotal>(`/api/orders/${id}`),

  create: (data: {
    items: Array<{
      productId: string;
      name: string;
      price: string;
      quantity: number;
      discount?: string;
    }>;
    deliveryService: "cdek" | "boxberry";
    deliveryType: "pvz" | "postamat" | "courier";
    deliveryPointCode?: string;
    deliveryAddress?: {
      city: string;
      street: string;
      building: string;
      apartment?: string;
      postalCode: string;
    };
    paymentMethod: "online" | "on_delivery";
    promocodeId?: string;
    bonusesUsed?: number;
  }) =>
    fetchApi<{ orderId: string; paymentUrl?: string }>("/api/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateStatus: (id: string, status: string) =>
    fetchApi<Order>(`/api/orders/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),
};

export const adminApi = {
  getStats: () =>
    fetchApi<{
      totalRevenue: number;
      revenueChange: number;
      totalOrders: number;
      ordersChange: number;
      totalCustomers: number;
      customersChange: number;
      totalProducts: number;
      productsChange: number;
      recentOrders: Order[];
    }>("/api/admin/stats"),

  getUsers: () =>
    fetchApi<Array<User & { roles: string[] }>>("/api/admin/users"),
};

export const supportApi = {
  getMessages: () => fetchApi<SupportMessage[]>("/api/support/messages"),

  sendMessage: (data: { messageText: string }) =>
    fetchApi<SupportMessage>("/api/support/messages", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  uploadAttachments: (messageId: string, files: FormData) =>
    fetchApi<{ attachments: string[] }>(
      `/api/support/messages/${messageId}/attachments`,
      {
        method: "POST",
        body: files,
        headers: {},
      },
    ),
};
