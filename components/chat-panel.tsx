"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageCircle, Send, Loader2, ExternalLink, Folder } from "lucide-react"

interface ChatResult {
  id: number
  title: string
  url: string
  description: string
  folder_path: string
  favicon_url?: string
  similarity: number
}

interface ChatResponse {
  suggestions: ChatResult[]
  message: string
}

export default function ChatPanel() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ChatResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [message, setMessage] = useState("")

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!query.trim()) return

    setIsSearching(true)
    setMessage("")

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: query.trim() }),
      })

      const data: ChatResponse = await response.json()

      if (response.ok) {
        setResults(data.suggestions || [])
        setMessage(data.message || "")
      } else {
        setMessage(`Error: ${data.error || "Failed to search"}`)
        setResults([])
      }
    } catch (error) {
      console.error("Search error:", error)
      setMessage("Failed to search. Please try again.")
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#000080]">
          <MessageCircle className="h-5 w-5" />
          AI Assistant
        </CardTitle>
        <CardDescription>Ask what tool to use for specific tasks</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What's the best tool for...?"
            disabled={isSearching}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="bg-[#54a09b] hover:bg-[#4a8f8a] text-white"
          >
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>

        {message && <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">{message}</div>}

        <div className="flex-1 overflow-y-auto space-y-3">
          {results.map((result) => (
            <div key={result.id} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {result.favicon_url && (
                      <img
                        src={result.favicon_url || "/placeholder.svg"}
                        alt=""
                        className="w-4 h-4 flex-shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = "none"
                        }}
                      />
                    )}
                    <h4 className="font-medium text-[#000080] truncate">{result.title}</h4>
                  </div>
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">{result.description}</p>
                  {result.folder_path && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                      <Folder className="h-3 w-3" />
                      <span>{result.folder_path}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 truncate">{result.url}</span>
                    <span className="text-xs text-[#54a09b] font-medium">
                      {Math.round(result.similarity * 100)}% match
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(result.url, "_blank")}
                  className="flex-shrink-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {results.length === 0 && !isSearching && !message && (
            <div className="text-center text-gray-500 py-8">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Ask me about tools in your bookmarks!</p>
              <p className="text-sm mt-1">Try: "What's the best tool for design?"</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
