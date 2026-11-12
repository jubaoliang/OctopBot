#!/usr/bin/env node
/**
 * Walk the production dependency graph and write src/legal/licenses.json.
 * Strips author/email/url fields — no personal metadata in the artifact.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'src/legal/licenses.json');
const requireFromRoot = createRequire(join(root, 'package.json'));

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function licenseTextFor(pkgDir) {
  for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md']) {
    const path = join(pkgDir, name);
    if (!existsSync(path)) {
      continue;
    }
    try {
      return readFileSync(path, 'utf8').trim();
    } catch {
      // Try the next candidate filename.
    }
  }
  return undefined;
}

function resolvePkgDir(name, version) {
  // Prefer the install path npm reported (when present).
  // Fall back to a hoisted node_modules layout, then require.resolve.
  const candidates = [join(root, 'node_modules', ...name.split('/'))];
  for (const dir of candidates) {
    const pkgJson = join(dir, 'package.json');
    if (!existsSync(pkgJson)) {
      continue;
    }
    try {
      const pkg = readJson(pkgJson);
      if (!version || pkg.version === version) {
        return realpathSync(dir);
      }
    } catch {
      // keep looking
    }
  }
  try {
    return dirname(realpathSync(requireFromRoot.resolve(`${name}/package.json`)));
  } catch {
    return null;
  }
}

function walk(deps, seen, out) {
  if (!deps || typeof deps !== 'object') {
    return;
  }
  for (const [name, node] of Object.entries(deps)) {
    if (!node || typeof node !== 'object') {
      continue;
    }
    const version = typeof node.version === 'string' ? node.version : '';
    const key = version ? `${name}@${version}` : name;
    if (!seen.has(key)) {
      seen.add(key);
      const pkgDir =
        typeof node.path === 'string' && node.path
          ? node.path
          : resolvePkgDir(name, version || undefined);
      let license = 'UNKNOWN';
      let licenseText;
      if (pkgDir) {
        try {
          const pkg = readJson(join(pkgDir, 'package.json'));
          const raw = pkg.license;
          if (typeof raw === 'string') {
            license = raw;
          } else if (raw && typeof raw === 'object' && typeof raw.type === 'string') {
            license = raw.type;
          }
          licenseText = licenseTextFor(pkgDir);
        } catch {
          // Keep UNKNOWN when package.json is unreadable.
        }
      }
      /** @type {{ name: string; version: string; license: string; licenseText?: string }} */
      const entry = { name, version: version || 'unknown', license };
      if (licenseText) {
        entry.licenseText = licenseText;
      }
      out.push(entry);
    }
    walk(node.dependencies, seen, out);
  }
}

let raw;
try {
  raw = execFileSync('npm', ['ls', '--omit=dev', '--all', '--json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (error) {
  // npm ls exits non-zero when the tree has peer warnings; stdout is still usable.
  raw = error && typeof error === 'object' && 'stdout' in error ? String(error.stdout) : '';
  if (!raw) {
    throw error;
  }
}

const tree = JSON.parse(raw);
const out = [];
walk(tree.dependencies, new Set(), out);
out.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

const known = out.filter(e => e.license !== 'UNKNOWN' && e.version !== 'unknown');
if (known.length === 0) {
  console.error('Refusing to overwrite licenses.json: no resolved production licenses.');
  process.exit(1);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
console.log(`Wrote ${out.length} licenses (${known.length} known) → src/legal/licenses.json`);
