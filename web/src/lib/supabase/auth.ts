import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

import type {
  EmailPasswordCredentials,
  PasswordResetRequestResult,
  SignUpCredentials,
  SignUpResult,
} from '../../types/auth'
import { supabase } from './client'
import { SupabaseServiceError } from './errors'

function getSupabaseClient() {
  if (!supabase) {
    throw new SupabaseServiceError(
      'SUPABASE_NOT_CONFIGURED',
      'Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.',
    )
  }

  return supabase
}

export async function getCurrentSession() {
  const client = getSupabaseClient()
  const { data, error } = await client.auth.getSession()

  if (error) {
    throw error
  }

  return data.session
}

export function subscribeToAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  const client = getSupabaseClient()
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange(callback)

  return subscription
}

export async function signInWithEmail(credentials: EmailPasswordCredentials) {
  const client = getSupabaseClient()
  const { data, error } = await client.auth.signInWithPassword(credentials)

  if (error) {
    throw error
  }

  return data.session
}

export async function signUpWithEmail(
  credentials: SignUpCredentials,
): Promise<SignUpResult> {
  const client = getSupabaseClient()
  const { email, password, nickname } = credentials
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: nickname ? { nickname } : undefined,
    },
  })

  if (error) {
    throw error
  }

  return {
    needsEmailConfirmation: !data.session,
  }
}

export async function signOutUser() {
  const client = getSupabaseClient()
  const { error } = await client.auth.signOut()

  if (error) {
    throw error
  }
}

export async function requestPasswordReset(
  email: string,
  redirectTo?: string,
): Promise<PasswordResetRequestResult> {
  const client = getSupabaseClient()
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo,
  })

  if (error) {
    throw error
  }

  return {
    email,
  }
}

export async function updateCurrentUserPassword(password: string) {
  const client = getSupabaseClient()
  const { error } = await client.auth.updateUser({
    password,
  })

  if (error) {
    throw error
  }
}
