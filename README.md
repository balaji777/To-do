# To-Do App

Full-stack to-do app with Google sign-in, due dates, priorities, categories, recurring tasks, dark mode, and email notifications.

- `server/` — Express + SQLite (better-sqlite3) + Google auth (JWT sessions) + Resend (email) + node-cron (reminders)
- `client/` — React + Vite + Tailwind CSS

## Features

- Sign in with Google (also creates the account on first sign-in — no separate signup flow)
- Tasks with due date, priority (low/medium/high), category, and recurrence (daily/weekly/monthly)
- Search, filter by category/priority, hide completed
- Light/Dark theme toggle
- Email sent to your Google account's email when a task is added
- Up to 3 reminder emails per task, spaced 3 days before / 1 day before / on the due date — stops once the task is done

## Run it

```
cd server
npm install
npm run dev
```

```
cd client
npm install
npm run dev
```

Open http://localhost:5173 (or whatever port Vite prints). The Vite dev server proxies `/api` requests to the backend on port 4000.

## Setting up Google Sign-In

You need one OAuth Client ID from Google Cloud Console (free, no client secret needed — this app uses Google Identity Services' ID-token flow).

1. Go to https://console.cloud.google.com/ and create a project (or pick an existing one).
2. Go to **APIs & Services → OAuth consent screen**. Choose **External**, fill in the required fields (app name, your email), and save. You don't need to submit for verification for personal/testing use — just add your own Google account under **Test users** if prompted.
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
4. Application type: **Web application**.
5. Under **Authorized JavaScript origins**, add `http://localhost:5173` (and `http://localhost:5174` too, in case 5173 is busy and Vite picks the next port).
6. Leave **Authorized redirect URIs** empty — not needed for this flow.
7. Click **Create**. Copy the **Client ID** (looks like `123-abc.apps.googleusercontent.com`).

Then set the same Client ID in **both**:
- `server/.env` → `GOOGLE_CLIENT_ID=...`
- `client/.env` → `VITE_GOOGLE_CLIENT_ID=...`

Restart both dev servers after setting these.

## Other environment variables (`server/.env`)

- `PORT` / `JWT_SECRET` — already generated for local dev; regenerate `JWT_SECRET` before deploying anywhere shared.
- `RESEND_API_KEY` — get one free at https://resend.com. Without it, emails are just logged to the server console instead of sent.
- `EMAIL_FROM` — defaults to `onboarding@resend.dev`, Resend's shared test sender. It can only deliver to the email address you signed up to Resend with, until you verify your own domain in the Resend dashboard.

Reminder emails are checked once daily (9am server time) via a cron job in `server/reminders.js`.
