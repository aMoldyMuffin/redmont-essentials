import { createServer } from 'node:http';
import { processWebsiteOrder } from './orders.js';

export function startApiServer(client, { port, secret, ordersChannelId }) {
  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== 'POST' || req.url !== '/api/order') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    let body = '';
    for await (const chunk of req) body += chunk;

    let data;
    try {
      data = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    const authHeader = req.headers.authorization?.replace('Bearer ', '');
    const providedSecret = authHeader || data.secret;
    if (!secret || providedSecret !== secret) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    if (data.website) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    const ign = String(data.ign || '').trim();
    const orderType = String(data.orderType || '').trim();
    const item = String(data.item || data.kit || '').trim();

    if (!/^[A-Za-z0-9_]{3,16}$/.test(ign)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid Minecraft username.' }));
      return;
    }

    if (!orderType || !item) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing order details.' }));
      return;
    }

    try {
      const result = await processWebsiteOrder(client, ordersChannelId, {
        ign,
        orderType,
        item,
        notes: data.notes,
        discord: data.discord,
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          message: 'Order sent! Staff will claim it on Discord.',
          orderId: result.id,
        })
      );
    } catch (err) {
      console.error('Order API error:', err);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Could not post order to Discord.' }));
    }
  });

  server.listen(port, () => {
    console.log(`Monty order API listening on port ${port}`);
  });

  return server;
}
