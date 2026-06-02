/**
 * GET /api/inventory — public inventory from Eleanor
 */

export async function onRequestGet({ env }) {
  const eleanorUrl = env.ELEANOR_API_URL;
  if (!eleanorUrl) {
    return Response.json({ error: 'Inventory unavailable' }, { status: 503 });
  }

  const base = String(eleanorUrl).match(/^https?:\/\//) ? eleanorUrl : `https://${eleanorUrl}`;

  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/inventory`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return Response.json({ error: data.error || 'Could not load inventory' }, { status: 502 });
    }
    return Response.json(data, {
      headers: { 'Cache-Control': 'public, max-age=30' },
    });
  } catch (err) {
    return Response.json(
      { error: `Could not reach Eleanor. ${err?.message || ''}`.trim() },
      { status: 503 }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
