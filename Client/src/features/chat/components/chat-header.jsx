import { MessageSquare, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function ChatHeader({ messageCount, onClearChat }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 md:px-6">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <MessageSquare className="size-5" />
          </div>

          <div>
            <h1 className="text-sm font-semibold text-foreground md:text-base">VitalLM Chat</h1>
            <p className="text-xs text-muted-foreground">Simple medical assistant workspace.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {messageCount} {messageCount === 1 ? 'message' : 'messages'}
          </span>
          <Button variant="secondary" size="sm" onClick={onClearChat}>
            <Plus className="size-4" />
            New chat
          </Button>
        </div>
      </div>
    </header>
  )
}
