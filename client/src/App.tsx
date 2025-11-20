import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/providers/theme-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SupportChatLauncher } from "@/components/support-chat-launcher";

const NotFound = lazy(() => import("@/pages/not-found"));
const HomePage = lazy(() => import("@/pages/home-page"));
const CatalogPage = lazy(() => import("@/pages/catalog-page"));
const ProductDetailPage = lazy(() => import("@/pages/product-detail-page"));
const CartPage = lazy(() => import("@/pages/cart-page"));
const CheckoutPage = lazy(() => import("@/pages/checkout-page"));
const LoginPage = lazy(() => import("@/pages/login-page"));
const RegisterPage = lazy(() => import("@/pages/register-page"));
const VerifyEmailPage = lazy(() => import("@/pages/verify-email-page"));
const ProfilePage = lazy(() => import("@/pages/profile-page"));
const WishlistPage = lazy(() => import("@/pages/wishlist-page"));
const PrivacyPolicyPage = lazy(() => import("@/pages/privacy-policy-page"));
const AdminDashboardPage = lazy(() => import("@/pages/admin/dashboard-page"));
const AdminUsersPage = lazy(() => import("@/pages/admin/users-page"));
const AdminProductsPage = lazy(() => import("@/pages/admin/products-page"));
const AdminCategoriesPage = lazy(() => import("@/pages/admin/categories-page"));
const AdminPromocodesPage = lazy(() => import("@/pages/admin/promocodes-page"));
const AdminOrdersPage = lazy(() => import("@/pages/admin/orders-page"));
const AdminSupportChatPage = lazy(() => import("@/pages/admin/support-chat-page"));

function PageLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Загрузка...</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/catalog" component={CatalogPage} />
      <Route path="/products/:id" component={ProductDetailPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route path="/privacy-policy" component={PrivacyPolicyPage} />
      
      {/* Protected Routes - require authentication */}
      <Route path="/cart">
        <ProtectedRoute>
          <CartPage />
        </ProtectedRoute>
      </Route>
      <Route path="/checkout">
        <ProtectedRoute>
          <CheckoutPage />
        </ProtectedRoute>
      </Route>
      <Route path="/profile">
        <ProtectedRoute>
          <ProfilePage />
        </ProtectedRoute>
      </Route>
      <Route path="/profile/:tab">
        <ProtectedRoute>
          <ProfilePage />
        </ProtectedRoute>
      </Route>
      <Route path="/wishlist">
        <ProtectedRoute>
          <WishlistPage />
        </ProtectedRoute>
      </Route>
      
      {/* Admin Routes - require staff role */}
      <Route path="/admin">
        <ProtectedRoute roles={["admin", "marketer", "consultant"]}>
          <AdminDashboardPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute roles={["admin"]}>
          <AdminUsersPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/products">
        <ProtectedRoute roles={["admin", "marketer"]}>
          <AdminProductsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/categories">
        <ProtectedRoute roles={["admin", "marketer"]}>
          <AdminCategoriesPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/promocodes">
        <ProtectedRoute roles={["admin", "marketer"]}>
          <AdminPromocodesPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/orders">
        <ProtectedRoute roles={["admin", "consultant"]}>
          <AdminOrdersPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/support">
        <ProtectedRoute roles={["admin", "consultant"]}>
          <AdminSupportChatPage />
        </ProtectedRoute>
      </Route>
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Suspense fallback={<PageLoadingFallback />}>
              <Router />
            </Suspense>
            <SupportChatLauncher />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
