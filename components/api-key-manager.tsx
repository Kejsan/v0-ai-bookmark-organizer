"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Key, Eye, EyeOff, Trash2, Loader2, CheckCircle, AlertCircle } from "lucide-react"

interface ApiKeyStatus {
  hasKey: boolean
  provider?: string
  createdAt?: string
}

export default function ApiKeyManager() {
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [status, setStatus] = useState<ApiKeyStatus>({ hasKey: false })
  const [message, setMessage] = useState("")

  useEffect(() => {
    checkKeyStatus()
  }, [])

  const checkKeyStatus = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/account/check-key")
      const data = await response.json()

      if (response.ok) {
        setStatus(data)
      } else {
        setMessage(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error("Failed to check key status:", error)
      setMessage("Failed to check API key status")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!apiKey.trim()) {
      setMessage("Please enter your Gemini API key")
      return
    }

    setIsSaving(true)
    setMessage("")

    try {
      const response = await fetch("/api/account/save-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage("API key saved successfully!")
        setApiKey("")
        setShowKey(false)
        await checkKeyStatus()
      } else {
        setMessage(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error("Failed to save API key:", error)
      setMessage("Failed to save API key")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteKey = async () => {
    if (!confirm("Are you sure you want to delete your API key? This will disable AI features.")) {
      return
    }

    setIsDeleting(true)
    setMessage("")

    try {
      const response = await fetch("/api/account/delete-key", {
        method: "DELETE",
      })

      const data = await response.json()

      if (response.ok) {
        setMessage("API key deleted successfully")
        await checkKeyStatus()
      } else {
        setMessage(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error("Failed to delete API key:", error)
      setMessage("Failed to delete API key")
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[#54a09b]" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#000080]">
          <Key className="h-5 w-5" />
          Gemini API Key
        </CardTitle>
        <CardDescription>
          Your API key is encrypted and stored securely. It's only used for AI features like summarization and search.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <div
            className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
              message.includes("Error") || message.includes("Failed")
                ? "bg-[#fb6163]/10 text-[#fb6163] border border-[#fb6163]/20"
                : "bg-[#54a09b]/10 text-[#54a09b] border border-[#54a09b]/20"
            }`}
          >
            {message.includes("Error") || message.includes("Failed") ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            {message}
          </div>
        )}

        {status.hasKey ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">API key configured</span>
              </div>
              <span className="text-xs text-green-600">
                Added {status.createdAt ? new Date(status.createdAt).toLocaleDateString() : "recently"}
              </span>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setApiKey("")
                  setShowKey(false)
                  setMessage("")
                }}
                variant="outline"
                className="flex-1"
              >
                Update Key
              </Button>
              <Button
                onClick={handleDeleteKey}
                disabled={isDeleting}
                variant="destructive"
                className="bg-[#fb6163] hover:bg-[#e55557]"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        ) : null}

        {(!status.hasKey || apiKey) && (
          <form onSubmit={handleSaveKey} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">
                Gemini API Key
              </label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIza..."
                  disabled={isSaving}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-0 top-0 h-full px-3"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Get your API key from{" "}
                <a
                  href="https://makersuite.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#54a09b] hover:underline"
                >
                  Google AI Studio
                </a>
              </p>
            </div>

            <Button
              type="submit"
              disabled={isSaving || !apiKey.trim()}
              className="w-full bg-[#54a09b] hover:bg-[#4a8f8a] text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save API Key"
              )}
            </Button>
          </form>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Your API key is encrypted using AES-256-GCM encryption</p>
          <p>• It's only decrypted when making AI requests on your behalf</p>
          <p>• You can delete it anytime to disable AI features</p>
        </div>
      </CardContent>
    </Card>
  )
}
