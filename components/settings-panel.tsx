"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings, Loader2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"

export default function SettingsPanel() {
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true)
  const [aiSuggestionsEnabled, setAiSuggestionsEnabled] = useState(true)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    try {
      const autoSync = localStorage.getItem("settings:autoSync")
      const aiSuggestions = localStorage.getItem("settings:aiSuggestions")
      if (autoSync !== null) {
        setAutoSyncEnabled(autoSync === "true")
      }
      if (aiSuggestions !== null) {
        setAiSuggestionsEnabled(aiSuggestions === "true")
      }
    } catch (error) {
      console.warn("Failed to load settings", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem("settings:autoSync", autoSyncEnabled ? "true" : "false")
    } catch (error) {
      console.warn("Failed to persist auto-sync setting", error)
    }
  }, [autoSyncEnabled])

  useEffect(() => {
    try {
      localStorage.setItem("settings:aiSuggestions", aiSuggestionsEnabled ? "true" : "false")
    } catch (error) {
      console.warn("Failed to persist AI suggestions setting", error)
    }
  }, [aiSuggestionsEnabled])

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
          <Settings className="h-5 w-5" />
          application Settings
        </CardTitle>
        <CardDescription>
          Configure how the AI Bookmark Organizer works for you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4 rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700">Auto-sync with Chrome</p>
              <p className="text-xs text-gray-500">
                Allow the Chrome extension to push new bookmarks automatically when changes are detected.
              </p>
            </div>
            <Switch checked={autoSyncEnabled} onCheckedChange={setAutoSyncEnabled} />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700">AI organization suggestions</p>
              <p className="text-xs text-gray-500">
                Enable Gemini-powered clustering and deduplication recommendations in your dashboard.
              </p>
            </div>
            <Switch checked={aiSuggestionsEnabled} onCheckedChange={setAiSuggestionsEnabled} />
          </div>
          <p className="text-xs text-gray-400">
            These preferences sync locally in your browser and inform the Chrome extension which features to activate.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
