import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || join(__dirname, '..', 'data', 'monty.db');

mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    ign TEXT NOT NULL,
    order_type TEXT NOT NULL,
    item TEXT NOT NULL,
    weight REAL NOT NULL DEFAULT 1,
    notes TEXT,
    customer_discord TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    claimed_by_id TEXT,
    claimed_by_name TEXT,
    claimed_at INTEGER,
    message_id TEXT,
    channel_id TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS staff_stats (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    orders_claimed INTEGER NOT NULL DEFAULT 0,
    total_weight REAL NOT NULL DEFAULT 0
  );
`);

export function createOrder(order) {
  const stmt = db.prepare(`
    INSERT INTO orders (id, ign, order_type, item, weight, notes, customer_discord, created_at)
    VALUES (@id, @ign, @orderType, @item, @weight, @notes, @customerDiscord, @createdAt)
  `);
  stmt.run(order);
}

export function getOrder(id) {
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
}

export function setOrderMessage(id, messageId, channelId) {
  db.prepare('UPDATE orders SET message_id = ?, channel_id = ? WHERE id = ?').run(messageId, channelId, id);
}

export function claimOrder(id, userId, username) {
  const txn = db.transaction(() => {
    const order = getOrder(id);
    if (!order || order.status !== 'open') return null;

    const now = Date.now();
    db.prepare(`
      UPDATE orders
      SET status = 'claimed', claimed_by_id = ?, claimed_by_name = ?, claimed_at = ?
      WHERE id = ?
    `).run(userId, username, now, id);

    const existing = db.prepare('SELECT * FROM staff_stats WHERE user_id = ?').get(userId);
    if (existing) {
      db.prepare(`
        UPDATE staff_stats
        SET username = ?, orders_claimed = orders_claimed + 1, total_weight = total_weight + ?
        WHERE user_id = ?
      `).run(username, order.weight, userId);
    } else {
      db.prepare(`
        INSERT INTO staff_stats (user_id, username, orders_claimed, total_weight)
        VALUES (?, ?, 1, ?)
      `).run(userId, username, order.weight);
    }

    return { ...order, claimed_by_id: userId, claimed_by_name: username, claimed_at: now };
  });

  return txn();
}

export function getLeaderboard(limit = 10) {
  return db
    .prepare(`
      SELECT user_id, username, orders_claimed, total_weight
      FROM staff_stats
      ORDER BY total_weight DESC, orders_claimed DESC
      LIMIT ?
    `)
    .all(limit);
}

export function getStaffStats(userId) {
  return db.prepare('SELECT * FROM staff_stats WHERE user_id = ?').get(userId);
}

export function getOpenOrderCount() {
  return db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'open'").get().count;
}

export default db;
