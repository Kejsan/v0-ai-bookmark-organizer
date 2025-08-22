"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setBookmarks([])
        setCategories([])
        setLoading(false)
        return
      }

      const [bookmarkRes, categoryRes] = await Promise.all([
        supabase
          .from("bookmarks")
          .select("id, title, url, description, favicon_url, category_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("categories")
          .select("id, path")
          .eq("user_id", user.id),
      ])

      if (!bookmarkRes.error && bookmarkRes.data) {
        setBookmarks(bookmarkRes.data as Bookmark[])
      }

      if (!categoryRes.error && categoryRes.data) {
        setCategories(categoryRes.data as Category[])
      }

      setLoading(false)
    }

    fetchData()
  }, [refreshTrigger])

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
                <Button variant="ghost" size="sm" asChild>
                  <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

