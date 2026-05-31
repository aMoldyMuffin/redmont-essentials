/**
 * POST /api/order — forwards website orders to a Discord channel via webhook.
 * Set DISCORD_WEBHOOK_URL in Cloudflare Pages → Settings → Environment variables.
 */

const KITS = new Set([
  'Survival Starter',
  'Adventurer Kit',
  'Builder Bundle',
  'Custom / Other',
]);

const ORDER_TYPES = new Set(['Gear Kit', 'Buy Items', 'Sell Items', 'Other']);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function cleanText(value, maxLen) {
  return String(value || '')
    .trim()
    .slice(0, maxLen)
    .replace(/[\u0000-\u001F\u007F]/g, '');
}

function isValidIgn(ign) {
  return /^[A-Za-z0-9_]{3,16}$/.test(ign);
}

export async function onRequestPost({ request, env }) {
  if (!env.DISCORD_WEBHOOK_URL) {
    return json({ error: 'Orders are not configured yet.' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  if (body.website) {
    return json({ ok: true });
  }

  const ign = cleanText(body.ign, 16);
  const kit = cleanText(body.kit, 40);
  const orderType = cleanText(body.orderType, 24);
  const notes = cleanText(body.notes, 500);
  const discord = cleanText(body.discord, 64);

  if (!isValidIgn(ign)) {
    return json({ error: 'Enter a valid Minecraft username (3–16 characters).' }, 400);
  }

  if (!KITS.has(kit)) {
    return json({ error: 'Please select a valid kit.' }, 400);
  }

  if (!ORDER_TYPES.has(orderType)) {
    return json({ error: 'Please select a valid order type.' }, 400);
  }

  const embed = {
    title: '🛒 New Website Order',
    color: 0xd4af37,
    fields: [
      { name: 'Minecraft IGN', value: ign, inline: true },
      { name: 'Order Type', value: orderType, inline: true },
      { name: 'Kit / Item', value: kit, inline: true },
    ],
    footer: { text: 'Redmont Essentials · Website Order' },
    timestamp: new Date().toISOString(),
  };

  if (discord) {
    embed.fields.push({ name: 'Discord', value: discord, inline: true });
  }

  if (notes) {
    embed.fields.push({ name: 'Notes', value: notes, inline: false });
  }

  const webhookRes = await fetch(`${env.DISCORD_WEBHOOK_URL}?wait=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'Redmont Essentials',
      embeds: [embed],
    }),
  });

  if (!webhookRes.ok) {
    return json({ error: 'Could not send order to Discord. Try again or order on Discord.' }, 502);
  }

  return json({ ok: true, message: 'Order sent! We will contact you in-game or on Discord.' });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
