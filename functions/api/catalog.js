/**
 * GET /api/catalog — public shop catalog from Monty
 */

export async function onRequestGet({ env }) {
  const montyUrl = env.MONTY_API_URL;
  if (!montyUrl) {
    return Response.json({ error: 'Catalog unavailable' }, { status: 503 });
  }

  const base = String(montyUrl).match(/^https?:\/\//) ? montyUrl : `https://${montyUrl}`;

  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/catalog`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return Response.json({ error: data.error || 'Could not load catalog' }, { status: 502 });
    }
    return Response.json(data, {
      headers: { 'Cache-Control': 'public, max-age=60' },
    });
  } catch (err) {
    return Response.json(
      { error: `Could not reach Monty. ${err?.message || ''}`.trim() },
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
