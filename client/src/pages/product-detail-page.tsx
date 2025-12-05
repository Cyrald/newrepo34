import { useState } from "react"
import { useRoute, Link, useLocation } from "wouter"
import { ShoppingCart, Heart, Star, Plus, Minus, ArrowLeft } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
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
import { PageLoadingSkeleton } from "@/components/loading-state"
import { ProductCard } from "@/components/product-card"
import { useProduct } from "@/hooks/useProducts"
import { useAddToCart } from "@/hooks/useCart"
import { useAddToWishlist, useRemoveFromWishlist, useWishlist } from "@/hooks/useWishlist"
import { useToast } from "@/hooks/use-toast"
import { useAuthStore } from "@/stores/authStore"

export default function ProductDetailPage() {
  const [, params] = useRoute("/products/:id")
  const productId = params?.id || ""
  const [location, setLocation] = useLocation()
  
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [authDialogConfig, setAuthDialogConfig] = useState<{
    description: string
    onConfirm: () => void
  }>({ description: "", onConfirm: () => {} })
  
  const { toast } = useToast()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const { data: product, isLoading } = useProduct(productId)
  const addToCartMutation = useAddToCart()
  const addToWishlist = useAddToWishlist()
  const removeFromWishlist = useRemoveFromWishlist()
  const { data: wishlistItems } = useWishlist()

  const [quantity, setQuantity] = useState<number | "">(1)
  const [selectedImage, setSelectedImage] = useState(0)

  const relatedProducts: any[] = []
  
  // Check if product is in wishlist
  const wishlistProductIds = new Set((wishlistItems || []).map((item: any) => item.productId))
  const isInWishlist = wishlistProductIds.has(productId)

  if (isLoading) {
    return <PageLoadingSkeleton />
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-serif font-semibold mb-2">Товар не найден</h1>
            <Link href="/catalog">
              <Button variant="outline">Вернуться в каталог</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const handleAddToCart = async () => {
    if (!product) return
    
    if (!isAuthenticated) {
      setAuthDialogConfig({
        description: "Для добавления товара в корзину требуется авторизация. Войти?",
        onConfirm: () => {
          setAuthDialogOpen(false)
          setLocation(`/login?returnUrl=${encodeURIComponent(location)}`)
        }
      })
      setAuthDialogOpen(true)
      return
    }
    
    const qty = typeof quantity === "number" ? quantity : 1
    
    try {
      await addToCartMutation.mutateAsync({
        productId: product.id,
        quantity: qty,
      })
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось добавить товар в корзину",
        variant: "destructive",
      })
    }
  }

  const handleToggleWishlist = async () => {
    if (!isAuthenticated) {
      setAuthDialogConfig({
        description: "Для добавления в избранное требуется авторизация. Войти?",
        onConfirm: () => {
          setAuthDialogOpen(false)
          setLocation(`/login?returnUrl=${encodeURIComponent(location)}`)
        }
      })
      setAuthDialogOpen(true)
      return
    }
    
    try {
      if (isInWishlist) {
        await removeFromWishlist.mutateAsync(productId)
      } else {
        await addToWishlist.mutateAsync(productId)
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось изменить избранное",
        variant: "destructive",
      })
    }
  }

  const images = (product as any).images || []
  const reviews: any[] = []
  const avgRating = parseFloat(product.rating || "0")

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          {/* Breadcrumbs */}
          <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/">
              <span className="hover:underline">Главная</span>
            </Link>
            <span>/</span>
            <Link href="/catalog">
              <span className="hover:underline">Каталог</span>
            </Link>
            {product.categoryId && (
              <>
                <span>/</span>
                <span>Категория</span>
              </>
            )}
            <span>/</span>
            <span className="text-foreground">{product.name}</span>
          </div>

          {/* Back Button */}
          <Button variant="ghost" className="mb-4" asChild>
            <Link href="/catalog">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад к каталогу
            </Link>
          </Button>

          {/* Product Details */}
          <div className="grid gap-8 lg:grid-cols-2 mb-16">
            {/* Images */}
            <div>
              {/* Main Image */}
              <div className="mb-4 aspect-[3/4] overflow-hidden rounded-lg bg-muted">
                {images.length > 0 && images[selectedImage]?.url ? (
                  <img
                    src={images[selectedImage].url}
                    alt={product.name}
                    className="h-full w-full object-cover"
                    data-testid="img-product-main"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    Нет изображения
                  </div>
                )}
              </div>

              {/* Thumbnail Images */}
              {images.length > 1 && (
                <div className="grid grid-cols-5 gap-2">
                  {images.map((image: any, index: number) => (
                    <button
                      key={image.id}
                      onClick={() => setSelectedImage(index)}
                      className={`aspect-[3/4] overflow-hidden rounded-md border-2 transition-all ${
                        selectedImage === index
                          ? "border-primary"
                          : "border-transparent hover-elevate"
                      }`}
                      data-testid={`button-thumbnail-${index}`}
                    >
                      <img
                        src={image.url}
                        alt={`${product.name} ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div>
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h1 className="mb-2 font-serif text-3xl font-semibold" data-testid="text-product-name">
                    {product.name}
                  </h1>
                  {product.isNew && (
                    <Badge variant="outline" className="hover-elevate">
                      Новинка
                    </Badge>
                  )}
                </div>
              </div>

              {/* Rating */}
              {avgRating > 0 && (
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-5 w-5 ${
                          star <= avgRating
                            ? "fill-primary text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {avgRating.toFixed(1)} ({product.reviewsCount || 0} отзывов)
                  </span>
                </div>
              )}

              {/* Price */}
              <div className="mb-6">
                <p className="text-4xl font-bold text-primary" data-testid="text-product-price">
                  {parseFloat(product.price)} ₽
                </p>
                {parseFloat(product.discountPercentage || "0") > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Скидка {product.discountPercentage}%
                  </p>
                )}
              </div>

              {/* Stock Status */}
              {product.stockQuantity > 0 ? (
                <Badge className="mb-6" variant="default">В наличии</Badge>
              ) : (
                <Badge className="mb-6" variant="destructive">Нет в наличии</Badge>
              )}

              {/* Description */}
              <p className="mb-6 text-muted-foreground">
                {product.description}
              </p>

              <Separator className="my-6" />

              {/* Quantity Selector */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium">
                  Количество
                </label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, (typeof quantity === "number" ? quantity : 1) - 1))}
                    disabled={typeof quantity === "number" && quantity <= 1}
                    data-testid="button-decrease-quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  
                  <Input
                    type="text"
                    value={quantity}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || /^\d+$/.test(val)) {
                        setQuantity(val === "" ? "" : parseInt(val));
                      }
                    }}
                    onBlur={(e) => {
                      const num = parseInt(e.target.value) || 1;
                      setQuantity(Math.max(1, num));
                    }}
                    className="w-20 text-center"
                    data-testid="input-quantity"
                  />
                  
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity((typeof quantity === "number" ? quantity : 1) + 1)}
                    data-testid="button-increase-quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={handleAddToCart}
                  disabled={product.stockQuantity <= 0}
                  data-testid="button-add-to-cart"
                >
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  Добавить в корзину
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleToggleWishlist}
                  data-testid="button-toggle-wishlist"
                >
                  <Heart className={`h-5 w-5 ${isInWishlist ? "fill-red-500 text-red-500" : ""}`} />
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="description" className="mb-16">
            <TabsList>
              <TabsTrigger value="description">Описание</TabsTrigger>
              <TabsTrigger value="specifications">Характеристики</TabsTrigger>
              <TabsTrigger value="reviews">Отзывы ({reviews.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="description" className="mt-6">
              <Card>
                <CardContent className="p-6">
                  <div className="prose max-w-none">
                    <p>{product.description || "Описание отсутствует"}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="specifications" className="mt-6">
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {product.weight && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="font-medium">Вес:</span>
                        <span>{product.weight} г</span>
                      </div>
                    )}
                    {product.volume && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="font-medium">Объем:</span>
                        <span>{product.volume} мл</span>
                      </div>
                    )}
                    {product.composition && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="font-medium">Состав:</span>
                        <span>{product.composition}</span>
                      </div>
                    )}
                    {product.sku && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="font-medium">Артикул:</span>
                        <span>{product.sku}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reviews" className="mt-6">
              <div className="space-y-4">
                {reviews.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <p className="text-muted-foreground">Отзывов пока нет. Будьте первым!</p>
                    </CardContent>
                  </Card>
                ) : (
                  reviews.map((review: any) => (
                    <Card key={review.id}>
                      <CardContent className="p-6">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{review.user.firstName}</span>
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-4 w-4 ${
                                    star <= review.rating
                                      ? "fill-primary text-primary"
                                      : "text-muted-foreground"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {new Date(review.createdAt).toLocaleDateString("ru-RU")}
                          </span>
                        </div>
                        <p className="text-muted-foreground">{review.comment}</p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <section>
              <h2 className="mb-6 font-serif text-2xl font-semibold">
                Похожие товары
              </h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {relatedProducts.map((relatedProduct: any) => (
                  <ProductCard key={relatedProduct.id} product={relatedProduct} />
                ))}
              </div>
            </section>
          )}
        </div>
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
