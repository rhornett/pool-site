# How the Rikki Hornett Pool Site Was Built — Quick Reference

A plain-language recap for future-you. Live at **hornett.org**.

## What it is

Two pages on one site:
1. **The dashboard** (`hornett.org`) — pool stats, live NFL scoring, leaderboards
2. **A file upload page** (`hornett.org/upload.html`) — generic, no pool branding, accepts files up to 1GB

## The dashboard, in brief

- Built from an Excel export of the pool entries (116 entries, 72 households)
- Each entry picks NFL teams within a $10 "selection value" budget — **separate from the real $50/line entry fee** ($5,800 total pot = 116 × $50)
- **Live Scoreboard tab**: auto-syncs regular-season win/loss from ESPN's (undocumented) API the moment the page loads. Division/Conference/Super Bowl bonuses are **manual** — you check them off in "Edit Standings" once they're officially decided, never auto-awarded from current standings
- **Best Possible Score**: a knapsack-optimization feature — shown both as a headline stat and its own section — that calculates the highest score achievable for $10 or less, recalculating live as scores update
- **"Download This Week's Snapshot"** button bakes the current live state into a fresh copy of the HTML file — use this instead of the plain file if you want to freeze/share a specific week's numbers

## How the site is hosted

- **Code lives in a GitHub repo** (`rhornett/pool-site`)
- **Netlify** builds and hosts it, auto-deploying every time the repo changes
- Repo structure:
  ```
  public/index.html          → the dashboard
  public/upload.html         → the upload page
  netlify/functions/         → one serverless function (see below)
  netlify.toml, package.json → build config
  ```
- **To update the dashboard weekly**: replace `public/index.html` in the repo with a fresh "Download This Week's Snapshot" export, commit — Netlify redeploys automatically

## How the file upload works

Files up to 1GB can't pass through a normal serverless function (they have small payload limits), so the upload page uses a **presigned URL** pattern instead:

1. Visitor picks a file on `upload.html`
2. The page asks a Netlify function (`generate-upload-url.js`) for permission
3. That function talks to **Cloudflare R2** (S3-compatible object storage) and hands back a temporary, one-time upload link
4. The browser sends the file **directly to R2** — never through Netlify at all — which is what makes large files possible

**Where uploaded files land**: Cloudflare dashboard → R2 → `file-upload` bucket → Objects tab. Named `uploads/<timestamp>-<sender name>-<filename>`.

### Two non-obvious gotchas that cost real debugging time
- The R2 bucket is **EU-jurisdiction**, so the function needs the EU-specific endpoint (`R2_ENDPOINT` env var), not R2's global default
- The AWS SDK defaults to a URL style R2 doesn't like (`bucket.account.r2.cloudflarestorage.com`); the function forces the style R2 actually expects via `forcePathStyle: true`

### The 5 environment variables (set in Netlify, not in code)
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`

### CORS
The R2 bucket's CORS policy must list every domain that's allowed to upload to it (currently `hornett.org` and the `.netlify.app` address). If uploads ever start failing with a CORS error in the browser console after adding a new domain, this is the first thing to check.

## Domain setup

`hornett.org` was bought on Namecheap. DNS points to Netlify via:
- **A record**: `@` → `75.2.60.5`
- **CNAME record**: `www` → `unrivaled-croquembouche-40037d.netlify.app`

Netlify issues and renews the HTTPS certificate automatically — no action needed unless the domain or DNS ever changes.

## Security notes for future-you

- The R2 API token was regenerated at least once during setup after being visible in screenshots/chat — if anything ever seems off with uploads, rotating the token (Cloudflare → R2 → Manage API Tokens) and updating the two secret env vars in Netlify is a safe first troubleshooting step
- Netlify's "Environment variables" screen is where all the R2 credentials live — never in the code itself, and the code never displays them

## If something breaks later

- **Dashboard shows stale scores**: click "Refresh Live Sync" manually, or check if ESPN's feed itself is lagging (it has occasionally been slow to update a specific game while others update fine)
- **Upload page fails**: check the browser console (F12) for the exact error first — CORS errors and R2 credential errors look different and point to different fixes
- **Site down / cert errors**: usually resolves itself within minutes; a hard refresh or trying from a different device/network rules out local caching before assuming something's actually broken
