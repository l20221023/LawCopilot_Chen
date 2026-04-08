import type { UserProfile, UserProfilePatch } from '../../types/auth'
import { supabase } from './client'
import { SupabaseServiceError } from './errors'

const profileColumns = [
  'id',
  'nickname',
  'email',
  'subscription_plan',
  'remaining_credits',
  'subscription_expires_at',
  'default_scenario_id',
  'created_at',
].join(', ')

function getSupabaseClient() {
  if (!supabase) {
    throw new SupabaseServiceError(
      'SUPABASE_NOT_CONFIGURED',
      'Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.',
    )
  }

  return supabase
}

function isMissingUsersTable(error: { code?: string; message?: string }) {
  return (
    error.code === '42P01' ||
    error.message?.includes('relation "public.users" does not exist') === true
  )
}

export async function getUserProfile(
  userId: string,
  fallbackEmail?: string | null,
) {
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('users')
    .select(profileColumns)
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    if (isMissingUsersTable(error)) {
      throw new SupabaseServiceError(
        'PROFILE_TABLE_UNAVAILABLE',
        'The public.users table is not available yet. Create the profile table before loading account data.',
        { cause: error },
      )
    }

    throw error
  }

  if (!data) {
    throw new SupabaseServiceError(
      'PROFILE_NOT_FOUND',
      'The authenticated user does not have a row in public.users yet.',
    )
  }

  return normalizeUserProfile(
    data as unknown as Partial<UserProfile> & Pick<UserProfile, 'id'>,
    fallbackEmail,
  )
}

export async function updateUserProfile(
  userId: string,
  patch: UserProfilePatch,
  fallbackEmail?: string | null,
) {
  const client = getSupabaseClient()
  const nextPatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  )

  if (Object.keys(nextPatch).length === 0) {
    return getUserProfile(userId, fallbackEmail)
  }

  const { data, error } = await client
    .from('users')
    .update(nextPatch)
    .eq('id', userId)
    .select(profileColumns)
    .single()

  if (error) {
    if (isMissingUsersTable(error)) {
      throw new SupabaseServiceError(
        'PROFILE_TABLE_UNAVAILABLE',
        'The public.users table is not available yet. Create the profile table before updating account data.',
        { cause: error },
      )
    }

    throw error
  }

  return normalizeUserProfile(
    data as unknown as Partial<UserProfile> & Pick<UserProfile, 'id'>,
    fallbackEmail,
  )
}

function normalizeUserProfile(
  profile: Partial<UserProfile> & Pick<UserProfile, 'id'>,
  fallbackEmail?: string | null,
): UserProfile {
  return {
    id: profile.id,
    nickname: profile.nickname?.trim() || fallbackEmail || 'New user',
    email: profile.email || fallbackEmail || '',
    subscription_plan: profile.subscription_plan || 'free',
    remaining_credits: profile.remaining_credits ?? 0,
    subscription_expires_at: profile.subscription_expires_at ?? null,
    default_scenario_id: profile.default_scenario_id ?? null,
    created_at: profile.created_at || new Date(0).toISOString(),
  }
}
