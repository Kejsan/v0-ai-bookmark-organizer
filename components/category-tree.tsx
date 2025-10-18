"use client"

import { useState, useCallback, Fragment } from "react"
import { ChevronDown, ChevronRight, FolderTree } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CategoryTreeNode {
  id: number
  name: string
  path: string
  children?: CategoryTreeNode[]
}

interface CategoryTreeProps {
  categories: CategoryTreeNode[]
  selectedPath?: string | null
  onSelect?: (path: string | null) => void
  onDropBookmark?: (path: string | null, bookmarkId: number) => void
}

export default function CategoryTree({
  categories,
  selectedPath = null,
  onSelect,
  onDropBookmark,
}: CategoryTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const toggleNode = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const handleSelect = useCallback(
    (path: string | null) => {
      onSelect?.(path)
    },
    [onSelect],
  )

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>, path: string | null) => {
      if (!onDropBookmark) return
      event.preventDefault()
      event.stopPropagation()
      const bookmarkId = Number(event.dataTransfer.getData("text/bookmark-id"))
      if (!Number.isNaN(bookmarkId)) {
        onDropBookmark(path, bookmarkId)
      }
    },
    [onDropBookmark],
  )

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (onDropBookmark) {
      event.preventDefault()
    }
  }, [onDropBookmark])

  const renderNode = (node: CategoryTreeNode) => {
    const isExpanded = expanded.has(node.path) || !node.children?.length
    const hasChildren = node.children && node.children.length > 0
    const isSelected = selectedPath === node.path

    return (
      <Fragment key={node.path}>
        <div
          className={cn(
            "flex items-center gap-2 rounded px-2 py-1 text-sm transition-colors",
            isSelected ? "bg-[#000080]/10 text-[#000080]" : "text-gray-700 hover:bg-gray-100",
          )}
          draggable={false}
          onClick={() => handleSelect(node.path)}
          onDragOver={handleDragOver}
          onDrop={(event) => handleDrop(event, node.path)}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              if (hasChildren) {
                toggleNode(node.path)
              }
            }}
            className="flex h-5 w-5 items-center justify-center rounded border border-gray-200 bg-white"
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )
            ) : (
              <FolderTree className="h-4 w-4" />
            )}
          </button>
          <span className="truncate">{node.name}</span>
        </div>
        {hasChildren && isExpanded && (
          <div className="ml-4 border-l border-dashed border-gray-200 pl-3">
            {node.children!.map((child) => renderNode(child))}
          </div>
        )}
      </Fragment>
    )
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm",
          selectedPath === null ? "bg-[#000080]/10 text-[#000080]" : "text-gray-700 hover:bg-gray-100",
        )}
        onClick={() => handleSelect(null)}
        onDragOver={handleDragOver}
        onDrop={(event) => handleDrop(event, null)}
      >
        <FolderTree className="h-4 w-4" />
        <span>All bookmarks</span>
      </div>
      {categories.map((category) => renderNode(category))}
    </div>
  )
}
