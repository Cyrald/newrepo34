import { useState } from "react"
import { Link, useLocation } from "wouter"
import { Search, ShoppingCart, Heart, User, Menu, X, LayoutDashboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAuthStore } from "@/stores/authStore"
import { useCartStore } from "@/stores/cartStore"

export function Header() {
  const [, setLocation] = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [authDialogConfig, setAuthDialogConfig] = useState<{
    title: string
    description: string
    returnUrl: string
  }>({ title: "", description: "", returnUrl: "" })

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)
  const cartItemsCount = useCartStore((state) => state.itemCount)
  const wishlistItemsCount = 0

  // Check if user has staff role (admin, marketer, or consultant)
  const hasStaffRole = user?.roles && user.roles.some(role => 
    ['admin', 'marketer', 'consultant'].includes(role)
  )

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      window.location.href = `/catalog?search=${encodeURIComponent(searchQuery)}`
    }
  }

  const handleProtectedNavigation = (e: React.MouseEvent, targetUrl: string, feature: string) => {
    e.preventDefault()
    if (!isAuthenticated) {
      setAuthDialogConfig({
        title: "Требуется авторизация",
        description: `Для ${feature} требуется авторизация. Войти?`,
        returnUrl: targetUrl
      })
      setAuthDialogOpen(true)
    } else {
      setLocation(targetUrl)
    }
  }

  const handleAuthConfirm = () => {
    setAuthDialogOpen(false)
    setLocation(`/login?returnUrl=${encodeURIComponent(authDialogConfig.returnUrl)}`)
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Top bar */}
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center gap-2" data-testid="link-home">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <span className="font-serif text-xl font-bold">Э</span>
            </div>
            <span className="hidden font-serif text-xl font-bold sm:inline">ЭкоМаркет</span>
          </div>
        </Link>

        {/* Search - desktop */}
        <form onSubmit={handleSearch} className="hidden flex-1 max-w-xl md:flex">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Поиск товаров..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10"
              data-testid="input-search"
            />
          </div>
        </form>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => handleProtectedNavigation(e, "/wishlist", "просмотра избранного")}
            data-testid="link-wishlist"
          >
            <div className="relative">
              <Heart className="h-5 w-5" />
              {wishlistItemsCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -right-2 -top-2 h-5 min-w-5 px-1 text-xs"
                  data-testid="badge-wishlist-count"
                >
                  {wishlistItemsCount}
                </Badge>
              )}
            </div>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => handleProtectedNavigation(e, "/cart", "просмотра корзины")}
            data-testid="link-cart"
          >
            <span className="relative inline-flex w-5 h-5">
              <ShoppingCart className="h-5 w-5" />
              {cartItemsCount > 0 && (
                <Badge
                  className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 flex h-4 w-4 min-w-[16px] items-center justify-center rounded-full p-0 text-[9px] bg-red-500 hover:bg-red-500 dark:bg-orange-500 dark:hover:bg-orange-500 text-white border-0 pointer-events-none"
                  data-testid="badge-cart-count"
                >
                  {cartItemsCount > 99 ? "99+" : cartItemsCount}
                </Badge>
              )}
            </span>
          </Button>

          {/* Admin Panel Button */}
          {isAuthenticated && hasStaffRole && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="hidden sm:inline-flex gap-2"
              data-testid="link-admin-panel"
            >
              <Link href="/admin">
                <LayoutDashboard className="h-4 w-4" />
                Админ панель
              </Link>
            </Button>
          )}

          {isAuthenticated ? (
            <Button
              variant="ghost"
              size="icon"
              asChild
              data-testid="link-profile"
            >
              <Link href="/profile">
                <User className="h-5 w-5" />
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              size="sm"
              className="hidden sm:inline-flex"
              data-testid="link-login"
            >
              <Link href="/login">Войти</Link>
            </Button>
          )}

          {/* Mobile menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                data-testid="button-mobile-menu"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <nav className="flex flex-col gap-4 mt-8">
                <Link href="/catalog" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start" data-testid="link-catalog-mobile">
                    Каталог
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start" 
                  data-testid="link-wishlist-mobile"
                  onClick={(e) => {
                    setMobileMenuOpen(false)
                    handleProtectedNavigation(e, "/wishlist", "просмотра избранного")
                  }}
                >
                  Избранное
                </Button>
                {isAuthenticated && hasStaffRole && (
                  <Link href="/admin" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full justify-start gap-2" data-testid="link-admin-panel-mobile">
                      <LayoutDashboard className="h-4 w-4" />
                      Админ панель
                    </Button>
                  </Link>
                )}
                {!isAuthenticated && (
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full" data-testid="link-login-mobile">
                      Войти
                    </Button>
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Search - mobile */}
      <form onSubmit={handleSearch} className="container mx-auto px-4 pb-3 md:hidden">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Поиск товаров..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10"
            data-testid="input-search-mobile"
          />
        </div>
      </form>

      {/* Secondary nav */}
      <div className="border-t">
        <div className="container mx-auto px-4">
          <nav className="flex gap-6 overflow-x-auto py-3">
            <Link href="/catalog">
              <Button
                variant="ghost"
                size="sm"
                data-testid="link-catalog"
              >
                Каталог
              </Button>
            </Link>
            <Link href="/catalog?category=honey">
              <Button variant="ghost" size="sm">
                Мёд
              </Button>
            </Link>
            <Link href="/catalog?category=herbs">
              <Button variant="ghost" size="sm">
                Травы
              </Button>
            </Link>
            <Link href="/catalog?category=cosmetics">
              <Button variant="ghost" size="sm">
                Косметика
              </Button>
            </Link>
          </nav>
        </div>
      </div>

      {/* Auth Dialog */}
      <AlertDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{authDialogConfig.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {authDialogConfig.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleAuthConfirm}>
              Войти
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  )
}
