# LawCopilot Tech Summary

Current status:

- Frontend: React + Vite + Tailwind + React Router
- Auth: Supabase Auth with email/password and password reset
- Profile: `public.users`
- AI: `Browser -> /api/chat -> OpenRouter`
- Persistence: conversations/messages/usage now prefer Supabase
- Chat UI: split into chat home and chat workspace
- Runtime: chat controller is lifted to `/app`, so switching between `/app/chat`, `/app/pricing`, and `/app/settings` does not interrupt the current stream

Core files:

- Router: [router.tsx](/E:/00-long/Re-examination/Chen/web/src/app/router.tsx)
- Protected layout: [protected-layout.tsx](/E:/00-long/Re-examination/Chen/web/src/components/layout/protected-layout.tsx)
- Chat home: [chat-home-page.tsx](/E:/00-long/Re-examination/Chen/web/src/pages/chat/chat-home-page.tsx)
- Chat workspace: [chat-workspace-page.tsx](/E:/00-long/Re-examination/Chen/web/src/pages/chat/chat-workspace-page.tsx)
- Chat controller: [use-chat-controller.ts](/E:/00-long/Re-examination/Chen/web/src/features/chat/use-chat-controller.ts)
- Chat runtime provider: [chat-runtime-provider.tsx](/E:/00-long/Re-examination/Chen/web/src/features/chat/chat-runtime-provider.tsx)
- Supabase chat persistence: [chat.ts](/E:/00-long/Re-examination/Chen/web/src/lib/supabase/chat.ts)
- Supabase usage persistence: [usage.ts](/E:/00-long/Re-examination/Chen/web/src/lib/supabase/usage.ts)
- OpenRouter proxy: [chat.js](/E:/00-long/Re-examination/Chen/web/api/chat.js)

Routing:

- `/auth`
- `/auth/reset-password`
- `/app/chat`
- `/app/chat/:conversationId`
- `/app/pricing`
- `/app/settings`

Current send flow:

1. Check quota from profile
2. Create user message
3. Create assistant draft
4. Call `/api/chat`
5. Stream assistant content
6. Record usage on success
7. Consume credit after success

Current limitation:

- Stream now survives route changes inside `/app`
- Stream still stops on full page refresh, tab close, sign-out, or leaving the app
- Solving that requires server-side job persistence or resumable generation state
