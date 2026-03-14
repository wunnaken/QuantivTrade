# Shareable beta link – Xchange

Ways to get a link you can share so others can use your beta.

---

## Option 1: Vercel (recommended)

Vercel runs Next.js very well and gives you a free HTTPS URL.

1. **Push your code to GitHub** (if you haven’t already):
   - Create a repo at [github.com/new](https://github.com/new).
   - In your project folder: `git init`, `git add .`, `git commit -m "Initial commit"`, then add the remote and push.

2. **Deploy on Vercel**:
   - Go to [vercel.com](https://vercel.com) and sign in with GitHub.
   - Click **Add New → Project** and import your Xchange repo.
   - Leave the defaults (Framework: Next.js) and click **Deploy**.
   - When it finishes, you get a URL like `xchange-xxx.vercel.app` – that’s your **shareable beta link**.

3. **Environment variables** (for live market/news):
   - In the Vercel project: **Settings → Environment Variables**.
   - Add `FINNHUB_API_KEY` and `NEWS_API_KEY` (same values as in your `.env.local`) so the tickers and news work in production.

4. **Updates**: Push to the same branch (e.g. `main`); Vercel will redeploy and your link will show the latest version.

---

## Option 2: Netlify

### Connect GitHub (“Configure Netlify on GitHub”)

When Netlify says **Configure Netlify on GitHub**:

1. Click **Configure Netlify on GitHub** (or the button that sends you to GitHub).
2. You’ll be on **GitHub** asking to install the **Netlify** app:
   - Choose the **account** that owns your Xchange repo (your user or an organization).
   - Under “Repository access”, choose:
     - **All repositories**, or  
     - **Only select repositories** → pick the repo where Xchange lives.
   - Click **Install** (or **Save**).
3. You’ll be sent back to **Netlify**. The list of repos should refresh.
4. Select your **Xchange repo** and continue.

### Build and deploy

5. Netlify will use the **`netlify.toml`** in the repo (build: `npm run build`, publish: `.next`). You can leave the defaults or confirm they match.
6. Before the first deploy, add **environment variables**:
   - **Site settings** → **Environment variables** → **Add a variable** (or **Edit settings** → **Environment**).
   - Add `FINNHUB_API_KEY` and `NEWS_API_KEY` with the same values as in your `.env.local`.
7. Click **Deploy site** (or trigger a deploy). When it finishes, use the URL Netlify gives you (e.g. `something.netlify.app`) as your **shareable beta link**.

### If the deploy fails

- Ensure **Node version** is 20 (set in `netlify.toml` or in Netlify: **Build & deploy** → **Environment** → **Node version**).
- For Next.js, you can install the **Essential Next.js** plugin: **Site configuration** → **Build & deploy** → **Plugins** → **Add plugin** → search “Next.js” and add it.

---

## Option 3: Quick local share (ngrok)

Only for short demos; your laptop must stay on and the app running.

1. Install [ngrok](https://ngrok.com/download).
2. Run your app: `npm run dev`.
3. In another terminal: `ngrok http 3000`.
4. Use the HTTPS URL ngrok prints (e.g. `https://abc123.ngrok.io`) as your shareable link. It stops when you close ngrok or the dev server.

---

**Summary:** For a stable beta link, use **Vercel**: connect GitHub, deploy, add env vars, and share the `*.vercel.app` URL.
