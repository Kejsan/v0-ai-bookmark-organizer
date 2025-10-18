const statusText = document.querySelector(".status-text")
const loginButton = document.getElementById("login")
const logoutButton = document.getElementById("logout")
const syncButton = document.getElementById("sync")
const syncDetails = document.querySelector(".sync-details")
const autoSyncToggle = document.getElementById("autoSync")
const includeReadingListToggle = document.getElementById("includeReadingList")
const sendAiSignalsToggle = document.getElementById("sendAiSignals")

function formatTimestamp(timestamp) {
  if (!timestamp) return "Never synced"
  const date = new Date(timestamp)
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`
}

async function getState() {
  const response = await chrome.runtime.sendMessage({ type: "get-state" })
  if (!response?.success) {
    throw new Error(response?.error || "Failed to load state")
  }
  return response
}

function updateAuth(session) {
  const isAuthenticated = Boolean(session?.access_token)
  loginButton.disabled = isAuthenticated
  logoutButton.disabled = !isAuthenticated
  syncButton.disabled = !isAuthenticated
  statusText.textContent = isAuthenticated
    ? "Connected. Use Sync now or enable auto-sync to stay up to date."
    : "Connect your account to sync bookmarks."
}

function updateSyncDetails(record) {
  if (!record) {
    syncDetails.textContent = "No syncs yet."
    return
  }

  const { result, trigger, timestamp } = record
  const lines = []
  lines.push(`Last sync: ${formatTimestamp(timestamp)} (${trigger})`)
  if (result) {
    lines.push(`Imported ${result.imported || 0}, skipped ${result.failed || 0}`)
    if (result.duplicates?.length) {
      lines.push(`${result.duplicates.length} duplicates detected`)
    }
  }
  syncDetails.textContent = lines.join("\n")
}

function updateSettingsToggles(settings) {
  autoSyncToggle.checked = Boolean(settings?.autoSync)
  includeReadingListToggle.checked = settings?.includeReadingList !== false
  sendAiSignalsToggle.checked = settings?.sendAiSignals !== false
}

async function persistSettings() {
  const response = await chrome.runtime.sendMessage({
    type: "update-settings",
    settings: {
      autoSync: autoSyncToggle.checked,
      includeReadingList: includeReadingListToggle.checked,
      sendAiSignals: sendAiSignalsToggle.checked,
    },
  })
  if (!response?.success) {
    throw new Error(response?.error || "Failed to save settings")
  }
  return response.settings
}

async function init() {
  try {
    const state = await getState()
    updateAuth(state.session)
    updateSyncDetails(state.lastSync)
    updateSettingsToggles(state.settings)
  } catch (error) {
    statusText.textContent = error.message
  }
}

loginButton.addEventListener("click", async () => {
  loginButton.disabled = true
  statusText.textContent = "Opening sign-in..."
  try {
    const response = await chrome.runtime.sendMessage({ type: "login" })
    if (!response?.success) {
      throw new Error(response?.error || "Login failed")
    }
    updateAuth(response.session)
    statusText.textContent = "Authenticated! You can sync now."
  } catch (error) {
    statusText.textContent = error.message
    loginButton.disabled = false
  }
})

logoutButton.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "logout" })
  updateAuth(null)
  statusText.textContent = "Signed out."
})

syncButton.addEventListener("click", async () => {
  syncButton.disabled = true
  statusText.textContent = "Sync in progress..."
  try {
    const response = await chrome.runtime.sendMessage({ type: "sync", trigger: "manual" })
    if (!response?.success) {
      throw new Error(response?.error || "Sync failed")
    }
    updateSyncDetails(response.data)
    statusText.textContent = "Sync complete!"
  } catch (error) {
    statusText.textContent = error.message
  } finally {
    syncButton.disabled = false
  }
})

for (const toggle of [autoSyncToggle, includeReadingListToggle, sendAiSignalsToggle]) {
  toggle.addEventListener("change", () => {
    persistSettings().catch((error) => {
      statusText.textContent = error.message
    })
  })
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "sync-complete") {
    updateSyncDetails(message.payload)
  }
  if (message?.type === "auth-changed") {
    updateAuth(message.payload?.authenticated ? { access_token: true } : null)
  }
})

init()
