import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

// Check if Supabase environment variables are available
export function isSupabaseConfigured() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? undefined
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    undefined

  return Boolean(url && url.length > 0 && anonKey && anonKey.length > 0)
}

export function createClient() {
  if (!isSupabaseConfigured()) {
    console.warn("Supabase environment variables are not set. Using dummy client.")
    return {
      auth: {
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        signInWithPassword: () =>
          Promise.resolve({ data: null, error: { message: "Supabase not configured" } }),
        signUp: () =>
          Promise.resolve({ data: null, error: { message: "Supabase not configured" } }),
        signOut: () =>
          Promise.resolve({ data: null, error: { message: "Supabase not configured" } }),
      },
      from: () => ({
        select: () => Promise.resolve({ data: [], error: null }),
        insert: () => Promise.resolve({ data: null, error: null }),
        update: () => Promise.resolve({ data: null, error: null }),
        delete: () => Promise.resolve({ data: null, error: null }),
      }),
      rpc: () => Promise.resolve({ data: null, error: null }),
    } as any
  }

  const cookieStore = cookies()

  const canMutateCookies = typeof cookieStore.set === "function"

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options?: CookieOptions) {
          if (!canMutateCookies) {
            console.warn(
              "Attempted to set Supabase auth cookie in a read-only context. Ensure this mutation runs inside a route handler or server action.",
            )
            return
          }
          cookieStore.set(name, value, options)
        },
        remove(name: string, options?: CookieOptions) {
          if (!canMutateCookies) {
            console.warn(
              "Attempted to clear Supabase auth cookie in a read-only context. Ensure this mutation runs inside a route handler or server action.",
            )
            return
          }
          cookieStore.set(name, "", { ...options, maxAge: 0 })
        },
      },
    },
  )
}

export function createClientWithAccessToken(token: string): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase environment variables are not set")
  }

  return createSupabaseClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!,
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY)!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  )
}
