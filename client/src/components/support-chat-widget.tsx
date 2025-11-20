import { useState, useEffect, useRef } from "react"
import { X, Send, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAuthStore } from "@/stores/authStore"
import { wsClient } from "@/lib/websocket"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import type { SupportMessage } from "@shared/schema"
import { format } from "date-fns"
import { ru } from "date-fns/locale"

interface SupportChatWidgetProps {
  isOpen: boolean
  onClose: () => void
}

export function SupportChatWidget({ isOpen, onClose }: SupportChatWidgetProps) {
  const [message, setMessage] = useState("")
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)

  // Fetch messages
  const { data: messages = [], isLoading } = useQuery<SupportMessage[]>({
    queryKey: ["/api/support/messages"],
    enabled: isOpen,
  })

  // Send message mutation
  const sendMessageMutation = useMutation<SupportMessage, Error, string>({
    mutationFn: async (text: string) => {
      return apiRequest<SupportMessage>("POST", "/api/support/messages", {
        messageText: text,
      })
    },
    onMutate: async (text) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/support/messages"] })

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<SupportMessage[]>(["/api/support/messages"])

      // Optimistically update with temp message
      if (previousMessages && user?.id) {
        const tempMessage: SupportMessage = {
          id: `temp-${Date.now()}`,
          userId: user.id,
          senderId: user.id,
          messageText: text,
          createdAt: new Date(),
        } as SupportMessage

        queryClient.setQueryData<SupportMessage[]>(
          ["/api/support/messages"],
          [...previousMessages, tempMessage]
        )
      }

      return { previousMessages }
    },
    onSuccess: (data) => {
      setMessage("")
      // Update with real message from server
      queryClient.setQueryData<SupportMessage[]>(
        ["/api/support/messages"],
        (old) => {
          if (!old) return [data]
          // Replace temp message with real one
          return old.filter(m => !m.id.startsWith('temp-')).concat(data)
        }
      )
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(["/api/support/messages"], context.previousMessages)
      }
      toast({
        title: "Ошибка",
        description: "Не удалось отправить сообщение",
        variant: "destructive",
      })
    },
  })

  // Connect to WebSocket when chat is open
  useEffect(() => {
    if (isOpen && user?.id) {
      wsClient.connect(user.id)

      const unsubscribe = wsClient.onMessage((msg) => {
        if (msg.type === "new_message" && msg.message) {
          // Directly add the message to the cache
          queryClient.setQueryData<SupportMessage[]>(
            ["/api/support/messages"],
            (old) => {
              if (!old) return [msg.message]
              // Avoid duplicates
              if (old.some(m => m.id === msg.message.id)) return old
              return [...old, msg.message]
            }
          )
        }
      })

      return () => {
        unsubscribe()
      }
    }
  }, [isOpen, user?.id, queryClient])

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
    if (!message.trim()) return
    sendMessageMutation.mutate(message)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (!isOpen) return null

  // Show chat widget in bottom right corner - responsive design
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col w-[90vw] sm:w-[420px] h-[85vh] sm:h-[650px] max-h-[650px] bg-background border rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-primary text-primary-foreground rounded-t-2xl">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          <h3 className="font-semibold">Техническая поддержка</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages Area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Загрузка сообщений...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <MessageCircle className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              Начните диалог с нашей службой поддержки
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg: SupportMessage) => {
              const isMyMessage = msg.senderId === user?.id
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1 ${
                    isMyMessage ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      isMyMessage
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.messageText}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(msg.createdAt), "HH:mm", { locale: ru })}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            placeholder="Введите сообщение..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            rows={2}
            className="resize-none"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || sendMessageMutation.isPending}
            size="icon"
            className="h-auto"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Нажмите Enter для отправки, Shift+Enter для новой строки
        </p>
      </div>
    </div>
  )
}
