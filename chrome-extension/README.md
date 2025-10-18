# AI Bookmark Organizer Chrome extension

This folder contains a Manifest V3 extension that syncs Chrome bookmarks and reading list entries with the AI Bookmark Organizer backend.

## Features

- Collects the full bookmark tree (folders + URLs) via `chrome.bookmarks.getTree()`
- Reads Chrome's reading list entries on Chrome 120+
- Signs in through the existing Supabase flow with `chrome.identity.launchWebAuthFlow`
- Sends data to the `/api/import-chrome` endpoint with the stored Supabase session token
- Supports auto-sync on bookmark/reading list changes and exposes manual sync controls in the popup
- Allows toggling reading list inclusion and AI clustering hints

## Local development

1. Build the web app (`npm run dev`) to ensure the backend endpoints are available.
2. Open `chrome://extensions`, enable **Developer mode**, and click **Load unpacked**.
3. Select the `chrome-extension` directory from this repository.
4. In the popup, sign in using the Supabase-hosted login and click **Sync now** to push bookmarks.

The extension expects the web app to be reachable at [`https://ai-bookmark-organizer.netlify.app`](https://ai-bookmark-organizer.netlify.app) and uses the `/api/import-chrome` route to ingest data.

## Packaging

When preparing for the Chrome Web Store:

- Provide production-ready icons and update the `icons` field in `manifest.json` if you want branded assets in the Chrome Web Store listing.
- Update the `version` in `manifest.json` and re-run QA.
- Zip the entire `chrome-extension` directory and upload it through the Chrome Web Store developer dashboard.

