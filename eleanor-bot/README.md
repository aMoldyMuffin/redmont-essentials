# Eleanor — Shared Inventory Ledger

**Eleanor** tracks raw material stock on Discord with a live-updating ledger message. Staff use buttons to add or remove stock (Iron, Diamonds, Gold, Netherite by default).

## Features

- **Live ledger embed** in a Discord channel — everyone can see current counts
- **Adjust stock** button flow (like Monty orders): pick material → Add/Remove → enter quantity
- **`/ledger post`** — post or replace the ledger message
- **`/ledger refresh`** — refresh embed counts
- **`/inventory`** — view stock (ephemeral)
- **Website admin** — edit materials and quantities at `/admin.html` → Inventory tab
- **Role-restricted** — only configured roles (or Manage Messages) can use commands and buttons

## Setup

### 1. Create Eleanor in Discord

1. [Discord Developer Portal](https://discord.com/developers/applications) → **New Application** → name it **Eleanor**
2. **Bot** tab → copy token
3. **OAuth2 → URL Generator** → scopes: `bot`, `applications.commands`
   - Permissions: Send Messages, Embed Links, Manage Messages, Read Message History
4. Invite Eleanor to your server (same server as Monty is fine)

### 2. Configure `.env`

```bash
cd eleanor-bot
npm install
```

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Eleanor bot token |
| `DISCORD_CLIENT_ID` | Application ID |
| `DISCORD_GUILD_ID` | Your server ID |
| `INVENTORY_CHANNEL_ID` | Channel for the live ledger (e.g. `#raw-materials`) |
| `ELEANOR_ROLE_IDS` | Comma-separated role IDs allowed to adjust stock (e.g. `123,456`) |
| `ELEANOR_API_SECRET` | Random secret for API + admin panel (e.g. `openssl rand -hex 32`) |
| `ADMIN_SECRET` | Optional; defaults to `ELEANOR_API_SECRET` |
| `DATABASE_PATH` | Optional; use `/data/eleanor.db` on Railway with a volume |

If `ELEANOR_ROLE_IDS` is empty, only members with **Manage Messages** can adjust inventory.

### 3. Run

```bash
npm start
```

On first start, Eleanor posts the ledger to `INVENTORY_CHANNEL_ID` if none exists yet.

### 4. Railway

Deploy with root directory **`eleanor-bot`** (separate service from Monty).

Add a **volume** mounted at `/data` and set `DATABASE_PATH=/data/eleanor.db` so stock survives redeploys.

### 5. Cloudflare Pages (admin panel)

Add environment variables:

| Variable | Value |
|----------|--------|
| `ELEANOR_API_URL` | Eleanor’s public URL (e.g. `https://eleanor-production.up.railway.app`) |
| `ELEANOR_API_SECRET` or `ADMIN_SECRET` | Same secret as Eleanor’s API |

Then open **admin.html** → **Inventory (Eleanor)** tab to edit materials and quantities.

## Discord usage

1. Run **`/ledger post`** in your inventory channel (once, or to reset the message).
2. Pin the ledger message so staff always find it.
3. Click **Adjust stock** → choose material → **Add** or **Remove** → enter amount.
4. The public embed updates instantly for everyone in the channel.

## Default materials

Edit in admin panel or `config/inventory.json`:

- Iron, Diamonds, Gold, Netherite

You can add more materials from the website admin.
