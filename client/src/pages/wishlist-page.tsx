import { useEffect } from "react"
import { Heart } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProductCard } from "@/components/product-card"
import { ProductGridSkeleton } from "@/components/loading-state"
import { EmptyState } from "@/components/empty-state"
import { useWishlist, useRemoveFromWishlist } from "@/hooks/useWishlist"
import { useAddToCart } from "@/hooks/useCart"
import { useToast } from "@/hooks/use-toast"
import { useAuthStore } from "@/stores/authStore"
import { useLocation } from "wouter"

export default function WishlistPage() {
  const [, setLocation] = useLocation()
  const authInitialized = useAuthStore((state) => state.authInitialized)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const { data: wishlistItems, isLoading } = useWishlist()
  const removeFromWishlist = useRemoveFromWishlist()
  const addToCart = useAddToCart()
  const { toast } = useToast()

  useEffect(() => {
    if (authInitialized && !isAuthenticated) {
      setLocation("/login?returnUrl=/wishlist")
    }
  }, [authInitialized, isAuthenticated, setLocation])

  if (!authInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    )
  }

  const handleAddToCart = async (productId: string) => {
    try {
      await addToCart.mutateAsync({ productId, quantity: 1 })
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось добавить товар в корзину",
        variant: "destructive",
      })
    }
  }

  const handleRemoveFromWishlist = async (productId: string) => {
    try {
      await removeFromWishlist.mutateAsync(productId)
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить товар",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <h1 className="mb-8 font-serif text-3xl md:text-4xl font-semibold" data-testid="text-page-title">
            Избранное
          </h1>

          {isLoading ? (
            <ProductGridSkeleton />
          ) : !wishlistItems || wishlistItems.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="Избранное пусто"
              description="Добавьте товары в избранное, чтобы не потерять их"
              action={{
                label: "Перейти в каталог",
                onClick: () => setLocation("/catalog"),
              }}
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {wishlistItems.map((item) => (
                <ProductCard
                  key={item.id}
                  product={item.product}
                  onAddToCart={handleAddToCart}
                  onToggleWishlist={handleRemoveFromWishlist}
                  isInWishlist={true}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
