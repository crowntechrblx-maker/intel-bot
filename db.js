require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function get(sql, params = []) {
  const res = await pool.query(sql, params);
  return res.rows[0];
}

async function all(sql, params = []) {
  const res = await pool.query(sql, params);
  return res.rows;
}

async function run(sql, params = []) {
  const res = await pool.query(sql, params);
  return { id: res.rows[0]?.id ?? null, rowCount: res.rowCount };
}

async function initBotSchema() {
  await pool.query(`
    ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS discord_id TEXT UNIQUE;
    ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS verify_token TEXT;
    ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS verify_token_expires TIMESTAMPTZ;

    CREATE TABLE IF NOT EXISTS shift_logs (
      id                SERIAL PRIMARY KEY,
      discord_user_id   TEXT NOT NULL,
      discord_username  TEXT NOT NULL,
      division          TEXT,
      start_time        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      end_time          TIMESTAMPTZ,
      duration_minutes  INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_shift_logs_discord_user ON shift_logs (discord_user_id);
    CREATE INDEX IF NOT EXISTS idx_shift_logs_start_time   ON shift_logs (start_time DESC);
  `);
}

module.exports = { pool, get, all, run, initBotSchema };
