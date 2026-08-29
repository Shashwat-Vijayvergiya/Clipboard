# QuickClip ⚡ — Fast 4-Digit Clipboard Sharing

Lightning-fast real-time clipboard sharing with auto-expiration (1 min, 5 min, 10 min), ready for local development and **1-click Vercel + Upstash Redis deployment**.

---

## 🚀 Deploying to Vercel in 3 Easy Steps

### Step 1: Push Code to GitHub
Push this repository to your GitHub account:
```bash
git init
git add .
git commit -m "Initial commit for QuickClip"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

### Step 2: Import into Vercel
1. Go to [vercel.com/new](https://vercel.com/new).
2. Select your GitHub repository and click **Deploy**.

### Step 3: Connect Free Upstash Redis (1-Click)
1. In your Vercel Project Dashboard, navigate to the **Storage** tab.
2. Click **Connect Database** $\to$ Select **Upstash Redis** (or **Vercel KV**).
3. Click **Create** (Free tier: 10,000 commands/day).
4. Select your project and click **Connect**.
5. Vercel will automatically inject `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
6. Click **Redeploy** on Vercel, and your app is live worldwide with zero maintenance!

---

## 💻 Local Development

```bash
npm install
npm start
```
Open **`http://localhost:3000`** in your browser.
*(Local dev automatically uses an in-memory store if Redis credentials are not configured).*
