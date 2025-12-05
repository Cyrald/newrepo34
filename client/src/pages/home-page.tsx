import { useState } from "react"
import { Link, useLocation } from "wouter"
import { ShoppingBag, Leaf, Award, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import heroImage from "@assets/generated_images/Hero_section_background_image_b0dcdc6c.png"
import honeyImage from "@assets/generated_images/Honey_category_image_cdb40b0f.png"
import herbsImage from "@assets/generated_images/Herbs_category_image_2680fbbd.png"
import cosmeticsImage from "@assets/generated_images/Cosmetics_category_image_81e7ff29.png"
import { ProductCard } from "@/components/product-card"
import { CategoryCard } from "@/components/category-card"
import { useCategories } from "@/hooks/useCategories"
import { useProducts } from "@/hooks/useProducts"
import { useWishlist } from "@/hooks/useWishlist"
import { useAuthStore } from "@/stores/authStore"
import { usePrefetchRoutes } from "@/hooks/usePrefetchRoutes"
import { useAddToCart } from "@/hooks/useCart"
import { useAddToWishlist, useRemoveFromWishlist } from "@/hooks/useWishlist"
import { useToast } from "@/hooks/use-toast"

export default function HomePage() {
  usePrefetchRoutes()
  const [, setLocation] = useLocation()
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [authDialogConfig, setAuthDialogConfig] = useState<{
    description: string
    onConfirm: () => void
  }>({ description: "", onConfirm: () => {} })
  
  const { data: categories, isLoading: categoriesLoading } = useCategories()
  const { data: newProductsData, isLoading: productsLoading } = useProducts({
    sortBy: "newest",
    limit: 6,
  })
  const { data: wishlistItems } = useWishlist()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const addToCart = useAddToCart()
  const addToWishlist = useAddToWishlist()
  const removeFromWishlist = useRemoveFromWishlist()
  const { toast } = useToast()

  const featuredCategories = categories?.slice(0, 3) || []
  
  const categoryImages: Record<string, string> = {
    "honey": honeyImage,
    "herbs": herbsImage,
    "cosmetics": cosmeticsImage,
  }

  const newProducts = newProductsData?.products || []
  // Create a Set of wishlist product IDs for quick lookup (empty for unauthenticated users)
  const wishlistProductIds = new Set((wishlistItems || []).map((item: any) => item.productId))

  const handleAddToCart = async (productId: string) => {
    if (!isAuthenticated) {
      setAuthDialogConfig({
        description: "Для добавления товара в корзину требуется авторизация. Войти?",
        onConfirm: () => {
          setAuthDialogOpen(false)
          setLocation(`/login?returnUrl=${encodeURIComponent(window.location.pathname)}`)
        }
      })
      setAuthDialogOpen(true)
      return
    }
    addToCart.mutate({ productId, quantity: 1 }, {
      onSuccess: () => toast({ title: "Товар добавлен в корзину" }),
      onError: () => toast({ title: "Ошибка", description: "Не удалось добавить товар", variant: "destructive" })
    })
  }

  const handleToggleWishlist = async (productId: string) => {
    if (!isAuthenticated) {
      setAuthDialogConfig({
        description: "Для добавления в избранное требуется авторизация. Войти?",
        onConfirm: () => {
          setAuthDialogOpen(false)
          setLocation(`/login?returnUrl=${encodeURIComponent(window.location.pathname)}`)
        }
      })
      setAuthDialogOpen(true)
      return
    }
    
    const isInWishlist = wishlistProductIds.has(productId)
    if (isInWishlist) {
      removeFromWishlist.mutate(productId, {
        onSuccess: () => toast({ title: "Удалено из избранного" }),
      })
    } else {
      addToWishlist.mutate(productId, {
        onSuccess: () => toast({ title: "Добавлено в избранное" }),
      })
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative h-[60vh] md:h-[70vh] overflow-hidden">
          <img
            src={heroImage}
            alt="Натуральные продукты"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Dark wash gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />
          
          <div className="relative container mx-auto px-4 h-full flex flex-col justify-center items-start">
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 max-w-2xl" data-testid="text-hero-title">
              Натуральные продукты для здоровой жизни
            </h1>
            <p className="text-lg md:text-xl text-white/90 mb-8 max-w-xl">
              Только проверенные продукты от надёжных поставщиков
            </p>
            <Link href="/catalog">
              <Button size="lg" variant="default" data-testid="button-hero-cta">
                <ShoppingBag className="mr-2 h-5 w-5" />
                Перейти в каталог
              </Button>
            </Link>
          </div>
        </section>

        {/* Featured Categories */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <h2 className="mb-12 text-center font-serif text-3xl md:text-4xl font-semibold">
              Популярные категории
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              {categoriesLoading ? (
                <p className="col-span-3 text-center text-muted-foreground">Загрузка категорий...</p>
              ) : (
                featuredCategories.map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    imageUrl={categoryImages[category.slug] || honeyImage}
                  />
                ))
              )}
            </div>
          </div>
        </section>

        {/* New Products */}
        {newProducts.length > 0 && (
          <section className="bg-muted py-16 md:py-24">
            <div className="container mx-auto px-4">
              <div className="mb-12 flex items-center justify-between">
                <h2 className="font-serif text-3xl md:text-4xl font-semibold">
                  Новые поступления
                </h2>
                <Link href="/catalog?sort=newest">
                  <Button variant="outline" data-testid="link-all-new-products">
                    Смотреть всё
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {newProducts.slice(0, 6).map((product: any) => (
                  <ProductCard 
                    key={product.id} 
                    product={product}
                    onAddToCart={handleAddToCart}
                    onToggleWishlist={handleToggleWishlist}
                    isInWishlist={wishlistProductIds.has(product.id)}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Value Propositions */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="grid gap-8 md:grid-cols-3">
              <Card>
                <CardContent className="flex flex-col items-center p-8 text-center">
                  <div className="mb-4 rounded-full bg-primary/10 p-4">
                    <Leaf className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="mb-2 font-serif text-xl font-semibold">
                    100% натурально
                  </h3>
                  <p className="text-muted-foreground">
                    Только природные ингредиенты без химии и консервантов
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex flex-col items-center p-8 text-center">
                  <div className="mb-4 rounded-full bg-primary/10 p-4">
                    <Award className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="mb-2 font-serif text-xl font-semibold">
                    Сертифицировано
                  </h3>
                  <p className="text-muted-foreground">
                    Все товары имеют необходимые сертификаты качества
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex flex-col items-center p-8 text-center">
                  <div className="mb-4 rounded-full bg-primary/10 p-4">
                    <Truck className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="mb-2 font-serif text-xl font-semibold">
                    Быстрая доставка
                  </h3>
                  <p className="text-muted-foreground">
                    Доставим в любой город России через СДЭК и Boxberry
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Promotional Banner - Only for non-authenticated users */}
        {!isAuthenticated && (
          <section className="bg-primary py-12 text-primary-foreground">
            <div className="container mx-auto px-4 text-center">
              <h2 className="mb-4 font-serif text-3xl font-semibold">
                Получите 100 бонусов при регистрации!
              </h2>
              <p className="mb-6 text-lg opacity-90">
                Используйте их для оплаты следующих заказов
              </p>
              <Link href="/register">
                <Button size="lg" variant="secondary" data-testid="button-register-cta">
                  Зарегистрироваться
                </Button>
              </Link>
            </div>
          </section>
        )}

        {/* Newsletter */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <Card className="mx-auto max-w-2xl">
              <CardContent className="p-8 text-center">
                <h2 className="mb-4 font-serif text-2xl font-semibold">
                  Подпишитесь на рассылку
                </h2>
                <p className="mb-6 text-muted-foreground">
                  Узнавайте первыми о новых поступлениях и специальных предложениях
                </p>
                <form className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="email"
                    placeholder="Ваш email"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    data-testid="input-newsletter-email"
                  />
                  <Button type="submit" data-testid="button-newsletter-submit">
                    Подписаться
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {/* Auth Dialog */}
      <AlertDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Требуется авторизация</AlertDialogTitle>
            <AlertDialogDescription>
              {authDialogConfig.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={authDialogConfig.onConfirm}>
              Войти
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  )
}
