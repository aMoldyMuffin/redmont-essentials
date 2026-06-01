import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultPath = process.env.CATALOG_PATH || join(__dirname, '..', 'config', 'catalog.json');

const CATALOG_KEY = 'catalog';

let memoryCatalog = null;

function loadDefaultCatalog() {
  return JSON.parse(readFileSync(defaultPath, 'utf8'));
}

export function getCatalog() {
  if (memoryCatalog) return memoryCatalog;

  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(CATALOG_KEY);
  if (row?.value) {
    memoryCatalog = JSON.parse(row.value);
    return memoryCatalog;
  }

  const defaults = loadDefaultCatalog();
  saveCatalog(defaults, { skipMemory: true });
  memoryCatalog = defaults;
  return memoryCatalog;
}

export function saveCatalog(catalog, { skipMemory = false } = {}) {
  const json = JSON.stringify(catalog);
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(CATALOG_KEY, json);
  if (!skipMemory) memoryCatalog = catalog;
  return catalog;
}

export function formatMoney(catalog, amount) {
  const n = Number(amount) || 0;
  if (n <= 0) return 'Quote on request';
  const suffix = catalog.currencySuffix || '';
  return `${catalog.currency || '$'}${n.toLocaleString()}${suffix}`;
}

export function calculateOrderPrice(catalog, orderType, itemText) {
  if (!itemText?.trim()) return { total: 0, display: '—', quotable: true };

  if (orderType === 'Other') {
    return { total: 0, display: 'Quote on request', quotable: true };
  }

  const parts = itemText
    .split(/[,—–-]/)
    .map((p) => p.trim())
    .filter(Boolean);

  let total = 0;
  let matched = 0;
  let hasCustom = false;

  for (const part of parts) {
    const kit = catalog.kits.find((k) => k.id === part || part.includes(k.id));
    if (kit) {
      if (kit.price <= 0) hasCustom = true;
      else total += kit.price;
      matched++;
      continue;
    }

    const cat = catalog.categories.find((c) => c.id === part || part.includes(c.id));
    if (cat) {
      total += cat.price;
      matched++;
    }
  }

  if (orderType === 'Sell Items' && matched > 0) {
    const mult = catalog.pricing?.sellMultiplier ?? 0.8;
    total = Math.round(total * mult);
  }

  if (matched === 0 || hasCustom) {
    return { total: 0, display: 'Quote on request', quotable: true };
  }

  return { total, display: formatMoney(catalog, total), quotable: false };
}

export function buildKitsEmbed(catalog) {
  const lines = catalog.kits.map((k) => {
    const price = k.price > 0 ? formatMoney(catalog, k.price) : 'Quote';
    return `${k.icon} **${k.id}** — ${price}\n${k.shortDesc}`;
  });
  return lines.join('\n\n');
}
