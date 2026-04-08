import type { Session } from '@supabase/supabase-js'
import type { PropsWithChildren } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { resolveSubscriptionExpiry } from '../billing/billing-rules'
import { getCurrentSession, signInWithEmail, signOutUser, signUpWithEmail, subscribeToAuthStateChange } from '../../lib/supabase/auth'
import { isSupabaseConfigured } from '../../lib/supabase/client'
import { getErrorMessage } from '../../lib/supabase/errors'
import { getUserProfile, updateUserProfile } from '../../lib/supabase/profiles'
import type { AuthUser, UserProfile, UserProfilePatch } from '../../types/auth'
import { AuthContext, type AuthContextValue } from './auth-context'

function getBillingPatch(profile: UserProfile): UserProfilePatch {
  return {
    default_scenario_id: profile.default_scenario_id,
    email: profile.email,
    nickname: profile.nickname,
    remaining_credits: profile.remaining_credits,
    subscription_expires_at: profile.subscription_expires_at,
    subscription_plan: profile.subscription_plan,
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (user: AuthUser) => {
    try {
      const nextProfile = await getUserProfile(user.id, user.email)
      const normalizedProfile = resolveSubscriptionExpiry(nextProfile).profile

      if (normalizedProfile !== nextProfile) {
        try {
          const persistedProfile = await updateUserProfile(
            user.id,
            getBillingPatch(normalizedProfile),
            user.email,
          )
          setProfile(persistedProfile)
        } catch {
          setProfile(normalizedProfile)
        }
      } else {
        setProfile(normalizedProfile)
      }

      setProfileError(null)
      return normalizedProfile
    } catch (error) {
      setProfile(null)
      setProfileError(getErrorMessage(error))
      return null
    }
  }, [])

  const applySession = useCallback(
    async (session: Session | null) => {
      const nextUser = session?.user ?? null
      setAuthUser(nextUser)

      if (!nextUser) {
        setProfile(null)
        setProfileError(null)
        return null
      }

      return loadProfile(nextUser)
    },
    [loadProfile],
  )

  useEffect(() => {
    let cancelled = false

    async function initializeAuth() {
      if (!isSupabaseConfigured) {
        setAuthUser(null)
        setProfile(null)
        setProfileError(null)
        setLoading(false)
        return
      }

      try {
        const session = await getCurrentSession()

        if (cancelled) {
          return
        }

        await applySession(session)
      } catch {
        if (!cancelled) {
          setAuthUser(null)
          setProfile(null)
          setProfileError(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void initializeAuth()

    if (!isSupabaseConfigured) {
      return () => {
        cancelled = true
      }
    }

    const subscription = subscribeToAuthStateChange((_event, session) => {
      void (async () => {
        if (cancelled) {
          return
        }

        setLoading(true)

        try {
          await applySession(session)
        } finally {
          if (!cancelled) {
            setLoading(false)
          }
        }
      })()
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [applySession])

  const refreshProfile = useCallback(async () => {
    if (!authUser) {
      setProfile(null)
      setProfileError(null)
      return null
    }

    return loadProfile(authUser)
  }, [authUser, loadProfile])

  const updateProfile = useCallback<AuthContextValue['updateProfile']>(
    async (patch) => {
      if (!authUser) {
        return null
      }

      setLoading(true)

      try {
        const nextProfile = await updateUserProfile(authUser.id, patch, authUser.email)
        const normalizedProfile = resolveSubscriptionExpiry(nextProfile).profile

        setProfile(normalizedProfile)
        setProfileError(null)
        return normalizedProfile
      } catch (error) {
        setProfileError(getErrorMessage(error))
        throw error
      } finally {
        setLoading(false)
      }
    },
    [authUser],
  )

  const signIn = useCallback<AuthContextValue['signIn']>(
    async (credentials) => {
      setLoading(true)

      try {
        const session = await signInWithEmail(credentials)
        await applySession(session)
      } finally {
        setLoading(false)
      }
    },
    [applySession],
  )

  const signUp = useCallback<AuthContextValue['signUp']>(
    async (credentials) => {
      setLoading(true)

      try {
        const result = await signUpWithEmail(credentials)

        if (!result.needsEmailConfirmation) {
          const session = await getCurrentSession()
          await applySession(session)
        }

        return result
      } finally {
        setLoading(false)
      }
    },
    [applySession],
  )

  const signOut = useCallback(async () => {
    setLoading(true)

    try {
      await signOutUser()
      await applySession(null)
    } finally {
      setLoading(false)
    }
  }, [applySession])

  const value = useMemo<AuthContextValue>(() => {
    const isAuthenticated = Boolean(authUser)

    return {
      status: loading ? 'loading' : isAuthenticated ? 'authenticated' : 'guest',
      isAuthenticated,
      loading,
      authUser,
      profile,
      profileError,
      refreshProfile,
      updateProfile,
      signIn,
      signUp,
      signOut,
      isPreviewSession: false,
      enterPreview: () => {},
      exitPreview: signOut,
    }
  }, [authUser, loading, profile, profileError, refreshProfile, signIn, signOut, signUp, updateProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
