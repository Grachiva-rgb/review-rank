'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const appRoot = path.resolve(__dirname, '..');
const guardPath = path.resolve(__dirname, 'verification-network-guard.cjs');
let nextCliPath;
try {
  nextCliPath = require.resolve('next/dist/bin/next', { paths: [appRoot] });
} catch {
  process.stderr.write('Installed Next.js CLI was not found in this app.\n');
  process.exit(1);
}

function nodeOptionsWithGuard(existingOptions) {
  const options = existingOptions || '';
  if (options.includes(guardPath)) return options;
  return `${options} --require=${JSON.stringify(guardPath)}`.trim();
}

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: appRoot,
    env,
    stdio: 'inherit',
  });
  if (result.error) {
    process.stderr.write(`Unable to start verification command: ${result.error.message}\n`);
    process.exitCode = 1;
    return false;
  }
  if (result.status !== 0) {
    process.exitCode = result.status === null ? 1 : result.status;
    return false;
  }
  return true;
}

const verificationEnvironment = {
  ...process.env,
  // Match CI and fail rather than prompting or auto-installing missing tooling.
  CI: '1',
  REVIEWRANK_VERIFY_BUILD: '1',
  NEXT_TELEMETRY_DISABLED: '1',
  NODE_OPTIONS: nodeOptionsWithGuard(process.env.NODE_OPTIONS),
};

const selfTestInvocation = `require(${JSON.stringify(guardPath)}).runSelfTest()`;
if (!run(process.execPath, ['-e', selfTestInvocation], verificationEnvironment)) {
  process.exit(process.exitCode || 1);
}

// Keep the established Webpack build instead of combining the dependency
// remediation with Next 16's separate default-Turbopack migration.
if (!run(process.execPath, [nextCliPath, 'build', '--webpack'], verificationEnvironment)) {
  process.exit(process.exitCode || 1);
}
