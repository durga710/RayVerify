/**
 * Applies the physical-layer SQL (partitioning, RLS, immutability + audit
 * hash-chain triggers) that Prisma migrations don't manage. Run AFTER
 * `prisma migrate deploy`. Idempotent-ish: wrap in a transaction and tolerate
 * "already exists" by running against a fresh DB in CI.
 *
 * In production this is split into ordered, versioned SQL migrations; this
 * helper keeps local/dev simple.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const sqlPath = path.resolve(__dirname, '../../../db/schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    console.log('[apply-sql] applying db/schema.sql physical layer…');
    await client.query(sql);
    console.log('[apply-sql] done.');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('[apply-sql] failed:', e.message);
  process.exit(1);
});
