# Push QuantivTrade to GitHub (wunnaken/QuantivTrade)

Your repo is ready: **https://github.com/wunnaken/QuantivTrade**

## 1. Open a terminal in Cursor

- **Keyboard:** Press **Ctrl + `** (backtick, the key above Tab).
- **Or:** Menu **Terminal** → **New Terminal**.

The terminal opens at the bottom. If it’s not in your project folder, type:

```bash
cd g:\quantivtrade
```

and press Enter.

---

## 2. Run these commands (one at a time)

Copy and paste each line, press Enter, then do the next. Use the **“push an existing repository”** block (your project already exists locally).

```bash
git init
git add .
git commit -m "Initial commit - QuantivTrade beta"
git branch -M main
git remote add origin https://github.com/wunnaken/QuantivTrade.git
git push -u origin main
```

---

## 3. If Git asks for login

- **Username:** your GitHub username (e.g. `wunnaken`).
- **Password:** use a **Personal Access Token**, not your GitHub password.
  - GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Generate new token (classic)**.
  - Name it (e.g. “Netlify”), check **repo**, generate, then copy the token and paste it when Git asks for a password.

---

After `git push` succeeds, refresh your GitHub repo page — you should see all your files. Then in Netlify, import from Git and choose **wunnaken/QuantivTrade**.
