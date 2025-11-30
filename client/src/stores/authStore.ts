import { create } from "zustand";
import type { User } from "@shared/schema";
import { authApi } from "@/lib/api";
import { useCartStore } from "./cartStore";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  authInitialized: boolean;
  
  // Actions
  login: (user: User) => void;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isAuthenticated: false,
  authInitialized: false,

  login: (user: User) => {
    set({
      user,
      isAuthenticated: true,
      authInitialized: true,
    });
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      useCartStore.getState().clear();
      
      // Очистить cookies при logout
      document.cookie = 'sessionId=; Max-Age=0; path=/';
      document.cookie = 'csrf-token=; Max-Age=0; path=/';
      
      set({
        user: null,
        isAuthenticated: false,
        authInitialized: true,
      });
    }
  },

  setUser: (user: User) => {
    set({ user });
  },

  checkAuth: async () => {
    // Проверить наличие session cookie ЛОКАЛЬНО перед API запросом
    const hasSessionCookie = document.cookie
      .split('; ')
      .some(cookie => cookie.startsWith('sessionId='));
    
    if (!hasSessionCookie) {
      // Нет cookie → точно не залогинен, не делаем лишний API запрос
      set({
        user: null,
        isAuthenticated: false,
        authInitialized: true,
      });
      return;
    }
    
    // Cookie есть → проверить валидность сессии через API
    try {
      const user = await authApi.me();
      set({
        user,
        isAuthenticated: true,
        authInitialized: true,
      });
    } catch (error) {
      // Сессия невалидна → очистить cookies
      document.cookie = 'sessionId=; Max-Age=0; path=/';
      document.cookie = 'csrf-token=; Max-Age=0; path=/';
      
      set({
        user: null,
        isAuthenticated: false,
        authInitialized: true,
      });
    }
  },
}));
