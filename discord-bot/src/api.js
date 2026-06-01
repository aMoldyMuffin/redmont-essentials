import { createServer } from 'node:http';
import { getCatalog, saveCatalog } from './catalog.js';
import { processWebsiteOrder } from './orders.js';

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body;
}

function checkSecret(req, data, secret) {
  const authHeader = req.headers.authorization?.replace('Bearer ', '');
  const providedSecret = authHeader || data?.secret;
  return secret && providedSecret === secret;
}

export function startApiServer(client, { port, secret, adminSecret, ordersChannelId }) {
  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url?.split('?')[0];

    if (req.method === 'GET' && (url === '/' || url === '/health')) {
      json(res, { ok: true, service: 'monty' });
      return;
    }

    if (req.method === 'GET' && url === '/api/catalog') {
      json(res, { ok: true, catalog: getCatalog() });
      return;
    }

    if (url === '/api/admin/catalog' && (req.method === 'PUT' || req.method === 'POST')) {
      const body = await readBody(req);
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        json(res, { error: 'Invalid JSON' }, 400);
        return;
      }

      const adminKey = adminSecret || secret;
      if (!checkSecret(req, data, adminKey)) {
        json(res, { error: 'Unauthorized' }, 401);
        return;
      }

      if (!data.catalog || typeof data.catalog !== 'object') {
        json(res, { error: 'Missing catalog object' }, 400);
        return;
      }

      saveCatalog(data.catalog);
      json(res, { ok: true, catalog: getCatalog() });
      return;
    }

    if (req.method !== 'POST' || url !== '/api/order') {
      json(res, { error: 'Not found' }, 404);
      return;
    }

    const body = await readBody(req);
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      json(res, { error: 'Invalid JSON' }, 400);
      return;
    }

    if (!checkSecret(req, data, secret)) {
      json(res, { error: 'Unauthorized' }, 401);
      return;
    }

    if (data.website) {
      json(res, { ok: true });
      return;
    }

    const ign = String(data.ign || '').trim();
    const orderType = String(data.orderType || '').trim();
    const item = String(data.item || data.kit || '').trim();

    if (!/^[A-Za-z0-9_]{3,16}$/.test(ign)) {
      json(res, { error: 'Invalid Minecraft username.' }, 400);
      return;
    }

    if (!orderType || !item) {
      json(res, { error: 'Missing order details.' }, 400);
      return;
    }

    try {
      const result = await processWebsiteOrder(client, ordersChannelId, {
        ign,
        orderType,
        item,
        notes: data.notes,
        discord: data.discord,
        price: data.price,
        priceDisplay: data.priceDisplay,
        source: data.source || 'website',
      });

      json(res, {
        ok: true,
        message: 'Order sent! Staff will claim it on Discord.',
        orderId: result.id,
      });
    } catch (err) {
      console.error('Order API error:', err);
      json(res, { error: 'Could not post order to Discord.' }, 502);
    }
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`Monty order API listening on port ${port}`);
  });

  return server;
}
