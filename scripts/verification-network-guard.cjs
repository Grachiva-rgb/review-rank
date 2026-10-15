'use strict';

const path = require('node:path');
const { URL } = require('node:url');
const childProcess = require('node:child_process');

// Explicitly define these even when the caller did not provide them. dotenv
// does not override a key that is already present in process.env, including an
// empty value, so credentials in an app .env file remain disabled.
const protectedEnvironmentKeys = [
  'GOOGLE_PLACES_API_KEY',
  'TRIPADVISOR_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'RESEND_FROM_ADDRESS',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'UPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_POSTHOG_KEY',
  'ADMIN_SECRET',
  'CRON_SECRET',
];

const providerCredentialName = /(?:GOOGLE.*(?:API.*KEY|PLACE|MAPS)|TRIPADVISOR|STRIPE|RESEND|SUPABASE|UPABASE|POSTHOG|ADMIN.*SECRET|CRON.*SECRET|CF_ANALYTICS_TOKEN)/i;
for (const key of protectedEnvironmentKeys) process.env[key] = '';
for (const key of Object.keys(process.env)) {
  if (providerCredentialName.test(key)) process.env[key] = '';
}
process.env.NEXT_TELEMETRY_DISABLED = '1';

function normalizedHostname(value) {
  return String(value || '').toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

function isAllowedDestination(destination, protocol) {
  let url;
  try {
    url = destination instanceof URL ? destination : new URL(String(destination));
  } catch {
    return false;
  }
  const scheme = protocol || url.protocol;
  if (scheme !== 'http:' && scheme !== 'https:') return false;
  const host = normalizedHostname(url.hostname);
  return host === 'localhost'
    || host === '127.0.0.1'
    || host === '::1'
    || host === 'fonts.googleapis.com'
    || host === 'fonts.gstatic.com';
}

function blockedError() {
  const error = new Error('Outbound network request blocked by verification guard');
  error.code = 'ERR_DEPENDENCY_NETWORK_BLOCKED';
  return error;
}

function fetchDestination(input) {
  if (input instanceof URL) return input;
  if (typeof input === 'string') {
    try {
      return new URL(input);
    } catch {
      return null;
    }
  }
  if (input && typeof input.url === 'string') {
    try {
      return new URL(input.url);
    } catch {
      return null;
    }
  }
  return null;
}

if (typeof globalThis.fetch === 'function') {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = function guardedFetch(input, init) {
    const destination = fetchDestination(input);
    if (!destination || !isAllowedDestination(destination)) {
      return Promise.reject(blockedError());
    }
    // Node fetch follows redirects internally, bypassing this guard. Keep
    // redirects manual to prevent an allowed origin redirecting off-policy.
    return originalFetch.call(this, input, { ...init, redirect: 'manual' });
  };
}

function httpDestination(args) {
  const first = args[0];
  const second = args[1];
  const options = first && typeof first === 'object' && !(first instanceof URL)
    ? first
    : second && typeof second === 'object'
      ? second
      : null;
  if (options && options.socketPath) return { socketPath: true };
  if (first instanceof URL || typeof first === 'string') {
    try {
      return new URL(String(first));
    } catch {
      // Host/protocol options may accompany a non-URL path.
    }
  }
  if (options) {
    const protocol = options.protocol || 'http:';
    const hostname = options.hostname || options.host || 'localhost';
    try {
      return new URL(`${protocol}//${hostname}`);
    } catch {
      return null;
    }
  }
  return null;
}

function guardHttpModule(moduleName) {
  const httpModule = require(moduleName);
  for (const method of ['request', 'get']) {
    const original = httpModule[method];
    if (typeof original !== 'function') continue;
    httpModule[method] = function guardedRequest(...args) {
      const destination = httpDestination(args);
      if (!destination || (!destination.socketPath && !isAllowedDestination(destination))) {
        throw blockedError();
      }
      return original.apply(this, args);
    };
  }
}

guardHttpModule('node:http');
guardHttpModule('node:https');

function childOptionsIndex(method, args) {
  if (method === 'exec' || method === 'execSync') {
    return typeof args[1] === 'object' ? 1 : -1;
  }
  if (method === 'spawn' || method === 'spawnSync' || method === 'fork'
      || method === 'execFile' || method === 'execFileSync') {
    return Array.isArray(args[1])
      ? (typeof args[2] === 'object' ? 2 : -1)
      : (typeof args[1] === 'object' ? 1 : -1);
  }
  return -1;
}

function childArguments(method, originalArgs) {
  const args = Array.from(originalArgs);
  let index = childOptionsIndex(method, args);
  if (index < 0) {
    index = method === 'exec' || method === 'execSync'
      ? 1
      : (Array.isArray(args[1]) ? 2 : 1);
    args.splice(index, 0, {});
  }
  const options = { ...args[index] };
  const env = options.env ? { ...options.env } : { ...process.env };
  for (const key of Object.keys(env)) {
    if (providerCredentialName.test(key)) env[key] = '';
  }
  for (const key of protectedEnvironmentKeys) env[key] = '';
  env.NEXT_TELEMETRY_DISABLED = '1';
  const requireOption = `--require=${__filename}`;
  const nodeOptions = env.NODE_OPTIONS || '';
  if (!nodeOptions.includes(__filename)) {
    env.NODE_OPTIONS = `${nodeOptions} ${requireOption}`.trim();
  }
  options.env = env;
  args[index] = options;
  return args;
}

for (const method of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {
  const original = childProcess[method];
  if (typeof original !== 'function') continue;
  childProcess[method] = function guardedChildProcess(...args) {
    return original.apply(this, childArguments(method, args));
  };
}

module.exports = { isAllowedDestination };

function runSelfTest() {
  const guardPath = __filename;
  const childScript = `
    const guard = require(${JSON.stringify(guardPath)});
    const keys = ${JSON.stringify(protectedEnvironmentKeys)};
    for (const key of keys) {
      if (process.env[key] !== '') throw new Error('Protected environment key was not blanked');
    }
    if (process.env.NEXT_TELEMETRY_DISABLED !== '1') {
      throw new Error('Telemetry was not disabled');
    }
    for (const target of [
      'http://localhost:3000/',
      'http://127.0.0.1/',
      'http://[::1]/',
      'https://fonts.googleapis.com/css',
      'https://fonts.gstatic.com/font.woff2'
    ]) {
      if (!guard.isAllowedDestination(target)) throw new Error('Expected allow-listed destination');
    }
    if (guard.isAllowedDestination('https://example.com/')) {
      throw new Error('Unexpected allow-listed destination');
    }
    for (const name of ['node:http', 'node:https']) {
      let blocked = false;
      try { require(name).request('https://example.com/'); }
      catch (error) { blocked = error.code === 'ERR_DEPENDENCY_NETWORK_BLOCKED'; }
      if (!blocked) throw new Error('HTTP request was not blocked');
    }
    (async () => {
      try {
        await fetch('https://example.com/');
        throw new Error('Fetch was not blocked');
      } catch (error) {
        if (error.code !== 'ERR_DEPENDENCY_NETWORK_BLOCKED') throw error;
      }
    })().catch((error) => {
      process.stderr.write(error.message + '\\n');
      process.exitCode = 1;
    });
  `;
  const testEnvironment = { ...process.env };
  for (const key of protectedEnvironmentKeys) testEnvironment[key] = 'self-test-only';

  const result = childProcess.spawnSync(process.execPath, ['-r', guardPath, '-e', childScript], {
    cwd: path.resolve(__dirname, '..'),
    env: testEnvironment,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Verification network guard self-test failed (exit ${result.status})`);
  }
  process.stdout.write('verification network guard self-test passed\n');
}

module.exports.runSelfTest = runSelfTest;

if (require.main === module && process.argv[2] === '--self-test') {
  try {
    runSelfTest();
  } catch (error) {
    process.stderr.write(`verification network guard self-test failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
