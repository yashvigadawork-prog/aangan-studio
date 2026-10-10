// Run with: node db/test-connection.js
// Checks that your Neon database URL in .env actually works.
import 'dotenv/config';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is empty. Open .env and paste your Neon connection string.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  const { rows } = await client.query('SELECT NOW() AS time');
  console.log('✅ Connected to Neon! Server time:', rows[0].time);
} catch (err) {
  console.error('❌ Could not connect:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
