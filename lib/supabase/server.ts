import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

// Check if Supabase environment variables are available
export function isSupabaseConfigured() {
  return (
    typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
    typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string" &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0
  )
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

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage: {
          getItem: (key: string) => {
            const cookie = cookieStore.get(key)
            return cookie?.value || null
          },
          setItem: (key: string, value: string) => {
            cookieStore.set(key, value, {
              path: "/",
              maxAge: 60 * 60 * 24 * 365,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
              httpOnly: true,
            })
          },
          removeItem: (key: string) => {
            cookieStore.delete(key)
          },
        },
      },
    },
  )

  return supabase
}
