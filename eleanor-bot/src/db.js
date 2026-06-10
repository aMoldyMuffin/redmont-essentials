import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const dbPath = process.env.DATABASE_PATH || join(__dirname, '..', 'data', 'eleanor.db');

mkdirSync(dirname(dbPath), { recursive: true });
console.log(`Eleanor database: ${dbPath}`);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ledger_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id TEXT NOT NULL,
    delta INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS leaderboard (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'manual',
    updated_at INTEGER NOT NULL
  );
`);

export default db;
