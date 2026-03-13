import { Bot } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

export function MessageBubble({ message }) {
  const isAssistant = message.role === 'assistant'

  if (isAssistant && !message.content.trim()) {
    return null
  }

  return (
    <div
      className={cn(
        'flex w-full gap-3 md:gap-4',
        isAssistant ? 'items-start' : 'justify-end',
      )}
    >
      {isAssistant ? (
        <Avatar className="mt-1 size-9 border-primary/20 bg-primary/10 text-primary">
          <AvatarFallback className="bg-transparent text-primary">
            <Bot className="size-4" />
          </AvatarFallback>
        </Avatar>
      ) : null}

      <div
        className={cn(
          'max-w-3xl rounded-3xl border px-4 py-4 shadow-sm md:px-5',
          isAssistant
            ? 'border-border bg-card text-card-foreground'
            : 'border-primary/20 bg-primary text-primary-foreground shadow-lg shadow-primary/10',
        )}
      >
        <div className="mb-2 flex items-center gap-2 text-xs">
          <span className={cn(isAssistant ? 'text-muted-foreground' : 'text-primary-foreground/75')}>
            {isAssistant ? 'Assistant' : 'You'}
          </span>
          <span className={cn(isAssistant ? 'text-muted-foreground' : 'text-primary-foreground/75')}>
            {message.timestamp}
          </span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-7 md:text-[15px]">{message.content}</p>
      </div>
    </div>
  )
}
