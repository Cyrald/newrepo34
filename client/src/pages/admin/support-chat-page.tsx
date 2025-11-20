import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/queryClient"
import { wsClient } from "@/lib/websocket"
import { useAuthStore } from "@/stores/authStore"
import { AdminLayout } from "@/components/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Send, MessageCircle, User, ShoppingBag } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import type { SupportMessage } from "@shared/schema"

interface Conversation {
  userId: string
  lastMessage: SupportMessage
  unreadCount: number
}

interface CustomerInfo {
  id: string
  email: string
  firstName: string
  lastName: string | null
  patronymic: string | null
  phone: string
  bonusBalance: number
  orders: Array<{
    id: string
    orderNumber: string
    createdAt: Date
    total: string
    status: string
  }>
}

export default function AdminSupportChatPage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active')
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)

  // Fetch all conversations
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/support/conversations", statusFilter],
    queryFn: async () => {
      const url = statusFilter === 'all' 
        ? '/api/support/conversations'
        : `/api/support/conversations?status=${statusFilter}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch conversations');
      return response.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  })

  // Auto-select first conversation
  useEffect(() => {
    if (!selectedUserId && conversations.length > 0) {
      setSelectedUserId(conversations[0].userId)
    }
  }, [conversations, selectedUserId])

  // Fetch messages for selected user
  const { data: messages = [], isLoading: messagesLoading } = useQuery<SupportMessage[]>({
    queryKey: ["/api/support/messages", { userId: selectedUserId }],
    queryFn: async () => {
      if (!selectedUserId) return []
      const response = await fetch(`/api/support/messages?userId=${selectedUserId}`, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch messages')
      return response.json()
    },
    enabled: !!selectedUserId,
  })

  // Fetch customer info
  const { data: customerInfo } = useQuery<CustomerInfo>({
    queryKey: ["/api/support/customer-info", selectedUserId],
    enabled: !!selectedUserId,
  })

  // Send message mutation
  const sendMessageMutation = useMutation<SupportMessage, Error, { userId: string; text: string }>({
    mutationFn: async (data: { userId: string; text: string }) => {
      return apiRequest<SupportMessage>("POST", "/api/support/messages", {
        userId: data.userId,
        messageText: data.text,
      })
    },
    onMutate: async (data) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/support/messages", { userId: selectedUserId }] })

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<SupportMessage[]>(["/api/support/messages", { userId: selectedUserId }])

      // Optimistically update with temp message
      if (previousMessages && user?.id) {
        const tempMessage: SupportMessage = {
          id: `temp-${Date.now()}`,
          userId: data.userId,
          senderId: user.id,
          messageText: data.text,
          createdAt: new Date(),
        } as SupportMessage

        queryClient.setQueryData<SupportMessage[]>(
          ["/api/support/messages", { userId: selectedUserId }],
          [...previousMessages, tempMessage]
        )
      }

      return { previousMessages }
    },
    onSuccess: (data) => {
      setMessage("")
      // Update with real message from server
      queryClient.setQueryData<SupportMessage[]>(
        ["/api/support/messages", { userId: selectedUserId }],
        (old) => {
          if (!old) return [data]
          // Replace temp message with real one
          return old.filter(m => !m.id.startsWith('temp-')).concat(data)
        }
      )
      // Update conversations list
      queryClient.invalidateQueries({ queryKey: ["/api/support/conversations"] })
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(["/api/support/messages", { userId: selectedUserId }], context.previousMessages)
      }
      toast({
        title: "Ошибка",
        description: "Не удалось отправить сообщение",
        variant: "destructive",
      })
    },
  })

  // Connect to WebSocket
  useEffect(() => {
    if (user?.id) {
      wsClient.connect(user.id)

      const unsubscribe = wsClient.onMessage((msg) => {
        if (msg.type === "new_message" && msg.message) {
          // Directly add the message to the cache for the relevant conversation
          queryClient.setQueryData<SupportMessage[]>(
            ["/api/support/messages", { userId: msg.message.userId }],
            (old) => {
              if (!old) return [msg.message]
              // Avoid duplicates
              if (old.some(m => m.id === msg.message.id)) return old
              return [...old, msg.message]
            }
          )
          // Update conversations list
          queryClient.invalidateQueries({ queryKey: ["/api/support/conversations"] })
        }
      })

      return () => {
        unsubscribe()
      }
    }
  }, [user?.id, queryClient])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages])

  const handleSendMessage = () => {
    if (!message.trim() || !selectedUserId) return
    sendMessageMutation.mutate({ userId: selectedUserId, text: message })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-500"
      case "paid": return "bg-blue-500"
      case "shipped": return "bg-purple-500"
      case "delivered": return "bg-green-500"
      case "cancelled": return "bg-red-500"
      default: return "bg-gray-500"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending": return "Ожидает оплаты"
      case "paid": return "Оплачен"
      case "shipped": return "Отправлен"
      case "delivered": return "Доставлен"
      case "cancelled": return "Отменён"
      default: return status
    }
  }

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Чат поддержки</h1>
        <p className="text-muted-foreground">
          Управление диалогами с клиентами
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6 min-h-[calc(100vh-160px)]">
        {/* Conversations List - Left Sidebar */}
        <Card className="col-span-3 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Диалоги</CardTitle>
            <div className="flex gap-2 mt-3">
              <Button
                variant={statusFilter === 'active' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('active')}
                className="flex-1"
              >
                Активные
              </Button>
              <Button
                variant={statusFilter === 'archived' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('archived')}
                className="flex-1"
              >
                Архив
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {conversations.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Нет активных диалогов</p>
                </div>
              ) : (
                <div className="divide-y">
                  {conversations.map((conv) => (
                    <button
                      key={conv.userId}
                      onClick={() => setSelectedUserId(conv.userId)}
                      className={`w-full text-left p-4 hover:bg-accent transition-colors ${
                        selectedUserId === conv.userId ? "bg-accent" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">
                            Клиент #{conv.userId.slice(0, 8)}
                          </span>
                        </div>
                        {conv.unreadCount > 0 && (
                          <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-1">
                        {conv.lastMessage.messageText}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(conv.lastMessage.createdAt), "dd MMM, HH:mm", {
                          locale: ru,
                        })}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Active Chat - Center */}
        <Card className="col-span-6 flex flex-col">
          <CardHeader className="border-b pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                {selectedUserId ? `Диалог с клиентом` : "Выберите диалог"}
              </CardTitle>
              {selectedUserId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await fetch(`/api/support/conversations/${selectedUserId}/archive`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                      });
                      queryClient.invalidateQueries({ queryKey: ["/api/support/conversations"] });
                      setSelectedUserId(null);
                    } catch {
                      toast({ title: "Ошибка", description: "Не удалось закрыть обращение", variant: "destructive" });
                    }
                  }}
                >
                  Закрыть обращение
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 flex flex-col flex-1 min-h-0">
            {!selectedUserId ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Выберите диалог из списка слева</p>
                </div>
              </div>
            ) : (
              <>
                {/* Messages */}
                <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                        <p className="mt-2 text-sm text-muted-foreground">Загрузка...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((msg) => {
                        const isCustomerMessage = msg.senderId === selectedUserId
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col gap-1 ${
                              isCustomerMessage ? "items-start" : "items-end"
                            }`}
                          >
                            <div
                              className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                                isCustomerMessage
                                  ? "bg-muted/70 rounded-tl-sm"
                                  : "bg-primary text-primary-foreground rounded-tr-sm"
                              }`}
                            >
                              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                {msg.messageText}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground px-1">
                              {format(new Date(msg.createdAt), "HH:mm", { locale: ru })}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </ScrollArea>

                {/* Input */}
                <div className="p-4 border-t bg-muted/20">
                  <div className="flex gap-3">
                    <Textarea
                      placeholder="Введите ответ..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={handleKeyPress}
                      rows={2}
                      className="resize-none flex-1 bg-background"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!message.trim() || sendMessageMutation.isPending}
                      size="icon"
                      className="h-auto px-4"
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 px-1">
                    Enter — отправить, Shift+Enter — новая строка
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Customer Info - Right Sidebar */}
        <Card className="col-span-3 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Информация о клиенте</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedUserId ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Выберите диалог для просмотра информации
              </p>
            ) : !customerInfo ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-sm text-muted-foreground">Загрузка...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Personal Info */}
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Личные данные
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Имя:</span>
                      <p className="font-medium">
                        {customerInfo.firstName}{" "}
                        {customerInfo.lastName && customerInfo.lastName}{" "}
                        {customerInfo.patronymic && customerInfo.patronymic}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <p className="font-medium">{customerInfo.email}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Телефон:</span>
                      <p className="font-medium">{customerInfo.phone}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Бонусы:</span>
                      <p className="font-medium">{customerInfo.bonusBalance} ₽</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Orders */}
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" />
                    История заказов
                  </h3>
                  <ScrollArea className="h-[300px]">
                    {customerInfo.orders.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Нет заказов
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {customerInfo.orders.map((order) => (
                          <div
                            key={order.id}
                            className="p-3 border rounded-lg text-sm space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">№{order.orderNumber}</span>
                              <Badge className={`text-xs ${getStatusBadgeColor(order.status)}`}>
                                {getStatusText(order.status)}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground">
                              {format(new Date(order.createdAt), "dd MMM yyyy", {
                                locale: ru,
                              })}
                            </p>
                            <p className="font-semibold">{order.total} ₽</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
