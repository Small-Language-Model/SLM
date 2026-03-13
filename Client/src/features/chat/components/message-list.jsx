import { useEffect, useRef } from 'react'

import { MessageBubble } from '@/features/chat/components/message-bubble'

function EmptyState() {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="max-w-md text-center">
        <h2 className="text-2xl font-semibold text-foreground">Start a conversation</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Ask a medical question and get answer using our 50M parameter model.
        </p>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 md:gap-4">
      <div className="mt-1 flex size-9 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
        <span className="size-2 rounded-full bg-primary" />
      </div>
      <div className="rounded-3xl border border-border bg-card px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
          <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
          <span className="size-2 animate-bounce rounded-full bg-muted-foreground" />
        </div>
      </div>
    </div>
  )
}

export function MessageList({ messages, isSending }) {
  const containerRef = useRef(null)
  const lastMessage = messages[messages.length - 1]

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages.length, lastMessage?.content, isSending])

  return (
    <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-5 px-4 py-6 md:px-6 md:py-8">
        {messages.length === 0 ? <EmptyState /> : null}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isSending ? <TypingIndicator /> : null}
      </div>
    </div>
  )
}
