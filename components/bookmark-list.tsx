"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, RefreshCw, Sparkles, Trash2, CheckCircle2, Circle } from "lucide-react"
import CategoryTree, { type CategoryTreeNode } from "@/components/category-tree"

interface BookmarkRecord {
  id: number
  title: string | null
  url: string
  description: string | null
  favicon_url?: string | null
  category_id: number | null
  folder_path?: string | null
  source?: string | null
  is_read?: boolean | null
  created_at?: string | null
}

interface BookmarkListProps {
  refreshTrigger?: number
}

interface OrganizeResult {
  prompt: string
  categories: Array<{
    category: string
    bookmarkIds: number[]
    rationale?: string
  }>
  duplicates: Array<{
    firstId: number
    secondId: number
    score: number
  }>
  bookmarks: BookmarkRecord[]
}

export default function BookmarkList({ refreshTrigger = 0 }: BookmarkListProps) {
  const [activeTab, setActiveTab] = useState("bookmarks")
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([])
  const [readingList, setReadingList] = useState<BookmarkRecord[]>([])
  const [categories, setCategories] = useState<CategoryTreeNode[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [organizing, setOrganizing] = useState(false)
  const [organizeResult, setOrganizeResult] = useState<OrganizeResult | null>(null)
  const [appliedCategories, setAppliedCategories] = useState<Set<string>>(new Set())

  const categoryMap = useMemo(() => {
    const map = new Map<string, number>()
    const walk = (nodes: CategoryTreeNode[]) => {
      for (const node of nodes) {
        map.set(node.path, node.id)
        if (node.children?.length) {
          walk(node.children)
        }
      }
    }
    walk(categories)
    return map
  }, [categories])

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories")
      if (!res.ok) {
        throw new Error("Failed to load categories")
      }
      const data = await res.json()
      setCategories((data.categories || []) as CategoryTreeNode[])
    } catch (error) {
      console.error(error)
      setCategories([])
    }
  }, [])

  const fetchBookmarks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (activeTab === "bookmarks" && selectedCategory) {
        params.set("category", selectedCategory)
      }
      if (activeTab === "readingList") {
        params.set("source", "readingList")
      }
      const res = await fetch(`/api/bookmarks${params.toString() ? `?${params.toString()}` : ""}`)
      if (!res.ok) {
        throw new Error("Failed to fetch bookmarks")
      }
      const data = await res.json()
      const records = (data.bookmarks || []) as BookmarkRecord[]
      if (activeTab === "readingList") {
        setReadingList(records)
      } else {
        setBookmarks(records)
        if (!selectedCategory) {
          setOrganizeResult((current) =>
            current ? { ...current, bookmarks: records } : current,
          )
        }
      }
    } catch (error) {
      console.error(error)
      if (activeTab === "readingList") {
        setReadingList([])
      } else {
        setBookmarks([])
      }
    } finally {
      setLoading(false)
    }
  }, [activeTab, selectedCategory])

  useEffect(() => {
    loadCategories()
  }, [loadCategories, refreshTrigger])

  useEffect(() => {
    fetchBookmarks()
  }, [fetchBookmarks, refreshTrigger])

  const handleCategoryDrop = useCallback(
    async (path: string | null, bookmarkId: number) => {
      try {
        if (!path) {
          await fetch(`/api/bookmarks/${bookmarkId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category_id: null, folder_path: null }),
          })
        } else {
          let categoryId = categoryMap.get(path) || null
          if (!categoryId) {
            const ensure = await fetch("/api/categories/ensure", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path }),
            })
            if (ensure.ok) {
              const data = await ensure.json()
              categoryId = data.id ?? null
              await loadCategories()
            } else {
              throw new Error("Failed to ensure category")
            }
          }

          await fetch(`/api/bookmarks/${bookmarkId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category_id: categoryId, folder_path: path }),
          })
        }
      } catch (error) {
        console.error("Failed to move bookmark", error)
      } finally {
        fetchBookmarks()
      }
    },
    [categoryMap, fetchBookmarks, loadCategories],
  )

  const handleDelete = useCallback(
    async (id: number) => {
      const res = await fetch(`/api/bookmarks/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const error = await res.json()
        alert(error.error || error.message || "Failed to delete bookmark")
        return
      }
      fetchBookmarks()
    },
    [fetchBookmarks],
  )

  const handleOrganize = useCallback(async () => {
    setOrganizing(true)
    try {
      const res = await fetch("/api/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "organise my bookmarks by topic" }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to organize")
      }
      const data = (await res.json()) as OrganizeResult
      setOrganizeResult(data)
      setAppliedCategories(new Set())
      setActiveTab("suggestions")
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : "Failed to request AI suggestions")
    } finally {
      setOrganizing(false)
    }
  }, [])

  const applySuggestion = useCallback(
    async (category: string, bookmarkIds: number[]) => {
      const updated = new Set(appliedCategories)
      try {
        const ensure = await fetch("/api/categories/ensure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: category }),
        })
        if (!ensure.ok) {
          throw new Error("Failed to create category")
        }
        const { id } = await ensure.json()
        for (const bookmarkId of bookmarkIds) {
          await fetch(`/api/bookmarks/${bookmarkId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category_id: id, folder_path: category }),
          })
        }
        updated.add(category)
        setAppliedCategories(updated)
        fetchBookmarks()
      } catch (error) {
        console.error(error)
        alert("Failed to apply category suggestion")
      }
    },
    [appliedCategories, fetchBookmarks],
  )

  const handleDuplicateDelete = useCallback(
    async (id: number) => {
      await handleDelete(id)
      if (organizeResult) {
        setOrganizeResult((prev) =>
          prev
            ? {
                ...prev,
                duplicates: prev.duplicates.filter(
                  (dup) => dup.firstId !== id && dup.secondId !== id,
                ),
              }
            : prev,
        )
      }
    },
    [handleDelete, organizeResult],
  )

  const contextBookmarks = organizeResult?.bookmarks || bookmarks
  const bookmarkLookup = useMemo(() => {
    const map = new Map<number, BookmarkRecord>()
    for (const bookmark of contextBookmarks) {
      map.set(bookmark.id, bookmark)
    }
    return map
  }, [contextBookmarks])

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <CardTitle className="text-[#000080]">Library</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={fetchBookmarks} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button variant="default" size="sm" onClick={handleOrganize} disabled={organizing}>
            <Sparkles className="mr-2 h-4 w-4" />
            {organizing ? "Asking Gemini..." : "AI organize"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bookmarks">Bookmarks</TabsTrigger>
            <TabsTrigger value="readingList">Reading List</TabsTrigger>
            <TabsTrigger value="suggestions">AI Suggestions</TabsTrigger>
          </TabsList>

          <TabsContent value="bookmarks" className="mt-6">
            <div className="grid gap-6 md:grid-cols-[260px_1fr]">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-600">Categories</h3>
                <CategoryTree
                  categories={categories}
                  selectedPath={selectedCategory}
                  onSelect={setSelectedCategory}
                  onDropBookmark={handleCategoryDrop}
                />
              </div>
              <div>
                {loading ? (
                  <p className="text-gray-500">Loading...</p>
                ) : bookmarks.length === 0 ? (
                  <p className="text-gray-500">No bookmarks found.</p>
                ) : (
                  <ul className="space-y-4">
                    {bookmarks.map((bookmark) => (
                      <li
                        key={bookmark.id}
                        className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4 md:flex-row md:items-center md:justify-between"
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/bookmark-id", String(bookmark.id))
                        }}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            {bookmark.favicon_url && (
                              <Image
                                src={bookmark.favicon_url}
                                alt=""
                                width={16}
                                height={16}
                                className="h-4 w-4"
                                unoptimized
                              />
                            )}
                            <a
                              href={bookmark.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate font-semibold text-[#000080] hover:underline"
                            >
                              {bookmark.title || bookmark.url}
                            </a>
                          </div>
                          {bookmark.description && (
                            <p className="text-sm text-gray-600 line-clamp-3">
                              {bookmark.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            {bookmark.folder_path && <Badge variant="outline">{bookmark.folder_path}</Badge>}
                            {bookmark.source && <Badge variant="secondary">{bookmark.source}</Badge>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            className="text-[#000080]"
                          >
                            <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(bookmark.id)}
                            className="text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="readingList" className="mt-6">
            {loading ? (
              <p className="text-gray-500">Loading...</p>
            ) : readingList.length === 0 ? (
              <p className="text-gray-500">Your Chrome reading list is empty.</p>
            ) : (
              <ul className="space-y-4">
                {readingList.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        {item.favicon_url && (
                          <Image
                            src={item.favicon_url}
                            alt=""
                            width={16}
                            height={16}
                            className="h-4 w-4"
                            unoptimized
                          />
                        )}
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate font-semibold text-[#000080] hover:underline"
                        >
                          {item.title || item.url}
                        </a>
                      </div>
                      {item.description && (
                        <p className="text-sm text-gray-600 line-clamp-3">{item.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Badge variant={item.is_read ? "outline" : "secondary"}>
                          {item.is_read ? "Read" : "Unread"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          await fetch(`/api/bookmarks/${item.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ is_read: !item.is_read }),
                          })
                          fetchBookmarks()
                        }}
                      >
                        {item.is_read ? (
                          <Circle className="mr-2 h-4 w-4" />
                        ) : (
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                        )}
                        Mark as {item.is_read ? "unread" : "read"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item.id)}
                        className="text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="suggestions" className="mt-6">
            {organizeResult ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-[#000080]">Category suggestions</h3>
                  {organizeResult.categories.length === 0 ? (
                    <p className="text-sm text-gray-500">No category recommendations right now.</p>
                  ) : (
                    <ul className="space-y-4">
                      {organizeResult.categories.map((suggestion) => (
                        <li key={suggestion.category} className="rounded-lg border border-gray-200 p-4">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <h4 className="font-semibold text-[#000080]">{suggestion.category}</h4>
                              {suggestion.rationale && (
                                <p className="text-sm text-gray-600">{suggestion.rationale}</p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => applySuggestion(suggestion.category, suggestion.bookmarkIds)}
                              disabled={appliedCategories.has(suggestion.category)}
                            >
                              {appliedCategories.has(suggestion.category) ? "Applied" : "Apply"}
                            </Button>
                          </div>
                          <ul className="mt-3 space-y-2">
                            {suggestion.bookmarkIds.map((id) => {
                              const bookmark = bookmarkLookup.get(id)
                              if (!bookmark) return null
                              return (
                                <li key={id} className="flex items-center justify-between text-sm text-gray-700">
                                  <span className="truncate">{bookmark.title || bookmark.url}</span>
                                  <a
                                    href={bookmark.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#000080] hover:underline"
                                  >
                                    Open
                                  </a>
                                </li>
                              )
                            })}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-[#000080]">Duplicate suggestions</h3>
                  {organizeResult.duplicates.length === 0 ? (
                    <p className="text-sm text-gray-500">No duplicates detected.</p>
                  ) : (
                    <ul className="space-y-4">
                      {organizeResult.duplicates.map((duplicate) => {
                        const first = bookmarkLookup.get(duplicate.firstId)
                        const second = bookmarkLookup.get(duplicate.secondId)
                        if (!first || !second) return null
                        return (
                          <li key={`${duplicate.firstId}-${duplicate.secondId}`} className="rounded-lg border border-gray-200 p-4">
                            <div className="flex flex-col gap-3">
                              <div className="flex flex-col gap-1">
                                <p className="text-sm text-gray-500">Similarity score: {duplicate.score.toFixed(2)}</p>
                                <div>
                                  <p className="font-semibold text-[#000080]">{first.title || first.url}</p>
                                  <p className="text-sm text-gray-600">{first.url}</p>
                                </div>
                                <div>
                                  <p className="font-semibold text-[#000080]">{second.title || second.url}</p>
                                  <p className="text-sm text-gray-600">{second.url}</p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" onClick={() => window.open(first.url, "_blank")}>Keep first</Button>
                                <Button variant="outline" size="sm" onClick={() => window.open(second.url, "_blank")}>Keep second</Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDuplicateDelete(second.id)}
                                >
                                  Delete duplicate
                                </Button>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[#000080]/30 p-6 text-center">
                <p className="text-sm text-gray-600">
                  Request AI suggestions to see recommended categories and duplicate clean up tips.
                </p>
                <Button className="mt-4" onClick={handleOrganize} disabled={organizing}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Ask Gemini
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
