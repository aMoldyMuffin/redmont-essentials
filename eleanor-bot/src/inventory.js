import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import db from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultPath = process.env.INVENTORY_PATH || join(__dirname, '..', 'config', 'inventory.json');

const INVENTORY_KEY = 'inventory';
const LEDGER_MESSAGE_KEY = 'ledger_message';
const LEDGER_CHANNEL_KEY = 'ledger_channel';

let memoryInventory = null;

function loadDefaultInventory() {
  return JSON.parse(readFileSync(defaultPath, 'utf8'));
}

function slugId(label) {
  return String(label || 'material')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 32) || 'material';
}

function normalizeMaterial(m, index) {
  const label = String(m.label || m.id || 'Material').trim();
  return {
    id: slugId(m.id || label),
    label,
    emoji: String(m.emoji || '📦').trim() || '📦',
    quantity: Math.max(0, Math.floor(Number(m.quantity) || 0)),
    sortOrder: Number.isFinite(m.sortOrder) ? m.sortOrder : index,
  };
}

export function normalizeInventory(data) {
  const defaults = loadDefaultInventory();
  if (!data || typeof data !== 'object') return structuredClone(defaults);

  const materials = (Array.isArray(data.materials) && data.materials.length
    ? data.materials
    : defaults.materials
  ).map(normalizeMaterial);

  materials.sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    title: String(data.title || defaults.title).trim() || defaults.title,
    subtitle: String(data.subtitle || defaults.subtitle).trim() || defaults.subtitle,
    materials,
  };
}

export function getInventory() {
  if (memoryInventory) return memoryInventory;

  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(INVENTORY_KEY);
  if (row?.value) {
    memoryInventory = normalizeInventory(JSON.parse(row.value));
    return memoryInventory;
  }

  const defaults = loadDefaultInventory();
  saveInventory(defaults, { skipMemory: true });
  memoryInventory = normalizeInventory(defaults);
  return memoryInventory;
}

export function saveInventory(inventory, { skipMemory = false } = {}) {
  inventory = normalizeInventory(inventory);
  const json = JSON.stringify(inventory);
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(INVENTORY_KEY, json);
  if (!skipMemory) memoryInventory = inventory;
  return inventory;
}

export function getLedgerMessageIds() {
  const msg = db.prepare('SELECT value FROM settings WHERE key = ?').get(LEDGER_MESSAGE_KEY);
  const ch = db.prepare('SELECT value FROM settings WHERE key = ?').get(LEDGER_CHANNEL_KEY);
  return {
    messageId: msg?.value || null,
    channelId: ch?.value || null,
  };
}

export function setLedgerMessageIds(channelId, messageId) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(LEDGER_CHANNEL_KEY, String(channelId));
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(LEDGER_MESSAGE_KEY, String(messageId));
}

export function getMaterial(materialId) {
  return getInventory().materials.find((m) => m.id === materialId) || null;
}

export function adjustMaterial(materialId, delta, userId, username) {
  const inventory = getInventory();
  const index = inventory.materials.findIndex((m) => m.id === materialId);
  if (index < 0) return { error: 'unknown_material' };

  const amount = Math.floor(Number(delta));
  if (!Number.isFinite(amount) || amount === 0) return { error: 'invalid_amount' };

  const current = inventory.materials[index].quantity;
  const next = current + amount;
  if (next < 0) return { error: 'insufficient_stock', current, requested: amount };

  inventory.materials[index] = { ...inventory.materials[index], quantity: next };
  saveInventory(inventory);

  db.prepare(`
    INSERT INTO ledger_log (material_id, delta, quantity_after, user_id, username, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(materialId, amount, next, userId, username, Date.now());

  return {
    ok: true,
    material: inventory.materials[index],
    delta: amount,
    previous: current,
  };
}

export function setMaterialQuantity(materialId, quantity) {
  const inventory = getInventory();
  const index = inventory.materials.findIndex((m) => m.id === materialId);
  if (index < 0) return null;

  inventory.materials[index] = {
    ...inventory.materials[index],
    quantity: Math.max(0, Math.floor(Number(quantity) || 0)),
  };
  saveInventory(inventory);
  return inventory.materials[index];
}

export function getRecentLog(limit = 1) {
  return db
    .prepare(`
      SELECT material_id, delta, quantity_after, username, created_at
      FROM ledger_log
      ORDER BY id DESC
      LIMIT ?
    `)
    .all(limit);
}

export function formatQuantity(n) {
  return Math.floor(Number(n) || 0).toLocaleString('en-US');
}

export function buildLedgerEmbed(inventory = getInventory(), lastChange = null) {
  const lines = inventory.materials.map(
    (m) => `${m.emoji} **${m.label}** — \`${formatQuantity(m.quantity)}\``
  );

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle(`📦 ${inventory.title}`)
    .setDescription([inventory.subtitle, '', ...lines].join('\n'))
    .setTimestamp();

  if (lastChange) {
    const sign = lastChange.delta > 0 ? '+' : '';
    const mat = getMaterial(lastChange.material_id) || { label: lastChange.material_id, emoji: '📦' };
    embed.setFooter({
      text: `Last: ${sign}${lastChange.delta} ${mat.label} by ${lastChange.username}`,
    });
  } else {
    embed.setFooter({ text: 'Eleanor · Shared Inventory Ledger' });
  }

  return embed;
}

export function buildLedgerControlsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('eleanor_inv:adjust')
      .setLabel('Adjust stock')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📋')
  );
}

export function buildMaterialSelectRow(inventory = getInventory()) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('eleanor_inv:material')
      .setPlaceholder('Choose a material')
      .addOptions(
        inventory.materials.map((m) => ({
          label: m.label,
          value: m.id,
          description: `Current: ${formatQuantity(m.quantity)}`.slice(0, 100),
          emoji: m.emoji,
        }))
      )
  );
}

export function buildActionRow(materialId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`eleanor_inv:add:${materialId}`)
      .setLabel('Add')
      .setStyle(ButtonStyle.Success)
      .setEmoji('➕'),
    new ButtonBuilder()
      .setCustomId(`eleanor_inv:sub:${materialId}`)
      .setLabel('Remove')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('➖')
  );
}

export async function refreshLedgerMessage(client, lastChange = null) {
  const { channelId, messageId } = getLedgerMessageIds();
  if (!channelId || !messageId) return false;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) return false;
    const message = await channel.messages.fetch(messageId);
    await message.edit({
      embeds: [buildLedgerEmbed(getInventory(), lastChange)],
      components: [buildLedgerControlsRow()],
    });
    return true;
  } catch (err) {
    console.warn('Could not refresh ledger message:', err.message);
    return false;
  }
}

export async function postLedgerMessage(client, channelId) {
  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased()) {
    throw new Error('Channel not found or not text-based');
  }

  const message = await channel.send({
    embeds: [buildLedgerEmbed()],
    components: [buildLedgerControlsRow()],
  });

  setLedgerMessageIds(channel.id, message.id);
  return message;
}
