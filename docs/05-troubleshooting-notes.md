# LawCopilot Troubleshooting Notes

## 1. `/auth` returned 404 on Vercel

Cause:

- SPA rewrites were missing, so direct route access did not return `index.html`

Fix:

- Added [vercel.json](/E:/00-long/Re-examination/Chen/web/vercel.json)
- Later excluded `/api/*` from SPA rewrites

## 2. `auth.users` existed but `public.users` was missing

Cause:

- Auth data and business profile data are separate
- Profile creation depended on table shape, RLS, and trigger behavior

Fix:

- Corrected `public.users` table and RLS assumptions
- Added frontend fallback profile creation in the Supabase profile layer

## 3. Login flashed `Loading session` and cleared the form

Cause:

- App initialization state and form submit loading state were mixed together
- The auth route unmounted during sign-in

Fix:

- Split auth state into `initializing` and `loading`
- Only full-screen block on `initializing`

## 4. Settings page React crash

Cause:

- `useSyncExternalStore` snapshot returned a new array every render

Fix:

- Reworked usage loading logic
- Moved to async loading plus subscription refresh

## 5. Quota sometimes did not decrease correctly

Cause:

- Billing depended on stale `profile` props during chat flow
- Regenerate did not originally go through the exact same accounting path

Fix:

- Introduced latest-profile ref in chat controller
- Routed regenerate through the same quota and usage flow

## 6. Old conversation stream took over the newly selected conversation

Cause:

- Refresh after stream completion reset the active conversation to the old one

Fix:

- Refresh conversation list without overwriting the active conversation id

## 7. Scenario switch confirm dialog was not centered in the current viewport

Cause:

- Dialog lived under a transformed visual container, so fixed positioning was relative to the wrong context

Fix:

- Rendered it through a portal to `document.body`

## 8. OpenRouter returned 402

Cause:

- AI proxy was connected, but the upstream request effectively allowed too many completion tokens for the available credits

Fix:

- Added `OPENROUTER_MAX_COMPLETION_TOKENS`
- Set an explicit completion cap in [chat.js](/E:/00-long/Re-examination/Chen/web/api/chat.js)
- Improved upstream error readability

## 9. Switching from chat to pricing/settings interrupted the stream

Cause:

- The chat controller originally lived inside the chat page component
- Route change unmounted the controller and aborted the stream

Fix:

- Lifted the chat runtime to `/app`
- Added [chat-runtime-provider.tsx](/E:/00-long/Re-examination/Chen/web/src/features/chat/chat-runtime-provider.tsx)
- Mounted it inside [protected-layout.tsx](/E:/00-long/Re-examination/Chen/web/src/components/layout/protected-layout.tsx)

## 10. Current unresolved boundary

Still not solved:

- full refresh
- tab close
- sign-out
- leaving the app entirely

To solve that, generation needs server-side persistence or resumable job state, not just a browser-held streaming request.

## 11. Recommended debugging order

1. Check browser Network first
2. Check whether the relevant page/runtime was unmounted
3. Check whether Supabase data really persisted
4. Check Vercel environment variables
5. Check OpenRouter upstream errors last
