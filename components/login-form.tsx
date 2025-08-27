"use client"

import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"

function SubmitButton({ loading }: { loading: boolean }) {
  return (
    <Button
      type="submit"
      disabled={loading}
      className="w-full bg-[#54a09b] hover:bg-[#4a8f8a] text-white py-6 text-lg font-medium rounded-lg h-[60px]"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Signing in...
        </>
      ) : (
        "Sign In"
      )}
    </Button>
  )
}

export default function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const supabaseConfigured = isSupabaseConfigured()

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(error.message)
    else router.push("/")
  }

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-white">Welcome back</h1>
        <p className="text-lg text-gray-300">Sign in to your bookmark organizer</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {!supabaseConfigured && (
          <div className="bg-[#fb6163]/10 border border-[#fb6163]/50 text-[#fb6163] px-4 py-3 rounded">
            Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
          </div>
        )}
        {supabaseConfigured && error && (
          <div className="bg-[#fb6163]/10 border border-[#fb6163]/50 text-[#fb6163] px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-gray-300">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-gray-300">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="bg-white/10 border-white/20 text-white"
            />
          </div>
        </div>

        <SubmitButton loading={loading} />

        <div className="text-center text-gray-300">
          Don't have an account?{" "}
          <Link href="/auth/signup" className="text-white hover:underline">
            Sign up
          </Link>
        </div>
      </form>
    </div>
  )
}
