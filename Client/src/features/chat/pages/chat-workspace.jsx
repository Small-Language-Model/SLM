import { ChatComposer } from '@/features/chat/components/chat-composer'
import { ChatHeader } from '@/features/chat/components/chat-header'
import { MessageList } from '@/features/chat/components/message-list'
import { useChatStore } from '@/features/chat/store/chat-store'

export function ChatWorkspace() {
  const {
    messages,
    isSending,
    error,
    clearChat,
    clearError,
    sendMessage,
  } = useChatStore()

  return (
    <main className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_55%)]" />

        <ChatHeader
          messageCount={messages.length}
          onClearChat={clearChat}
        />

        <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <MessageList messages={messages} isSending={isSending} />

          <ChatComposer
            error={error}
            isSending={isSending}
            onChangeStarted={clearError}
            onSend={sendMessage}
          />
        </section>
      </main>
  )
}
