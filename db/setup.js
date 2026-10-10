// Run with: npm run db:setup
// Creates the tables from db/schema.sql in your Neon database.
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const sql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query(sql);
  const { rows } = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1"
  );
  console.log('✅ Tables ready:', rows.map((r) => r.table_name).join(', '));
} catch (err) {
  console.error('❌ Setup failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
