# To-Do App

Full-stack to-do app with per-user login.

- `server/` — Express + SQLite (better-sqlite3) + JWT auth
- `client/` — React + Vite + Tailwind CSS

## Run it

```
cd server && npm install && npm run dev
```

```
cd client && npm install && npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` requests to the backend on port 4000.

`server/.env` holds `PORT` and `JWT_SECRET` (already generated; regenerate before deploying anywhere shared).
