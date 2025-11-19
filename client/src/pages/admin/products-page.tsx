import { useState, useRef, useCallback, useEffect } from "react"
import { Plus, Search, MoreHorizontal, Pencil, Archive, Eye, ImageIcon, ArrowUpAZ, ArrowDownAZ } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { useLocation } from "wouter"
import { AdminLayout } from "@/components/admin-layout"
import { ProductFormDialog } from "@/components/product-form-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { productsApi } from "@/lib/api"
import { useArchiveProduct, useUnarchiveProduct } from "@/hooks/useProducts"
import { useCategories } from "@/hooks/useCategories"
import type { Product } from "@shared/schema"

// Lazy loaded image component with Intersection Observer
function LazyProductImage({ product }: { product: Product }) {
  const [isVisible, setIsVisible] = useState(false)
  const [imageError, setImageError] = useState(false)
  const imgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            observer.disconnect()
          }
        })
      },
      { rootMargin: "50px" }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const firstImage = (product as any).images?.[0]?.url || null

  return (
    <div ref={imgRef} className="w-12 h-16 bg-muted rounded overflow-hidden flex items-center justify-center">
      {isVisible && firstImage && !imageError ? (
        <img
          src={firstImage}
          alt={product.name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setImageError(true)}
        />
      ) : (
        <ImageIcon className="h-6 w-6 text-muted-foreground" />
      )}
    </div>
  )
}

export default function AdminProductsPage() {
  const { toast } = useToast()
  const [, setLocation] = useLocation()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"published" | "archived">("published")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false)
  const [productToArchive, setProductToArchive] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["adminProducts"],
    queryFn: () => productsApi.getAll({ limit: 10000, includeArchived: true }),
  })

  const { data: categoriesData } = useCategories()
  const categories = categoriesData || []

  const archiveProduct = useArchiveProduct()
  const unarchiveProduct = useUnarchiveProduct()

  const products = data?.products || []

  // Create category map for quick lookup
  const categoryMap = categories.reduce((acc, cat) => {
    acc[cat.id] = cat.name
    return acc
  }, {} as Record<string, string>)

  // Filter by archive status first, then by search, then sort
  const filteredByStatus = products.filter((product) =>
    activeTab === "published" ? !product.isArchived : product.isArchived
  )

  const filteredBySearch = filteredByStatus.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredProducts = [...filteredBySearch].sort((a, b) => {
    const nameA = a.name.toLowerCase()
    const nameB = b.name.toLowerCase()
    return sortOrder === "asc" 
      ? nameA.localeCompare(nameB, 'ru')
      : nameB.localeCompare(nameA, 'ru')
  })

  const handleAddProduct = () => {
    setSelectedProduct(null)
    setIsFormOpen(true)
  }

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product)
    setIsFormOpen(true)
  }

  const handleViewProduct = (productId: string) => {
    setLocation(`/products/${productId}`)
  }

  const handleArchiveProduct = (productId: string) => {
    setProductToArchive(productId)
    setIsArchiveDialogOpen(true)
  }

  const handleUnarchiveProduct = async (productId: string) => {
    try {
      await unarchiveProduct.mutateAsync(productId)
      toast({
        title: "Товар восстановлен",
        description: "Товар успешно возвращён в каталог",
      })
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось восстановить товар",
        variant: "destructive",
      })
    }
  }

  const confirmArchive = async () => {
    if (!productToArchive) return

    try {
      await archiveProduct.mutateAsync(productToArchive)
      toast({
        title: "Товар архивирован",
        description: "Товар успешно перенесён в архив",
      })
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось архивировать товар",
        variant: "destructive",
      })
    } finally {
      setIsArchiveDialogOpen(false)
      setProductToArchive(null)
    }
  }

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Загрузка товаров...</div>
        </div>
      </AdminLayout>
    )
  }

  const publishedCount = products.filter(p => !p.isArchived).length
  const archivedCount = products.filter(p => p.isArchived).length

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-semibold" data-testid="text-page-title">
              Товары
            </h1>
            <p className="text-muted-foreground">
              Управление каталогом товаров
            </p>
          </div>
          <Button onClick={handleAddProduct} data-testid="button-add-product">
            <Plus className="mr-2 h-4 w-4" />
            Добавить товар
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Каталог товаров</CardTitle>
            <CardDescription>
              {products.length} товаров в каталоге
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "published" | "archived")}>
              <div className="flex items-center justify-between mb-4 gap-4">
                <TabsList>
                  <TabsTrigger value="published">
                    Опубликовано ({publishedCount})
                  </TabsTrigger>
                  <TabsTrigger value="archived">
                    Архив ({archivedCount})
                  </TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Поиск по названию или артикулу..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-products"
                    />
                  </div>

                  <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "asc" | "desc")}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">
                        <div className="flex items-center gap-2">
                          <ArrowUpAZ className="h-4 w-4" />
                          По алфавиту А-Я
                        </div>
                      </SelectItem>
                      <SelectItem value="desc">
                        <div className="flex items-center gap-2">
                          <ArrowDownAZ className="h-4 w-4" />
                          По алфавиту Я-А
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <TabsContent value={activeTab} className="mt-0">
                {filteredProducts.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    {searchQuery ? "Товары не найдены" : `Нет товаров в ${activeTab === "published" ? "опубликованных" : "архиве"}`}
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Фото</TableHead>
                          <TableHead>Название</TableHead>
                          <TableHead>Артикул</TableHead>
                          <TableHead>Категория</TableHead>
                          <TableHead>Цена</TableHead>
                          <TableHead>Наличие</TableHead>
                          <TableHead className="w-[70px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProducts.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell>
                              <LazyProductImage product={product} />
                            </TableCell>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell>{product.sku || "—"}</TableCell>
                            <TableCell>
                              {product.categoryId && categoryMap[product.categoryId] 
                                ? categoryMap[product.categoryId] 
                                : "—"}
                            </TableCell>
                            <TableCell>{parseFloat(product.price).toLocaleString()} ₽</TableCell>
                            <TableCell>
                              {product.stockQuantity > 0 ? (
                                <Badge variant="default">{product.stockQuantity} шт</Badge>
                              ) : (
                                <Badge variant="destructive">Нет</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleViewProduct(product.id)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Просмотр
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Редактировать
                                  </DropdownMenuItem>
                                  {activeTab === "published" ? (
                                    <DropdownMenuItem
                                      className="text-orange-600"
                                      onClick={() => handleArchiveProduct(product.id)}
                                    >
                                      <Archive className="mr-2 h-4 w-4" />
                                      Архивировать
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      className="text-green-600"
                                      onClick={() => handleUnarchiveProduct(product.id)}
                                    >
                                      <Archive className="mr-2 h-4 w-4" />
                                      Разархивировать
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Product Form Dialog */}
      <ProductFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        product={selectedProduct}
      />

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Архивировать товар?</AlertDialogTitle>
            <AlertDialogDescription>
              Товар будет перемещён в архив и скрыт из каталога. Вы сможете восстановить его позже через вкладку "Архив".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive} className="bg-orange-600 hover:bg-orange-700 text-white">
              Архивировать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  )
}
