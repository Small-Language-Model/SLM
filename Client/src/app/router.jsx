import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { ChatWorkspace } from '@/features/chat/pages/chat-workspace'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChatWorkspace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
