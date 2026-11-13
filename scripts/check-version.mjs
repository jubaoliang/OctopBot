#!/usr/bin/env node
/**
 * Fail CI when package.json version and app.json expo.version drift.
 * Marketing version source of truth is app.json; package.json must match.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));

const pkgVersion = pkg.version;
const appVersion = app?.expo?.version;

if (typeof pkgVersion !== 'string' || !pkgVersion) {
  console.error('package.json is missing a string "version".');
  process.exit(1);
}
if (typeof appVersion !== 'string' || !appVersion) {
  console.error('app.json expo.version is missing.');
  process.exit(1);
}
if (pkgVersion !== appVersion) {
  console.error(
    `Version mismatch: package.json=${pkgVersion} app.json expo.version=${appVersion}. Keep them equal (see CONTRIBUTING.md).`,
  );
  process.exit(1);
}

console.log(`Versions aligned: ${pkgVersion}`);
