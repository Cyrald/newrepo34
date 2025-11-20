import { MessageCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SupportChatWidget } from "@/components/support-chat-widget"
import { useChatStore } from "@/stores/chatStore"
import { useAuthStore } from "@/stores/authStore"

export function SupportChatLauncher() {
  const isOpen = useChatStore((state) => state.isOpen)
  const openChat = useChatStore((state) => state.openChat)
  const closeChat = useChatStore((state) => state.closeChat)
  const user = useAuthStore((state) => state.user)
  
  // Don't show chat for staff (admin, marketer, consultant)
  const hasStaffRole = user?.roles && user.roles.some(role => 
    ['admin', 'marketer', 'consultant'].includes(role)
  )

  // Only show for authenticated non-staff users
  if (!user || hasStaffRole) {
    return null
  }

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <Button
          onClick={openChat}
          size="icon"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all z-50 bg-primary hover:bg-primary/90"
          aria-label="Открыть чат поддержки"
        >
          <MessageCircle className="h-6 w-6" />
          {/* Unread badge - можно добавить позже */}
          {/* <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center">
            3
          </Badge> */}
        </Button>
      )}

      {/* Chat Widget */}
      <SupportChatWidget isOpen={isOpen} onClose={closeChat} />
    </>
  )
}
