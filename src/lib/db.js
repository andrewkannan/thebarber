import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Disable ssl requirement for local, but enable for Railway
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('executed query', { text, duration, rows: res.rowCount });
  return res;
}

export async function initDb() {
  const createBookingsQuery = `
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      date_string VARCHAR(20) NOT NULL,
      time_slot VARCHAR(20) NOT NULL,
      status VARCHAR(20) DEFAULT 'PENDING',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date_string, time_slot)
    );
  `;
  const createOverridesQuery = `
    CREATE TABLE IF NOT EXISTS slot_overrides (
      id SERIAL PRIMARY KEY,
      date_string VARCHAR(20) NOT NULL,
      time_slot VARCHAR(20) NOT NULL,
      override_type VARCHAR(20) NOT NULL,
      UNIQUE(date_string, time_slot)
    );
  `;
  const createInventoryQuery = `
    CREATE TABLE IF NOT EXISTS inventory (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      price DECIMAL(10,2) NOT NULL
    );
  `;
  const createSettingsQuery = `
    CREATE TABLE IF NOT EXISTS settings (
      key VARCHAR(50) PRIMARY KEY,
      value TEXT
    );
  `;
  try {
    await query(createBookingsQuery);
    await query(createOverridesQuery);
    await query(createInventoryQuery);
    await query(createSettingsQuery);
    await query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PENDING'`);
    await query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_price DECIMAL(10,2) DEFAULT 0.00`);
    await query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS billed_items TEXT`);
    console.log("Database initialized successfully.");
  } catch (err) {
    console.error("Error initializing database", err);
  }
}
