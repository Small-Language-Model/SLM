import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function ChatComposer({ error, isSending, onChangeStarted, onSend }) {
  const [value, setValue] = useState('')
  const textareaRef = useRef(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }

    textarea.style.height = '0px'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`
  }, [value])

  const handleSubmit = (event) => {
    event.preventDefault()

    const trimmedValue = value.trim()
    if (!trimmedValue || isSending) {
      return
    }

    onSend(trimmedValue)
    setValue('')
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit(event)
    }
  }

  return (
    <div className="border-t border-border bg-background px-4 py-4 md:px-6 md:py-5">
      <div className="mx-auto max-w-4xl">
        <form
          onSubmit={handleSubmit}
          className="rounded-[28px] border border-input bg-card p-3 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.8)]"
        >
          {error ? (
            <div className="mb-3 flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              <AlertCircle className="size-4" />
              {error}
            </div>
          ) : null}

          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => {
              if (error) {
                onChangeStarted()
              }

              setValue(event.target.value)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="max-h-55 min-h-18 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
          />

          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">Enter to send · Shift + Enter for a new line</p>

            <Button
              type="submit"
              size="icon"
              className="rounded-2xl"
              disabled={!value.trim() || isSending}
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
