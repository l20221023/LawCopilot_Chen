import type { User } from '@supabase/supabase-js'

export type AuthStatus = 'guest' | 'loading' | 'authenticated'

export type SubscriptionPlan = 'free' | 'limited' | 'unlimited'

export type SubscriptionLifecycle = 'active' | 'expired' | 'not_applicable'

export type AuthUser = User

export type EmailPasswordCredentials = {
  email: string
  password: string
}

export type SignUpCredentials = EmailPasswordCredentials & {
  nickname?: string
}

export type SignUpResult = {
  needsEmailConfirmation: boolean
}

export type PasswordResetRequestResult = {
  email: string
}

export type AuthServiceErrorCode =
  | 'SUPABASE_NOT_CONFIGURED'
  | 'PROFILE_NOT_FOUND'
  | 'PROFILE_TABLE_UNAVAILABLE'
  | 'UNKNOWN'

export type UserProfile = {
  id: string
  nickname: string
  email: string
  subscription_plan: SubscriptionPlan
  remaining_credits: number
  subscription_expires_at: string | null
  default_scenario_id: string | null
  created_at: string
}

export type UserProfilePatch = Partial<
  Pick<
    UserProfile,
    | 'nickname'
    | 'email'
    | 'subscription_plan'
    | 'remaining_credits'
    | 'subscription_expires_at'
    | 'default_scenario_id'
  >
>
