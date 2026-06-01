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

function isValidDiscord(value) {
  const v = String(value || '').trim();
  if (v.length < 2 || v.length > 64) return false;
  if (/^\d{17,20}$/.test(v)) return true;
  if (/^<@!?\d{17,20}>$/.test(v)) return true;
  return /^@?[\w.\-]{2,32}$/.test(v);
}

async function verifyTurnstile(token, secret, remoteip) {
  const body = new URLSearchParams();
  body.append('secret', secret);
  body.append('response', token);
  if (remoteip) body.append('remoteip', remoteip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json().catch(() => ({}));
  return Boolean(data.success);
}

export async function onRequestPost({ request, env }) {
  const montyUrl = env.MONTY_API_URL;
  const montySecret = env.MONTY_API_SECRET;

  if (!montyUrl || !montySecret) {
    const missing = [];
    if (!montyUrl) missing.push('MONTY_API_URL');
    if (!montySecret) missing.push('MONTY_API_SECRET');

    return json(
      {
        error:
          `Monty is not connected yet. Staff: set ${missing.join(
            ', '
          )} in Cloudflare (Settings → Variables and Secrets), then redeploy.`,
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

  if (env.TURNSTILE_SECRET_KEY) {
    const token = String(body.turnstileToken || '').trim();
    if (!token) {
      return json({ error: 'Complete the security verification and try again.' }, 403);
    }
    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For');
    const valid = await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY, ip);
    if (!valid) {
      return json({ error: 'Security verification failed. Refresh the page and try again.' }, 403);
    }
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

  if (!isValidDiscord(discord)) {
    return json({ error: 'Enter your Discord username (required so we can contact you).' }, 400);
  }

  const montyBaseUrl = String(montyUrl || '').match(/^https?:\/\//)
    ? String(montyUrl)
    : `https://${String(montyUrl || '')}`;
  const montyEndpoint = `${montyBaseUrl.replace(/\/$/, '')}/api/order`;

  let montyRes;
  try {
    montyRes = await fetch(montyEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${montySecret}`,
      },
    body: JSON.stringify({
      ign,
      orderType,
      item,
      notes,
      discord,
      price: body.price,
      priceDisplay: body.priceDisplay,
      source: 'website',
    }),
  });
  } catch (err) {
    return json(
      {
        error: `Could not reach Monty at ${montyEndpoint}. ${err?.message ? `(${err.message})` : ''}`,
      },
      503
    );
  }

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
