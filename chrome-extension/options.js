const autoSyncToggle = document.getElementById("autoSync")
const includeReadingListToggle = document.getElementById("includeReadingList")
const sendAiSignalsToggle = document.getElementById("sendAiSignals")

async function loadSettings() {
  const response = await chrome.runtime.sendMessage({ type: "get-state" })
  if (!response?.success) return
  const settings = response.settings
  autoSyncToggle.checked = Boolean(settings?.autoSync)
  includeReadingListToggle.checked = settings?.includeReadingList !== false
  sendAiSignalsToggle.checked = settings?.sendAiSignals !== false
}

async function saveSettings() {
  await chrome.runtime.sendMessage({
    type: "update-settings",
    settings: {
      autoSync: autoSyncToggle.checked,
      includeReadingList: includeReadingListToggle.checked,
      sendAiSignals: sendAiSignalsToggle.checked,
    },
  })
}

for (const toggle of [autoSyncToggle, includeReadingListToggle, sendAiSignalsToggle]) {
  toggle.addEventListener("change", () => {
    saveSettings().catch((error) => console.error("Failed to save settings", error))
  })
}

loadSettings().catch((error) => console.error(error))
