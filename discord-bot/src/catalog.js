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

function slugBase(text) {
  return (
    String(text || 'item')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'item'
  );
}

/** Discord select menus require unique option values — separate from display names. */
function assignUniqueKeys(items, prefix) {
  const seen = new Set();
  return items.map((item, index) => {
    let key = typeof item.key === 'string' ? item.key.trim() : '';
    if (!key) key = `${prefix}-${slugBase(item.id)}-${index + 1}`;
    let candidate = key;
    let n = 2;
    while (seen.has(candidate)) {
      candidate = `${key}-${n++}`;
    }
    seen.add(candidate);
    return { ...item, key: candidate };
  });
}

function normalizeCatalog(catalog) {
  const defaults = loadDefaultCatalog();
  if (!catalog || typeof catalog !== 'object') return structuredClone(defaults);

  if (!Array.isArray(catalog.kits) || catalog.kits.length === 0) {
    catalog.kits = defaults.kits;
  }
  if (!Array.isArray(catalog.categories) || catalog.categories.length === 0) {
    catalog.categories = defaults.categories;
  }
  if (!Array.isArray(catalog.orderTypes) || catalog.orderTypes.length === 0) {
    catalog.orderTypes = defaults.orderTypes;
  }
  if (!catalog.kitsSection) catalog.kitsSection = defaults.kitsSection;
  if (!catalog.trade) catalog.trade = defaults.trade;
  if (!catalog.pricing) catalog.pricing = defaults.pricing;
  if (!catalog.currency) catalog.currency = defaults.currency;

  catalog.kits = assignUniqueKeys(catalog.kits, 'kit');
  catalog.categories = assignUniqueKeys(catalog.categories, 'cat');

  return catalog;
}

export function findKit(catalog, keyOrLabel) {
  return catalog.kits.find((k) => k.key === keyOrLabel || k.id === keyOrLabel);
}

export function findCategory(catalog, keyOrLabel) {
  return catalog.categories.find((c) => c.key === keyOrLabel || c.id === keyOrLabel);
}

export function getCatalog() {
  if (memoryCatalog) return memoryCatalog;

  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(CATALOG_KEY);
  if (row?.value) {
    memoryCatalog = normalizeCatalog(JSON.parse(row.value));
    return memoryCatalog;
  }

  const defaults = loadDefaultCatalog();
  saveCatalog(defaults, { skipMemory: true });
  memoryCatalog = defaults;
  return memoryCatalog;
}

export function saveCatalog(catalog, { skipMemory = false } = {}) {
  catalog = normalizeCatalog(catalog);
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
    const kit = catalog.kits.find(
      (k) => k.key === part || k.id === part || part.includes(k.id)
    );
    if (kit) {
      if (kit.price <= 0) hasCustom = true;
      else total += kit.price;
      matched++;
      continue;
    }

    const cat = catalog.categories.find(
      (c) => c.key === part || c.id === part || part.includes(c.id)
    );
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
