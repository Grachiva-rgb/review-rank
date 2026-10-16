'use strict';

// Exercise the built Next server on loopback, never a deployed environment.
// The inherited build guard blanks provider/admin/database credentials before
// dotenv and rejects non-font external Node HTTP/fetch requests.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const { once } = require('node:events');

const appRoot = path.resolve(__dirname, '..');
const guardPath = path.join(__dirname, 'verification-network-guard.cjs');
const nextCli = require.resolve('next/dist/bin/next', { paths: [appRoot] });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function reservePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function main() {
  const port = await reservePort();
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [nextCli, 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: appRoot,
    env: {
      ...process.env,
      CI: '1',
      NEXT_TELEMETRY_DISABLED: '1',
      NEXT_PUBLIC_SITE_URL: 'https://verification.example.invalid',
      NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require=${JSON.stringify(guardPath)}`.trim(),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  let spawnError;
  child.on('error', (error) => { spawnError = error; });
  for (const output of [child.stdout, child.stderr]) {
    output.on('data', (chunk) => { logs = (logs + chunk.toString()).slice(-20000); });
  }
  const request = (route, options) => fetch(`${origin}${route}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(20000),
    ...options,
  });
  try {
    let home;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(`Next server exited before becoming ready (${child.exitCode ?? child.signalCode}).`);
      }
      try {
        home = await request('/');
        break;
      } catch {
        await delay(500);
      }
    }
    assert.ok(home, 'Loopback Next server must become ready');
    assert.equal(home.status, 200, 'Home page must render');
    const html = await home.text();
    assert.match(html, /ReviewRank/);
    assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
    assert.match(home.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
    console.log('PASS homepage SSR and security headers');

    // SEO paths omitted from the cache-only prerender list must still render
    // on demand. With credentials blanked, this must use the established
    // unavailable-data view, not retain the build-only quota-error condition.
    const seo = await request('/plumbers/cleveland-oh');
    assert.equal(seo.status, 200, 'An on-demand SEO route must render without provider credentials');
    const seoHtml = await seo.text();
    assert.ok(seoHtml.includes('https://verification.example.invalid/plumbers/cleveland-oh'),
      'On-demand SEO canonical metadata must remain intact');
    console.log('PASS on-demand SEO rendering and canonical metadata after cache-only build');

    const admin = await request('/admin/leads');
    assert.equal(admin.status, 503, 'Admin must fail closed without a configured secret');
    assert.match(admin.headers.get('cache-control') || '', /no-store/);
    assert.equal((await admin.json()).error, 'Admin access is not configured.');
    console.log('PASS admin proxy fails closed with no-store headers');

    // One character returns before either cache/database access or Google calls.
    const suggestions = await request('/api/location-autocomplete?q=a');
    assert.equal(suggestions.status, 200);
    assert.deepEqual(await suggestions.json(), []);
    assert.match(suggestions.headers.get('cache-control') || '', /no-store/);
    console.log('PASS short-input autocomplete and API no-store headers');

    const staticPath = html.match(/src="(\/_next\/static\/[^"]+)"/)?.[1];
    assert.ok(staticPath, 'Home page must reference a local Next static script');
    const asset = await request(staticPath, { method: 'HEAD' });
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('cache-control') || '', /max-age=31536000/);
    assert.match(asset.headers.get('cache-control') || '', /immutable/);
    console.log('PASS content-hashed static asset caching');
  } catch (error) {
    console.error(logs);
    throw error;
  } finally {
    if (!spawnError && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      const killTimer = setTimeout(() => child.kill('SIGKILL'), 5000);
      await exited;
      clearTimeout(killTimer);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
