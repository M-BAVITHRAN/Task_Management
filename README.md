# TaskFlow — Task Management System

A full-stack task manager built with React + Vite, Node.js, Express, SQLite, and JWT authentication.

## Features

- User registration and login
- Password hashing with bcrypt
- JWT-protected API routes
- Create, list, read, update, and delete tasks
- Per-user task ownership enforced in SQL queries
- Task statuses: `pending`, `in-progress`, `completed`
- Optional description and due date
- Search and status filtering
- Responsive UI with loading and error states
- Helmet security headers, request body limit, and authentication rate limiting

## Requirements

- Node.js 20 or newer
- npm

SQLite is embedded and stores data in a file. No database account or connection string is required for local development.

## Folder structure

```text
task-management-system/
├── client/                 # React + Vite frontend
│   ├── src/api.js
│   ├── src/App.jsx
│   ├── src/main.jsx
│   └── src/styles.css
├── server/                 # Express API
│   ├── src/db.js            # SQLite database + schema initialization
│   ├── src/middleware/auth.js
│   ├── src/routes/auth.js
│   ├── src/routes/tasks.js
│   ├── src/server.js
│   ├── .env.example
│   └── package.json
└── README.md
```

## 1. Run the backend locally

From the project root:

```bash
cd server
npm install
```

Copy `server/.env.example` to `server/.env` and configure a strong JWT secret. Example:

```env
PORT=5000
NODE_ENV=development
DB_FILE=./data/task-manager.sqlite
JWT_SECRET=replace_with_a_random_secret_at_least_32_characters
JWT_EXPIRES_IN=1d
CLIENT_URL=http://localhost:5173
```

Generate a strong secret with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste the generated output as `JWT_SECRET` in `server/.env`. Do not commit `.env` or share your secret.

Start the API:

```bash
npm run dev
```

The API runs at `http://localhost:5000`. Health check: `http://localhost:5000/api/health`.

The SQLite database file is created automatically at `server/data/task-manager.sqlite` by default. Tables and indexes are created on startup. Data persists across local server restarts.

## 2. Run the frontend locally

Open a second terminal from the project root:

```bash
cd client
npm install
```

Copy `client/.env.example` to `client/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

Start Vite:

```bash
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

## API reference

All request and response bodies use JSON unless stated otherwise. Protected task endpoints require this header:

```http
Authorization: Bearer <JWT>
```

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create an account |
| POST | `/api/auth/login` | No | Log in and receive a JWT |
| GET | `/api/auth/me` | Yes | Get current user profile |
| GET | `/api/tasks` | Yes | List current user's tasks |
| POST | `/api/tasks` | Yes | Create a task |
| GET | `/api/tasks/:id` | Yes | Read an owned task |
| PUT | `/api/tasks/:id` | Yes | Update an owned task |
| DELETE | `/api/tasks/:id` | Yes | Delete an owned task |
| GET | `/api/health` | No | Health check |

### Task payload

```json
{
  "title": "Finish project report",
  "description": "Write the final documentation",
  "status": "pending",
  "dueDate": "2026-10-30"
}
```

`title` is required (1–120 characters). `description` is optional (up to 2,000 characters). `status` must be `pending`, `in-progress`, or `completed`. `dueDate` can be omitted or set to `null`.

## Test with curl

Register a user:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo User","email":"demo@example.com","password":"change-this-password"}'
```

Copy the `token` from the JSON response. Set it in your terminal:

```bash
TOKEN="paste-your-token-here"
```

Create a task:

```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Prepare interview","description":"Review REST APIs","status":"pending"}'
```

List tasks:

```bash
curl http://localhost:5000/api/tasks -H "Authorization: Bearer $TOKEN"
```

Update a task (replace `<TASK_ID>` with the task's numeric `_id` returned by the API):

```bash
curl -X PUT http://localhost:5000/api/tasks/<TASK_ID> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"completed"}'
```

Read one task:

```bash
curl http://localhost:5000/api/tasks/<TASK_ID> -H "Authorization: Bearer $TOKEN"
```

Delete a task:

```bash
curl -X DELETE http://localhost:5000/api/tasks/<TASK_ID> \
  -H "Authorization: Bearer $TOKEN"
