import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = process.env.WEIGHTS_PATH || join(__dirname, '..', 'config', 'weights.json');

let weights = JSON.parse(readFileSync(configPath, 'utf8'));

export function reloadWeights() {
  weights = JSON.parse(readFileSync(configPath, 'utf8'));
}

export function calculateOrderWeight(orderType, itemText) {
  if (!itemText) return weights.defaultWeight;

  let total = 0;
  let matched = 0;
  const parts = itemText.split(/[,—–-]/).map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    const kitWeight = weights.kits[part];
    if (kitWeight !== undefined) {
      total += kitWeight;
      matched++;
      continue;
    }

    const catWeight = weights.categories[part];
    if (catWeight !== undefined) {
      total += catWeight;
      matched++;
      continue;
    }

    for (const [name, w] of Object.entries({ ...weights.kits, ...weights.categories })) {
      if (part.toLowerCase().includes(name.toLowerCase())) {
        total += w;
        matched++;
        break;
      }
    }
  }

  if (matched === 0) total = weights.defaultWeight;

  if (orderType === 'Sell Items') {
    total = Math.round(total * (weights.sellMultiplier || 1) * 10) / 10;
  }

  return Math.max(total, weights.defaultWeight);
}

export function getWeightBreakdown(orderType, itemText) {
  const weight = calculateOrderWeight(orderType, itemText);
  return { weight, config: weights };
}
