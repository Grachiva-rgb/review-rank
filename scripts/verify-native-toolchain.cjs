'use strict';

// Load the network/credential guard before resolving or loading application
// dependencies. Its child-process wrapper carries the guard into spawned CLIs.
require('./verification-network-guard.cjs');

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');

const appRoot = path.resolve(__dirname, '..');
const trackedProject = path.join(appRoot, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');
const expectedCapacitorCliVersion = '8.5.3';
const expectedUuidVersion = '11.1.1';
const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function packageRootFor(entryPath, packageName) {
  let current = path.dirname(entryPath);
  while (true) {
    const manifestPath = path.join(current, 'package.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (manifest.name === packageName) return { root: current, manifest };
    }
    const parent = path.dirname(current);
    if (parent === current) throw new Error(`Could not find ${packageName} package.json from ${entryPath}`);
    current = parent;
  }
}

function assertVersionAtResolution(entryPath, packageName, expectedVersion) {
  const { manifest } = packageRootFor(entryPath, packageName);
  assert.equal(
    manifest.version,
    expectedVersion,
    `${packageName} resolved for this check must be ${expectedVersion}; found ${manifest.version}`,
  );
  return manifest.version;
}

function uuidBufferCheck(generate, uuid, label, version) {
  const offset = 2;
  const buffer = Buffer.alloc(20, 0xa5);
  const result = generate(buffer, offset);
  assert.equal(result, buffer, `${label} must return the supplied buffer`);
  assert.match(result.slice(offset, offset + 16).toString('hex'), /^[0-9a-f]{32}$/);
  assert.equal(uuid.stringify(buffer, offset), result.slice(offset, offset + 16).toString('hex')
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5'));
  assert.equal((buffer[offset + 6] >> 4) & 0x0f, version, `${label} must write UUID version ${version}`);
  assert.deepEqual(buffer.subarray(0, offset), Buffer.alloc(offset, 0xa5), `${label} must preserve the prefix`);
  assert.deepEqual(buffer.subarray(offset + 16), Buffer.alloc(2, 0xa5), `${label} must preserve the suffix`);
}

function assertOutputBufferRejections(generate, label) {
  assert.throws(() => generate(Buffer.alloc(15), 0), RangeError, `${label} must reject a short output buffer`);
  assert.throws(() => generate(Buffer.alloc(16), 1), RangeError, `${label} must reject an offset without 16 bytes`);
}

function projectObjects(project, section) {
  const objects = project.hash.project.objects[section];
  assert.ok(objects && typeof objects === 'object', `Parsed project must contain ${section}`);
  return objects;
}

function entriesMatching(objects, predicate) {
  return Object.entries(objects).filter(([key, value]) => !key.endsWith('_comment') && predicate(value, key));
}

function verifyAddedSwiftLinks(xcode, projectFilePath, swiftFilename) {
  const parsed = xcode.project(projectFilePath);
  parsed.parseSync();
  const objects = parsed.hash.project.objects;
  // The pbxproj parser preserves quoted strings and represents list references
  // as { value, comment }, rather than flattening them into plain strings.
  const fileRefs = entriesMatching(projectObjects(parsed, 'PBXFileReference'), (entry) =>
    entry.path === swiftFilename || entry.path === JSON.stringify(swiftFilename));
  assert.equal(fileRefs.length, 1, 'The fake Swift file must have exactly one PBXFileReference');
  const [fileRefUuid, fileRef] = fileRefs[0];
  assert.match(fileRefUuid, /^[A-F0-9]{24}$/);
  assert.equal(fileRef.lastKnownFileType, 'sourcecode.swift');

  const buildFiles = entriesMatching(projectObjects(parsed, 'PBXBuildFile'), (entry) => entry.fileRef === fileRefUuid);
  assert.equal(buildFiles.length, 1, 'The Swift PBXFileReference must have exactly one PBXBuildFile');
  const [buildFileUuid] = buildFiles[0];
  assert.match(buildFileUuid, /^[A-F0-9]{24}$/);

  const appGroupUuid = Object.keys(projectObjects(parsed, 'PBXGroup'))
    .find((key) => key.endsWith('_comment') && objects.PBXGroup[key] === 'App')
    ?.slice(0, -'_comment'.length);
  assert.ok(appGroupUuid, 'The parsed project must contain the App PBXGroup');
  assert.ok(
    objects.PBXGroup[appGroupUuid].children.some((reference) => reference.value === fileRefUuid),
    'The App PBXGroup must contain the new file reference',
  );

  const sourcePhases = entriesMatching(projectObjects(parsed, 'PBXSourcesBuildPhase'), (entry) =>
    Array.isArray(entry.files) && entry.files.some((reference) => reference.value === buildFileUuid));
  assert.equal(sourcePhases.length, 1, 'The new PBXBuildFile must be linked from exactly one Sources phase');
  assert.ok(
    parsed.getFirstTarget().firstTarget.buildPhases.some((reference) => reference.value === sourcePhases[0][0]),
    'The Sources phase must belong to the first native target used by Capacitor',
  );
}

function verifyUuidTools(uuid) {
  for (const method of ['v3', 'v5', 'v6']) {
    const generate = method === 'v6'
      ? (buffer, offset) => uuid.v6({}, buffer, offset)
      : (buffer, offset) => uuid[method]('native-toolchain-check', namespace, buffer, offset);
    assertOutputBufferRejections(generate, `uuid.${method}`);
  }

  assertOutputBufferRejections((buffer, offset) => uuid.v4({}, buffer, offset), 'uuid.v4');
  uuidBufferCheck((buffer, offset) => uuid.v4({}, buffer, offset), uuid, 'uuid.v4', 4);
  uuidBufferCheck(
    (buffer, offset) => uuid.v3('native-toolchain-check', namespace, buffer, offset),
    uuid,
    'uuid.v3',
    3,
  );
  uuidBufferCheck(
    (buffer, offset) => uuid.v5('native-toolchain-check', namespace, buffer, offset),
    uuid,
    'uuid.v5',
    5,
  );
  uuidBufferCheck((buffer, offset) => uuid.v6({}, buffer, offset), uuid, 'uuid.v6', 6);
  console.log('PASS UUID v3/v4/v5/v6 buffer validation, offsets, and generated bytes');
}

function verifyXcodeUuidGeneration(xcodeProject) {
  const project = xcodeProject.project(trackedProject);
  project.parseSync();
  const existingIds = new Set();
  for (const section of Object.values(project.hash.project.objects)) {
    if (!section || typeof section !== 'object') continue;
    for (const key of Object.keys(section)) {
      if (/^[A-F0-9]{24}$/.test(key)) existingIds.add(key);
    }
  }

  const generatedIds = Array.from({ length: 100 }, () => project.generateUuid());
  for (const id of generatedIds) assert.match(id, /^[A-F0-9]{24}$/, 'Xcode UUIDs must be 24 uppercase hex characters');
  assert.equal(new Set(generatedIds).size, generatedIds.length, 'Repeated Xcode UUID generation must not duplicate IDs');
  for (const id of generatedIds) {
    assert.ok(!existingIds.has(id), `Generated Xcode UUID ${id} must not collide with an existing project ID`);
  }
  console.log('PASS xcode.generateUuid format, uniqueness, and collision checks');
}

function verifyCapacitorVersion(cliEntryPath) {
  const cliPackage = packageRootFor(cliEntryPath, '@capacitor/cli');
  assert.equal(cliPackage.manifest.version, expectedCapacitorCliVersion);
  const cliBin = path.join(cliPackage.root, 'bin', 'capacitor');
  assert.ok(fs.existsSync(cliBin), 'Capacitor CLI executable must be present');
  const result = spawnSync(process.execPath, [cliBin, '--version'], {
    cwd: appRoot,
    encoding: 'utf8',
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    timeout: 30000,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `Capacitor CLI --version failed: ${(result.stderr || '').trim()}`);
  assert.equal(result.stdout.trim(), expectedCapacitorCliVersion, 'Actual Capacitor CLI --version must match package version');
  console.log(`PASS actual Capacitor CLI ${expectedCapacitorCliVersion} --version (offline, no npx)`);
}

function verifySwiftRegistration(addSwiftFileToAppTarget, xcode, originalBytes) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewrank-native-toolchain-'));
  const copiedProjectPath = path.join(temporaryRoot, 'App.xcodeproj', 'project.pbxproj');
  const swiftFilename = 'NativeToolchainVerification.swift';
  try {
    fs.mkdirSync(path.dirname(copiedProjectPath), { recursive: true });
    fs.copyFileSync(trackedProject, copiedProjectPath);
    assert.deepEqual(fs.readFileSync(copiedProjectPath), originalBytes, 'Temporary project must begin as a byte-for-byte copy');

    const first = addSwiftFileToAppTarget(copiedProjectPath, 'App', swiftFilename);
    assert.deepEqual(first, { added: true }, 'First Swift registration must add the file');
    const afterFirstAdd = fs.readFileSync(copiedProjectPath);
    verifyAddedSwiftLinks(xcode, copiedProjectPath, swiftFilename);

    const second = addSwiftFileToAppTarget(copiedProjectPath, 'App', swiftFilename);
    assert.deepEqual(second, { added: false }, 'Second Swift registration must be idempotent');
    assert.deepEqual(
      fs.readFileSync(copiedProjectPath),
      afterFirstAdd,
      'Idempotent second registration must leave the temporary project bytes unchanged',
    );
    assert.deepEqual(fs.readFileSync(trackedProject), originalBytes, 'Tracked native project must remain unchanged');
    console.log('PASS real Capacitor Swift project registration, reparsing, and idempotence on an os.tmpdir copy');
  } finally {
    try {
      assert.deepEqual(fs.readFileSync(trackedProject), originalBytes, 'Tracked native project must remain unchanged');
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  }
}

function main() {
  const cliEntryPath = require.resolve('@capacitor/cli/dist/util/xcode.js', { paths: [appRoot] });
  const cliPackage = packageRootFor(cliEntryPath, '@capacitor/cli');
  assert.equal(cliPackage.manifest.version, expectedCapacitorCliVersion);
  const xcodeEntryPath = createRequire(cliEntryPath).resolve('xcode');
  const xcodeRequire = createRequire(xcodeEntryPath);
  const uuidEntryPath = xcodeRequire.resolve('uuid');

  // Check the exact xcode -> uuid resolution before loading either package.
  assertVersionAtResolution(uuidEntryPath, 'uuid', expectedUuidVersion);
  const uuid = xcodeRequire('uuid');
  const xcodeProject = xcodeRequire(xcodeEntryPath);
  verifyUuidTools(uuid);
  verifyXcodeUuidGeneration(xcodeProject);

  verifyCapacitorVersion(cliEntryPath);

  const originalBytes = fs.readFileSync(trackedProject);
  const capacitorXcodeUtil = require(cliEntryPath);
  assert.equal(typeof capacitorXcodeUtil.addSwiftFileToAppTarget, 'function');
  verifySwiftRegistration(capacitorXcodeUtil.addSwiftFileToAppTarget, xcodeProject, originalBytes);
  console.log(`PASS actual Capacitor CLI xcode utility resolved uuid ${expectedUuidVersion}`);
}

try {
  main();
} catch (error) {
  console.error(`Native toolchain verification failed: ${error.stack || error.message}`);
  process.exitCode = 1;
}
