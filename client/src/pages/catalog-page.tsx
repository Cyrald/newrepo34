import { useState, useEffect, useRef } from "react"
import { useRoute, useSearch, useLocation } from "wouter"
import { SlidersHorizontal, Search, X } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProductCard } from "@/components/product-card"
import { ProductGridSkeleton } from "@/components/loading-state"
import { EmptyState } from "@/components/empty-state"
import { ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
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
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { useProducts } from "@/hooks/useProducts"
import { useCategories } from "@/hooks/useCategories"
import { useAddToCart } from "@/hooks/useCart"
import { useAddToWishlist, useRemoveFromWishlist, useWishlist } from "@/hooks/useWishlist"
import { useToast } from "@/hooks/use-toast"
import { useAuthStore } from "@/stores/authStore"
import { useDebounce } from "@/hooks/useDebounce"

export default function CatalogPage() {
  const [, params] = useRoute("/catalog")
  const [location, setLocation] = useLocation()
  const searchParams = useSearch()
  const urlParams = new URLSearchParams(searchParams)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [authDialogConfig, setAuthDialogConfig] = useState<{
    description: string
    onConfirm: () => void
  }>({ description: "", onConfirm: () => {} })
  
  const [sortBy, setSortBy] = useState<"price_asc" | "price_desc" | "popularity" | "newest" | "rating">(
    (urlParams.get("sort") as any) || "newest"
  )
  const [priceRange, setPriceRange] = useState([0, 10000])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [inputSearch, setInputSearch] = useState(urlParams.get("search") || "")
  const previousSearch = useRef(urlParams.get("search") || "")
  
  const debouncedInputSearch = useDebounce(inputSearch, 500)

  const searchQuery = urlParams.get("search") || ""
  const currentPage = parseInt(urlParams.get("page") || "1", 10)

  const { data: categoriesData, isLoading: categoriesLoading } = useCategories()
  const { data: productsData, isLoading: productsLoading } = useProducts({
    categoryIds: selectedCategories.length > 0 ? selectedCategories : undefined,
    minPrice: priceRange[0],
    maxPrice: priceRange[1],
    sortBy: sortBy,
    search: searchQuery || undefined,
    page: currentPage,
    limit: 30,
  })

  const addToCart = useAddToCart()
  const addToWishlist = useAddToWishlist()
  const removeFromWishlist = useRemoveFromWishlist()
  const { data: wishlistItems } = useWishlist()
  const { toast } = useToast()

  const categories = categoriesData || []
  const products = productsData?.products || []
  const total = productsData?.total || 0
  const totalPages = productsData?.totalPages || 1
  const isLoading = productsLoading
  
  // Create a Set of wishlist product IDs for quick lookup (empty for unauthenticated users)
  const wishlistProductIds = new Set((wishlistItems || []).map((item: any) => item.productId))

  useEffect(() => {
    const urlSearch = urlParams.get("search") || ""
    if (urlSearch !== previousSearch.current) {
      previousSearch.current = urlSearch
      setInputSearch(urlSearch)
    }
  }, [searchParams])
  
  useEffect(() => {
    if (debouncedInputSearch !== searchQuery) {
      updateURL({ search: debouncedInputSearch, resetPage: true })
    }
  }, [debouncedInputSearch])

  const updateURL = (updates: { search?: string; page?: number; resetPage?: boolean }) => {
    const newParams = new URLSearchParams(searchParams)
    
    if (updates.search !== undefined) {
      if (updates.search) {
        newParams.set("search", updates.search)
      } else {
        newParams.delete("search")
      }
    }
    
    if (updates.resetPage || updates.page === 1) {
      newParams.delete("page")
    } else if (updates.page !== undefined && updates.page > 1) {
      newParams.set("page", updates.page.toString())
    }
    
    const newUrl = `/catalog${newParams.toString() ? '?' + newParams.toString() : ''}`
    setLocation(newUrl)
  }

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
    updateURL({ resetPage: true })
  }

  const handlePriceRangeChange = (newRange: number[]) => {
    setPriceRange(newRange)
    updateURL({ resetPage: true })
  }

  const handleSortChange = (value: string) => {
    setSortBy(value as typeof sortBy)
    updateURL({ resetPage: true })
  }

  const handleSearchChange = (value: string) => {
    setInputSearch(value)
  }

  const handlePageChange = (page: number) => {
    updateURL({ page })
  }

  const handleAddToCart = async (productId: string) => {
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
          setLocation(`/login?returnUrl=${encodeURIComponent(location)}`)
        }
      })
      setAuthDialogOpen(true)
      return
    }
    
    const isInWishlist = wishlistProductIds.has(productId)
    
    try {
      if (isInWishlist) {
        await removeFromWishlist.mutateAsync(productId)
      } else {
        await addToWishlist.mutateAsync(productId)
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось добавить товар в избранное",
        variant: "destructive",
      })
    }
  }

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <h3 className="mb-3 font-semibold">Категории</h3>
        <div className="space-y-2">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center space-x-2">
              <Checkbox
                id={`category-${category.id}`}
                checked={selectedCategories.includes(category.id)}
                onCheckedChange={() => handleCategoryToggle(category.id)}
                data-testid={`checkbox-category-${category.id}`}
              />
              <Label
                htmlFor={`category-${category.id}`}
                className="text-sm font-normal cursor-pointer"
              >
                {category.name}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h3 className="mb-3 font-semibold">Цена</h3>
        <div className="space-y-4">
          <Slider
            min={0}
            max={10000}
            step={100}
            value={priceRange}
            onValueChange={handlePriceRangeChange}
            data-testid="slider-price-range"
          />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{priceRange[0]} ₽</span>
            <span>{priceRange[1]} ₽</span>
          </div>
        </div>
      </div>

      {/* Reset Filters */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          setSelectedCategories([])
          setPriceRange([0, 10000])
          handleSearchChange("")
        }}
        data-testid="button-reset-filters"
      >
        Сбросить фильтры
      </Button>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <h1 className="mb-6 font-serif text-3xl md:text-4xl font-semibold" data-testid="text-page-title">
            Каталог товаров
          </h1>

          {/* Search Bar */}
          <div className="mb-8 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Поиск товаров..."
              value={inputSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 pr-9"
              data-testid="input-search"
            />
            {inputSearch && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-clear-search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-8 lg:flex-row">
            {/* Filters - Desktop */}
            <aside className="hidden lg:block w-64 shrink-0">
              <div className="sticky top-24 rounded-lg border bg-card p-6">
                <h2 className="mb-4 font-semibold">Фильтры</h2>
                <FilterContent />
              </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1">
              {/* Toolbar */}
              <div className="mb-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {/* Filters - Mobile */}
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="sm" className="lg:hidden" data-testid="button-show-filters">
                        <SlidersHorizontal className="mr-2 h-4 w-4" />
                        Фильтры
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left">
                      <SheetHeader>
                        <SheetTitle>Фильтры</SheetTitle>
                      </SheetHeader>
                      <div className="mt-6">
                        <FilterContent />
                      </div>
                    </SheetContent>
                  </Sheet>

                  <span className="text-sm text-muted-foreground">
                    Найдено: {total} {total === 1 ? 'товар' : total > 1 && total < 5 ? 'товара' : 'товаров'}
                  </span>
                </div>

                {/* Sort */}
                <Select value={sortBy} onValueChange={handleSortChange}>
                  <SelectTrigger className="w-[180px]" data-testid="select-sort">
                    <SelectValue placeholder="Сортировка" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Новые</SelectItem>
                    <SelectItem value="price_asc">Цена: по возрастанию</SelectItem>
                    <SelectItem value="price_desc">Цена: по убыванию</SelectItem>
                    <SelectItem value="popularity">Популярные</SelectItem>
                    <SelectItem value="rating">По рейтингу</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Products Grid */}
              {isLoading ? (
                <ProductGridSkeleton />
              ) : products.length === 0 ? (
                <EmptyState
                  icon={ShoppingBag}
                  title="Товары не найдены"
                  description="Попробуйте изменить параметры фильтрации или поиска"
                  action={{
                    label: "Сбросить фильтры",
                    onClick: () => {
                      setSelectedCategories([])
                      setPriceRange([0, 10000])
                      handleSearchChange("")
                    },
                  }}
                />
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {products.map((product: any) => (
                      <ProductCard 
                        key={product.id} 
                        product={product}
                        onAddToCart={handleAddToCart}
                        onToggleWishlist={handleToggleWishlist}
                        isInWishlist={wishlistProductIds.has(product.id)}
                      />
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-8 flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        data-testid="button-prev-page"
                      >
                        Предыдущая
                      </Button>
                      
                      <div className="flex gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(page => {
                            if (totalPages <= 7) return true
                            if (page === 1 || page === totalPages) return true
                            if (page >= currentPage - 1 && page <= currentPage + 1) return true
                            return false
                          })
                          .map((page, index, array) => {
                            const prevPage = array[index - 1]
                            const showEllipsis = prevPage && page - prevPage > 1
                            
                            return (
                              <div key={page} className="flex items-center gap-1">
                                {showEllipsis && <span className="px-2 text-muted-foreground">...</span>}
                                <Button
                                  variant={currentPage === page ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handlePageChange(page)}
                                  className="w-10"
                                  data-testid={`button-page-${page}`}
                                >
                                  {page}
                                </Button>
                              </div>
                            )
                          })}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        data-testid="button-next-page"
                      >
                        Следующая
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
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
