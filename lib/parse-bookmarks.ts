import { BookmarksParser, BookmarksTree } from "netscape-bookmark-parser"

export type ParsedFolder = {
  name: string
  children: Array<ParsedFolder | ParsedLink>
}

export type ParsedLink = {
  title: string
  href: string
  add_date?: string
  icon?: string
}

function convertTree(
  tree: BookmarksTree,
  level = 0,
): Array<ParsedFolder | ParsedLink> {
  const output: Array<ParsedFolder | ParsedLink> = []

  for (const [name, value] of tree) {
    if (value instanceof BookmarksTree) {
      // It's a folder
      output.push({
        name,
        children: convertTree(value, level + 1),
      })
    } else {
      // It's a bookmark
      const url = value as unknown as string
      // The library does not directly expose metadata like add_date or icon in the same way.
      // We will have to make do with what we have.
      output.push({
        title: name,
        href: url,
      })
    }
  }

  return output
}

export function parseNetscapeBookmarks(
  html: string,
): Array<ParsedFolder | ParsedLink> {
  if (!html) return []

  try {
    const bookmarksTree = BookmarksParser.parse(html)
    // The top-level object from the parser is a BookmarksTree, which represents the root.
    // We need to process its children.
    return convertTree(bookmarksTree)
  } catch (error) {
    console.error("Failed to parse bookmarks:", error)
    return []
  }
}
