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

## Website orders → Monty (Discord bot)

Orders go through **Monty**, your Discord bot — not a webhook. Monty posts orders with a **Claim** button, tracks weighted points, and runs `/leaderboard`.

Full setup guide: [`discord-bot/README.md`](discord-bot/README.md)

### Quick overview

1. **Create Monty** in the [Discord Developer Portal](https://discord.com/developers/applications) and invite to your server
2. **Deploy Monty** on [Railway](https://railway.app) (always-on, free tier works)
3. **Cloudflare variables** (Settings → Variables and Secrets):

| Name | Value |
|------|--------|
| `MONTY_API_URL` | Your Railway URL, e.g. `https://monty-production.up.railway.app` |
| `MONTY_API_SECRET` | Same random secret in Monty's `.env` |
| `ADMIN_SECRET` | Password for `/admin.html` shop editor (optional; defaults to `MONTY_API_SECRET`) |

4. **Redeploy** Cloudflare after saving

## Shared inventory → Eleanor (Discord bot)

**Eleanor** is a separate bot that keeps a live **raw materials ledger** on Discord (Iron, Diamonds, Gold, Netherite). Staff use **Adjust stock** buttons to add/remove counts; everyone sees the updated embed.

Full setup: [`eleanor-bot/README.md`](eleanor-bot/README.md)

### Cloudflare variables for Eleanor admin

| Name | Value |
|------|--------|
| `ELEANOR_API_URL` | Eleanor’s Railway URL |
| `ELEANOR_API_SECRET` | Same secret in Eleanor’s `.env` (or reuse `ADMIN_SECRET`) |

Edit materials and quantities at **`/admin.html`** → **Inventory (Eleanor)** tab.

### Weighted leaderboard

Edit `discord-bot/config/weights.json` to set points per kit/item. Harder orders = more points when staff claims them.

| Command | What it does |
|---------|----------------|
| `/leaderboard` | Top staff by points |
| `/mystats` | Your stats |
| `/orders` | Open orders count |

## Project structure

```
redmont-essentials/
├── index.html
├── order.html
├── functions/api/order.js  # Forwards orders to Monty
├── discord-bot/            # Monty — claims, weights, leaderboard
│   ├── config/weights.json
│   └── src/
├── css/  js/
└── logo.png
```

## Customize content

- **Gear kits & prices** — edit the cards in `index.html`
- **Buy/sell items** — edit the trade tags in `index.html`
- **Colors** — CSS variables at the top of `css/styles.css`

---

Built for Democracy Craft · Redmont Essentials
