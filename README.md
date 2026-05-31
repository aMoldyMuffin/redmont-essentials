# Redmont Essentials

Website for **Redmont Essentials** — a Democracy Craft in-game business selling starter gear kits and general goods.

> *Everything you need to get started.*

## What's included

| Part | Description |
|------|-------------|
| **Website** | Modern single-page site with gear kits, order form, buy & sell, and Discord |
| **Order API** | Cloudflare Pages Function posts orders to a Discord channel |
| **Discord bot** | Optional bot with `/shop`, `/kits`, and `/stock` commands |
| **Deploy configs** | Ready for Cloudflare Pages or GitHub Pages |

## Quick start (local preview)

Open the site with any static file server:

```bash
cd redmont-essentials
python3 -m http.server 8080
```

Then visit [http://localhost:8080](http://localhost:8080).

## Configure your site

Edit `js/config.js`:

```js
discordInviteUrl: 'https://discord.gg/YOUR_CODE',
discordGuildId: 'YOUR_SERVER_ID',  // enables live Discord widget
```

## Hosting

### Cloudflare Pages (recommended)

1. Push this folder to a GitHub repo
2. Go to [Cloudflare Dashboard → Pages](https://dash.cloudflare.com/) → **Create** → **Pages** → **Connect to Git**
3. Select your repo and use these settings exactly:

| Setting | Value |
|---------|--------|
| **Production branch** | `main` |
| **Framework preset** | None |
| **Build command** | *(leave empty — do not use `npx wrangler deploy`)* |
| **Build output directory** | `.` or `/` |

4. Deploy — your site goes live at `*.pages.dev`

> **Important:** This is a static HTML site. If Cloudflare shows a "Deploy command" of `npx wrangler deploy`, remove it — that is for Workers, not Pages. Go to **Settings → Builds & deployments** and clear the build/deploy command.

To deploy manually:

```bash
npx wrangler pages deploy . --project-name=redmont-essentials
```

### GitHub Pages

1. Push to GitHub
2. Settings → Pages → Source: **GitHub Actions**
3. The included workflow (`.github/workflows/deploy.yml`) deploys on push to `main`

Your site will be at `https://YOUR_USERNAME.github.io/redmont-essentials/`.

> **Note:** If using a project site (not user site), update asset paths or use a custom domain.

## Website orders → Discord

Customers can submit orders on the site. A **Cloudflare Pages Function** (`functions/api/order.js`) sends each order to a Discord channel. **You do not need a bot running for this** — a Discord webhook is enough.

### 1. Create a Discord webhook

1. In Discord, open the **orders channel** (create one like `#website-orders`)
2. Click the gear icon → **Integrations** → **Webhooks** → **New Webhook**
3. Name it `Redmont Essentials Orders`
4. **Copy Webhook URL** (keep this secret)

### 2. Add it to Cloudflare

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → your Pages project
2. **Settings** → **Environment variables**
3. Add a variable:
   - **Name:** `DISCORD_WEBHOOK_URL`
   - **Value:** your webhook URL
4. Save, then **Deployments** → **Retry deployment** (needed so the function picks up the variable)

### 3. Test

1. Open your live site → **Order** section
2. Submit a test order with your Minecraft username
3. Check your Discord orders channel — you should see an embed within a few seconds

> **Note:** Orders only work on **Cloudflare Pages** (not plain GitHub Pages or local preview), because the `/api/order` endpoint runs as a Cloudflare Function.

### Optional: full Discord bot

The bot in `discord-bot/` is separate — useful for `/shop`, `/kits`, and `/stock` commands. Order posting uses the webhook above and does not require the bot to be online.

## Discord bot setup

The bot lives in `discord-bot/` and connects your Discord server to the business.

### 1. Create a Discord application

1. [Discord Developer Portal](https://discord.com/developers/applications) → New Application
2. **Bot** tab → Add Bot → copy the token
3. **OAuth2 → URL Generator** → scopes: `bot`, `applications.commands` → permissions: Send Messages, Embed Links
4. Invite the bot to your server

### 2. Configure

```bash
cd discord-bot
cp .env.example .env
# Fill in DISCORD_TOKEN, DISCORD_GUILD_ID, DISCORD_CLIENT_ID
npm install
npm start
```

### 3. Commands

| Command | Description |
|---------|-------------|
| `/shop` | Shop info + website link |
| `/kits` | Lists gear kits |
| `/stock` | Staff-only stock update (posts to configured channel) |

### Hosting the bot

The bot needs a always-on Node process. Free/cheap options:

- **Railway** or **Render** — deploy the `discord-bot` folder
- **A VPS** — run with `pm2` or systemd
- **Your PC** — fine for testing with `npm start`

## Future upgrades

1. **Live stock feed** — Cloudflare KV + bot `/stock` command
2. **Order status** — bot reacts to orders or DMs customers when ready
3. **Price list** — JSON or API synced from in-game shop data

## Project structure

```
redmont-essentials/
├── index.html              # Main page + order form
├── css/styles.css
├── js/
│   ├── config.js
│   └── main.js
├── functions/api/order.js  # Posts orders to Discord (Cloudflare only)
├── logo.png
├── discord-bot/            # Optional slash-command bot
├── wrangler.toml
└── .github/workflows/
```

## Customize content

- **Gear kits & prices** — edit the cards in `index.html`
- **Buy/sell items** — edit the trade tags in `index.html`
- **Colors** — CSS variables at the top of `css/styles.css`

---

Built for Democracy Craft · Redmont Essentials
