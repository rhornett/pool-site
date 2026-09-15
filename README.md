# Rikki Hornett NFL Owner's Pool — Site + File Upload

This folder is a complete, ready-to-deploy site with two pages:

- `public/index.html` — the pool dashboard (unchanged from before)
- `public/upload.html` — a file upload page. Visitors can upload files up
  to 1GB, which go **directly** from their browser to Cloudflare R2 storage
  (a serverless function only hands out a temporary permission slip — the
  file itself never passes through Netlify or this function, which is what
  makes large uploads possible).

Nothing in this repo needs editing before deploy, except the environment
variables described in Step 3 below.

---

## One-time setup

### Step 1 — Cloudflare account + R2 bucket

1. Go to https://dash.cloudflare.com and sign up (free).
2. In the left sidebar, click **R2 Object Storage** → **Create bucket**.
   - Name it something like `pool-uploads`.
   - Location: Automatic is fine.
3. Once created, click into the bucket → **Settings** → **CORS Policy** →
   add this (replace `your-site.netlify.app` with your real Netlify URL
   once you have it, and add your custom domain too if/when you set one up):

   ```json
   [
     {
       "AllowedOrigins": [
         "https://your-site.netlify.app",
         "https://your-custom-domain.com"
       ],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```

   Without this step, uploads will fail with a CORS error in the browser —
   this is the single most common thing to forget.

### Step 2 — Create an R2 API token

1. Still in Cloudflare: **R2** → **Manage R2 API Tokens** → **Create API Token**.
2. Permissions: **Object Read & Write**, scoped to your `pool-uploads` bucket only.
3. Save the three values it shows you (you only see the secret once):
   - **Access Key ID**
   - **Secret Access Key**
   - Your **Account ID** (shown in the R2 overview page, or in the URL of
     your Cloudflare dashboard)

### Step 3 — Deploy this site to Netlify

Because this site includes a serverless function with dependencies, it
needs to be deployed via a connected Git repository (not a plain drag-and-drop) —
Netlify runs `npm install` and bundles the function automatically on that path.

1. Push this folder to a new GitHub repository.
2. In Netlify: **Add new site** → **Import an existing project** → connect
   the repo.
3. Build settings should auto-detect from `netlify.toml` — no changes needed.
4. Before or after the first deploy, go to **Site configuration →
   Environment variables** and add these four (enter the values yourself
   directly in Netlify's UI — never share these in chat, email, or commit
   them to the repo):

   | Key | Value |
   |---|---|
   | `R2_ACCOUNT_ID` | your Cloudflare account ID |
   | `R2_ACCESS_KEY_ID` | from the API token in Step 2 |
   | `R2_SECRET_ACCESS_KEY` | from the API token in Step 2 |
   | `R2_BUCKET_NAME` | `pool-uploads` (or whatever you named it) |

5. Trigger a deploy (or redeploy) after adding the variables so the
   function picks them up.

### Step 4 — Custom domain (optional)

1. Buy a domain from any registrar (Namecheap, Cloudflare Registrar, Google
   Domains successor, etc.) — typically $10-15/year for a `.com`.
2. In Netlify: **Domain settings** → **Add a domain** → enter your domain.
3. Netlify will show you either:
   - A **Netlify DNS** option (simplest — you change your domain's
     nameservers at your registrar to Netlify's, and Netlify manages
     everything), or
   - Specific **A/CNAME records** to add at your registrar if you'd
     rather keep DNS elsewhere.
4. SSL (the padlock/https) is issued automatically and free once DNS
   points correctly — usually within a few minutes to an hour.
5. Once your domain is live, go back to Step 1 and add it to the R2 CORS
   policy's `AllowedOrigins` list (uploads will fail from a new domain
   that isn't allow-listed there).

---

## Updating the dashboard each week

Replace `public/index.html` with your freshly-downloaded "This Week's
Snapshot" file from the dashboard's own download button, keep the filename
`index.html`, commit, and push. Netlify redeploys automatically.

## Where uploaded files end up

Open the `pool-uploads` bucket in the Cloudflare dashboard → **Objects**.
Files are named `uploads/<timestamp>-<sender name>-<original filename>`,
so they sort chronologically and you can tell at a glance who sent what.
