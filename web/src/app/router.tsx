import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from 'react-router-dom'

import { ProtectedLayout } from '../components/layout/protected-layout'
import { useAuth } from '../features/auth/use-auth'
import { AuthPage } from '../pages/auth/auth-page'
import { PasswordResetPage } from '../pages/auth/password-reset-page'
import { ChatHomePage } from '../pages/chat/chat-home-page'
import { ChatWorkspacePage } from '../pages/chat/chat-workspace-page'
import { PricingPage } from '../pages/pricing/pricing-page'
import { SettingsPage } from '../pages/settings/settings-page'

function RouteLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="app-shell-card w-full max-w-md p-8 text-center">
        <div className="mono-label uppercase tracking-[0.18em] text-[color:var(--accent)]">
          LawCopilot
        </div>
        <h1 className="page-title mt-3">Loading session</h1>
        <p className="mt-3 text-sm leading-7 muted-copy">
          Checking the current Supabase session and user profile.
        </p>
      </div>
    </div>
  )
}

function RootRedirect() {
  const { initializing, isAuthenticated } = useAuth()

  if (initializing) {
    return <RouteLoadingScreen />
  }

  return <Navigate replace to={isAuthenticated ? '/app/chat' : '/auth'} />
}

function AppOutlet() {
  return <Outlet />
}

function AuthRoute() {
  const { initializing, isAuthenticated } = useAuth()

  if (initializing) {
    return <RouteLoadingScreen />
  }

  if (isAuthenticated) {
    return <Navigate replace to="/app/chat" />
  }

  return <AuthPage />
}

function ProtectedRoute() {
  const { initializing, isAuthenticated } = useAuth()

  if (initializing) {
    return <RouteLoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate replace to="/auth" />
  }

  return <ProtectedLayout />
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootRedirect />,
  },
  {
    path: '/auth',
    element: <AuthRoute />,
  },
  {
    path: '/auth/reset-password',
    element: <PasswordResetPage />,
  },
  {
    path: '/app',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppOutlet />,
        children: [
          {
            path: 'chat',
            element: <ChatHomePage />,
          },
          {
            path: 'chat/:conversationId',
            element: <ChatWorkspacePage />,
          },
          {
            path: 'pricing',
            element: <PricingPage />,
          },
          {
            path: 'settings',
            element: <SettingsPage />,
          },
        ],
      },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
