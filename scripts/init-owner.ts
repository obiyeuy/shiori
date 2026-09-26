import { createDbPool } from '../src/lib/server/db/client.js';
import { initializeOwner } from '../src/lib/server/auth/service.js';

const password = process.env.OWNER_PASSWORD;
if (!password) throw new Error('OWNER_PASSWORD must be supplied to the one-time local initialization command');
const pool = createDbPool();
try {
  await initializeOwner(pool, { password, githubNumericId: process.env.GITHUB_OWNER_ID });
  console.log('Owner initialized. Remove OWNER_PASSWORD from the shell environment.');
} finally {
  await pool.end();
}
