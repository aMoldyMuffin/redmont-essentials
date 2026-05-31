# Redmont Essentials

Website for **Redmont Essentials** — a Democracy Craft in-game business selling starter gear kits and general goods.

> *Everything you need to get started.*

## What's included

| Part | Description |
|------|-------------|
| **Website** | Modern single-page site with Gear Kits, Buy & Sell, About, and Discord sections |
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

Easiest path if you want to add **dynamic features later** (API routes via Cloudflare Workers).

1. Push this folder to a GitHub repo
2. Go to [Cloudflare Dashboard → Pages](https://dash.cloudflare.com/) → Create project → Connect Git
3. Build settings:
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/` (root)
4. Deploy — your site goes live at `*.pages.dev`

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

## Website ↔ Discord integration (roadmap)

The current site is static. The bot is the first bridge. Future upgrades:

1. **Live stock feed** — Cloudflare Worker API + bot `/stock` command writes to KV storage; website reads it
2. **Order tickets** — Discord ticket bot linked from site buttons
3. **Price list** — JSON file or API synced from in-game shop data

## Project structure

```
redmont-essentials/
├── index.html          # Main page
├── css/styles.css      # Styles & animations
├── js/
│   ├── config.js       # Your Discord URL, guild ID, etc.
│   └── main.js         # Nav, scroll reveal, widget loader
├── logo.png            # Your business logo
├── discord-bot/        # Optional Discord bot
├── wrangler.toml       # Cloudflare Pages config
└── .github/workflows/  # GitHub Pages deploy
```

## Customize content

- **Gear kits & prices** — edit the cards in `index.html`
- **Buy/sell items** — edit the trade tags in `index.html`
- **Colors** — CSS variables at the top of `css/styles.css`

---

Built for Democracy Craft · Redmont Essentials
