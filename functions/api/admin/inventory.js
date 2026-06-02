/**
 * PUT/POST /api/admin/inventory — update Eleanor inventory (requires ADMIN_SECRET)
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
  const eleanorUrl = env.ELEANOR_API_URL;
  const adminSecret = env.ADMIN_SECRET || env.ELEANOR_API_SECRET;

  if (!eleanorUrl || !adminSecret) {
    return json(
      {
        error:
          'Inventory admin not configured. Set ELEANOR_API_URL and ADMIN_SECRET (or ELEANOR_API_SECRET) in Cloudflare.',
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

  const base = String(eleanorUrl).match(/^https?:\/\//) ? eleanorUrl : `https://${eleanorUrl}`;

  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/admin/inventory`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminSecret}`,
      },
      body: JSON.stringify({ inventory: body.inventory }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return json(
        { error: data.error || 'Eleanor could not save inventory' },
        res.status >= 500 ? 502 : res.status
      );
    }
    return json(data);
  } catch (err) {
    return json({ error: `Could not reach Eleanor. ${err?.message || ''}`.trim() }, 503);
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
