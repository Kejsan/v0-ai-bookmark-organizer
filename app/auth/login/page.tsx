import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import LoginForm from "@/components/login-form"

export default async function LoginPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#000080] p-4">
        <div className="w-full max-w-md space-y-4 rounded-lg bg-white/10 p-8 text-center text-white shadow-lg">
          <h1 className="text-3xl font-bold">Supabase Not Configured</h1>
          <p className="text-gray-300">
            The application is not connected to a Supabase backend. Please set the required
            environment variables to enable authentication and database services.
          </p>
          <div className="text-left text-sm text-gray-400">
            <p className="font-semibold text-white">Required variables:</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>
                <code className="rounded bg-gray-700/50 px-1 py-0.5">
                  NEXT_PUBLIC_SUPABASE_URL
                </code>
              </li>
              <li>
                <code className="rounded bg-gray-700/50 px-1 py-0.5">
                  NEXT_PUBLIC_SUPABASE_ANON_KEY
                </code>
              </li>
            </ul>
          </div>
          <p className="pt-2 text-xs text-gray-400">
            Create a <code className="rounded bg-gray-700/50 px-1 py-0.5">.env.local</code> file
            with these variables and restart the application.
          </p>
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session) {
    redirect("/")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#000080] px-4 py-12 sm:px-6 lg:px-8">
      <LoginForm />
    </div>
  )
}
