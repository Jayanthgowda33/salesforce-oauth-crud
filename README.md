# Salesforce CRUD App — CloudVandana Assignment

A full-stack app that lets you log in with Salesforce OAuth 2.0 and do
Create/Read/Update/Delete on Account, Opportunity, Lead, Contact, and Case,
with a dropdown to pick the object, dynamic fields, and infinite-scroll
pagination (20 records at a time).

Stack: **React (Vite)** frontend + **Node.js/Express** backend, which proxies
calls to the Salesforce REST API using the OAuth access token.

---

## 0. How the pieces fit together

```
Browser (React) → Node/Express backend → Salesforce REST API
                     ↑ holds the OAuth token in a session cookie
```

The backend, not the browser, calls Salesforce. This keeps your Client
Secret off the frontend and avoids CORS issues with Salesforce.

---

## 1. Create a Salesforce Developer Org

1. Go to https://developer.salesforce.com/signup and sign up (free).
2. Verify your email, set a password, and log in to the org.
3. Note your login URL — normally `https://login.salesforce.com`.

## 2. Create an External Client App (Connected App)

1. In Salesforce, click the gear icon → **Setup**.
2. In Quick Find, search **External Client Apps** → **New External Client App** (in newer orgs) or **App Manager → New Connected App** (older orgs — either works the same way for OAuth).
3. Fill in:
   - **App Name**: `CloudVandana CRUD App`
   - **Contact Email**: your email
4. Enable **OAuth Settings**:
   - Check **Enable OAuth Settings**
   - **Callback URL**: `http://localhost:5000/auth/callback`
     (this must exactly match `SF_REDIRECT_URI` in your backend `.env`)
   - **Selected OAuth Scopes**: add
     - `Manage user data via APIs (api)`
     - `Perform requests at any time (refresh_token, offline_access)`
5. Save. It can take **2–10 minutes** to activate.
6. Open the app again → **Manage Consumer Details** → copy the
   **Consumer Key** (Client ID) and **Consumer Secret** (Client Secret).
7. Under **Manage** → OAuth policies, set **Permitted Users** to
   "All users may self-authorize" so you can log in with your own account.

## 3. Configure the backend

```bash
cd backend
cp .env.example .env
```

Edit `.env` and paste in:
- `SF_CLIENT_ID` = Consumer Key
- `SF_CLIENT_SECRET` = Consumer Secret
- `SF_REDIRECT_URI` = `http://localhost:5000/auth/callback`
- `SESSION_SECRET` = any random string

Install and run:

```bash
npm install
npm start
```

Backend runs on `http://localhost:5000`.

## 4. Configure and run the frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## 5. Try it locally

1. Open `http://localhost:5173`.
2. Click **Log in to Salesforce** → you're redirected to Salesforce's
   login/consent page → approve → redirected back, now logged in.
3. Pick an object from the dropdown (e.g. **Contact**).
4. You'll see up to 20 records with the object's fields as columns.
5. Scroll to the bottom of the table to auto-load the next 20 (infinite scroll).
6. Use **+ New**, **Edit**, and **Delete** to test full CRUD.

Tip: create a few test records directly in Salesforce first (Setup →
Object Manager, or just use the app's own "New" button) so the list isn't empty.

---

## 6. Understanding the OAuth 2.0 flow used here (Web Server Flow)

1. `GET /auth/login` on the backend redirects the browser to
   `https://login.salesforce.com/services/oauth2/authorize?response_type=code&client_id=...&redirect_uri=...`
2. User logs in and approves access in Salesforce.
3. Salesforce redirects to your **Callback URL** with `?code=...`.
4. The backend exchanges that code for an **access_token**, **refresh_token**,
   and **instance_url** by POSTing to `/services/oauth2/token`.
5. The backend stores the token in a server-side session (cookie-based) and
   uses it as `Authorization: Bearer <token>` on every Salesforce REST API call
   (`/services/data/vXX.0/sobjects/...` and `/query`).

This satisfies the assignment's requirement to authenticate via OAuth 2.0
through an External Client App and use the resulting tokens to perform
operations in Salesforce.

---

## 7. Deploying (required by the assignment)

You need a **public URL**, since Salesforce must be able to reach your
callback URL and reviewers need to open the live app.

### Backend → Render.com (free tier)
1. Push this repo to GitHub (see step 9).
2. Go to https://render.com → New → **Web Service** → connect your repo.
3. Root directory: `backend`. Build command: `npm install`. Start command: `npm start`.
4. Add the same environment variables as your local `.env`, but set:
   - `SF_REDIRECT_URI=https://<your-render-app>.onrender.com/auth/callback`
   - `FRONTEND_URL=https://<your-vercel-app>.vercel.app`
5. Deploy. Copy the resulting backend URL.

### Frontend → Vercel (free tier)
1. Go to https://vercel.com → New Project → import the same repo.
2. Root directory: `frontend`. Framework preset: Vite.
3. Add environment variable `VITE_BACKEND_URL=https://<your-render-app>.onrender.com`.
4. Deploy. Copy the resulting frontend URL.

### Update Salesforce
Go back to your External Client App → OAuth settings → update the
**Callback URL** to the new Render URL
(`https://<your-render-app>.onrender.com/auth/callback`), save, and wait a
few minutes for it to propagate.

Also update `backend`'s env var `SF_REDIRECT_URI` on Render to match exactly,
and redeploy.

> Any host works (Render/Railway/Fly.io for the backend, Vercel/Netlify for
> the frontend) — just keep the Callback URL, `SF_REDIRECT_URI`, and
> `FRONTEND_URL` all consistent with wherever things actually end up running.

---

## 8. Cookie note for cross-domain deploys

Since frontend and backend will be on different domains in production, set
in `backend/server.js`'s session cookie config:
```js
cookie: { sameSite: "none", secure: true, ... }
```
(`secure: true` requires HTTPS, which Render/Vercel provide by default.)

---

## 9. Push to GitHub

```bash
cd sf-crud-app
git init
git add .
git commit -m "Salesforce CRUD assignment"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

Double-check `.env` files are **not** committed (they're in `.gitignore`).

## 10. Submit

Email **careers@cloudvandana.com** with:
- The deployed frontend URL (the live app link)
- Your GitHub repository link
- Your updated resume

---

## Troubleshooting

- **"redirect_uri_mismatch"** — the Callback URL in the External Client App
  must be *character-for-character* identical to `SF_REDIRECT_URI`.
- **Blank record list** — make sure the logged-in user actually has records
  for that object, or create one via the "+ New" button.
- **CORS errors** — confirm `FRONTEND_URL` on the backend matches the exact
  frontend origin (including https:// and no trailing slash).
- **401 after login on prod** — usually the cross-domain cookie issue; see
  section 8 above.
