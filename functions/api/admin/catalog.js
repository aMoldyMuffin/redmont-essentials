/**
 * PUT/POST /api/admin/catalog — update shop catalog (requires ADMIN_SECRET)
 */

function json(data, status = 200) {
  return Response.json(data, { status });
}

export async function onRequestPost({ request, env }) {
  return handleUpdate(request, env);
}

export async function onRequestPut({ request, env }) {
  return handleUpdate(request, env);
}

async function handleUpdate(request, env) {
  const montyUrl = env.MONTY_API_URL;
  const adminSecret = env.ADMIN_SECRET || env.MONTY_API_SECRET;

  if (!montyUrl || !adminSecret) {
    return json(
      {
        error:
          'Admin API not configured. Set MONTY_API_URL and ADMIN_SECRET (or MONTY_API_SECRET) in Cloudflare.',
      },
      503
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const auth = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!auth || auth !== adminSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const base = String(montyUrl).match(/^https?:\/\//) ? montyUrl : `https://${montyUrl}`;

  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/admin/catalog`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminSecret}`,
      },
      body: JSON.stringify({ catalog: body.catalog }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return json({ error: data.error || 'Monty could not save catalog' }, res.status >= 500 ? 502 : res.status);
    }
    return json(data);
  } catch (err) {
    return json({ error: `Could not reach Monty. ${err?.message || ''}`.trim() }, 503);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
