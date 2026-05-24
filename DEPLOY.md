# Deployment guide — EGI Workbench

Quick reference for getting the workbench live on Vercel before the Monday
presentation. ~5 minutes once you have a Vercel account.

## One-time setup

1. **Install the Vercel CLI** if you don't have it:
   ```bash
   npm install -g vercel
   ```

2. **Log in to Vercel** (opens a browser):
   ```bash
   vercel login
   ```

## Deploy

From the repo root:

```bash
cd app

# Link this folder to a new Vercel project (one-time)
vercel link

# Required: 32-byte hex used to sign session cookies
vercel env add AUTH_SECRET
# Paste a value generated with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Optional but recommended: enables free-text "Ask the EGI"
vercel env add GROQ_API_KEY
# Get a free key at https://console.groq.com/keys

# Optional: persistent sessions + saved cohorts across deployments
# (Provision a KV store from the Vercel dashboard → Storage tab first.)
vercel env add KV_REST_API_URL
vercel env add KV_REST_API_TOKEN

# Ship it
vercel deploy --prod
```

Vercel returns a `https://<your-project>.vercel.app` URL. Add it to:
- `README.md` (top of the file where it says "Deployed app: _add your Vercel URL_")
- The submission email body
- The PPTX cover slide

## What's already wired

- `app/vercel.json` configures the Next.js build, sets the Node region to
  `iad1`, and bumps function timeouts for PDF generation (60s) and the AI
  page (30s).
- `app/scripts/build-geojson.mjs` runs in `postinstall` and downloads the
  Mississippi county GeoJSON at build time — no manual step needed.
- `better-sqlite3` ships prebuilt binaries for Node 20+ on Vercel. No
  special configuration required.

## Without KV

If you skip the KV env vars, the app falls back to an **in-memory KV** —
sessions and saved cohorts still work, but they reset whenever Vercel
spins up a fresh function instance. Fine for a demo; not for production.

## Without GROQ_API_KEY

The five starter chips on `/ask` still work (they have hardcoded SQL). The
free-text input shows a muted footnote explaining the LLM isn't
configured. The demo can run entirely off chips if Groq is rate-limited
or unavailable mid-presentation.

## Smoke test after deploy

```bash
DEPLOYED="https://your-project.vercel.app"
curl -s -o /dev/null -w "GET /login → %{http_code}\n" "$DEPLOYED/login"
# Should return 200
```

Then sign in as `officer@gulfsouth.example` / `demo` and click through:
landing → click Issaquena → /compare → /cohort → /quadrant → /reweight →
/methodology → /ask.
