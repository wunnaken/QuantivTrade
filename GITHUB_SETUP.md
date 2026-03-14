# Get Xchange on GitHub so Netlify can see it

Netlify shows "no repositories" when it can't see any repos in your GitHub account. Do one of the following.

---

## Option A: You don't have Git installed yet

1. **Install Git for Windows**  
   - Download: https://git-scm.com/download/win  
   - Run the installer (defaults are fine).  
   - Close and reopen your terminal/VS Code so it picks up Git.

2. Then follow **Option B** below to create the repo and push.

---

## Option B: Create a GitHub repo and push Xchange

### 1. Create a new repo on GitHub

1. Go to **https://github.com/new** (log in if needed).
2. **Repository name:** `xchange` (or any name you like).
3. Choose **Private** or **Public**.
4. **Do not** check "Add a README" or "Add .gitignore" — leave the repo empty.
5. Click **Create repository**.

### 2. Push your project from your computer

Open a terminal in your project folder (e.g. `g:\xchange` in PowerShell or Command Prompt, or the integrated terminal in VS Code/Cursor).

Run these commands **one at a time** (replace `YOUR_USERNAME` with your GitHub username):

```bash
git init
git add .
git commit -m "Initial commit - Xchange beta"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/xchange.git
git push -u origin main
```

When Git asks for credentials, use your GitHub username and a **Personal Access Token** (not your GitHub password):

- GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token**.
- Give it a name, check **repo**, then generate and copy the token.
- When Git asks for password, paste that token.

### 3. Refresh Netlify

1. Go back to **Netlify** → **Add new site** → **Import an existing project**.
2. Choose **GitHub** and authorize if asked.
3. Your **xchange** repo should now appear in the list.
4. Click it, confirm build settings (or use the `netlify.toml` in the repo), then **Deploy**.

---

## Option C: Upload without Git (GitHub website)

If you prefer not to use the command line:

1. Go to **https://github.com/new** and create a new repo named `xchange` (empty, no README).
2. On the new repo page, click **"uploading an existing file"** (or the **Add file** dropdown → **Upload files**).
3. Open your `g:\xchange` folder in File Explorer. Select **all files and folders** (including `app`, `components`, `package.json`, `netlify.toml`, etc.).  
   - Do **not** upload `node_modules` or `.next` — if you see them, leave them unchecked.
4. Drag and drop the selected items into the GitHub upload area (or choose them).
5. Add a commit message and click **Commit changes**.
6. In **Netlify**, try **Import from Git** again; the **xchange** repo should now show up.

---

## If the repo exists but Netlify still shows no repositories

1. On GitHub, go to **Settings** → **Applications** → **Installed GitHub Apps**.
2. Find **Netlify** and click **Configure**.
3. Under **Repository access**, choose **All repositories** or select **xchange**.
4. Save, then in Netlify try importing again (you may need to disconnect and reconnect GitHub).
