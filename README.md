# Build this app

*Automatically synced with your [v0.app](https://v0.app) deployments*

[![Deployed on Netlify](https://img.shields.io/badge/Deployed%20on-Netlify-blue?style=for-the-badge&logo=netlify)](https://v0-ai-bookmark-organizer.netlify.app)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/projects/zItTXaLWcQE)

## Overview

This repository will stay in sync with your deployed chats on [v0.app](https://v0.app).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.app](https://v0.app).

## Deployment

Your project is live at:

**[https://v0-ai-bookmark-organizer.netlify.app](https://v0-ai-bookmark-organizer.netlify.app)**

## Build your app

Continue building your app on:

**[https://v0.app/chat/projects/zItTXaLWcQE](https://v0.app/chat/projects/zItTXaLWcQE)**

## How It Works

1. Create and modify your project using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Netlify deploys the latest version from this repository

## Environment Variables

The app requires several environment variables to connect to Supabase and handle encryption keys.

1. Copy `.env.example` to `.env.local` and fill in the values.
2. In Netlify:
   - Navigate to **Site settings → Build & deploy → Environment**.
   - Add the following variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `APP_KMS_MASTER_KEY`
     - Optional: `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`
     - Optional: `NEXT_PUBLIC_SITE_URL`
   - Save the variables and trigger a new deploy.

