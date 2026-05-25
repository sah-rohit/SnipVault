# 🔮 SnipVault - Your Contextual Snippet Sanctuary

SnipVault is a premium, high-performance Progressive Web App (PWA) designed to seamlessly collect, search, organize, and synchronize your code snippets, bookmarks, recipes, and ideas. 

Engineered for **Visual Excellence** and **Offline Resilience**, SnipVault combines a responsive frontend with a robust, real-time database to offer a premium user experience whether you are online or in the middle of a subway tunnel with zero reception.

---

## ✨ Features & Capabilities

### ⚡ PWA & Seamless Offline Sync
* **Full PWA Experience**: Installable on Desktop, iOS, and Android ("Add to Home Screen") with custom splash screens and standard display capabilities.
* **Smart Asset Caching**: A custom Service Worker caches vital static assets and external stylesheets/SDKs (TailwindCSS, FontAwesome, Google Fonts, Convex SDK) allowing the app to open instantly offline.
* **IndexedDB Browser Database**: When offline, new snippets are saved securely in your browser's local database.
* **Background Sync**: Connection state is tracked automatically (`navigator.onLine`). When internet is restored, local snippets sync in order to the cloud, local cache is cleared, and updates render instantly.
* **Visual Offline UX**: Floating glassmorphic notification banner displaying connection updates and sync states.

### 🛡️ Enterprise-Grade Auth & Email Delivery
* **SMTP Transactional Mail via Brevo**: Highly reliable email dispatch using secure server-side Convex Actions (no client CORS issues or org-sharing blocks).
* **Direct Master Account Modification Panel**: A secure link sent to the inbox bypasses the need for current credentials, allowing users to modify password or change account email.
* **Zero-Enumeration Design**: Secure forgot-password flow prevents user enumeration attacks by returning uniform success regardless of email existence.
* **Conflict-Free Account Merger**: If you change your email to an address that already possesses a SnipVault cloud account, you can confirm a **vault migration merge** which transfers all snippets/categories into the target account in a single database transaction.

### 🎨 Visual & Organizational Excellence
* **HARMONIOUS Glassmorphism UI**: High-fidelity sleek gradients, harmonious HSL tailored dark-mode highlights, and gorgeous micro-animations for tabs, modals, and list items.
* **Real-time Subscriptions**: Instantly updates changes across all active windows and devices via Convex's real-time sync.
* **Active Session Manager**: Audit and revoke login sessions from other devices with one click.
* **Compliance Ready**: Integrated GDPR Data Export utility enabling users to download a structured JSON backup of their profile, categories, and snippets.
* **Safe Countdown Deletion**: A 5-second countdown lock prevents accidental profile purges.

---

## 🛠️ Folder Structure

```
SnipVault/
├── .convex/                # Local Convex backend storage and config
├── convex/
│   ├── _generated/         # Automatically generated typescript files
│   ├── auth.ts             # Auth, profile, session, and migration mutations
│   ├── email.ts            # Secure Brevo SMTP email action
│   ├── schema.ts           # Convex relational database tables and indexes
│   └── snippets.ts         # Create, read, update, delete snippet handlers
├── index.html              # Main Single Page App (SPA) interface
├── script.js               # Client-side routing, IndexedDB logic, and event handlers
├── style.css               # Vanilla CSS custom animations & design system tokens
├── sw.js                   # Custom service worker for asset caching
├── manifest.json           # Web Manifest config for PWA installation
├── config.example.js       # Template file for Convex URL settings
└── .env.local              # Local secrets (API keys) - gitignored
```

---

## 🚀 Top-to-Bottom Setup & Run Guide

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### 2. Clone and Install Dependencies
Open your terminal in the SnipVault directory and run:
```bash
npm install
```

### 3. Setup your Convex Project & Backend
Convex provides the secure database and backend environment. To set it up locally:
1. Initialize the Convex CLI and link your workspace:
   ```bash
   npx convex dev
   ```
2. When prompted:
   * Select `choose an existing project` or create a new one.
   * Choose/Create a project named `SnipVault`.
   * This automatically provisions your development database, spins up the server, and creates a local `.env.local` containing your `CONVEX_DEPLOYMENT` variables.
3. Keep the terminal running or close it (use `--once` to compile once).

### 4. Setup Brevo SMTP Email (For Password Resets & Verification)
1. Register for a free account at [Brevo](https://www.brevo.com/).
2. Navigate to **SMTP & API** -> **API Keys**, click **Generate a new API key**, and copy it.
3. Verify a sender email address (e.g. `yourname@gmail.com`) under **Senders & IPs**.
4. Open the generated `.env.local` in the root of SnipVault and append your secrets:
   ```env
   BREVO_API_KEY="your_xkeysib_api_key_here"
   BREVO_SENDER_EMAIL="your_verified_sender_email_here"
   ```
5. Deploy these environment variables to the Convex server:
   ```bash
   npx convex env set BREVO_API_KEY "your_xkeysib_api_key_here"
   npx convex env set BREVO_SENDER_EMAIL "your_verified_sender_email_here"
   ```

### 5. Setup Local Configuration
1. Make a copy of `config.example.js` and rename it to `config.js` in the root directory:
   ```bash
   cp config.example.js config.js
   ```
2. Open `config.js` and configure your `CONVEX_URL` to match your local or cloud deployment URL (found in `.env.local` or the Convex dashboard):
   ```javascript
   const CONVEX_URL = "https://your-deployment-name.convex.cloud"; // Or local port http://127.0.0.1:3210
   ```

### 6. Run the Application
You can run SnipVault locally using a simple HTTP server (such as VS Code's Live Server extension, `npx serve`, or `python -m http.server`). 
Using `npx`:
```bash
npx serve ./
```
Open the provided local address (e.g., `http://localhost:3000`) in your browser.

---

## 🔒 Security Best Practices

SnipVault is built to be secure and open-source friendly:
1. **Never Commit Secrets**: The `.env.local` and `config.js` files are added to `.gitignore`. Keep your Brevo API key and sender details inside `.env.local` only.
2. **Server-Side Execution**: Emails are handled on secure serverless environments (Convex Actions), never exposing your API credentials or mail logs to the browser console.
3. **Replay Attack Resistance**: All verification and reset tokens are cryptographically complex high-entropy keys, valid for a single transaction only, and deleted on first consume.

---

## 📄 License
© 2026 SnipVault. Licensed under the MIT License. Feel free to fork, modify, and build upon this project!
