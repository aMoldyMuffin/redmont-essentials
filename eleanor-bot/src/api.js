import { createServer } from 'node:http';
import {
  getInventory,
  saveInventory,
  refreshLedgerMessage,
  getLedgerMessageIds,
} from './inventory.js';

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

export function startApiServer(client, { port, secret, adminSecret }) {
  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url?.split('?')[0];

    if (req.method === 'GET' && (url === '/' || url === '/health')) {
      json(res, { ok: true, service: 'eleanor' });
      return;
    }

    if (req.method === 'GET' && url === '/api/inventory') {
      const inventory = getInventory();
      const ledger = getLedgerMessageIds();
      json(res, {
        ok: true,
        inventory,
        ledger: {
          channelId: ledger.channelId,
          messageId: ledger.messageId,
        },
      });
      return;
    }

    if (url === '/api/admin/inventory' && (req.method === 'PUT' || req.method === 'POST')) {
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

      if (!data.inventory || typeof data.inventory !== 'object') {
        json(res, { error: 'Missing inventory object' }, 400);
        return;
      }

      saveInventory(data.inventory);
      refreshLedgerMessage(client).catch((err) =>
        console.warn('Ledger refresh after admin save:', err.message)
      );

      json(res, { ok: true, inventory: getInventory() });
      return;
    }

    json(res, { error: 'Not found' }, 404);
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`Eleanor API listening on port ${port}`);
  });

  return server;
}
