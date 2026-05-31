/**
 * POST /api/order — forwards to Monty bot API
 * Set MONTY_API_URL and MONTY_API_SECRET in Cloudflare Variables and Secrets
 */

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
  const montyUrl = env.MONTY_API_URL;
  const montySecret = env.MONTY_API_SECRET;

  if (!montyUrl || !montySecret) {
    return json(
      {
        error:
          'Monty is not connected yet. Staff: deploy the bot and set MONTY_API_URL + MONTY_API_SECRET in Cloudflare.',
      },
      503
    );
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
  const item = cleanText(body.item || body.kit, 200);
  const orderType = cleanText(body.orderType, 24);
  const notes = cleanText(body.notes, 500);
  const discord = cleanText(body.discord, 64);

  if (!isValidIgn(ign)) {
    return json({ error: 'Enter a valid Minecraft username (3–16 characters).' }, 400);
  }

  if (!ORDER_TYPES.has(orderType)) {
    return json({ error: 'Please select a valid order type.' }, 400);
  }

  if (!item) {
    return json({ error: 'Please select or describe what you need.' }, 400);
  }

  const montyRes = await fetch(`${montyUrl.replace(/\/$/, '')}/api/order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${montySecret}`,
    },
    body: JSON.stringify({ ign, orderType, item, notes, discord }),
  });

  const data = await montyRes.json().catch(() => ({}));

  if (!montyRes.ok) {
    return json(
      { error: data.error || 'Monty could not process the order. Try Discord instead.' },
      montyRes.status >= 500 ? 502 : montyRes.status
    );
  }

  return json({
    ok: true,
    message: data.message || 'Order sent! Staff will claim it on Discord.',
    orderId: data.orderId,
  });
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
