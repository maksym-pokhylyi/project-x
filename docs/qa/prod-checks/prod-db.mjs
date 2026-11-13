// Read-only checks against the production database over HTTPS (Neon serverless driver).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/home/user/project-x/package.json');
const { neon } = require('@neondatabase/serverless');
const which = process.argv[2] === 'staging' ? '/home/user/.secrets/neon-staging-uris.json' : '/home/user/.secrets/neon-uris.json';
const sql = neon(JSON.parse(readFileSync(which, 'utf8'))['false']);
const q = process.argv[3] || process.argv[2];
const rows = await sql.query(q.startsWith('select') || q.startsWith('SELECT') ? q : 'select 1');
console.log(JSON.stringify(rows, null, 1).slice(0, 4000));
