# Monty — Redmont Essentials Discord Bot

**Monty** handles website orders, staff claims, weighted scoring, and leaderboards.

## Features

- Website orders post to your Discord orders channel
- **Claim Order** button for staff → optional **private ticket channel** per order (Tickety-style)
- **Transcripts & bot log** — HTML transcript on close + open/close events in a staff log channel
- **Weighted points** — harder items = more leaderboard points
- `/leaderboard` — top staff by points
- `/mystats` — your claim stats
- `/orders` — open order count

## Setup

### 1. Create Monty in Discord

1. [Discord Developer Portal](https://discord.com/developers/applications) → **New Application** → name it **Monty**
2. **Bot** tab → **Add Bot** → copy token
3. Enable **Server Members Intent** (required for claim DMs by username lookup and staff role checks)
4. **OAuth2 → URL Generator** → scopes: `bot`, `applications.commands`
   - Permissions: Send Messages, Embed Links, Use External Emojis
5. Invite Monty to your Redmont Essentials server

### 2. Configure `.env`

```bash
cd discord-bot
cp .env.example .env
npm install
```

Fill in:
- `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`
- `ORDERS_CHANNEL_ID` — right-click your `#website-orders` channel → Copy ID
- `STAFF_ROLE_ID` — role that can claim orders (optional if staff have Manage Messages)
- `TICKET_CATEGORY_ID` — category for private order tickets when staff claim (optional)
- `BOT_LOG_CHANNEL_ID` — staff channel for ticket opened/closed events (optional)
- `TRANSCRIPT_CHANNEL_ID` — channel for HTML transcripts on close (optional; defaults to bot log channel)
- `MONTY_API_SECRET` — long random string (e.g. `openssl rand -hex 32`)
- `ADMIN_SECRET` — optional; for `/admin.html` catalog editor (defaults to `MONTY_API_SECRET`)
- `WEBSITE_URL` — your Cloudflare Pages URL

### 3. Run locally (testing)

```bash
npm start
```

### 4. Deploy Monty (always-on)

Monty must run 24/7 to receive orders and handle claim buttons.

**Important — persistent database (fixes “order not found” when claiming):**

Railway’s disk is wiped on redeploy unless you add a volume. Without it, orders post to Discord but **Claim** fails after a restart.

1. Railway → your Monty service → **Volumes** → Add volume (e.g. mount `/data`)
2. Variables → `DATABASE_PATH` = `/data/monty.db`
3. Redeploy

Also run **only one** Monty instance (don’t `npm start` locally while Railway is online with the same bot token).

**Railway (recommended, free tier):**
1. [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Set root directory to `discord-bot`
3. Add all `.env` variables in Railway **Variables**
4. Railway gives you a public URL like `https://monty-production.up.railway.app`

### 5. Connect Cloudflare to Monty

In Cloudflare Pages → **Settings → Variables and Secrets**:

| Name | Value |
|------|--------|
| `MONTY_API_URL` | `https://your-monty-url.railway.app` |
| `MONTY_API_SECRET` | same secret as in Monty's `.env` |

Remove `DISCORD_WEBHOOK_URL` if you added it — Monty replaces the webhook.

**Redeploy** Cloudflare after saving.

## Item weights

Edit `config/weights.json` to tune points:

| Item | Default pts |
|------|-------------|
| Survival Starter | 1 |
| Adventurer Kit | 3 |
| Builder Bundle | 2 |
| Ores & Ingots | 3 |
| Farming Goods | 1 |
| Sell orders | ×1.25 multiplier |

Restart Monty after changing weights.

## Commands

| Command | Who can use |
|---------|-------------|
| `/order` | **Everyone** — place an order |
| `/leaderboard`, `/mystats`, `/orders`, `/shop`, `/kits` | **Staff only** — role needs **Manage Messages** |

## How claiming works

1. Customer submits order (website or `/order`) with Minecraft IGN + Discord username
2. Monty posts embed in `#website-orders` with **Claim Order** button
3. Staff clicks Claim → order assigned, points added, embed updates
4. If **`TICKET_CATEGORY_ID`** is set, Monty opens a **private ticket channel** (customer + claimer only, like Tickety)
5. Monty **DMs the customer** with a link to the ticket (needs Server Members Intent)

### Ticket channels (optional)

1. In Discord, create a category (e.g. `Orders`) and hide it from `@everyone` if you want tickets fully private.
2. Copy the category ID (Developer Mode → right‑click category → Copy ID).
3. On Railway, set **`TICKET_CATEGORY_ID`** to that ID and redeploy.
4. Monty needs **Manage Channels** and **View Channel** in that category.

Customers must use a Discord username that matches someone **in your server** (or mention format from `/order`) so Monty can add them to the channel.

### Transcripts & bot log (Tickety-style)

When tickets are enabled, you can log activity like Tickety:

1. Create `#ticket-logs` (staff-only) and optionally `#transcripts` (staff-only).
2. On Railway, set:
   - **`BOT_LOG_CHANNEL_ID`** — Monty posts when a ticket **opens** or **closes**
   - **`TRANSCRIPT_CHANNEL_ID`** — Monty posts an **HTML transcript** when a ticket closes (if omitted, transcripts go to the bot log channel)
3. Monty needs **Send Messages**, **Embed Links**, and **Attach Files** in those channels.

On close, Monty saves every message from the ticket channel into a downloadable `.html` file before deleting the channel.

Points = sum of item weights from `config/weights.json`.
