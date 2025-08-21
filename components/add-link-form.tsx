"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Loader2 } from "lucide-react"

interface AddLinkFormProps {
  onLinkAdded?: () => void
}

export default function AddLinkForm({ onLinkAdded }: AddLinkFormProps) {
  const [url, setUrl] = useState("")
  const [categoryPath, setCategoryPath] = useState("")
  const [isAdding, setIsAdding] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!url.trim()) {
      alert("Please enter a URL")
      return
    }

    setIsAdding(true)

    try {
      const response = await fetch("/api/add-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: url.trim(),
          categoryPath: categoryPath.trim() || undefined,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        alert("Bookmark added successfully!")
        setUrl("")
        setCategoryPath("")
        onLinkAdded?.()
      } else {
        alert(`Failed to add bookmark: ${result.error}`)
      }
    } catch (error) {
      console.error("Add link error:", error)
      alert("Failed to add bookmark. Please try again.")
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#000080]">
          <Plus className="h-5 w-5" />
          Add Single Bookmark
        </CardTitle>
        <CardDescription>Add a single URL to your bookmark collection</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
              URL
            </label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              required
              disabled={isAdding}
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              Category (optional)
            </label>
            <Input
              id="category"
              type="text"
              value={categoryPath}
              onChange={(e) => setCategoryPath(e.target.value)}
              placeholder="Work/Tools or leave empty"
              disabled={isAdding}
            />
            <p className="text-xs text-gray-500 mt-1">Use forward slashes to create nested categories</p>
          </div>

          <Button type="submit" disabled={isAdding} className="w-full bg-[#54a09b] hover:bg-[#4a8f8a] text-white">
            {isAdding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Bookmark"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
