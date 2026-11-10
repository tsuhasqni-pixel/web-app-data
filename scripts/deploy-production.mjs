import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const required = ['GOOGLE_OAUTH_CLIENT_SECRET', 'SESSION_SECRET'];
const optional = ['STRIPE_TEST_SECRET_KEY', 'DATA_SHAPER_STRIPE_WEBHOOK_SECRET'];
const missing = required.filter((name) => !String(process.env[name] || '').trim());

if (missing.length) {
  console.error('Missing required Cloudflare Build secrets: ' + missing.join(', '));
  process.exit(1);
}

const secretsPath = join(tmpdir(), `data-shaper-secrets-${process.pid}.json`);
const forwarded = [...required, ...optional.filter((name) => String(process.env[name] || '').trim())];
const secrets = Object.fromEntries(forwarded.map((name) => [name, process.env[name]]));

try {
  writeFileSync(secretsPath, JSON.stringify(secrets), { mode: 0o600 });
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(
    npx,
    ['wrangler', 'deploy', '--secrets-file', secretsPath],
    { stdio: 'inherit', env: process.env }
  );
  process.exitCode = result.status ?? 1;
} finally {
  try { unlinkSync(secretsPath); } catch {}
}