```

On Windows PowerShell, `curl` can be an alias; use `curl.exe` or a REST client such as Postman/Thunder Client. To test ownership, register a second user and try using the first user's task ID with the second user's token. The task endpoint should return `404 Task not found`.

## GitHub

Create an empty repository on GitHub, then from the project root:

```bash
git init
git add .
git commit -m "Build TaskFlow task management system"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

The `.gitignore` files exclude `.env`, `node_modules`, build output, and local SQLite database files. Do not commit credentials or your local database unless you explicitly intend to distribute its data.

## Deploy backend to Render

SQLite persists to a file, so the Render service needs a **persistent disk**. Without one, the database can be lost when the instance restarts, redeploys, or is replaced.

1. Push the project to GitHub.
2. In Render, create a **Web Service** connected to the repository.
3. Set **Root Directory** to `server`.
4. Set **Build Command** to `npm install`.
5. Set **Start Command** to `npm start`.
6. In the Render service's Disks settings, attach a persistent disk mounted at `/var/data` (check current Render plan and disk availability/pricing).
7. Set environment variables:
   - `NODE_ENV=production`
   - `DB_FILE=/var/data/task-manager.sqlite`
   - `JWT_SECRET` = a fresh random secret (32+ characters)
   - `JWT_EXPIRES_IN=1d`
   - `CLIENT_URL` = your Vercel frontend origin, e.g. `https://your-app.vercel.app`
8. Deploy and verify `https://YOUR-RENDER-SERVICE.onrender.com/api/health` returns `{ "status": "ok" }`.

SQLite is best for a single backend instance and modest traffic. Do not run multiple service instances against the same SQLite file. If your Render plan does not support persistent disks, use a managed database such as PostgreSQL instead of relying on the ephemeral filesystem.

## Deploy frontend to Vercel

1. Import the GitHub repository into Vercel.
2. Set **Root Directory** to `client`.
3. Framework preset: **Vite**.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Add environment variable `VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api`.
7. Deploy and open the generated Vercel URL.
8. Confirm Render's `CLIENT_URL` exactly matches the deployed frontend origin. Redeploy the backend after changing that variable.

If you change a Vite environment variable, trigger a new frontend deployment because Vite injects `VITE_` variables at build time.

## Security notes

- Passwords are hashed with bcrypt; plaintext passwords are never stored.
- JWTs are signed with an environment-provided secret and verified with an explicit algorithm.
- Task routes require authentication. Queries and mutations include both task ID and authenticated owner ID, preventing cross-user task access.
- SQL statements use bound parameters for user-supplied values.
- Request bodies are size-limited, Helmet sets common security headers, and authentication routes are rate-limited.
- The browser keeps the JWT in memory, not local storage. A page refresh signs the user out; sign in again to obtain a token.
- Use HTTPS in production and a strong secret. CORS is not authentication; the server must verify JWTs and task ownership.
- For a public production service, consider automated tests, monitoring, stronger rate limiting, email verification, password reset, and secure HttpOnly cookie/session design.

## Common troubleshooting

- **`better-sqlite3` install error:** Use Node.js 20+ and a supported OS/architecture; rerun `npm install`. Some systems may require build tools if a prebuilt native module is unavailable.
- **Database file error:** Ensure `DB_FILE` points to a directory the process can write to. The app creates the parent directory automatically.
- **CORS error:** Check that Render's `CLIENT_URL` exactly matches the browser's Vercel origin (scheme and hostname, no extra path).
- **401 response:** Sign in again and send `Authorization: Bearer <JWT>`.
- **404 task response:** Confirm the ID and that the task belongs to the currently signed-in user.
- **Frontend cannot connect:** Verify `VITE_API_URL`, Render deployment status, and `/api/health`.

## License

For educational and portfolio use. Add a license if you intend to distribute the project publicly.
#   T a s k _ M a n a g e m e n t  
 