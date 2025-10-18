const API_BASE_URL = "https://ai-bookmark-organizer.netlify.app"
const IMPORT_ENDPOINT = `${API_BASE_URL}/api/import-chrome`
const DEFAULT_SETTINGS = {
  autoSync: false,
  includeReadingList: true,
  sendAiSignals: true,
}
const STORAGE_KEYS = {
  session: "supabaseSession",
  settings: "syncSettings",
  lastSync: "lastSyncResult",
}

async function getSettings() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.settings)
  return { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEYS.settings] || {}) }
}

async function saveSettings(settings) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.settings]: settings,
  })
  return settings
}

async function getSession() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.session)
  return stored[STORAGE_KEYS.session] || null
}

async function saveSession(session) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.session]: session,
  })
  return session
}

async function clearSession() {
  await chrome.storage.local.remove([STORAGE_KEYS.session])
}

function getFavicon(url) {
  try {
    const hostname = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${hostname}`
  } catch (error) {
    return null
  }
}

async function collectBookmarksTree() {
  const tree = await chrome.bookmarks.getTree()
  const bookmarks = []
  const folders = []

  const traverse = (node, path = []) => {
    const nextPath = node.title ? [...path, node.title] : path

    if (node.url) {
      bookmarks.push({
        id: node.id,
        title: node.title,
        url: node.url,
        folderPath: nextPath.join("/"),
        faviconUrl: getFavicon(node.url),
        dateAdded: node.dateAdded,
        dateGroupModified: node.dateGroupModified,
      })
    }

    if (node.children && node.children.length) {
      if (node.title) {
        folders.push({
          id: node.id,
          title: node.title,
          path: nextPath.join("/"),
        })
      }
      for (const child of node.children) {
        traverse(child, nextPath)
      }
    }
  }

  for (const node of tree) {
    traverse(node, [])
  }

  return { bookmarks, folders }
}

async function collectReadingListEntries(include = true) {
  if (!include || !chrome.readingList || !chrome.readingList.query) {
    return []
  }

  try {
    const entries = await chrome.readingList.query({})
    return entries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      url: entry.url,
      folderPath: "Reading List",
      faviconUrl: getFavicon(entry.url),
      dateAdded: entry.creationTime || entry.createdAt || entry.addedAt,
      dateGroupModified: entry.lastUpdateTime || entry.updatedAt,
      isRead: Boolean(entry.hasBeenRead),
      status: entry.hasBeenRead ? "READ" : "UNREAD",
    }))
  } catch (error) {
    console.warn("Reading list API unavailable", error)
    return []
  }
}

async function collectPayload() {
  const settings = await getSettings()
  const { bookmarks, folders } = await collectBookmarksTree()
  const readingList = await collectReadingListEntries(settings.includeReadingList)
  return {
    bookmarks,
    folders,
    readingList,
    autoCategorize: settings.sendAiSignals,
  }
}

async function syncNow(trigger = "manual") {
  const session = await getSession()
  if (!session?.access_token) {
    throw new Error("Not authenticated")
  }

  const payload = await collectPayload()
  const response = await fetch(IMPORT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || "Failed to sync")
  }

  const result = await response.json()
  const record = {
    timestamp: Date.now(),
    trigger,
    result,
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.lastSync]: record })
  chrome.runtime.sendMessage({ type: "sync-complete", payload: record })
  return record
}

async function login() {
  const redirectUri = chrome.identity.getRedirectURL("supabase")
  const authUrl = `${API_BASE_URL}/auth/login?redirect_to=${encodeURIComponent(redirectUri)}`
  const responseUrl = await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true })
  const url = new URL(responseUrl)
  const params = url.searchParams.size ? url.searchParams : new URLSearchParams(url.hash.replace(/^#/, ""))
  const accessToken = params.get("access_token") || params.get("token")
  const refreshToken = params.get("refresh_token")
  const expiresIn = Number(params.get("expires_in")) || 3600

  if (!accessToken) {
    throw new Error("No access token returned from Supabase")
  }

  const session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Date.now() + expiresIn * 1000,
  }

  await saveSession(session)
  chrome.runtime.sendMessage({ type: "auth-changed", payload: { authenticated: true } })
  return session
}

async function logout() {
  await clearSession()
  chrome.runtime.sendMessage({ type: "auth-changed", payload: { authenticated: false } })
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  const { type } = request || {}
  if (type === "sync") {
    syncNow(request.trigger)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true
  }
  if (type === "login") {
    login()
      .then((session) => sendResponse({ success: true, session }))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true
  }
  if (type === "logout") {
    logout().then(() => sendResponse({ success: true }))
    return true
  }
  if (type === "get-state") {
    Promise.all([getSession(), getSettings(), chrome.storage.local.get(STORAGE_KEYS.lastSync)])
      .then(([session, settings, lastSync]) => {
        sendResponse({
          success: true,
          session,
          settings,
          lastSync: lastSync[STORAGE_KEYS.lastSync] || null,
        })
      })
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true
  }
  if (type === "update-settings") {
    saveSettings({ ...DEFAULT_SETTINGS, ...(request.settings || {}) })
      .then((settings) => sendResponse({ success: true, settings }))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true
  }
  return false
})

async function maybeAutoSync(trigger) {
  try {
    const settings = await getSettings()
    if (!settings.autoSync) {
      return
    }
    await syncNow(trigger)
  } catch (error) {
    console.warn("Auto-sync failed", error)
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await saveSettings(await getSettings())
})

chrome.bookmarks.onCreated.addListener(() => maybeAutoSync("bookmark-created"))
chrome.bookmarks.onRemoved.addListener(() => maybeAutoSync("bookmark-removed"))
chrome.bookmarks.onChanged.addListener(() => maybeAutoSync("bookmark-updated"))

if (chrome.readingList && chrome.readingList.onItemAdded) {
  chrome.readingList.onItemAdded.addListener(() => maybeAutoSync("reading-list-added"))
  chrome.readingList.onItemRemoved.addListener(() => maybeAutoSync("reading-list-removed"))
  chrome.readingList.onItemUpdated.addListener(() => maybeAutoSync("reading-list-updated"))
}
