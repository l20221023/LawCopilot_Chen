import { createContext } from 'react'

import type {
  AuthStatus,
  AuthUser,
  EmailPasswordCredentials,
  PasswordResetRequestResult,
  SignUpCredentials,
  SignUpResult,
  UserProfile,
  UserProfilePatch,
} from '../../types/auth'

type AuthContextValue = {
  status: AuthStatus
  initializing: boolean
  isAuthenticated: boolean
  loading: boolean
  authUser: AuthUser | null
  profile: UserProfile | null
  profileError: string | null
  refreshProfile: () => Promise<UserProfile | null>
  updateProfile: (patch: UserProfilePatch) => Promise<UserProfile | null>
  requestPasswordReset: (
    email: string,
    redirectTo?: string,
  ) => Promise<PasswordResetRequestResult>
  updatePassword: (password: string) => Promise<void>
  signIn: (credentials: EmailPasswordCredentials) => Promise<void>
  signUp: (credentials: SignUpCredentials) => Promise<SignUpResult>
  signOut: () => Promise<void>
  isPreviewSession: boolean
  enterPreview: () => void
  exitPreview: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export type { AuthContextValue }
