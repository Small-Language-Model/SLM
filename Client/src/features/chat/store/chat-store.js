import { create } from 'zustand'

const makeId = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

const timestamp = () =>
  new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

const parseErrorResponse = async (response) => {
  try {
    const payload = await response.json()
    return payload.detail ?? 'Unable to get a response right now.'
  } catch {
    return 'Unable to get a response right now.'
  }
}

const appendToAssistantMessage = (messages, messageId, chunk) =>
  messages.map((message) =>
    message.id === messageId
      ? { ...message, content: `${message.content}${chunk}` }
      : message,
  )

export const useChatStore = create((set) => ({
  messages: [],
  isSending: false,
  error: '',
  clearChat: () => set({ messages: [], error: '' }),
  clearError: () => set({ error: '' }),
  sendMessage: async (value) => {
    const message = value.trim()
    if (!message) {
      return
    }

    const userMessage = {
      id: makeId(),
      role: 'user',
      content: message,
      timestamp: timestamp(),
    }

    const assistantMessageId = makeId()

    const assistantMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: timestamp(),
    }

    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      isSending: true,
      error: '',
    }))

    try {
      const response = await fetch(`${API_BASE_URL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      })

      if (!response.ok) {
        throw new Error(await parseErrorResponse(response))
      }

      if (!response.body) {
        throw new Error('Streaming is not available from the backend.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalMessage = ''

      while (true) {
        const { done, value: chunk } = await reader.read()

        if (done) {
          break
        }

        buffer += decoder.decode(chunk, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''

        for (const event of events) {
          const line = event
            .split('\n')
            .find((item) => item.startsWith('data: '))

          if (!line) {
            continue
          }

          const payload = JSON.parse(line.slice(6))

          if (payload.type === 'chunk') {
            finalMessage += payload.content

            set((state) => ({
              messages: appendToAssistantMessage(
                state.messages,
                assistantMessageId,
                payload.content,
              ),
            }))
          }

          if (payload.type === 'done') {
            finalMessage = payload.content || finalMessage

            set((state) => ({
              messages: state.messages.map((entry) =>
                entry.id === assistantMessageId
                  ? { ...entry, content: finalMessage }
                  : entry,
              ),
              isSending: false,
            }))
          }
        }
      }

      set({ isSending: false })
    } catch (error) {
      set((state) => ({
        messages: state.messages.filter((entry) => entry.id !== assistantMessageId),
        isSending: false,
        error: error.message || 'Unable to connect to the backend.',
      }))
    }
  },
}))
