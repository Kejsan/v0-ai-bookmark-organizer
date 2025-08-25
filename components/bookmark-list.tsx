"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"

interface Bookmark {
  id: number
  title: string | null
  url: string
  description: string | null
  favicon_url?: string | null
  category_id: number | null
}

interface Category {
  id: number
  path: string
}

interface BookmarkListProps {
  refreshTrigger?: number
}

export default function BookmarkList({ refreshTrigger = 0 }: BookmarkListProps) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [bookmarkRes, categoryRes] = await Promise.all([
        fetch("/api/bookmarks"),
        fetch("/api/categories"),
      ])

      if (bookmarkRes.ok) {
        const data = await bookmarkRes.json()
        setBookmarks((data.bookmarks || []) as Bookmark[])
      } else {
        setBookmarks([])
      }

      if (categoryRes.ok) {
        const data = await categoryRes.json()
        const flat: Category[] = []
        const walk = (nodes: any[]) => {
          for (const node of nodes) {
            flat.push({ id: node.id, path: node.path })
            if (node.children?.length) walk(node.children)
          }
        }
        walk(data.categories || [])
        setCategories(flat)
      } else {
        setCategories([])
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
      setBookmarks([])
      setCategories([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData, refreshTrigger])

  const handleMove = async (id: number, categoryId: number | null) => {
    const response = await fetch(`/api/bookmarks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_id: categoryId }),
    })
    if (!response.ok) {
      const error = await response.json()
      alert(error.error || error.message || "Failed to move bookmark")
      return
    }
    fetchData()
  }

  const handleDelete = async (id: number) => {
    const response = await fetch(`/api/bookmarks/${id}`, { method: "DELETE" })
    if (!response.ok) {
      const error = await response.json()
      alert(error.error || error.message || "Failed to delete bookmark")
      return
    }
    fetchData()
  }

  const getCategoryPath = (id: number | null) => {
    if (!id) return ""
    const category = categories.find((c) => c.id === id)
    return category?.path || ""
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-[#000080]">Bookmarks</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : bookmarks.length === 0 ? (
          <p className="text-gray-500">No bookmarks found.</p>
        ) : (
          <ul className="space-y-4">
            {bookmarks.map((bookmark) => (
              <li key={bookmark.id} className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <a
                    href={bookmark.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[#000080] hover:underline"
                  >
                    {bookmark.title || bookmark.url}
                  </a>
                  {bookmark.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{bookmark.description}</p>
                  )}
                  {bookmark.category_id && (
                    <p className="text-xs text-gray-500">
                      {getCategoryPath(bookmark.category_id)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="border rounded p-1 text-sm"
                    value={bookmark.category_id ?? ""}
                    onChange={(e) =>
                      handleMove(
                        bookmark.id,
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                  >
                    <option value="">No category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.path}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(bookmark.id)}
                  >
                    Delete
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
